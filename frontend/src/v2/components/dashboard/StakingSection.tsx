import React, { useMemo } from 'react';
import { useV2 } from '../../context/V2Context';
import type { ProjectionBreakdownItem } from '../../context/V2Context';
import { SectionHeader } from '../shared/SectionHeader';
import { ProtocolIcon } from '../shared/ProtocolIcon';
import { ChainIcon } from '../shared/ChainIcon';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
import MaskedValue from '../shared/MaskedValue';
import { formatPrice, formatTokenAmount } from '../../../utils/walletUtils';
import s from './StakingSection.module.css';

function tokenVal(t: any): number {
  const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? 0);
  return isFinite(v) && v > 0 ? v : 0;
}

interface Props {
  items: any[];
}

export const StakingSection: React.FC<Props> = ({ items }) => {
  const { positionSearch, selectedChains, openProjection } = useV2();

  const filtered = useMemo(() => {
    let result = items;
    if (selectedChains) {
      result = result.filter((item) =>
        selectedChains.has(
          String(item.protocol?.chain ?? '')
            .trim()
            .toLowerCase()
        )
      );
    }
    if (positionSearch.trim()) {
      const q = positionSearch.toLowerCase();
      result = result.filter(
        (item) =>
          (item.protocol?.name ?? '').toLowerCase().includes(q) ||
          (item.position?.tokens ?? []).some((t: any) => (t.symbol ?? '').toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, selectedChains, positionSearch]);

  if (filtered.length === 0) return null;

  const total = filtered.reduce(
    (s, item) =>
      s +
      (item.position?.tokens ?? [])
        .filter((t: any) => {
          const type = (t?.type ?? '').toLowerCase();
          return type !== 'reward' && type !== 'rewards';
        })
        .reduce((ts: number, t: any) => ts + tokenVal(t), 0),
    0
  );

  const sectionBreakdown: ProjectionBreakdownItem[] = filtered
    .map((item: any) => {
      const tokens = (item.position?.tokens ?? []).filter((t: any) => {
        const type = (t?.type ?? '').toLowerCase();
        return type !== 'reward' && type !== 'rewards';
      });
      const stakedVal = tokens.reduce((s: number, t: any) => s + tokenVal(t), 0);
      const apy = item.position?.apy ?? item.position?.apr ?? item.apy ?? null;
      const rate = apy != null ? parseFloat(apy) : 0;
      const label =
        tokens.map((t: any) => t.symbol ?? '?').join(' + ') || (item.position?.name ?? 'Stake');
      return {
        name: `${item.protocol?.name ?? '?'} · ${label}`,
        logoUrl: item.protocol?.logo ?? undefined,
        rate,
        baseUsd: stakedVal,
        type: 'earn' as const,
      };
    })
    .filter((b) => b.baseUsd > 0);

  const handleHeaderClick = () =>
    openProjection({
      level: 'global',
      name: 'Staking',
      context: `${filtered.length} position${filtered.length !== 1 ? 's' : ''}`,
      baseUsd: total,
      breakdownItems: sectionBreakdown.length > 0 ? sectionBreakdown : undefined,
    });

  return (
    <div className={s.section}>
      <SectionHeader
        title="Staking"
        count={filtered.length}
        total={formatPrice(total)}
        onClick={sectionBreakdown.length > 0 ? handleHeaderClick : undefined}
      />
      <div className={s.cards}>
        {filtered.map((item, i) => {
          const tokens = (item.position?.tokens ?? []).filter((t: any) => {
            const type = (t?.type ?? '').toLowerCase();
            return type !== 'reward' && type !== 'rewards';
          });
          const rewards = (item.position?.tokens ?? []).filter((t: any) => {
            const type = (t?.type ?? '').toLowerCase();
            return type === 'reward' || type === 'rewards';
          });

          const stakedVal = tokens.reduce((s: number, t: any) => s + tokenVal(t), 0);
          const rewardVal = rewards.reduce((s: number, t: any) => s + tokenVal(t), 0);
          const apy = item.position?.apy ?? item.position?.apr ?? item.apy ?? null;

          const label =
            tokens.map((t: any) => t.symbol ?? '?').join(' + ') || (item.position?.name ?? 'Stake');

          return (
            <div
              key={i}
              className={s.card}
              onClick={() =>
                openProjection({
                  level: 'protocol',
                  name: label,
                  context: `${item.protocol?.name ?? ''} Staking`,
                  baseUsd: stakedVal,
                  rate: apy != null ? parseFloat(apy) : undefined,
                })
              }
            >
              <div className={s.cardHeader}>
                <ProtocolIcon name={item.protocol?.name ?? ''} size={26} />
                <div className={s.protoInfo}>
                  <div className={s.protoName}>{item.protocol?.name ?? 'Unknown'}</div>
                  <div className={s.protoChain}>
                    <ChainIcon name={item.protocol?.chain} />
                    {cap(item.protocol?.chain ?? '')}
                  </div>
                </div>
                {apy != null && (
                  <div className={s.apyBadge}>{(parseFloat(apy) * 100).toFixed(2)}% APY</div>
                )}
                <div className={s.cardTotal}>
                  <MaskedValue value={formatPrice(stakedVal)} />
                </div>
              </div>

              <div className={s.tokenList}>
                {tokens.map((t: any, ti: number) => (
                  <div key={ti} className={s.tokenRow}>
                    <span className={s.tokenSym}>{t.symbol ?? '?'}</span>
                    <span className={s.tokenAmt}>
                      <MaskedValue value={formatTokenAmount(t, 4)} />
                    </span>
                    <span className={s.tokenVal}>
                      <MaskedValue value={formatPrice(tokenVal(t))} />
                    </span>
                  </div>
                ))}
              </div>

              {rewards.length > 0 && (
                <div className={s.rewards}>
                  <span className={s.rewardLabel}>Rewards</span>
                  {rewards.map((r: any, ri: number) => (
                    <div key={ri} className={s.rewardRow}>
                      <span className={s.rewardSym}>{r.symbol ?? '?'}</span>
                      <span className={s.rewardVal} style={{ color: 'var(--v2-accent)' }}>
                        <MaskedValue value={formatPrice(tokenVal(r))} />
                      </span>
                    </div>
                  ))}
                  {rewardVal > 0 && (
                    <span className={s.rewardTotal}>
                      <MaskedValue value={formatPrice(rewardVal)} />
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StakingSection;
