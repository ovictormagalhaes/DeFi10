import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useV2 } from '../context/V2Context';
import type { ProjectionBreakdownItem } from '../context/V2Context';
import { getWalletTokens } from '../../utils/walletUtils';
import { getLendingItems, getLiquidityPoolItems, getStakingItems } from '../../types/filters';
import { computeV2Breakdown } from '../utils/breakdown';

import V2Toolbar from '../components/layout/V2Toolbar';
import HeroCard from '../components/dashboard/HeroCard';
import WalletSection from '../components/dashboard/WalletSection';
import LendingSection from '../components/dashboard/LendingSection';
import PoolsSection from '../components/dashboard/PoolsSection';
import StakingSection from '../components/dashboard/StakingSection';
import ChartView from '../components/charts/ChartView';
import ProjectionDialog from '../components/dialogs/ProjectionDialog';
import ErrorScreen from '../components/shared/ErrorScreen';

import s from './DashboardPage.module.css';

type ViewMode = 'cards' | 'chart';

export const DashboardPage: React.FC = () => {
  const { account, selectedWalletGroupId, setWalletData, projectionTarget, closeProjection, openProjection, agg } = useV2();
  const [view, setView] = useState<ViewMode>('cards');
  const identifier = account ?? selectedWalletGroupId ?? '';

  useEffect(() => {
    if (identifier) {
      agg.ensure(identifier, null, { isGroup: !!selectedWalletGroupId });
    }
  }, [identifier]);

  const snap = agg.snapshot as any;

  useEffect(() => {
    if (snap) setWalletData(snap);
  }, [snap, setWalletData]);

  const items: any[] = useMemo(() => {
    if (!snap?.items) return [];
    return snap.items;
  }, [snap]);

  const walletTokens = useMemo(() => getWalletTokens(items), [items]);
  const lendingItems = useMemo(() => getLendingItems(items), [items]);
  const poolItems = useMemo(() => getLiquidityPoolItems(items), [items]);
  const stakingItems = useMemo(() => getStakingItems(items), [items]);

  const breakdown = useMemo(
    () => computeV2Breakdown({ walletTokens, lendingItems, poolItems, stakingItems }),
    [walletTokens, lendingItems, poolItems, stakingItems]
  );

  const portfolioPreCalc = useMemo(() => {
    const acc = { oneDay: 0, oneWeek: 0, oneMonth: 0, oneYear: 0 };
    let hasAny = false;
    items.forEach((item: any) => {
      const projections: any[] = item.additionalData?.projections ?? item.position?.additionalData?.projections ?? [];
      projections.forEach((p: any) => {
        if (!p?.projection) return;
        acc.oneDay += Number(p.projection.oneDay ?? 0);
        acc.oneWeek += Number(p.projection.oneWeek ?? 0);
        acc.oneMonth += Number(p.projection.oneMonth ?? 0);
        acc.oneYear += Number(p.projection.oneYear ?? 0);
        hasAny = true;
      });
    });
    return hasAny ? acc : undefined;
  }, [items]);

  const segmentBreakdown: ProjectionBreakdownItem[] = useMemo(() => {
    const segments: ProjectionBreakdownItem[] = [];

    let suppliedTotal = 0;
    let suppliedEarn = 0;
    let borrowedTotal = 0;
    let borrowedCost = 0;
    lendingItems.forEach((item: any) => {
      const tokens: any[] = item.position?.tokens ?? [];
      const projApy = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apy')?.metadata?.value;
      const projApr = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apr')?.metadata?.value;
      const supplyRate = Math.abs(parseFloat(item.position?.supplyRate ?? item.position?.apy ?? item.additionalInfo?.supplyRate ?? projApy ?? projApr ?? 0) / 100);
      const borrowRate = Math.abs(parseFloat(item.position?.borrowRate ?? item.position?.borrowApy ?? item.additionalInfo?.borrowRate ?? projApy ?? 0) / 100);
      tokens.forEach((t: any) => {
        const type = (t?.type ?? '').toLowerCase();
        const val = parseFloat(t?.financials?.totalPrice ?? 0);
        if (!isFinite(val) || val <= 0) return;
        const tokenRate = Math.abs(t.apy != null ? parseFloat(t.apy) / 100 : t.apr != null ? parseFloat(t.apr) / 100 : 0);
        if (type === 'supplied' || type === 'supply' || type === 'deposit') {
          suppliedTotal += val;
          suppliedEarn += val * (tokenRate || supplyRate);
        } else if (type === 'borrowed' || type === 'borrow' || type === 'debt') {
          borrowedTotal += val;
          borrowedCost += val * (tokenRate || borrowRate);
        }
      });
    });
    if (suppliedTotal > 0) {
      segments.push({
        name: 'Lending supply',
        rate: suppliedEarn / suppliedTotal,
        baseUsd: suppliedTotal,
        type: 'earn',
      });
    }
    if (borrowedTotal > 0) {
      segments.push({
        name: 'Lending borrow',
        rate: borrowedCost / borrowedTotal,
        baseUsd: borrowedTotal,
        type: 'cost',
      });
    }

    if (breakdown.poolValue > 0) {
      let totalEarn = 0;
      poolItems.forEach((item: any) => {
        const allTokens: any[] = item.position?.tokens ?? [];
        const supplied = allTokens.filter((t: any) => {
          const type = (t?.type ?? '').toLowerCase();
          return type !== 'reward' && type !== 'rewards' && !type.includes('fee');
        });
        const totalVal = supplied.reduce((s: number, t: any) => s + (parseFloat(t?.financials?.totalPrice ?? 0) || 0), 0);
        const fees24h = item.additionalData?.fees24h ?? item.position?.additionalData?.fees24h ?? null;
        const additionalInfo = item.additionalInfo ?? item.position?.additionalInfo ?? {};
        const aprProjection = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apr');
        const projApr = aprProjection?.metadata?.value;
        const apr = additionalInfo.apr ?? projApr ?? item.position?.apr ?? item.position?.apy ?? null;
        const rate = fees24h != null && totalVal > 0
          ? (fees24h / totalVal) * 365
          : apr != null ? parseFloat(apr) / 100 : 0;
        totalEarn += totalVal * rate;
      });
      segments.push({
        name: 'Liquidity Pools',
        rate: breakdown.poolValue > 0 ? totalEarn / breakdown.poolValue : 0,
        baseUsd: breakdown.poolValue,
        type: 'earn',
      });
    }

    if (breakdown.stakingValue > 0) {
      let totalEarn = 0;
      stakingItems.forEach((item: any) => {
        const tokens = (item.position?.tokens ?? []).filter((t: any) => {
          const type = (t?.type ?? '').toLowerCase();
          return type !== 'reward' && type !== 'rewards';
        });
        const stakedVal = tokens.reduce((s: number, t: any) => s + (parseFloat(t?.financials?.totalPrice ?? 0) || 0), 0);
        const apy = item.position?.apy ?? item.position?.apr ?? item.apy ?? null;
        const rate = apy != null ? parseFloat(apy) : 0;
        totalEarn += stakedVal * rate;
      });
      segments.push({
        name: 'Staking',
        rate: breakdown.stakingValue > 0 ? totalEarn / breakdown.stakingValue : 0,
        baseUsd: breakdown.stakingValue,
        type: 'earn',
      });
    }

    return segments;
  }, [breakdown, lendingItems, poolItems, stakingItems]);

  const { displayed, reachedFull } = useSmoothProgress(agg.progress, agg.isCompleted);
  const showSkeleton = !agg.error && (!agg.isCompleted || !reachedFull);

  if (showSkeleton) {
    return (
      <>
        <V2Toolbar />
        <V2LoadingSkeleton displayed={displayed} />
      </>
    );
  }

  if (agg.error) {
    return (
      <>
        <V2Toolbar />
        <ErrorScreen
          error={agg.error}
          retrying={agg.starting}
          onRetry={() => agg.ensure(identifier, null, { isGroup: !!selectedWalletGroupId, force: true })}
        />
      </>
    );
  }

  return (
    <>
      <V2Toolbar />
      <div className={s.page}>
        <div className={s.viewToggleRow}>
          <div className={s.viewToggle}>
            <button
              className={`${s.viewBtn} ${view === 'cards' ? s.viewBtnOn : ''}`}
              onClick={() => setView('cards')}
            >
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Cards
            </button>
            <button
              className={`${s.viewBtn} ${view === 'chart' ? s.viewBtnOn : ''}`}
              onClick={() => setView('chart')}
            >
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M2 15V9M6 15V3M10 15V7M14 15V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Chart
            </button>
          </div>
        </div>

        <HeroCard breakdown={breakdown} onProjection={() =>
          openProjection({
            level: 'global',
            name: 'Portfolio',
            context: 'All positions',
            baseUsd: breakdown.totalValue,
            preCalculated: portfolioPreCalc,
            breakdownItems: segmentBreakdown.length > 0 ? segmentBreakdown : undefined,
          })
        } />

        {view === 'cards' && (
          <>
            <WalletSection items={walletTokens} />
            <LendingSection items={lendingItems} />
            <PoolsSection items={poolItems} />
            <StakingSection items={stakingItems} />
          </>
        )}

        {view === 'chart' && (
          <ChartView
            walletTokens={walletTokens}
            lendingItems={lendingItems}
            poolItems={poolItems}
            stakingItems={stakingItems}
            breakdown={breakdown}
            walletGroupId={selectedWalletGroupId ?? undefined}
          />
        )}
      </div>

      {projectionTarget && (
        <ProjectionDialog target={projectionTarget} onClose={closeProjection} />
      )}
    </>
  );
};

