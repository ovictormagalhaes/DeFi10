import React, { useMemo, useState } from 'react';
import type { V2Breakdown } from '../../utils/breakdown';
import Donut, { type DonutSegment } from './Donut';
import s from './ChartView.module.css';

type View = 'portfolio' | 'protocol' | 'token';

interface Props {
  walletTokens: any[];
  lendingItems: any[];
  poolItems: any[];
  stakingItems: any[];
  breakdown: V2Breakdown;
  initialView?: View;
}

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
const TOKEN_LIMIT = 6;

function tokenVal(t: any): number {
  const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? 0);
  return isFinite(v) && v > 0 ? v : 0;
}

function lc(x: any): string {
  return (x ?? '').toString().toLowerCase();
}

const VIEW_CONFIG: { key: View; label: string }[] = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'protocol', label: 'Protocol' },
  { key: 'token', label: 'Token' },
];

export const AllocationDonut: React.FC<Props> = ({
  walletTokens,
  lendingItems,
  poolItems,
  stakingItems,
  breakdown,
  initialView = 'portfolio',
}) => {
  const [view, setView] = useState<View>(initialView);

  const portfolioSegments = useMemo<DonutSegment[]>(
    () =>
      [
        { label: 'Wallet', value: breakdown.walletValue, color: COLORS[0] },
        { label: 'Lending Net', value: breakdown.lendingNet, color: COLORS[1] },
        { label: 'Pools', value: breakdown.poolValue, color: COLORS[2] },
        { label: 'Staking', value: breakdown.stakingValue, color: COLORS[3] },
      ].filter((c) => c.value > 0),
    [breakdown]
  );

  const protocolSegments = useMemo<DonutSegment[]>(() => {
    const map = new Map<string, number>();
    const add = (proto: string, v: number) => {
      if (v > 0) map.set(proto, (map.get(proto) ?? 0) + v);
    };

    lendingItems.forEach((item: any) => {
      const proto = item.protocol?.name ?? 'Unknown';
      let supplied = 0,
        borrowed = 0;
      (item.position?.tokens ?? []).forEach((t: any) => {
        const type = lc(t?.type);
        const v = tokenVal(t);
        if (type === 'supplied' || type === 'supply' || type === 'deposit') supplied += v;
        else if (type === 'borrowed' || type === 'borrow' || type === 'debt') borrowed += v;
      });
      add(proto, supplied - borrowed);
    });

    poolItems.forEach((item: any) => {
      const proto = item.protocol?.name ?? 'Unknown';
      let v = 0;
      (item.position?.tokens ?? []).forEach((t: any) => {
        const type = lc(t?.type);
        if (type === 'reward' || type === 'rewards' || type.includes('fee')) return;
        v += tokenVal(t);
      });
      add(proto, v);
    });

    stakingItems.forEach((item: any) => {
      const proto = item.protocol?.name ?? 'Unknown';
      let v = 0;
      (item.position?.tokens ?? []).forEach((t: any) => {
        const type = lc(t?.type);
        if (type === 'reward' || type === 'rewards') return;
        v += tokenVal(t);
      });
      add(proto, v);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }, [lendingItems, poolItems, stakingItems]);

  const tokenSegments = useMemo<DonutSegment[]>(() => {
    const map = new Map<string, number>();
    const add = (sym: string, v: number) => {
      if (v > 0) map.set(sym, (map.get(sym) ?? 0) + v);
    };

    walletTokens.forEach((item) => {
      const t = item.token ?? item;
      add(t.symbol ?? '?', tokenVal(t));
    });

    lendingItems.forEach((item: any) => {
      (item.position?.tokens ?? []).forEach((t: any) => {
        const type = lc(t?.type);
        if (type === 'borrow' || type === 'borrowed') return;
        const sym = t.symbol ?? '?';
        const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? t?.balance_usd ?? 0);
        if (isFinite(v) && v > 0) add(sym, v);
      });
    });

    poolItems.forEach((item: any) => {
      (item.position?.tokens ?? []).forEach((t: any) => {
        const type = lc(t?.type);
        if (type === 'reward' || type === 'rewards' || type.includes('fee')) return;
        const sym = t.symbol ?? '?';
        const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? t?.balance_usd ?? 0);
        if (isFinite(v) && v > 0) add(sym, v);
      });
    });

    stakingItems.forEach((item: any) => {
      (item.position?.tokens ?? []).forEach((t: any) => {
        const type = lc(t?.type);
        if (type === 'reward' || type === 'rewards') return;
        const sym = t.symbol ?? '?';
        const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? t?.balance_usd ?? 0);
        if (isFinite(v) && v > 0) add(sym, v);
      });
    });

    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, TOKEN_LIMIT);
    const rest = sorted.slice(TOKEN_LIMIT);
    const restValue = rest.reduce((s, [, v]) => s + v, 0);

    const segs: DonutSegment[] = top.map(([label, value], i) => ({
      label,
      value,
      color: COLORS[i % COLORS.length],
    }));
    if (restValue > 0) {
      segs.push({ label: `Other (${rest.length})`, value: restValue, color: 'var(--v2-dim)' });
    }
    return segs;
  }, [walletTokens, lendingItems, poolItems, stakingItems]);

  const config = useMemo(
    () => ({
      portfolio: { segments: portfolioSegments, total: breakdown.totalValue, center: 'Portfolio' },
      protocol: {
        segments: protocolSegments,
        total: protocolSegments.reduce((sum, x) => sum + x.value, 0),
        center: 'Protocols',
      },
      token: {
        segments: tokenSegments,
        total: tokenSegments.reduce((sum, x) => sum + x.value, 0),
        center: 'Tokens',
      },
    }),
    [portfolioSegments, protocolSegments, tokenSegments, breakdown.totalValue]
  );

  const cur = config[view];

  return (
    <div>
      <div className={s.allocToggle}>
        {VIEW_CONFIG.map((v) => (
          <button
            key={v.key}
            type="button"
            className={`${s.allocBtn} ${view === v.key ? s.allocBtnOn : ''}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {cur.segments.length > 0 ? (
        <Donut segments={cur.segments} total={cur.total} center={cur.center} />
      ) : (
        <div className={s.lineEmpty}>No data.</div>
      )}
    </div>
  );
};

export default AllocationDonut;
