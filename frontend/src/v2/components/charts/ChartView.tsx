import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { formatPrice } from '../../../utils/walletUtils';
import type { V2Breakdown } from '../../utils/breakdown';
import { api } from '../../../config/api';
import MaskedValue from '../shared/MaskedValue';

import Donut, { type DonutSegment } from './Donut';
import AllocationDonut from './AllocationDonut';
import Gauge from './Gauge';
import Bullet from './Bullet';
import StackedAreaCanvas, { type StackedPoint, type StackedSeries } from './StackedAreaCanvas';

import s from './ChartView.module.css';

interface SnapshotSummary {
  byProtocol?: Record<string, number>;
  byChain?: Record<string, number>;
  byPositionType?: Record<string, number>;
  byProtocolPositionType?: Record<string, Record<string, number>>;
  walletValueUsd?: number;
  suppliedValueUsd?: number;
  borrowedValueUsd?: number;
  poolsValueUsd?: number;
  stakingValueUsd?: number;
  netWorthUsd?: number;
  positionCount?: number;
}

interface HistoryPoint {
  date: string;
  totalValueUsd: number;
  dailyPnl: number;
  dailyPnlPercent?: number;
  summary?: SnapshotSummary;
}

const HISTORY_DAYS = 90;
const COLORS = [
  '#14b8a6',
  '#45b773',
  '#f59e0b',
  '#a78bfa',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#22c55e',
];

interface Props {
  walletTokens: any[];
  lendingItems: any[];
  poolItems: any[];
  stakingItems: any[];
  breakdown: V2Breakdown;
  walletGroupId?: string;
}

const CHART_PAD = { top: 16, right: 16, bottom: 28, left: 60 };

function indexFromX(canvas: HTMLCanvasElement, mouseX: number, n: number): number | null {
  if (n <= 0) return null;
  const w = canvas.offsetWidth;
  const cw = w - CHART_PAD.left - CHART_PAD.right;
  if (mouseX < CHART_PAD.left || mouseX > w - CHART_PAD.right) return null;
  if (n === 1) return 0;
  const relX = mouseX - CHART_PAD.left;
  return Math.max(0, Math.min(n - 1, Math.round((relX / cw) * (n - 1))));
}

