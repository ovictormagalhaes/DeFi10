import React from 'react';
import { formatPrice } from '../../../utils/walletUtils';
import MaskedValue from '../shared/MaskedValue';
import s from './ChartView.module.css';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  total: number;
  center?: string;
  size?: number;
}

export const Donut: React.FC<Props> = ({ segments, total, center, size = 140 }) => {
  const R = size * 0.39;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * R;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circ;
    const arc = { ...seg, dash, offset, pct };
    offset += dash + 2;
    return arc;
  });

  return (
    <div className={s.donutWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="var(--v2-bg-hover)"
          strokeWidth={size * 0.115}
        />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth={size * 0.115}
            strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
            strokeDashoffset={circ / 4 - arc.offset}
            strokeLinecap="round"
          />
        ))}
        {center && (
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize={11}
            fill="var(--v2-muted)"
            fontWeight={600}
          >
            {center}
          </text>
        )}
      </svg>
      <div className={s.donutLegend}>
        {arcs.map((arc, i) => (
          <div key={i} className={s.legendRow}>
            <div className={s.legendDot} style={{ background: arc.color }} />
            <span className={s.legendName}>{arc.label}</span>
            <span className={s.legendVal}>
              <MaskedValue value={formatPrice(arc.value)} />
            </span>
            <span className={s.legendPct}>{(arc.pct * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Donut;
