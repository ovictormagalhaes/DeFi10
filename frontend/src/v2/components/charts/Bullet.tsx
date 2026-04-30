import React from 'react';
import { formatPrice } from '../../../utils/walletUtils';
import MaskedValue from '../shared/MaskedValue';
import s from './ChartView.module.css';

export interface BulletRow {
  label: string;
  value: number;
  color: string;
}

interface Props {
  rows: BulletRow[];
}

export const Bullet: React.FC<Props> = ({ rows }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className={s.bulletList}>
      {rows.map((r, i) => {
        const pct = (r.value / max) * 100;
        return (
          <div key={i} className={s.bulletRow}>
            <span className={s.bulletLabel}>{r.label}</span>
            <div className={s.bulletTrack}>
              <div className={s.bulletFill} style={{ width: `${pct}%`, background: r.color }} />
            </div>
            <span className={s.bulletVal}>
              <MaskedValue value={formatPrice(r.value)} />
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default Bullet;