function drawLineChart(
  canvas: HTMLCanvasElement,
  values: number[],
  labels: string[],
  color: string,
  hoverIndex?: number | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const points = values.length;
  if (points < 1) return;

  const onlyOne = points === 1;
  const baseMax = Math.max(...values);
  const baseMin = Math.min(...values);
  const max = onlyOne ? baseMax * 1.1 || 1 : baseMax * 1.05;
  const min = onlyOne ? Math.max(0, baseMin * 0.9) : baseMin * 0.95;

  const pad = CHART_PAD;
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const px = (i: number) => pad.left + (onlyOne ? cw : (i / (points - 1)) * cw);
  const py = (v: number) =>
    max === min ? pad.top + ch / 2 : pad.top + (1 - (v - min) / (max - min)) * ch;

  const styles = getComputedStyle(document.documentElement);
  const labelColor = styles.getPropertyValue('--v2-muted').trim() || '#64748b';
  const gridColor = styles.getPropertyValue('--v2-border-sub').trim() || 'rgba(127,127,127,0.15)';

  const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
  grad.addColorStop(0, color + '4d');
  grad.addColorStop(1, color + '00');

  if (onlyOne) {
    const y = py(values[0]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.lineTo(pad.left + cw, h - pad.bottom);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(px(0), y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(px(0), py(values[0]));
    for (let i = 1; i < points; i++) {
      const cp1x = px(i - 1) + (px(i) - px(i - 1)) / 2;
      ctx.bezierCurveTo(cp1x, py(values[i - 1]), cp1x, py(values[i]), px(i), py(values[i]));
    }
    ctx.lineTo(px(points - 1), h - pad.bottom);
    ctx.lineTo(px(0), h - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(px(0), py(values[0]));
    for (let i = 1; i < points; i++) {
      const cp1x = px(i - 1) + (px(i) - px(i - 1)) / 2;
      ctx.bezierCurveTo(cp1x, py(values[i - 1]), cp1x, py(values[i]), px(i), py(values[i]));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = labelColor;
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  if (onlyOne) {
    ctx.fillText(labels[0], px(0), h - pad.bottom + 14);
  } else {
    const step = Math.max(1, Math.floor(points / 6));
    for (let i = 0; i < points; i += step) {
      ctx.fillText(labels[i], px(i), h - pad.bottom + 14);
    }
  }

  ctx.textAlign = 'right';
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const v = min + (i / ySteps) * (max - min);
    const y = py(v);
    const label =
      v >= 1_000_000
        ? `$${(v / 1_000_000).toFixed(1)}M`
        : v >= 1000
          ? `$${(v / 1000).toFixed(0)}k`
          : `$${v.toFixed(0)}`;
    ctx.fillText(label, pad.left - 6, y + 4);
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
  }

  if (hoverIndex != null && hoverIndex >= 0 && hoverIndex < points) {
    const hx = px(hoverIndex);
    const hy = py(values[hoverIndex]);
    const bgCard = styles.getPropertyValue('--v2-bg-card').trim() || '#131826';

    ctx.beginPath();
    ctx.strokeStyle = labelColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(hx, pad.top);
    ctx.lineTo(hx, h - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = bgCard;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

const LineChart: React.FC<{
  history: HistoryPoint[] | null;
  loading: boolean;
  liveTotal?: number;
}> = ({ history, loading, liveTotal }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<() => void>();
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const merged = useMemo<HistoryPoint[]>(() => {
    const base = history ? [...history] : [];
    if (typeof liveTotal === 'number' && isFinite(liveTotal) && liveTotal > 0) {
      const today = new Date().toISOString().slice(0, 10);
      if (base.length > 0 && base[base.length - 1].date === today) {
        base[base.length - 1] = { ...base[base.length - 1], totalValueUsd: liveTotal };
      } else {
        const prev = base.length > 0 ? base[base.length - 1].totalValueUsd : liveTotal;
        base.push({ date: today, totalValueUsd: liveTotal, dailyPnl: liveTotal - prev });
      }
    }
    return base;
  }, [history, liveTotal]);

  const ready = merged.length >= 1;

  const { values, labels } = useMemo(() => {
    if (!ready) return { values: [], labels: [] };
    return {
      values: merged.map((p) => p.totalValueUsd),
      labels: merged.map((p) => {
        const d = new Date(p.date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
    };
  }, [merged, ready]);

  renderRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    drawLineChart(canvas, values, labels, '#22c55e', hover?.index ?? null);
  };

  useEffect(() => {
    renderRef.current?.();
  }, [values, labels, ready, hover]);

  useEffect(() => {
    const onResize = () => renderRef.current?.();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const idx = indexFromX(canvas, mx, values.length);
    if (idx == null) setHover(null);
    else setHover({ index: idx, x: mx, y: my });
  };

  if (!ready) {
    return (
      <div className={s.lineEmpty}>
        {loading ? 'Loading history…' : 'Not enough history yet — check back tomorrow.'}
      </div>
    );
  }

  const hp = hover ? merged[hover.index] : null;
  const w = canvasRef.current?.offsetWidth ?? 0;
  const tooltipRight = hover && hover.x > w / 2;

  return (
    <div className={s.canvasWrap}>
      <canvas
        ref={canvasRef}
        className={s.lineCanvas}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      />
      {hover && hp && (
        <div
          className={s.chartTooltip}
          style={
            tooltipRight
              ? { right: w - hover.x + 12, top: hover.y - 10 }
              : { left: hover.x + 12, top: hover.y - 10 }
          }
        >
          <div className={s.ttDate}>{hp.date}</div>
          <div className={s.ttValue}>{formatPrice(hp.totalValueUsd)}</div>
          {hp.dailyPnl !== 0 && isFinite(hp.dailyPnl) && (
            <div className={`${s.ttPnl} ${hp.dailyPnl > 0 ? s.ttPos : s.ttNeg}`}>
              {hp.dailyPnl > 0 ? '+' : '−'}
              {formatPrice(Math.abs(hp.dailyPnl))}
              {hp.dailyPnlPercent != null &&
                isFinite(hp.dailyPnlPercent) &&
                hp.dailyPnlPercent !== 0 && (
                  <span className={s.ttPct}>
                    {' '}
                    ({hp.dailyPnlPercent > 0 ? '+' : ''}
                    {hp.dailyPnlPercent.toFixed(2)}%)
                  </span>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface HeatCell {
  date: string;
  col: number;
  row: number;
  point: HistoryPoint | null;
}

const HCELL_H = 20;
const HGAP = 4;
const HSTRIDE_H = HCELL_H + HGAP;
const HPAD = { top: 20, left: 24, right: 8, bottom: 8 };

function heatColor(pnl: number, maxAbs: number): string {
  const t = maxAbs > 0 ? Math.min(1, Math.abs(pnl) / maxAbs) : 0;
  const a = +(0.2 + 0.8 * t).toFixed(2);
  return pnl >= 0 ? `rgba(34,197,94,${a})` : `rgba(239,68,68,${a})`;
}

const PnLHeatmap: React.FC<{ history: HistoryPoint[] | null; loading: boolean }> = ({
  history,
  loading,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const strideRef = useRef({ w: HSTRIDE_H, h: HSTRIDE_H });
  const [hover, setHover] = useState<{ cell: HeatCell; x: number; y: number } | null>(null);

  const { cells, maxAbs, numCols, stats } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pnlMap: Record<string, HistoryPoint> = {};
    (history ?? []).forEach((p) => {
      pnlMap[p.date] = p;
    });

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const result: HeatCell[] = [];
    let col = 0;
    const d = new Date(startDate);
    while (d <= today) {
      for (let row = 0; row < 7 && d <= today; row++) {
        const dateStr = d.toISOString().slice(0, 10);
        result.push({ date: dateStr, col, row, point: pnlMap[dateStr] ?? null });
        d.setDate(d.getDate() + 1);
      }
      col++;
    }

    const withPnl = result.filter(
      (c) => c.point && isFinite(c.point.dailyPnl) && c.point.dailyPnl !== 0
    );
    const maxA = Math.max(0, ...withPnl.map((c) => Math.abs(c.point!.dailyPnl)));
    const positive = withPnl.filter((c) => c.point!.dailyPnl > 0);
    const best = withPnl.reduce<HistoryPoint | null>(
      (acc, c) => (!acc || c.point!.dailyPnl > acc.dailyPnl ? c.point! : acc),
      null
    );
    const worst = withPnl.reduce<HistoryPoint | null>(
      (acc, c) => (!acc || c.point!.dailyPnl < acc.dailyPnl ? c.point! : acc),
      null
    );
    const totalPnl = withPnl.reduce((sum, c) => sum + c.point!.dailyPnl, 0);

    return {
      cells: result,
      maxAbs: maxA,
      numCols: col,
      stats: {
        totalPnl,
        winRate: withPnl.length > 0 ? (positive.length / withPnl.length) * 100 : null,
        best,
        worst,
      },
    };
  }, [history]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const st = getComputedStyle(document.documentElement);

    const containerW = wrap.offsetWidth;
    const availW = containerW - HPAD.left - HPAD.right;
    const cellH = HCELL_H;
    const strideH = cellH + HGAP;
    const strideW = numCols > 0 ? availW / numCols : strideH;
    const cellW = strideW - HGAP;
    strideRef.current = { w: strideW, h: strideH };

    const w = containerW;
    const h = HPAD.top + 7 * strideH - HGAP + HPAD.bottom;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const empty = st.getPropertyValue('--v2-bg-hover').trim() || '#1e293b';
    const labelCol = st.getPropertyValue('--v2-muted').trim() || '#64748b';
    const MONTHS = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    ctx.fillStyle = labelCol;
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    DAY_LABELS.forEach((l, i) => {
      if (i === 0 || i === 2 || i === 4 || i === 6) return;
      ctx.fillText(l, HPAD.left - 5, HPAD.top + i * strideH + cellH - 1);
    });

    ctx.textAlign = 'left';
    let lastMonth = -1;
    cells
      .filter((c) => c.row === 0)
      .forEach((c) => {
        const m = new Date(c.date + 'T00:00:00').getMonth();
        if (m !== lastMonth) {
          lastMonth = m;
          ctx.fillText(MONTHS[m], HPAD.left + c.col * strideW, HPAD.top - 6);
        }
      });

    cells.forEach((c) => {
      const x = HPAD.left + c.col * strideW;
      const y = HPAD.top + c.row * strideH;
      const hasData = c.point != null && isFinite(c.point.dailyPnl) && c.point.dailyPnl !== 0;
      const r = Math.max(2, Math.floor(Math.min(cellW, cellH) * 0.12));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + cellW - r, y);
      ctx.quadraticCurveTo(x + cellW, y, x + cellW, y + r);
      ctx.lineTo(x + cellW, y + cellH - r);
      ctx.quadraticCurveTo(x + cellW, y + cellH, x + cellW - r, y + cellH);
      ctx.lineTo(x + r, y + cellH);
      ctx.quadraticCurveTo(x, y + cellH, x, y + cellH - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      if (hasData) {
        ctx.fillStyle = heatColor(c.point!.dailyPnl, maxAbs);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = labelCol;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }, [cells, maxAbs, numCols]);

  useEffect(() => {
    draw();
  }, [draw]);
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { w: strideW, h: strideH } = strideRef.current;
    const col = Math.floor((mx - HPAD.left) / strideW);
    const row = Math.floor((my - HPAD.top) / strideH);
    const cell = cells.find((c) => c.col === col && c.row === row);
    setHover(cell ? { cell, x: mx, y: my } : null);
  };

  if (loading) return <div className={s.lineEmpty}>Loading history…</div>;
  if (!history || history.length === 0)
    return <div className={s.lineEmpty}>Not enough history yet.</div>;

  const hp = hover?.cell;
  const canvasW = canvasRef.current?.offsetWidth ?? 0;
  const tooltipRight = hover && hover.x > canvasW / 2;

  return (
    <div className={s.heatmapWrap}>
      <div ref={wrapRef} className={s.heatmapScroll}>
        <canvas
          ref={canvasRef}
          className={s.heatmapCanvas}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {hover && hp && (
          <div
            className={s.chartTooltip}
            style={
              tooltipRight
                ? { right: canvasW - hover.x + 12, top: hover.y - 10 }
                : { left: hover.x + 12, top: hover.y - 10 }
            }
          >
            <div className={s.ttDate}>{hp.date}</div>
            {hp.point && isFinite(hp.point.dailyPnl) && hp.point.dailyPnl !== 0 ? (
              <div className={`${s.ttPnl} ${hp.point.dailyPnl > 0 ? s.ttPos : s.ttNeg}`}>
                {hp.point.dailyPnl > 0 ? '+' : '−'}
                {formatPrice(Math.abs(hp.point.dailyPnl))}
                {hp.point.dailyPnlPercent != null &&
                  isFinite(hp.point.dailyPnlPercent) &&
                  hp.point.dailyPnlPercent !== 0 && (
                    <span className={s.ttPct}>
                      {' '}
                      ({hp.point.dailyPnlPercent > 0 ? '+' : ''}
                      {hp.point.dailyPnlPercent.toFixed(2)}%)
                    </span>
                  )}
              </div>
            ) : (
              <div className={s.ttNoData}>No data</div>
            )}
          </div>
        )}
      </div>
      <div className={s.heatFooter}>
        <div className={s.heatStats}>
          <div className={s.heatStat}>
            <span className={s.heatStatLabel}>90d PnL</span>
            <span
              className={s.heatStatVal}
              style={{ color: stats.totalPnl >= 0 ? 'var(--v2-green)' : 'var(--v2-red)' }}
            >
              {stats.totalPnl >= 0 ? '+' : '−'}
              {formatPrice(Math.abs(stats.totalPnl))}
            </span>
          </div>
          {stats.winRate != null && (
            <div className={s.heatStat}>
              <span className={s.heatStatLabel}>Win rate</span>
              <span className={s.heatStatVal}>{stats.winRate.toFixed(0)}%</span>
            </div>
          )}
          {stats.best && (
            <div className={s.heatStat}>
              <span className={s.heatStatLabel}>Best day</span>
              <span className={s.heatStatVal} style={{ color: 'var(--v2-green)' }}>
                +{formatPrice(stats.best.dailyPnl)}
              </span>
            </div>
          )}
          {stats.worst && (
            <div className={s.heatStat}>
              <span className={s.heatStatLabel}>Worst day</span>
              <span className={s.heatStatVal} style={{ color: 'var(--v2-red)' }}>
                −{formatPrice(Math.abs(stats.worst.dailyPnl))}
              </span>
            </div>
          )}
        </div>
        <div className={s.heatLegend}>
          <span className={s.heatLegendLabel}>Less</span>
          {[0.2, 0.45, 0.7, 1.0].map((t) => (
            <span
              key={t}
              className={s.heatLegendCell}
              style={{ background: `rgba(34,197,94,${t})` }}
            />
          ))}
          <span className={s.heatLegendLabel}>More</span>
        </div>
      </div>
    </div>
  );
};

export const ChartView: React.FC<Props> = ({
  walletTokens,
  lendingItems,
  poolItems,
  stakingItems,
  breakdown,
  walletGroupId,
}) => {
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyView, setHistoryView] = useState<'portfolio' | 'composition' | 'heatmap'>(
    'portfolio'
  );

  useEffect(() => {
    if (!walletGroupId) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    axios
      .get<{ points: HistoryPoint[] }>(api.getWalletGroupHistory(walletGroupId), {
        signal: controller.signal,
      })
      .then((res) => {
        setHistory(res.data.points);
        setHistoryLoading(false);
      })
      .catch((err) => {
        if (axios.isCancel?.(err) || err?.name === 'CanceledError') return;
        setHistory(null);
        setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [walletGroupId]);

  const lendingSegments = useMemo<DonutSegment[]>(
    () =>
      [
        { label: 'Supplied', value: breakdown.lendingSupplied, color: '#45b773' },
        { label: 'Borrowed', value: breakdown.lendingBorrowed, color: '#ef4444' },
      ].filter((c) => c.value > 0),
    [breakdown]
  );

  const ltv =
    breakdown.lendingSupplied > 0
      ? (breakdown.lendingBorrowed / breakdown.lendingSupplied) * 100
      : 0;

  const stackedSeries = useMemo<StackedSeries[]>(
    () => [
      { key: 'lending', label: 'Lending (supplied)', color: '#22c55e' },
      { key: 'liquiditypool', label: 'Liquidity Pool', color: '#f59e0b' },
      { key: 'staking', label: 'Staking', color: '#a78bfa' },
      { key: 'borrowing', label: 'Borrowing', color: '#ef4444' },
    ],
    []
  );

  const stackedPoints = useMemo<StackedPoint[]>(() => {
    const base: StackedPoint[] = (history ?? [])
      .filter((p) => p.summary?.byPositionType)
      .map((p) => {
        const bp = p.summary?.byPositionType ?? {};
        const norm: Record<string, number> = {};
        Object.entries(bp).forEach(([k, v]) => {
          const key = k.toLowerCase();
          norm[key] = key === 'borrowing' ? -v : v;
        });
        return { date: p.date, values: norm };
      });

    const today = new Date().toISOString().slice(0, 10);
    const liveValues: Record<string, number> = {
      lending: breakdown.lendingSupplied,
      borrowing: -breakdown.lendingBorrowed,
      liquiditypool: breakdown.poolValue,
      staking: breakdown.stakingValue,
    };
    const hasLive = Object.values(liveValues).some((v) => v > 0);
    if (!hasLive) return base;

    if (base.length > 0 && base[base.length - 1].date === today) {
      base[base.length - 1] = { date: today, values: liveValues };
    } else {
      base.push({ date: today, values: liveValues });
    }
    return base;
  }, [
    history,
    breakdown.lendingSupplied,
    breakdown.lendingBorrowed,
    breakdown.poolValue,
    breakdown.stakingValue,
  ]);

  return (
    <div className={s.view}>
      <div className={s.row3}>
        <div className={s.panel}>
          <div className={s.panelTitle}>Allocation</div>
          <AllocationDonut
            walletTokens={walletTokens}
            lendingItems={lendingItems}
            poolItems={poolItems}
            stakingItems={stakingItems}
            breakdown={breakdown}
          />
        </div>

        <div className={s.panel}>
          <div className={s.panelTitle}>Lending Breakdown</div>
          {lendingSegments.length > 0 ? (
            <Donut segments={lendingSegments} total={breakdown.lendingSupplied} center="Lending" />
          ) : (
            <div className={s.lineEmpty}>No lending positions.</div>
          )}
        </div>

        <div className={s.panel}>
          <div className={s.panelTitle}>LTV Risk</div>
          <Gauge value={ltv} />
        </div>
      </div>

      <div className={s.panel}>
        <div className={s.panelTitle}>Exposure</div>
        <Bullet
          rows={[
            { label: 'Supplied', value: breakdown.lendingSupplied, color: '#22c55e' },
            { label: 'Borrowed', value: breakdown.lendingBorrowed, color: '#ef4444' },
            { label: 'Pools', value: breakdown.poolValue, color: '#f59e0b' },
            { label: 'Staking', value: breakdown.stakingValue, color: '#a78bfa' },
            { label: 'Wallet', value: breakdown.walletValue, color: '#14b8a6' },
          ].filter((r) => r.value > 0)}
        />
      </div>

      <div className={s.panel}>
        <div className={s.panelTitle}>History (last {HISTORY_DAYS} days)</div>
        <div className={s.allocToggle}>
          <button
            type="button"
            className={`${s.allocBtn} ${historyView === 'portfolio' ? s.allocBtnOn : ''}`}
            onClick={() => setHistoryView('portfolio')}
          >
            Portfolio Value
          </button>
          <button
            type="button"
            className={`${s.allocBtn} ${historyView === 'composition' ? s.allocBtnOn : ''}`}
            onClick={() => setHistoryView('composition')}
          >
            Position Types
          </button>
          <button
            type="button"
            className={`${s.allocBtn} ${historyView === 'heatmap' ? s.allocBtnOn : ''}`}
            onClick={() => setHistoryView('heatmap')}
          >
            PnL Heatmap
          </button>
        </div>
        {historyView === 'portfolio' ? (
          <LineChart history={history} loading={historyLoading} liveTotal={breakdown.totalValue} />
        ) : historyView === 'composition' ? (
          <StackedAreaCanvas
            points={stackedPoints}
            series={stackedSeries}
            loading={historyLoading}
          />
        ) : (
          <PnLHeatmap history={history} loading={historyLoading} />
        )}
      </div>

      <div className={s.netPanel}>
        <div className={s.netTitle}>Net Breakdown</div>
        <div className={s.netGrid}>
          {[
            { label: 'Wallet', value: breakdown.walletValue, positive: true },
            { label: 'Supplied', value: breakdown.lendingSupplied, positive: true },
            { label: 'Borrowed', value: -breakdown.lendingBorrowed, positive: false },
            { label: 'Pools', value: breakdown.poolValue, positive: true },
            { label: 'Staking', value: breakdown.stakingValue, positive: true },
          ].map((item) => (
            <div key={item.label} className={s.netItem}>
              <span className={s.netLabel}>{item.label}</span>
              <span
                className={s.netVal}
                style={{ color: item.value < 0 ? 'var(--v2-red)' : 'var(--v2-green)' }}
              >
                <MaskedValue
                  value={`${item.value < 0 ? '-' : '+'}${formatPrice(Math.abs(item.value))}`}
                />
              </span>
            </div>
          ))}
          <div
            className={s.netItem}
            style={{ borderTop: '1px solid var(--v2-border)', paddingTop: 8 }}
          >
            <span className={s.netLabel} style={{ fontWeight: 800, color: 'var(--v2-text)' }}>
              Total
            </span>
            <span
              className={s.netVal}
              style={{ color: 'var(--v2-text)', fontSize: 15, fontWeight: 800 }}
            >
              <MaskedValue value={formatPrice(breakdown.totalValue)} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartView;
