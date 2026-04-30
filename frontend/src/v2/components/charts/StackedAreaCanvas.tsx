import React, { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../../utils/walletUtils';
import s from './ChartView.module.css';

export interface StackedSeries {
  key: string;
  label: string;
  color: string;
}

export interface StackedPoint {
  date: string;
  values: Record<string, number>;
}

interface Props {
  points: StackedPoint[];
  series: StackedSeries[];
  loading?: boolean;
  height?: number;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 60 };

function fmtAxis(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function indexFromX(canvas: HTMLCanvasElement, mouseX: number, n: number): number | null {
  if (n <= 0) return null;
  const w = canvas.offsetWidth;
  const cw = w - PAD.left - PAD.right;
  if (mouseX < PAD.left || mouseX > w - PAD.right) return null;
  if (n === 1) return 0;
  const relX = mouseX - PAD.left;
  return Math.max(0, Math.min(n - 1, Math.round((relX / cw) * (n - 1))));
}

function draw(canvas: HTMLCanvasElement, points: StackedPoint[], series: StackedSeries[], hoverIndex?: number | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const N = points.length;
  if (N < 1) return;

  let maxVal = 0, minVal = 0;
  points.forEach(p => {
    let posSum = 0, negSum = 0;
    series.forEach(sr => {
      const v = p.values[sr.key] ?? 0;
      if (v >= 0) posSum += v; else negSum += v;
    });
    maxVal = Math.max(maxVal, posSum);
    minVal = Math.min(minVal, negSum);
  });

  const max = Math.max(1, maxVal) * 1.05;
  const min = minVal < 0 ? minVal * 1.05 : 0;

  const pad = PAD;
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const styles = getComputedStyle(document.documentElement);
  const labelColor = styles.getPropertyValue('--v2-muted').trim() || '#64748b';
  const gridColor = styles.getPropertyValue('--v2-border-sub').trim() || 'rgba(127,127,127,0.15)';

  const px = (i: number) => pad.left + (N === 1 ? cw / 2 : (i / (N - 1)) * cw);
  const py = (v: number) => pad.top + (1 - (v - min) / (max - min)) * ch;

  ctx.fillStyle = labelColor;
  ctx.font = '10px system-ui';
  ctx.textAlign = 'right';
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const v = min + (i / ySteps) * (max - min);
    const y = py(v);
    ctx.fillText(fmtAxis(v), pad.left - 6, y + 4);
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
  }

  if (min < 0) {
    const zy = py(0);
    ctx.beginPath();
    ctx.strokeStyle = labelColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    ctx.moveTo(pad.left, zy);
    ctx.lineTo(pad.left + cw, zy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const posCum = new Array(N).fill(0);
  const negCum = new Array(N).fill(0);

  const drawBand = (topArr: number[], botArr: number[], color: string) => {
    if (N === 1) {
      const yTop = py(topArr[0]);
      const yBot = py(botArr[0]);
      const bandH = Math.abs(yBot - yTop);
      if (bandH < 1) return;
      ctx.fillStyle = color + 'b8';
      ctx.fillRect(pad.left, Math.min(yTop, yBot), cw, bandH);
      ctx.beginPath();
      ctx.moveTo(pad.left, yTop);
      ctx.lineTo(pad.left + cw, yTop);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(px(0), py(topArr[0]));
    for (let i = 1; i < N; i++) {
      const cp1x = px(i - 1) + (px(i) - px(i - 1)) / 2;
      ctx.bezierCurveTo(cp1x, py(topArr[i - 1]), cp1x, py(topArr[i]), px(i), py(topArr[i]));
    }
    for (let i = N - 1; i >= 0; i--) {
      const cp1x = i > 0 ? px(i - 1) + (px(i) - px(i - 1)) / 2 : px(i);
      if (i === N - 1) {
        ctx.lineTo(px(i), py(botArr[i]));
      } else {
        ctx.bezierCurveTo(cp1x, py(botArr[i + 1]), cp1x, py(botArr[i]), px(i), py(botArr[i]));
      }
    }
    ctx.closePath();
    ctx.fillStyle = color + 'b8';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(px(0), py(topArr[0]));
    for (let i = 1; i < N; i++) {
      const cp1x = px(i - 1) + (px(i) - px(i - 1)) / 2;
      ctx.bezierCurveTo(cp1x, py(topArr[i - 1]), cp1x, py(topArr[i]), px(i), py(topArr[i]));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  series.forEach(sr => {
    const vals = points.map(p => p.values[sr.key] ?? 0);
    const topArr = vals.map((v, i) => v >= 0 ? posCum[i] + v : negCum[i]);
    const botArr = vals.map((v, i) => v >= 0 ? posCum[i] : negCum[i] + v);
    drawBand(topArr, botArr, sr.color);
    vals.forEach((v, i) => { if (v >= 0) posCum[i] += v; else negCum[i] += v; });
  });

  ctx.fillStyle = labelColor;
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  if (N === 1) {
    const d = new Date(points[0].date);
    ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, pad.left + cw / 2, h - pad.bottom + 14);
  } else {
    const step = Math.max(1, Math.floor(N / 6));
    for (let i = 0; i < N; i += step) {
      const d = new Date(points[i].date);
      ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, px(i), h - pad.bottom + 14);
    }
  }

  if (hoverIndex != null && hoverIndex >= 0 && hoverIndex < N) {
    const hx = px(hoverIndex);
    const bgCard = styles.getPropertyValue('--v2-bg-card').trim() || '#131826';

    ctx.beginPath();
    ctx.strokeStyle = labelColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(hx, pad.top);
    ctx.lineTo(hx, h - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    if (N === 1 && hoverIndex === 0) return;

    let posAcc = 0, negAcc = 0;
    series.forEach(sr => {
      const v = points[hoverIndex].values[sr.key] ?? 0;
      const dotY = v >= 0 ? py(posAcc + v) : py(negAcc + v);
      if (v >= 0) posAcc += v; else negAcc += v;
      ctx.beginPath();
      ctx.arc(hx, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle = sr.color;
      ctx.fill();
      ctx.strokeStyle = bgCard;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
}

export const StackedAreaCanvas: React.FC<Props> = ({ points, series, loading, height = 220 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<() => void>();
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  renderRef.current = () => {
    const canvas = ref.current;
    if (!canvas || points.length < 1) return;
    draw(canvas, points, series, hover?.index ?? null);
  };

  useEffect(() => { renderRef.current?.(); }, [points, series, hover]);

  useEffect(() => {
    const onResize = () => renderRef.current?.();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const idx = indexFromX(canvas, mx, points.length);
    if (idx == null) setHover(null);
    else setHover({ index: idx, x: mx, y: my });
  };

  if (points.length < 1) {
    return (
      <div className={s.lineEmpty} style={{ height }}>
        {loading ? 'Loading history…' : 'Not enough history yet — check back tomorrow.'}
      </div>
    );
  }

  const hp = hover ? points[hover.index] : null;
  const w = ref.current?.offsetWidth ?? 0;
  const tooltipRight = hover && hover.x > w / 2;
  const total = hp ? series.reduce((sum, sr) => sum + (hp.values[sr.key] ?? 0), 0) : 0;

  return (
    <div>
      <div className={s.canvasWrap}>
        <canvas
          ref={ref}
          className={s.lineCanvas}
          style={{ height }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {hover && hp && (
          <div
            className={s.chartTooltip}
            style={tooltipRight
              ? { right: w - hover.x + 12, top: hover.y - 10 }
              : { left: hover.x + 12, top: hover.y - 10 }}
          >
            <div className={s.ttDate}>{hp.date}</div>
            <div className={s.ttSeries}>
              {series.map(sr => {
                const v = hp.values[sr.key] ?? 0;
                if (v === 0) return null;
                return (
                  <div key={sr.key} className={s.ttSeriesRow}>
                    <span className={s.ttSeriesDot} style={{ background: sr.color }} />
                    <span className={s.ttSeriesLabel}>{sr.label}</span>
                    <span className={s.ttSeriesVal} style={{ color: v < 0 ? 'var(--v2-red)' : undefined }}>
                      {v < 0 ? '-' : ''}{formatPrice(Math.abs(v))}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={s.ttTotal}>
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        )}
      </div>
      <div className={s.stackLegend}>
        {series.map(sr => (
          <span key={sr.key} className={s.stackLegendItem}>
            <span className={s.stackLegendDot} style={{ background: sr.color }} />
            {sr.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default StackedAreaCanvas;
