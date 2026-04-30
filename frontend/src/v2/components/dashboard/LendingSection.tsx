import React, { useMemo } from 'react';
import { useV2 } from '../../context/V2Context';
import type { ProjectionBreakdownItem } from '../../context/V2Context';
import { SectionHeader } from '../shared/SectionHeader';
import { HFGauge } from '../shared/HFGauge';
import { ProtocolIcon } from '../shared/ProtocolIcon';
import { ChainIcon } from '../shared/ChainIcon';
import MaskedValue from '../shared/MaskedValue';
import { formatPrice, formatTokenAmount } from '../../../utils/walletUtils';
import { getProtocolConfig } from '../../../constants/protocols';
import s from './LendingSection.module.css';

function tokenVal(t: any): number {
  const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? 0);
  return isFinite(v) && v > 0 ? v : 0;
}

function getHF(item: any): number | null {
  const hf =
    item.additionalData?.healthFactor ??
    item.position?.additionalData?.healthFactor ??
    item.position?.healthFactor ??
    item.healthFactor ??
    null;
  if (hf == null) return null;
  const n = parseFloat(hf);
  return isFinite(n) && n > 0 ? n : null;
}

function computeTokenRate(item: any, t: any): number | undefined {
  const position = item.position ?? item;
  const projApy = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apy')?.metadata?.value;
  const projApr = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apr')?.metadata?.value;
  const rawSupplyRate = parseFloat(position?.supplyRate ?? position?.apy ?? item.additionalInfo?.supplyRate ?? projApy ?? projApr ?? 0);
  const rawBorrowRate = parseFloat(position?.borrowRate ?? position?.borrowApy ?? item.additionalInfo?.borrowRate ?? projApy ?? 0);
  const type = (t?.type ?? '').toLowerCase();
  const isSupply = type === 'supplied' || type === 'supply' || type === 'deposit';
  const rate = Math.abs(
    t.apy != null ? parseFloat(t.apy) / 100
    : t.apr != null ? parseFloat(t.apr) / 100
    : (isSupply ? rawSupplyRate : rawBorrowRate) / 100
  );
  return isFinite(rate) && rate > 0 ? rate : undefined;
}

function getCreatedAt(item: any): number | null {
  const c = item.additionalData?.createdAt
    ?? item.position?.additionalData?.createdAt
    ?? item.position?.createdAt
    ?? null;
  if (c == null) return null;
  const n = typeof c === 'number' ? c : parseFloat(c);
  return isFinite(n) && n > 0 ? n : null;
}

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function groupByProtocol(items: any[]): Array<{ protocol: any; items: any[] }> {
  const map = new Map<string, { protocol: any; items: any[] }>();
  items.forEach(item => {
    const id = item.protocol?.id ?? item.protocol?.name ?? 'Unknown';
    if (!map.has(id)) map.set(id, { protocol: item.protocol, items: [] });
    map.get(id)!.items.push(item);
  });
  return Array.from(map.values());
}

interface Props {
  items: any[];
}

