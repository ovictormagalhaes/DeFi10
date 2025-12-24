/**
 * PoolsView TypeScript Component - Migração completa do PoolsView.jsx funcional
 * Exibe pools de liquidez com interface rica e expansível
 * Versão atualizada para usar a estrutura real dos dados da API
 */
import React from 'react';

import { useMaskValues } from '../context/MaskValuesContext.tsx';
import { useTheme } from '../context/ThemeProvider';
import type { WalletItem, Token, Range } from '../types/wallet';
import {
  extractPoolRange,
  extractPoolFees24h,
  extractPoolCreatedAt,
  formatPoolAge,
  extractUncollectedFeesForToken,
} from '../types/wallet';
import {
  formatPrice,
  formatTokenAmount,
  extractRewards,
  calculatePercentage,
  getTotalPortfolioValue,
} from '../utils/walletUtils';

import MiniMetric from './MiniMetric';
import RangeChip from './RangeChip';
import TokenDisplay from './TokenDisplay.tsx';

// MetricCard Component
const MetricCard: React.FC<{
  label: string;
  value: string | number;
  custom?: React.ReactNode;
  highlight?: boolean;
  icon?: React.ReactNode;
  accent?: boolean;
}> = ({ label, value, custom, highlight = false, icon, accent = false }) => {
  const { theme } = useTheme();

  return (
    <div
      className="metric-card"
      style={{
        minHeight: '80px',
        padding: '16px',
        borderRadius: '12px',
        background: highlight ? `${theme.accent}20` : theme.bgPanel,
        border: `1px solid ${highlight ? theme.accent : theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        className="flex items-center gap-4 text-sm font-medium leading-tight"
        style={{
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {icon}
        {label}
      </div>

      {custom ? (
        <div className="mt-8">{custom}</div>
      ) : (
        <div
          className="mt-8 leading-tight"
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: accent ? theme.accent : (theme as any).text || theme.textPrimary,
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
};

// CollapseItem Component
const CollapseItem: React.FC<{
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const { theme } = useTheme();

  return (
    <div
      style={{
        background: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer px-20 py-16"
        style={{
          background: isOpen ? (theme as any).bgElevated || theme.bgPanel : 'transparent',
          borderBottom: isOpen ? `1px solid ${theme.border}` : 'none',
          transition: 'all 0.2s ease',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1">{title}</div>
        <div
          className="text-base ml-6"
          style={{
            transform: `rotate(${isOpen ? 180 : 0}deg)`,
            transition: 'transform 0.2s ease',
            color: theme.textSecondary,
          }}
        >
          ▼
        </div>
      </div>

      {/* Content */}
      {isOpen && <div className="px-20 pb-20">{children}</div>}
    </div>
  );
};

// Interfaces específicas para PoolsView
interface ProtocolInfo {
  name: string | null;
  logo: string | null;
}

interface EnrichedPool {
  raw: WalletItem;
  pos: any; // Dados da posição interna
  tokens: Token[];
  rewards: Token[];
  value: number;
  apr: number | null;
  fees24h: number | null;
  created: Date | null;
  range: Range | null;
  poolName: string;
  poolId: string;
  protocolName: string | null;
  protocolLogo: string | null;
  rewardsUnclaimed: number;
  rewardsClaimed: number;
  rewardsTotalValue: number;
  uncollectedFeeTokens: Token[];
}

interface PoolsViewProps {
  getLiquidityPoolsData?: () => WalletItem[];
}

/* Funções utilitárias tipadas - mantendo compatibilidade com código existente */
function getTokens(pos: any): Token[] {
  if (!pos || typeof pos !== 'object') return [];

  let tokens: Token[] = [];

  if (Array.isArray(pos.tokens) && pos.tokens.length) {
    tokens = pos.tokens.map((t: any) => t?.token || t).filter(Boolean);
  } else if (Array.isArray(pos.pool?.tokens) && pos.pool.tokens.length) {
    tokens = pos.pool.tokens.map((t: any) => t?.token || t).filter(Boolean);
  } else {
    const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken;
    const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken;
    if (t0) tokens.push(t0?.token || t0);
    if (t1) tokens.push(t1?.token || t1);
  }

  return tokens.filter(Boolean);
}

function getProtocolInfo(pos: any): ProtocolInfo {
  if (!pos || typeof pos !== 'object') return { name: null, logo: null };

  const proto =
    pos.protocol || pos.provider || pos.platform || pos.dex || pos.exchange || pos.source || null;
  let name: string | null = null;
  let logo: string | null = null;

  if (proto && typeof proto === 'object') {
    name = proto.name || proto.id || proto.slug || proto.title || null;
    logo = proto.logo || proto.icon || proto.iconUrl || proto.image || proto.img || null;
  } else if (typeof proto === 'string') {
    name = proto;
  }

  return { name, logo };
}

// Função para detectar protocolo predominante
function detectPredominantProtocol(enriched: EnrichedPool[]): ProtocolInfo {
  if (!enriched || enriched.length === 0) {
    return { name: 'Unknown', logo: '❓' };
  }

  const protocolCounts = enriched.reduce(
    (acc, pool) => {
      const protocolInfo = getProtocolInfo(pool.pos);
      const protocolName = protocolInfo.name || 'Unknown';
      acc[protocolName] = (acc[protocolName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const predominantProtocolName = Object.keys(protocolCounts).reduce((a, b) =>
    protocolCounts[a] > protocolCounts[b] ? a : b
  );

  const mockPos = { protocol: predominantProtocolName };
  return getProtocolInfo(mockPos);
}

function safeNum(v: any): number {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

function formatAmount(value: any): string {
  if (value == null) return '—';
  const num = parseFloat(value);
  if (!isFinite(num)) return '—';

  if (Math.abs(num) >= 1_000_000_000) {
    return (num / 1_000_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'B';
  }
  if (Math.abs(num) >= 1_000_000) {
    return (num / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M';
  }
  if (Math.abs(num) >= 1_000) {
    return (num / 1_000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'K';
  }

  return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function stableTokenKey(t: any): string | null {
  if (!t || typeof t !== 'object') return null;
  return (t.tokenAddress || t.contractAddress || t.address || t.id || t.symbol || '').toLowerCase();
}

function mergeTokenList(list: Token[]): Token[] {
  const map = new Map<string | symbol, Token>();

  list.forEach((tok) => {
    const key = stableTokenKey(tok);
    if (!key) {
      map.set(Symbol(), tok); // keep unique unknown
      return;
    }

    if (!map.has(key)) {
      map.set(key, { ...tok });
    } else {
      const acc = map.get(key)!;
      const amountFields = ['amount', 'balance', 'rewardAmount', 'pending', 'earned', 'accrued'];

      amountFields.forEach((f) => {
        if ((tok as any)[f] != null) {
          const a = parseFloat((acc as any)[f] || 0);
          const b = parseFloat((tok as any)[f]);
          if (isFinite(b)) (acc as any)[f] = a + b;
        }
      });

      const valFields = ['totalPrice', 'value'];
      valFields.forEach((f) => {
        if ((tok as any)[f] != null) {
          const a = parseFloat((acc as any)[f] || 0);
          const b = parseFloat((tok as any)[f]);
          if (isFinite(b)) (acc as any)[f] = a + b;
        }
      });
    }
  });

  return Array.from(map.values());
}

function sumUnclaimed(rewards: Token[]): number {
  if (!Array.isArray(rewards) || !rewards.length) return 0;

  return rewards.reduce((s, r) => {
    const v =
      (r as any).pending ??
      (r as any).unclaimed ??
      (r as any).rewardAmount ??
      (r as any).accrued ??
      (r as any).amount ??
      (r as any).balance;
    const n = parseFloat(v);
    return s + (isFinite(n) ? n : 0);
  }, 0);
}

function sumClaimed(rewards: Token[]): number {
  if (!Array.isArray(rewards) || !rewards.length) return 0;

  return rewards.reduce((s, r) => {
    const v = (r as any).claimed ?? (r as any).earned ?? (r as any).realized;
    const n = parseFloat(v);
    return s + (isFinite(n) ? n : 0);
  }, 0);
}

function sumRewardValue(rewards: Token[]): number {
  if (!Array.isArray(rewards) || !rewards.length) return 0;

  return rewards.reduce((s, r) => {
    let val = (r as any).totalPrice ?? (r as any).value;
    if (val == null) {
      const price = parseFloat((r as any).price ?? (r as any).financials?.price);
      if (isFinite(price)) {
        const u =
          parseFloat(
            (r as any).pending ??
              (r as any).unclaimed ??
              (r as any).rewardAmount ??
              (r as any).accrued
          ) || 0;
        const c = parseFloat((r as any).claimed ?? (r as any).earned) || 0;
        val = price * (u + c);
      }
    }
    const num = parseFloat(val);
    return s + (isFinite(num) ? num : 0);
  }, 0);
}

function getUserValue(raw: any): number {
  const pos = raw?.position || raw;

  // Prefer explicit totalPrice/value fields
  const direct = pos.totalPrice ?? pos.value ?? pos.financials?.totalPrice;
  if (direct != null) return safeNum(direct);

  const toks = getTokens(pos);
  if (toks.length) {
    return toks.reduce(
      (s, t) =>
        s + safeNum((t as any).totalPrice ?? (t as any).value ?? (t as any).financials?.totalPrice),
      0
    );
  }

  return 0;
}

function getAPR(raw: any): number | null {
  const pos = raw?.position || raw;
  const cand =
    pos.apr ??
    pos.APR ??
    pos.apy ??
    pos.APY ??
    pos.aprPct ??
    pos.apyPct ??
    pos.yieldPct ??
    pos.annualPercentageRate;
  const n = safeNum(cand);

  if (!n) return null;

  // assume already percentage (0-100) if >1, else multiply by 100 if <=1
  return n > 1 ? n : n * 100;
}

function getCreatedDate(raw: any): Date | null {
  // First try to extract from additionalData.createdAt (new approach)
  const createdFromAdditional = extractPoolCreatedAt(raw);
  if (createdFromAdditional) return createdFromAdditional;

  // Fallback to legacy approach
  const pos = raw?.position || raw;
  const cand =
    pos.createdAt || pos.creationTime || pos.timestamp || pos.created_date || pos.startTime;
  if (!cand) return null;

  try {
    // If it's already a unix timestamp (number), convert to Date
    if (typeof cand === 'number') {
      const d = new Date(cand * 1000); // Assume Unix timestamp in seconds
      if (!isNaN(d.getTime())) return d;
    }
    // Otherwise try to parse as Date
    const d = new Date(cand);
    if (!isNaN(d.getTime())) return d;
  } catch {
    return null;
  }
  return null;
}

function shortenAddress(a: string): string {
  if (!a) return '';
  return a.slice(0, 6) + '...' + a.slice(-4);
}

const PoolsView: React.FC<PoolsViewProps> = ({ getLiquidityPoolsData }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();

  const pools = React.useMemo(() => getLiquidityPoolsData?.() || [], [getLiquidityPoolsData]);

  const enriched: EnrichedPool[] = React.useMemo(
    () =>
      pools.map((p, i) => {
        // Keep original reference because some providers put range at root while also nesting a position object.
        const original = p;
        const pos = p.position || p; // 'pos' is the inner position shape if available.

        // Get all tokens from position (including LiquidityUncollectedFee)
        const allTokens = pos.tokens || p.position?.tokens || p.tokens || [];
        const tokensRaw = getTokens(pos);
        const rewardsRaw = extractRewards(pos);
        const tokens = mergeTokenList(tokensRaw);
        const rewards = mergeTokenList(rewardsRaw);

        // Extract uncollected fees specifically from LiquidityUncollectedFee tokens
        const uncollectedFeeTokens =
          allTokens.filter((t: any) => t.type === 'LiquidityUncollectedFee') || [];

        const { name: protocolName, logo: protocolLogo } = getProtocolInfo(p);
        const value = getUserValue(p);
        const apr = getAPR(p);
        const fees24h = extractPoolFees24h(p);
        const created = getCreatedDate(p);

        // Extract range using unified utility function
        const range = extractPoolRange(p);
        const poolName =
          pos.name ||
          (tokens.length >= 2
            ? `${tokens[0].symbol || tokens[0].name}/${tokens[1].symbol || tokens[1].name}`
            : tokens[0]?.symbol || tokens[0]?.name || `Pool #${i + 1}`);
        const poolId = pos.id || pos.poolId || pos.address || pos.contractAddress || `pool-${i}`;

        // Calculate uncollected fees value from LiquidityUncollectedFee tokens (like PoolTables)
        const rewardsTotalValue = uncollectedFeeTokens.reduce(
          (s: number, t: any) =>
            s + (parseFloat(t.financials?.totalPrice || t.totalPrice || 0) || 0),
          0
        );

        // Keep legacy calculations for other rewards
        const rewardsUnclaimed = sumUnclaimed(rewards);
        const rewardsClaimed = sumClaimed(rewards);

        return {
          raw: p,
          pos,
          tokens,
          rewards,
          value,
          apr,
          fees24h,
          created,
          range,
          poolName,
          poolId,
          protocolName,
          protocolLogo,
          rewardsUnclaimed,
          rewardsClaimed,
          rewardsTotalValue,
          uncollectedFeeTokens,
        };
      }),
    [pools]
  );

  const totalValue = React.useMemo(() => enriched.reduce((s, e) => s + e.value, 0), [enriched]);

  const avgApr = React.useMemo(() => {
    const arr = enriched.map((e) => e.apr).filter((v): v is number => v != null && v > 0);
    if (!arr.length) return null;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }, [enriched]);

  const totalFees24h = React.useMemo(
    () => enriched.reduce((s, e) => s + (e.fees24h || 0), 0),
    [enriched]
  );
  const totalRewardsValue = React.useMemo(
    () => enriched.reduce((s, e) => s + (e.rewardsTotalValue || 0), 0),
    [enriched]
  );

  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const portfolioPercent =
    portfolioTotal > 0 ? calculatePercentage(totalValue, portfolioTotal) : '0%';

  // Extrair protocolo predominante dos pools
  const protocolInfo = React.useMemo(() => {
    if (!enriched.length) return { name: null, logo: null };

    // Coletar todos os protocolos e contar ocorrências
    const protocolCounts = new Map<
      string,
      { count: number; info: { name: string | null; logo: string | null } }
    >();

    enriched.forEach((pool) => {
      if (pool.protocolName) {
        const existing = protocolCounts.get(pool.protocolName);
        if (existing) {
          existing.count++;
          // Update logo if current pool has logo and existing doesn't
          if (pool.protocolLogo && !existing.info.logo) {
            existing.info.logo = pool.protocolLogo;
          }
        } else {
          protocolCounts.set(pool.protocolName, {
            count: 1,
            info: { name: pool.protocolName, logo: pool.protocolLogo },
          });
        }
      }
    });

    // Encontrar protocolo mais comum
    let maxCount = 0;
    let predominantProtocol: { name: string | null; logo: string | null } = {
      name: null,
      logo: null,
    };

    for (const [, { count, info }] of protocolCounts) {
      if (count > maxCount) {
        maxCount = count;
        predominantProtocol = info;
      }
    }

    return predominantProtocol;
  }, [enriched]);

  // responsiveness for card grid
  const [vw, setVw] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  React.useEffect(() => {
    const r = () => setVw(window.innerWidth);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const isNarrow = vw < 900;

  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpenMap((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div className="pools-view">
      <div
        className="metric-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '0px',
        }}
      >
        <MetricCard label="Total Pools" value={enriched.length} />
        <MetricCard label="Total Value" value={maskValue(formatPrice(totalValue))} />
        <MetricCard label="Uncollected" value={maskValue(formatPrice(totalRewardsValue || 0))} />
        <MetricCard
          label="Range"
          value={`${enriched.filter((e) => e.range?.inRange).length}/${enriched.length}`}
        />
        <MetricCard label="Portfolio" value={portfolioPercent} />
      </div>

      {/* Interface original com CollapseItem */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '0px' }}>
        {enriched.map((enrichedPool, index) => {
          const { raw, pos, tokens, rewards } = enrichedPool;
          const { name: protocolName, logo: protocolLogo } = getProtocolInfo(raw);

          console.log(`Pool ${index}:`, {
            enrichedPoolProtocolName: enrichedPool.protocolName,
            localProtocolName: protocolName,
            protocolLogo: protocolLogo,
            pos: pos,
            raw: raw,
            posKeys: Object.keys(pos || {}),
            rawKeys: Object.keys(raw || {}),
            posProtocol: pos?.protocol,
            posProvider: pos?.provider,
            posPlatform: pos?.platform,
            posDex: pos?.dex,
            rawProtocol: (raw as any)?.protocol,
            rawProvider: (raw as any)?.provider,
            rawPlatform: (raw as any)?.platform,
            rawDex: (raw as any)?.dex,
          });

          const poolValue = safeNum(pos?.totalPrice || pos?.value || 0);
          const poolApr = safeNum(pos?.apr || pos?.apy || 0);
          const fees24h = extractPoolFees24h(raw);
          const createdAt = extractPoolCreatedAt(raw);
          const ageDisplay = formatPoolAge(createdAt);
          // Dados da estrutura real: range está em raw.additionalData.range
          // Uncollected fees estão em raw.position.tokens com type "LiquidityUncollectedFee"

          // USAR extractPoolRange com o WalletItem completo (raw)
          const range = extractPoolRange(raw);

          const highlightValue = maskValue(formatPrice(poolValue));
          const highlightApr = poolApr > 0 ? `${poolApr.toFixed(2)}%` : '--';
          const highlightFees = fees24h && fees24h > 0 ? maskValue(formatPrice(fees24h)) : '--';

          return (
            <CollapseItem
              key={index}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  {/* Token Display */}
                  <div style={{ flex: 1 }}>
                    <TokenDisplay tokens={tokens} />
                  </div>

                  {/* Quick Stats */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      fontSize: '14px',
                    }}
                  >
                    {range && <RangeChip range={range} width={80} />}
                  </div>
                </div>
              }
            >
              <div style={{ padding: '16px 0' }}>
                {/* Métricas do Pool */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px',
                  }}
                >
                  {enrichedPool.protocolName && (
                    <MiniMetric
                      label="Protocol"
                      value={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {enrichedPool.protocolLogo && (
                            <img
                              src={enrichedPool.protocolLogo}
                              alt={enrichedPool.protocolName}
                              style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                              onError={(e) =>
                                ((e.target as HTMLImageElement).style.display = 'none')
                              }
                            />
                          )}
                          <span>{enrichedPool.protocolName}</span>
                        </div>
                      }
                    />
                  )}
                </div>

                {/* Tabelas de Tokens */}
                <div style={{ marginTop: '16px' }}>
                  {/* Positions Table */}
                  {tokens.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4
                        style={{
                          margin: '0 0 8px 0',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: (theme as any).text || theme.textPrimary,
                        }}
                      >
                        Positions
                      </h4>
                      <div
                        style={{
                          background: (theme as any).bgElevated || theme.bgPanel,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Table Header */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 1fr',
                            padding: '12px 16px',
                            background: (theme as any).bgElevated || theme.bgPanel,
                            borderBottom: `1px solid ${theme.border}`,
                            fontSize: '11px',
                            fontWeight: '600',
                            color: theme.textSecondary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          <div>Token</div>
                          <div style={{ textAlign: 'right' }}>Amount</div>
                          <div style={{ textAlign: 'right' }}>Value</div>
                          <div style={{ textAlign: 'right' }}>Uncollected</div>
                        </div>

                        {/* Table Rows */}
                        {tokens.map((token, tokenIndex) => {
                          // Get the actual token from raw position data to have proper amounts
                          const rawToken = raw.position?.tokens?.find(
                            (t: any) => t.symbol === token.symbol && t.type === 'Supplied'
                          ) as any;

                          const amount =
                            rawToken?.amount ??
                            (token as any).amount ??
                            (token as any).balance ??
                            token.financials?.amount;
                          const price =
                            rawToken?.price ?? (token as any).price ?? token.financials?.price;
                          let value =
                            rawToken?.totalPrice ??
                            (token as any).totalPrice ??
                            (token as any).value ??
                            token.financials?.totalPrice;

                          // Calcular uncollected fees usando a função correta baseada na estrutura real dos dados
                          const uncollectedValue = extractUncollectedFeesForToken(
                            raw,
                            token.symbol
                          );

                          if (value == null && amount != null && price != null) {
                            value = amount * price;
                          }

                          return (
                            <div
                              key={tokenIndex}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                                padding: '12px 16px',
                                borderBottom:
                                  tokenIndex < tokens.length - 1
                                    ? `1px solid ${theme.border}`
                                    : 'none',
                                alignItems: 'center',
                              }}
                            >
                              {/* Token Column */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {token.logo && (
                                  <img
                                    src={token.logo}
                                    alt={token.symbol}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                    }}
                                    onError={(e) =>
                                      ((e.target as HTMLImageElement).style.display = 'none')
                                    }
                                  />
                                )}
                                <span
                                  style={{
                                    fontWeight: '500',
                                    color: (theme as any).text || theme.textPrimary,
                                  }}
                                >
                                  {token.symbol}
                                </span>
                              </div>

                              {/* Amount Column */}
                              <div style={{ textAlign: 'right' }}>
                                {rawToken ? (
                                  <div
                                    style={{
                                      fontSize: '14px',
                                      color: (theme as any).text || theme.textPrimary,
                                    }}
                                  >
                                    {maskValue(formatTokenAmount(rawToken, 4))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                                    --
                                  </span>
                                )}
                              </div>

                              {/* Value Column */}
                              <div style={{ textAlign: 'right' }}>
                                {value != null ? (
                                  <div
                                    style={{
                                      fontSize: '14px',
                                      color: (theme as any).text || theme.textPrimary,
                                    }}
                                  >
                                    {maskValue(formatPrice(value))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                                    --
                                  </span>
                                )}
                              </div>

                              {/* Uncollected Column */}
                              <div style={{ textAlign: 'right' }}>
                                <div
                                  style={{
                                    fontSize: '14px',
                                    color: (theme as any).text || theme.textPrimary,
                                    fontWeight: '500',
                                  }}
                                >
                                  {maskValue(formatPrice(uncollectedValue || 0))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rewards Table */}
                  {rewards.length > 0 && (
                    <div>
                      <h4
                        style={{
                          margin: '0 0 8px 0',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: (theme as any).text || theme.textPrimary,
                        }}
                      >
                        Rewards
                      </h4>
                      <div
                        style={{
                          background: (theme as any).bgElevated || theme.bgPanel,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          overflow: 'hidden',
                        }}
                      >
                        {rewards.map((reward, rewardIndex) => {
                          const unclaimed =
                            (reward as any).pending ??
                            (reward as any).unclaimed ??
                            (reward as any).rewardAmount ??
                            (reward as any).accrued;
                          const claimed = (reward as any).claimed ?? (reward as any).earned ?? 0;

                          return (
                            <div
                              key={rewardIndex}
                              style={{
                                padding: '12px 16px',
                                borderBottom:
                                  rewardIndex < rewards.length - 1
                                    ? `1px solid ${theme.border}`
                                    : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {reward.logo && (
                                  <img
                                    src={reward.logo}
                                    alt={reward.symbol}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                    }}
                                    onError={(e) =>
                                      ((e.target as HTMLImageElement).style.display = 'none')
                                    }
                                  />
                                )}
                                <span
                                  style={{
                                    fontWeight: '500',
                                    color: (theme as any).text || theme.textPrimary,
                                  }}
                                >
                                  {reward.symbol}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                {unclaimed != null && unclaimed > 0 && (
                                  <div style={{ fontSize: '14px', color: theme.accent }}>
                                    +{formatTokenAmount(unclaimed)} unclaimed
                                  </div>
                                )}
                                {claimed != null && claimed > 0 && (
                                  <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                                    {formatTokenAmount(claimed)} earned
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CollapseItem>
          );
        })}
      </div>
    </div>
  );
};

export default PoolsView;
