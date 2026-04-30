import React from 'react';
import s from './ChartView.module.css';

interface Props {
  value: number;
  thresholds?: { safe: number; warn: number };
  label?: string;
  size?: number;
}

const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const a = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

export const Gauge: React.FC<Props> = ({ value, thresholds = { safe: 50, warn: 70 }, label = 'LTV', size = 220 }) => {
  const v = Math.max(0, Math.min(100, isFinite(value) ? value : 0));
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h - 10;
  const r = w * 0.38;
  const stroke = w * 0.06;
  const svgH = h + 56;

  const safeEnd = (thresholds.safe / 100) * 180;
  const warnEnd = (thresholds.warn / 100) * 180;

  const valueDeg = (v / 100) * 180;
  const pointer = polar(cx, cy, r + stroke * 0.15, valueDeg);

  const zone = v < thresholds.safe ? 'var(--v2-green)' : v < thresholds.warn ? '#f59e0b' : 'var(--v2-red)';

  return (
    <div className={s.gaugeWrap}>
      <svg width={w} height={svgH} viewBox={`0 0 ${w} ${svgH}`}>
        <path d={arcPath(cx, cy, r, 0, safeEnd)} stroke="var(--v2-green)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <path d={arcPath(cx, cy, r, safeEnd, warnEnd)} stroke="#f59e0b" strokeWidth={stroke} fill="none" />
        <path d={arcPath(cx, cy, r, warnEnd, 180)} stroke="var(--v2-red)" strokeWidth={stroke} fill="none" strokeLinecap="round" />

        <line x1={cx} y1={cy} x2={pointer.x} y2={pointer.y} stroke="var(--v2-text)" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="var(--v2-text)" />

        <text x={polar(cx, cy, r + 14, 0).x} y={polar(cx, cy, r + 14, 0).y + 4} textAnchor="middle" fontSize={10} fill="var(--v2-dim)">0%</text>
        <text x={polar(cx, cy, r + 14, 90).x} y={polar(cx, cy, r + 14, 90).y - 2} textAnchor="middle" fontSize={10} fill="var(--v2-dim)">50%</text>
        <text x={polar(cx, cy, r + 14, 180).x} y={polar(cx, cy, r + 14, 180).y + 4} textAnchor="middle" fontSize={10} fill="var(--v2-dim)">100%</text>

        <text x={cx} y={cy + 26} textAnchor="middle" fontSize={size * 0.14} fontWeight={800} fill={zone}>
          {v.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 44} textAnchor="middle" fontSize={11} fill="var(--v2-muted)" fontWeight={600}>
          {label}
        </text>
      </svg>
      <div className={s.gaugeBands}>
        <span className={s.bandSafe}>Safe &lt; {thresholds.safe}%</span>
        <span className={s.bandWarn}>Warn {thresholds.safe}–{thresholds.warn}%</span>
        <span className={s.bandDanger}>Danger &gt; {thresholds.warn}%</span>
      </div>
    </div>
  );
};

export default Gauge;