export const LendingSection: React.FC<Props> = ({ items }) => {
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

  const groups = groupByProtocol(filtered);

  const totalSupplied = filtered.reduce((s, item) =>
    s + (item.position?.tokens ?? []).filter((t: any) => {
      const type = (t?.type ?? '').toLowerCase();
      return type === 'supplied' || type === 'supply' || type === 'deposit';
    }).reduce((ts: number, t: any) => ts + tokenVal(t), 0), 0);

  const totalBorrowed = filtered.reduce((s, item) =>
    s + (item.position?.tokens ?? []).filter((t: any) => {
      const type = (t?.type ?? '').toLowerCase();
      return type === 'borrowed' || type === 'borrow' || type === 'debt';
    }).reduce((ts: number, t: any) => ts + tokenVal(t), 0), 0);

  type GroupAcc = {
    protoName: string;
    chain: string;
    logoUrl?: string;
    suppliedVal: number;
    suppliedEarn: number;
    borrowedVal: number;
    borrowedCost: number;
  };
  const groupMap = new Map<string, GroupAcc>();
  filtered.forEach((item: any) => {
    const position = item.position ?? item;
    const tokens: any[] = position?.tokens ?? [];
    const protoName = item.protocol?.name ?? 'Unknown';
    const chain = item.protocol?.chain ?? '';
    const key = `${protoName}|${chain}`;
    const protoCfg = getProtocolConfig(protoName);
    const logoUrl = protoCfg.logo || item.protocol?.logo || item.protocol?.icon || undefined;

    if (!groupMap.has(key)) {
      groupMap.set(key, { protoName, chain, logoUrl, suppliedVal: 0, suppliedEarn: 0, borrowedVal: 0, borrowedCost: 0 });
    }
    const g = groupMap.get(key)!;

    const projApy = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apy')?.metadata?.value;
    const projApr = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apr')?.metadata?.value;
    const rawSupplyRate = parseFloat(position?.supplyRate ?? position?.apy ?? item.additionalInfo?.supplyRate ?? projApy ?? projApr ?? 0);
    const rawBorrowRate = parseFloat(position?.borrowRate ?? position?.borrowApy ?? item.additionalInfo?.borrowRate ?? projApy ?? 0);

    tokens.forEach((t: any) => {
      const type = (t?.type ?? '').toLowerCase();
      const val = tokenVal(t);
      if (val <= 0) return;
      const tokenRate = Math.abs(
        t.apy != null ? parseFloat(t.apy) / 100
        : t.apr != null ? parseFloat(t.apr) / 100
        : (type === 'borrowed' || type === 'borrow' || type === 'debt' ? rawBorrowRate : rawSupplyRate) / 100
      );
      if (type === 'supplied' || type === 'supply' || type === 'deposit') {
        g.suppliedVal += val;
        g.suppliedEarn += val * tokenRate;
      } else if (type === 'borrowed' || type === 'borrow' || type === 'debt') {
        g.borrowedVal += val;
        g.borrowedCost += val * tokenRate;
      }
    });
  });

  const sectionBreakdown: ProjectionBreakdownItem[] = [];
  groupMap.forEach(g => {
    const label = g.chain ? `${g.protoName} · ${cap(g.chain)}` : g.protoName;
    if (g.suppliedVal > 0) {
      sectionBreakdown.push({
        name: `${label} supply`,
        logoUrl: g.logoUrl,
        rate: g.suppliedEarn / g.suppliedVal,
        baseUsd: g.suppliedVal,
        type: 'earn',
      });
    }
    if (g.borrowedVal > 0) {
      sectionBreakdown.push({
        name: `${label} borrow`,
        logoUrl: g.logoUrl,
        rate: g.borrowedCost / g.borrowedVal,
        baseUsd: g.borrowedVal,
        type: 'cost',
      });
    }
  });

  const handleHeaderClick = () => openProjection({
    level: 'global',
    name: 'Lending & Borrowing',
    context: `${filtered.length} position${filtered.length !== 1 ? 's' : ''}`,
    baseUsd: totalSupplied - totalBorrowed,
    breakdownItems: sectionBreakdown.length > 0 ? sectionBreakdown : undefined,
  });

  return (
    <div className={s.section}>
      <SectionHeader
        title="Lending & Borrowing"
        count={filtered.length}
        total={formatPrice(totalSupplied - totalBorrowed)}
        onClick={sectionBreakdown.length > 0 ? handleHeaderClick : undefined}
      />
      <div className={s.cards}>
        {groups.map(({ protocol, items: groupItems }) => (
          <ProtocolGroup
            key={protocol?.id ?? protocol?.name}
            protocol={protocol}
            items={groupItems}
            onProjection={(baseUsd, preCalc, breakdownItems) => openProjection({
              level: 'protocol',
              name: protocol?.name ?? 'Lending',
              context: `${cap(protocol?.chain ?? '')} Lending`,
              baseUsd,
              logoUrl: getProtocolConfig(protocol?.name ?? '').logo || protocol?.logo || protocol?.icon || undefined,
              preCalculated: preCalc,
              breakdownItems,
            })}
          />
        ))}
      </div>
    </div>
  );
};