function useSmoothProgress(progress: number, isCompleted: boolean): { displayed: number; reachedFull: boolean } {
  const target = isCompleted ? 1 : Math.max(0, Math.min(1, progress));
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(performance.now());

  useEffect(() => {
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;

      let goal: number;
      if (isCompleted) {
        goal = 1;
      } else {
        const elapsed = (now - startedAtRef.current) / 1000;
        const floor = Math.min(0.08, elapsed / 60);
        goal = Math.max(target, floor);
      }

      setDisplayed((prev) => {
        const next = Math.max(prev, goal);
        const diff = next - prev;
        if (Math.abs(diff) < 0.0005) return next;
        const speed = isCompleted ? 5 : 1.5;
        return prev + diff * Math.min(1, dt * speed);
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, isCompleted]);

  return { displayed, reachedFull: isCompleted && displayed >= 0.999 };
}

interface V2LoadingSkeletonProps {
  displayed: number;
}

const V2LoadingSkeleton: React.FC<V2LoadingSkeletonProps> = ({ displayed }) => {
  const pct = Math.round(displayed * 100);
  const barWidth = Math.max(displayed * 100, 3);

  return (
    <div className={s.skeletonPage}>
      <div className={s.skeletonHero}>
        <div className={s.skeletonBlock} style={{ width: 120, height: 13 }} />
        <div className={s.skeletonBlock} style={{ width: 200, height: 36, marginTop: 8 }} />
        <div className={s.skeletonBar}>
          <div className={s.skeletonBarFill} style={{ width: `${barWidth}%` }} />
        </div>
        <div className={s.skeletonPct}>{pct > 0 ? `${pct}%` : 'Starting…'}</div>
      </div>
      <div className={s.skeletonGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={s.skeletonCard}>
            <div className={s.skeletonRow}>
              <div className={s.skeletonCircle} />
              <div className={s.skeletonBlock} style={{ flex: 1, height: 13 }} />
              <div className={s.skeletonBlock} style={{ width: 60, height: 13 }} />
            </div>
            <div className={s.skeletonBlock} style={{ width: '70%', height: 11, marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className={s.skeletonSection}>
        <div className={s.skeletonBlock} style={{ width: 100, height: 11 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={s.skeletonCard}>
              <div className={s.skeletonRow}>
                <div className={s.skeletonCircle} style={{ borderRadius: 8 }} />
                <div className={s.skeletonBlock} style={{ flex: 1, height: 13 }} />
                <div className={s.skeletonBlock} style={{ width: 80, height: 13 }} />
              </div>
              <div className={s.skeletonBlock} style={{ width: '100%', height: 6, marginTop: 12, borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
