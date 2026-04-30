import React, { useMemo } from 'react';
import { useV2 } from '../../context/V2Context';
import type { ProjectionBreakdownItem } from '../../context/V2Context';
import { SectionHeader } from '../shared/SectionHeader';
import { PriceRangeBar } from '../shared/PriceRangeBar';
import { ProtocolIcon } from '../shared/ProtocolIcon';
import { ChainIcon } from '../shared/ChainIcon';

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
import MaskedValue from '../shared/MaskedValue';
import { formatPrice, formatTokenAmount } from '../../../utils/walletUtils';
import { getProtocolConfig } from '../../../constants/protocols';
import s from './PoolsSection.module.css';

function formatAge(seconds: number): string {
  if (seconds < 6 * 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function tokenVal(t: any): number {
  const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? t?.balance_usd ?? 0);
  return isFinite(v) && v > 0 ? v : 0;
}

function getRange(item: any) {
  return (
    item.additionalData?.range ??
    item.position?.additionalData?.range ??
    item.position?.range ??
    item.range ??
    null
  );
}

function sumFeeTokens(allTokens: any[], type: string): number {
  return allTokens
    .filter(t => (t?.type ?? '').toLowerCase() === type.toLowerCase())
    .reduce((s: number, t: any) => s + tokenVal(t), 0);
}

function sumFeesObj(feesObj: any): number {
  if (!feesObj || typeof feesObj !== 'object') return 0;
  return Object.values(feesObj).reduce((s: number, v: any) => {
    const usd = parseFloat(v?.usd ?? v?.totalPrice ?? v ?? 0);
    return s + (isFinite(usd) ? usd : 0);
  }, 0);
}

interface Props {
  items: any[];
}

export const PoolsSection: React.FC<Props> = ({ items }) => {
  const { positionSearch, selectedChains, openProjection } = useV2();

  const filtered = useMemo(() => {
    let result = items;
    if (selectedChains) {
      result = result.filter(item =>
        selectedChains.has(String(item.protocol?.chain ?? '').trim().toLowerCase())
      );
    }
    if (positionSearch.trim()) {
      const q = positionSearch.toLowerCase();
      result = result.filter(item =>
        (item.protocol?.name ?? '').toLowerCase().includes(q) ||
        (item.position?.tokens ?? []).some((t: any) =>
          (t.symbol ?? '').toLowerCase().includes(q)
        )
      );
    }
    return result;
  }, [items, selectedChains, positionSearch]);

  if (filtered.length === 0) return null;

  const total = filtered.reduce((s, item) =>
    s + (item.position?.tokens ?? [])
      .filter((t: any) => {
        const type = (t?.type ?? '').toLowerCase();
        return type !== 'reward' && type !== 'rewards' && !type.includes('fee');
      })
      .reduce((ts: number, t: any) => ts + tokenVal(t), 0), 0);

  const sectionBreakdown: ProjectionBreakdownItem[] = filtered.map((item: any) => {
    const allTokens: any[] = item.position?.tokens ?? [];
    const supplied = allTokens.filter((t: any) => {
      const type = (t?.type ?? '').toLowerCase();
      return type !== 'reward' && type !== 'rewards' && !type.includes('fee');
    });
    const totalVal = supplied.reduce((s: number, t: any) => s + tokenVal(t), 0);
    const additionalInfo = item.additionalInfo ?? item.position?.additionalInfo ?? {};
    const fees24h = item.additionalData?.fees24h ?? item.position?.additionalData?.fees24h ?? null;
    const aprProjection = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apr');
    const projApr = aprProjection?.metadata?.value;
    const apr = additionalInfo.apr ?? projApr ?? item.position?.apr ?? item.position?.apy ?? null;
    const rate = fees24h != null && totalVal > 0
      ? (fees24h / totalVal) * 365
      : apr != null ? parseFloat(apr) / 100 : 0;
    const pairLabel = supplied.map((t: any) => t.symbol ?? '?').join(' / ') || (item.position?.name ?? 'Position');
    const protoCfg = getProtocolConfig(item.protocol?.name ?? '');
    return {
      name: `${item.protocol?.name ?? '?'} · ${pairLabel}`,
      logoUrl: protoCfg.logo || item.protocol?.logo || item.protocol?.icon || undefined,
      rate,
      baseUsd: totalVal,
      type: 'earn' as const,
    };
  }).filter(b => b.baseUsd > 0);

  const weightedRateBase = sectionBreakdown.reduce((s, b) => s + b.baseUsd, 0);
  const weightedAvgRate = weightedRateBase > 0
    ? sectionBreakdown.reduce((s, b) => s + b.rate * b.baseUsd, 0) / weightedRateBase
    : 0;

  const handleHeaderClick = () => openProjection({
    level: 'global',
    name: 'Liquidity Pools',
    context: `${filtered.length} pool${filtered.length !== 1 ? 's' : ''}`,
    baseUsd: total,
    rate: weightedAvgRate > 0 ? weightedAvgRate : undefined,
    breakdownItems: sectionBreakdown.length > 0 ? sectionBreakdown : undefined,
  });

  return (
    <div className={s.section}>
      <SectionHeader
        title="Liquidity Pools"
        count={filtered.length}
        total={formatPrice(total)}
        onClick={sectionBreakdown.length > 0 ? handleHeaderClick : undefined}
      />
      <div className={s.grid}>
        {filtered.map((item, i) => (
          <PoolCard key={i} item={item} onProjection={openProjection} />
        ))}
      </div>
    </div>
  );
};

const PoolCard: React.FC<{ item: any; onProjection: (t: any) => void }> = ({ item, onProjection }) => {
  const [flipped, setFlipped] = React.useState(false);

  const protocol = item.protocol;
  const allTokens: any[] = item.position?.tokens ?? [];

  const supplied = allTokens.filter((t: any) => {
    const type = (t?.type ?? '').toLowerCase();
    return type !== 'reward' && type !== 'rewards' && !type.includes('fee');
  });

  const tokens = flipped ? [...supplied].reverse() : supplied;

  const totalVal = supplied.reduce((s: number, t: any) => s + tokenVal(t), 0);

  const uncollectedFromTokens = sumFeeTokens(allTokens, 'liquidityuncollectedfee');
  const collectedFromTokens = sumFeeTokens(allTokens, 'liquiditycollectedfee');
  const additionalInfo = item.additionalInfo ?? item.position?.additionalInfo ?? {};
  const uncollectedFromObj = sumFeesObj(
    item.additionalData?.uncollectedFees ?? additionalInfo?.uncollectedFees ?? item.position?.uncollectedFees
  );
  const collectedFromObj = sumFeesObj(
    item.additionalData?.collectedFees ?? additionalInfo?.collectedFees ?? item.position?.collectedFees
  );
  const uncollectedVal = uncollectedFromTokens > 0 ? uncollectedFromTokens : uncollectedFromObj;
  const collectedVal = collectedFromTokens > 0 ? collectedFromTokens : collectedFromObj;

  const range = getRange(item);
  const displayRange = range && flipped && range.current && range.lower && range.upper
    ? {
        ...range,
        current: 1 / range.current,
        lower: 1 / range.upper,
        upper: 1 / range.lower,
      }
    : range;
  const inRange = displayRange
    ? (displayRange.inRange ?? (displayRange.current >= displayRange.lower && displayRange.current <= displayRange.upper))
    : null;

  const fees24h = item.additionalData?.fees24h ?? item.position?.additionalData?.fees24h ?? null;
  const createdAt = item.additionalData?.createdAt ?? additionalInfo?.createdAt ?? item.position?.additionalData?.createdAt ?? null;
  const ageSeconds = createdAt ? Math.floor(Date.now() / 1000 - createdAt) : null;
  const aprProjection = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apr');
  const projApr = aprProjection?.metadata?.value;
  const apr = additionalInfo.apr ?? projApr ?? item.position?.apr ?? item.position?.apy ?? null;
  const projectionPreCalc = aprProjection?.projection ?? null;

  const pairLabel = (supplied.map((t: any) => t.symbol ?? '?').join(' / ')) || (item.position?.name ?? 'Position');
  const displayPair = flipped
    ? ([...supplied].reverse().map((t: any) => t.symbol ?? '?').join(' / ')) || pairLabel
    : pairLabel;

  const tierRaw = item.additionalData?.tierPercent ?? additionalInfo?.tierPercent;
  const tierPercent = tierRaw != null ? Number(tierRaw) : null;
  const tierLabel = tierPercent != null && isFinite(tierPercent)
    ? `${(tierPercent * 100).toFixed(2)}%`
    : null;

  return (
    <div
      className={s.card}
      onClick={() => onProjection({
        level: 'protocol',
        name: pairLabel,
        context: `${protocol?.name ?? ''} pool`,
        baseUsd: totalVal,
        rate: fees24h != null && totalVal > 0
          ? (fees24h / totalVal) * 365
          : apr != null ? parseFloat(apr) / 100 : undefined,
        logoUrl: getProtocolConfig(protocol?.name ?? '').logo || protocol?.logo || undefined,
        preCalculated: projectionPreCalc ? {
          oneDay: projectionPreCalc.oneDay,
          oneWeek: projectionPreCalc.oneWeek,
          oneMonth: projectionPreCalc.oneMonth,
          oneYear: projectionPreCalc.oneYear,
        } : undefined,
        shareData: {
          token0Symbol: supplied[0]?.symbol ?? 'Token0',
          token1Symbol: supplied[1]?.symbol ?? 'Token1',
          token0Logo: supplied[0]?.logo ?? supplied[0]?.thumbnail ?? supplied[0]?.financials?.logo ?? undefined,
          token1Logo: supplied[1]?.logo ?? supplied[1]?.thumbnail ?? supplied[1]?.financials?.logo ?? undefined,
          protocolName: protocol?.name,
          protocolLogo: protocol?.logo ?? undefined,
          chain: protocol?.chain ?? undefined,
          apr: apr != null ? parseFloat(apr) : undefined,
          createdAt: createdAt ?? undefined,
          inRange: inRange ?? undefined,
          totalValue: totalVal > 0 ? totalVal : undefined,
          totalFees: uncollectedVal + collectedVal > 0 ? uncollectedVal + collectedVal : undefined,
          rangeData:
            range?.lower != null && range?.upper != null && range?.current != null
              ? { lower: range.lower, upper: range.upper, current: range.current }
              : undefined,
          tierPercent: tierPercent ?? undefined,
        },
      })}
    >
      <div className={s.cardProto}>
        <ProtocolIcon name={protocol?.name ?? ''} size={22} />
        <span className={s.protoName}>{protocol?.name ?? 'Unknown'}</span>
        <span className={s.protoChain}>
          <ChainIcon name={protocol?.chain} />
          {cap(protocol?.chain ?? '')}
        </span>
      </div>

      <div className={s.cardHeader}>
        <div className={s.pairRow}>
          <span className={s.pairLabel}>{displayPair}</span>
          {tierLabel && <span className={s.tierBadge}>{tierLabel}</span>}
          {supplied.length >= 2 && (
            <button
              className={`${s.flipBtn}${flipped ? ` ${s.flipBtnActive}` : ''}`}
              onClick={e => { e.stopPropagation(); setFlipped(f => !f); }}
              title="Flip pair"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 5H13M13 5L10 2M13 5L10 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 11H3M3 11L6 8M3 11L6 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        <span className={s.cardTotal}>
          <MaskedValue value={formatPrice(totalVal)} />
        </span>
      </div>

      <div className={s.tokenSplit}>
        {tokens.map((t: any, ti: number) => {
          const logo = t.logo ?? t.thumbnail ?? t.financials?.logo ?? null;
          const symbol = t.symbol ?? '?';
          return (
            <div key={ti} className={s.splitToken}>
              <div className={s.splitLogo}>
                {logo ? (
                  <img src={logo} alt={symbol} width={16} height={16}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className={s.splitLogoFallback}>{symbol[0]}</div>
                )}
              </div>
              <span className={s.splitSym}>{symbol}</span>
              <span className={s.splitAmt}>
                <MaskedValue value={formatTokenAmount(t, 4)} />
              </span>
              <span className={s.splitVal}>
                <MaskedValue value={formatPrice(tokenVal(t))} />
              </span>
            </div>
          );
        })}
      </div>

      <div className={s.feesSection}>
        <div className={s.feeRow}>
          <span className={s.feeLabel}>Uncollected</span>
          <span className={s.feeVal} style={{ color: uncollectedVal > 0 ? 'var(--v2-green)' : undefined }}>
            <MaskedValue value={`$${uncollectedVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          </span>
        </div>
        <div className={s.feeRow}>
          <span className={s.feeLabel}>Collected</span>
          <span className={s.feeVal}>
            <MaskedValue value={`$${collectedVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          </span>
        </div>
      </div>

      {displayRange && (
        <PriceRangeBar
          lower={displayRange.lower}
          upper={displayRange.upper}
          current={displayRange.current}
          inRange={inRange ?? false}
        />
      )}

      <div className={s.metrics}>
        <div className={s.metric}>
          <span className={s.metricLabel}>APR</span>
          <span className={s.metricValue} style={{ color: apr != null && parseFloat(apr) > 0 ? 'var(--v2-green)' : undefined }}>
            {apr != null ? `${parseFloat(apr).toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Status</span>
          <span className={s.metricValue} style={{ color: inRange == null ? undefined : inRange ? 'var(--v2-green)' : 'var(--v2-red)' }}>
            {inRange == null ? '—' : inRange ? 'In Range' : 'Out of Range'}
          </span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Age</span>
          <span className={s.metricValue}>
            {ageSeconds != null ? formatAge(ageSeconds) : '—'}
          </span>
        </div>
      </div>

    </div>
  );
};

export default PoolsSection;