const ProtocolGroup: React.FC<{
  protocol: any;
  items: any[];
  onProjection: (total: number, preCalc?: { oneDay?: number; oneWeek?: number; oneMonth?: number; oneYear?: number }, breakdownItems?: ProjectionBreakdownItem[]) => void;
}> = ({ protocol, items, onProjection }) => {
  const { openProjection } = useV2();

  const allTokens: Array<{ token: any; item: any }> = items.flatMap(item =>
    (item.position?.tokens ?? []).map((t: any) => ({ token: t, item }))
  );

  const aggregatedPreCalc = (() => {
    const acc = { oneDay: 0, oneWeek: 0, oneMonth: 0, oneYear: 0 };
    let hasAny = false;
    items.forEach(item => {
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
  })();
  const supplied = allTokens.filter(({ token: t }) => {
    const type = (t?.type ?? '').toLowerCase();
    return type === 'supplied' || type === 'supply' || type === 'deposit';
  });
  const borrowed = allTokens.filter(({ token: t }) => {
    const type = (t?.type ?? '').toLowerCase();
    return type === 'borrowed' || type === 'borrow' || type === 'debt';
  });

  const totalSupplied = supplied.reduce((s: number, { token: t }) => s + tokenVal(t), 0);
  const totalBorrowed = borrowed.reduce((s: number, { token: t }) => s + tokenVal(t), 0);
  const netLending = totalSupplied - totalBorrowed;
  const ltv = totalSupplied > 0 ? (totalBorrowed / totalSupplied) * 100 : 0;

  const supplyEarn = supplied.reduce((s, { token: t, item }) => {
    const r = computeTokenRate(item, t);
    return s + tokenVal(t) * (r ?? 0);
  }, 0);
  const borrowCost = borrowed.reduce((s, { token: t, item }) => {
    const r = computeTokenRate(item, t);
    return s + tokenVal(t) * (r ?? 0);
  }, 0);
  const netEarn = supplyEarn - borrowCost;
  const netAPYDenom = netLending > 0 ? netLending : totalSupplied;
  const netAPY = netAPYDenom > 0 ? netEarn / netAPYDenom : null;

  const oldestCreatedAt = items.reduce((min, item) => {
    const c = getCreatedAt(item);
    if (c == null) return min;
    return min == null || c < min ? c : min;
  }, null as number | null);
  const ageDays = oldestCreatedAt != null ? Math.floor((Date.now() / 1000 - oldestCreatedAt) / 86400) : null;

  const minHF = items.reduce((min, item) => {
    const hf = getHF(item);
    if (hf == null) return min;
    return min == null || hf < min ? hf : min;
  }, null as number | null);

  const breakdownItems: ProjectionBreakdownItem[] = [];
  items.forEach((item: any) => {
    const position = item.position ?? item;
    const tokens: any[] = position?.tokens ?? [];
    const projApy = (item.additionalData?.projections as any[])?.find(
      (p: any) => p.type === 'apy'
    )?.metadata?.value;
    const projApr = (item.additionalData?.projections as any[])?.find(
      (p: any) => p.type === 'apr'
    )?.metadata?.value;
    const rawSupplyRate = parseFloat(
      position?.supplyRate ?? position?.apy ?? item.additionalInfo?.supplyRate ?? projApy ?? projApr ?? 0
    );
    const rawBorrowRate = parseFloat(
      position?.borrowRate ?? position?.borrowApy ?? item.additionalInfo?.borrowRate ?? projApy ?? 0
    );

    tokens.forEach((t: any) => {
      const type = (t?.type ?? '').toLowerCase();
      const val = tokenVal(t);
      if (val <= 0) return;
      if (type === 'supplied' || type === 'supply' || type === 'deposit') {
        const tokenRate = Math.abs(
          t.apy != null ? parseFloat(t.apy) / 100
          : t.apr != null ? parseFloat(t.apr) / 100
          : rawSupplyRate / 100
        );
        breakdownItems.push({
          name: `${t.symbol ?? '?'} supply`,
          symbol: t.symbol,
          logoUrl: t.logo ?? t.thumbnail ?? undefined,
          rate: tokenRate,
          baseUsd: val,
          type: 'earn',
        });
      } else if (type === 'borrowed' || type === 'borrow' || type === 'debt') {
        const tokenRate = Math.abs(
          t.apy != null ? parseFloat(t.apy) / 100
          : t.apr != null ? parseFloat(t.apr) / 100
          : rawBorrowRate / 100
        );
        breakdownItems.push({
          name: `${t.symbol ?? '?'} borrow cost`,
          symbol: t.symbol,
          logoUrl: t.logo ?? t.thumbnail ?? undefined,
          rate: tokenRate,
          baseUsd: val,
          type: 'cost',
        });
      }
    });
  });

  return (
    <div className={s.card} onClick={() => onProjection(netLending, aggregatedPreCalc, breakdownItems.length > 0 ? breakdownItems : undefined)}>
      <div className={s.cardHeader}>
        <ProtocolIcon name={protocol?.name ?? ''} size={28} />
        <div className={s.protoInfo}>
          <div className={s.protoName}>{protocol?.name ?? 'Unknown'}</div>
          <div className={s.protoChain}>
              <ChainIcon name={protocol?.chain} />
              {cap(protocol?.chain ?? '')}
            </div>
        </div>
        <div className={s.protoTotal}>
          <MaskedValue value={formatPrice(netLending)} />
        </div>
      </div>

      {minHF != null && <HFGauge value={minHF} />}

      {supplied.length > 0 && (
        <div className={s.tokenGroup}>
          <div className={s.tokenGroupLabel}>Supplied</div>
          {supplied.map(({ token: t, item }, i: number) => (
            <TokenRow
              key={i}
              token={t}
              type="supplied"
              rate={computeTokenRate(item, t)}
              onClick={() => openProjection({
                level: 'token',
                name: t.symbol ?? '?',
                context: `${protocol?.name} supplied`,
                baseUsd: tokenVal(t),
                rate: t.apy != null ? parseFloat(t.apy) / 100 : t.apr != null ? parseFloat(t.apr) / 100 : undefined,
                logoUrl: t.logo ?? t.thumbnail ?? undefined,
              })}
            />
          ))}
        </div>
      )}

      {borrowed.length > 0 && (
        <div className={s.tokenGroup}>
          <div className={s.tokenGroupLabel}>Borrowed</div>
          {borrowed.map(({ token: t, item }, i: number) => (
            <TokenRow
              key={i}
              token={t}
              type="borrowed"
              rate={computeTokenRate(item, t)}
            />
          ))}
        </div>
      )}

      <div className={s.metrics}>
        <div className={s.metric}>
          <span className={s.metricLabel}>Net APY</span>
          <span
            className={s.metricValue}
            style={{ color: netAPY != null ? (netAPY >= 0 ? 'var(--v2-green)' : 'var(--v2-red)') : undefined }}
          >
            {netAPY != null ? `${netAPY >= 0 ? '+' : ''}${(netAPY * 100).toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>LTV</span>
          <span className={s.metricValue}>{ltv.toFixed(1)}%</span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>{ageDays != null ? 'Age' : 'Positions'}</span>
          <span className={s.metricValue}>
            {ageDays != null ? `${ageDays}d` : items.length}
          </span>
        </div>
      </div>
    </div>
  );
};

const TokenRow: React.FC<{
  token: any;
  type: 'supplied' | 'borrowed';
  rate?: number;
  onClick?: () => void;
}> = ({ token, type, rate, onClick }) => {
  const val = tokenVal(token);
  const amt = formatTokenAmount(token, 4);
  const logo = token.logo ?? token.thumbnail ?? null;
  const symbol = token.symbol ?? '?';

  return (
    <div className={s.tokenRow} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className={s.tokenLogo}>
        {logo ? (
          <img src={logo} alt={symbol} width={16} height={16} style={{ borderRadius: '50%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className={s.tokenLogoFallback}>{symbol[0]}</div>
        )}
      </div>
      <span className={s.tokenSym}>{symbol}</span>
      {rate != null && rate > 0 && (
        <span className={s.tokenRate}>{(rate * 100).toFixed(2)}%</span>
      )}
      <span className={s.tokenAmt}><MaskedValue value={amt} /></span>
      <span className={s.tokenPrice} style={{ color: type === 'borrowed' ? 'var(--v2-red)' : 'var(--v2-green)' }}>
        <MaskedValue value={formatPrice(val)} />
      </span>
    </div>
  );
};

export default LendingSection;
