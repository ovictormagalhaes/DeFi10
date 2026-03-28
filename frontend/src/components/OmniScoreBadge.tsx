import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTheme } from '../context/ThemeProvider';
import type {
  PoolScoreResponse,
  PoolScoreSuggestion,
  LendingScoreResponse,
  LendingScoreSuggestion,
  LendingAssetRate,
  ScoreAsset,
} from '../services/omniClient';
import { scorePool, scoreLending } from '../services/omniClient';

import { capitalize } from '../utils/format';

const CHAIN_ICONS: Record<string, string> = {
  ethereum: '/resources/chains/ethereum.png',
  arbitrum: '/resources/chains/arbitrum.png',
  base: '/resources/chains/base.png',
  optimism: '/resources/chains/optimism.png',
  polygon: '/resources/chains/polygon.png',
  avalanche: '/resources/chains/avalanche.png',
  bsc: '/resources/chains/bsc.png',
  solana: '/resources/chains/solana.png',
  fantom: '/resources/chains/fantom.png',
  gnosis: '/resources/chains/gnosis.png',
  cronos: '/resources/chains/cronos.png',
};

const PROTOCOL_ICONS: Record<string, string> = {
  aave: '/resources/protocols/aave.svg',
  'aave-v3': '/resources/protocols/aave.svg',
  uniswap: '/resources/protocols/uniswap.svg',
  'uniswap-v3': '/resources/protocols/uniswap.svg',
  kamino: '/resources/protocols/kamino.svg',
  raydium: '/resources/protocols/raydium.svg',
  pendle: '/resources/protocols/pendle.svg',
};

const getChainIcon = (chain: string) => CHAIN_ICONS[chain.toLowerCase()] || null;
const getProtocolIcon = (protocol: string) => {
  const key = protocol.toLowerCase();
  if (PROTOCOL_ICONS[key]) return PROTOCOL_ICONS[key];
  const base = key.replace(/-v\d+$/, '');
  return PROTOCOL_ICONS[base] || null;
};

const ChainBadge: React.FC<{ chain: string; size?: number }> = ({ chain, size = 14 }) => {
  const { theme } = useTheme();
  const icon = getChainIcon(chain);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {icon && <img src={icon} alt={chain} style={{ width: size, height: size, borderRadius: '50%' }} />}
      <span style={{ color: theme.textSecondary, fontSize: 11 }}>{capitalize(chain)}</span>
    </span>
  );
};

const ProtocolBadge: React.FC<{ protocol: string; size?: number }> = ({ protocol, size = 14 }) => {
  const { theme } = useTheme();
  const icon = getProtocolIcon(protocol);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {icon && <img src={icon} alt={protocol} style={{ width: size, height: size, borderRadius: '50%' }} />}
      <span style={{ color: theme.textPrimary, fontWeight: 600, fontSize: 12 }}>{capitalize(protocol)}</span>
    </span>
  );
};

interface PoolParams {
  type: 'pool';
  token0: string;
  token1: string;
  protocol?: string;
  chain?: string;
  feeTier?: string;
}

interface LendingParams {
  type: 'lending';
  supplies: ScoreAsset[];
  borrows: ScoreAsset[];
  protocol?: string;
  chain?: string;
}

type OmniScoreBadgeProps = PoolParams | LendingParams;

type Status = 'idle' | 'loading' | 'done' | 'error';

const OmniScoreBadge: React.FC<OmniScoreBadgeProps> = (props) => {
  const { theme } = useTheme();
  const [status, setStatus] = useState<Status>('idle');
  const [poolResult, setPoolResult] = useState<PoolScoreResponse | null>(null);
  const [lendingResult, setLendingResult] = useState<LendingScoreResponse | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchScore = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (status === 'done' || status === 'loading') {
      if (status === 'done') setExpanded(!expanded);
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      if (props.type === 'pool') {
        const res = await scorePool({
          token0: props.token0,
          token1: props.token1,
          protocol: props.protocol,
          chain: props.chain,
          fee_tier: props.feeTier,
        });
        setPoolResult(res);
      } else {
        const res = await scoreLending({
          supplies: props.supplies,
          borrows: props.borrows,
          protocol: props.protocol,
          chain: props.chain,
        });
        setLendingResult(res);
      }
      setStatus('done');
      setExpanded(true);
    } catch (err: any) {
      setStatus('error');
      const raw = err?.response?.data?.error;
      setErrorMsg(typeof raw === 'string' ? raw : raw?.message || err?.message || 'Failed to fetch');
    }
  }, [props, status, expanded]);

  const isOptimal =
    status === 'done' &&
    ((props.type === 'pool' && poolResult && poolResult.suggestions.length === 0) ||
     (props.type === 'lending' && lendingResult && lendingResult.suggestions.length === 0));

  const svgFilter = status === 'done'
    ? isOptimal
      ? 'brightness(0) saturate(100%) invert(67%) sepia(52%) saturate(525%) hue-rotate(107deg) brightness(95%) contrast(92%)'
      : 'brightness(0) saturate(100%) invert(80%) sepia(45%) saturate(600%) hue-rotate(5deg) brightness(105%) contrast(97%)'
    : status === 'error'
      ? 'brightness(0) saturate(100%) invert(39%) sepia(95%) saturate(1500%) hue-rotate(342deg) brightness(95%) contrast(95%)'
      : 'none';

  const badgeBg = status === 'done'
    ? isOptimal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)'
    : status === 'error' ? 'rgba(239, 68, 68, 0.15)'
    : 'transparent';

  const badgeBorder = status === 'done'
    ? isOptimal ? 'rgba(16, 185, 129, 0.4)' : 'rgba(251, 191, 36, 0.4)'
    : status === 'error' ? 'rgba(239, 68, 68, 0.4)'
    : theme.border;

  return (
    <div style={{ position: 'relative', display: 'inline-block', marginLeft: 'auto', alignSelf: 'flex-start' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={fetchScore}
        title="Omni Score"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 20,
          border: `1px solid ${badgeBorder}`,
          backgroundColor: badgeBg,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontSize: 12,
          fontWeight: 600,
          color: theme.textPrimary,
          minWidth: 90,
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.accent; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = badgeBorder; }}
      >
        <img
          src="/resources/protocols/omni.svg"
          alt="Omni"
          style={{
            width: 18,
            height: 18,
            filter: svgFilter,
            animation: status === 'loading' ? 'omni-spin 1s linear infinite' : 'none',
          }}
        />
        <span style={{ color: theme.textSecondary }}>Score</span>
        {status === 'done' && (
          <span style={{
            transform: `rotate(${expanded ? 180 : 0}deg)`,
            transition: 'transform 0.2s ease',
            fontSize: 10,
            color: theme.textSecondary,
          }}>
            ▼
          </span>
        )}
      </button>

      {expanded && status === 'done' && (
        <ScoreDrawer
          onClose={() => setExpanded(false)}
          props={props}
          poolResult={poolResult}
          lendingResult={lendingResult}
        />
      )}


      <style>{`
        @keyframes omni-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const ScoreDrawer: React.FC<{
  onClose: () => void;
  props: OmniScoreBadgeProps;
  poolResult: PoolScoreResponse | null;
  lendingResult: LendingScoreResponse | null;
}> = ({ onClose, props, poolResult, lendingResult }) => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const title = props.type === 'pool'
    ? poolResult?.normalizedPair || 'Pool Score'
    : capitalize(lendingResult?.yourPosition?.protocol || 'Lending');

  const subtitleChain = props.type === 'pool'
    ? poolResult?.yourPool?.chain || ''
    : lendingResult?.yourPosition?.chain || '';

  const subtitleExtra = props.type === 'pool'
    ? `${poolResult?.token0Category || ''} / ${poolResult?.token1Category || ''}`
    : lendingResult?.yourPosition
      ? `${lendingResult.yourPosition.assetsMatched} assets`
      : '';

  const headerProtocol = props.type === 'pool'
    ? poolResult?.yourPool?.protocol || ''
    : lendingResult?.yourPosition?.protocol || '';

  return ReactDOM.createPortal(
    <>
      <div
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
          backdropFilter: visible ? 'blur(4px)' : 'none',
          zIndex: 9998,
          transition: 'all 0.3s ease',
        }}
      />
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: '100%',
          maxWidth: 480,
          backgroundColor: `${theme.bgPanel}f2`,
          backdropFilter: 'blur(20px)',
          borderLeft: `1px solid ${theme.border}`,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: theme.bgSecondary,
              border: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {getProtocolIcon(headerProtocol)
                ? <img src={getProtocolIcon(headerProtocol)!} alt={headerProtocol} style={{ width: 22, height: 22, borderRadius: '50%' }} />
                : <img src="/resources/protocols/omni.svg" alt="Omni" style={{ width: 20, height: 20 }} />
              }
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: theme.textPrimary, lineHeight: 1.2 }}>
                  {title}
                </span>
                {subtitleChain && <ChainBadge chain={subtitleChain} />}
              </div>
              {subtitleExtra && (
                <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                  {subtitleExtra}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textSecondary,
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.textPrimary; e.currentTarget.style.backgroundColor = theme.bgSecondary; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textSecondary; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 20px',
        }}>
          {props.type === 'pool' && poolResult && (
            <PoolScoreDrawerContent result={poolResult} />
          )}
          {props.type === 'lending' && lendingResult && (
            <LendingScoreDrawerContent result={lendingResult} />
          )}
        </div>

      </aside>
    </>,
    document.body,
  );
};

const formatUsd = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}> = ({ label, value, sub, valueColor }) => {
  const { theme } = useTheme();
  return (
    <div style={{
      backgroundColor: theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: valueColor || theme.textPrimary, fontFamily: 'monospace', lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: theme.textSecondary }}>{sub}</div>}
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => {
  const { theme } = useTheme();
  return (
    <div style={{
      fontSize: 13,
      fontWeight: 600,
      color: theme.textPrimary,
      marginBottom: 10,
      marginTop: first ? 0 : 20,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      {children}
    </div>
  );
};

interface ProjectionLine {
  label: string;
  apy: number;
  color: string;
  dashed?: boolean;
}

const TIMEPOINTS = [
  { label: 'Now', days: 0 },
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

const LINE_COLORS = ['#a2a9b5', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

const ProjectionChart: React.FC<{ lines: ProjectionLine[]; totalValue: number }> = ({ lines, totalValue }) => {
  const { theme } = useTheme();

  const data = useMemo(() => {
    return TIMEPOINTS.map(tp => {
      const point: Record<string, string | number> = { name: tp.label };
      lines.forEach(l => {
        const rate = l.apy / 100;
        const earned = totalValue * rate * (tp.days / 365);
        point[l.label] = Math.round(earned * 100) / 100;
      });
      return point;
    });
  }, [lines, totalValue]);

  const allValues = data.flatMap(d =>
    lines.map(l => (d[l.label] as number) || 0)
  );
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const padding = Math.max(Math.abs(maxVal - minVal) * 0.1, 10);

  const formatYAxis = (v: number) => {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div style={{
      backgroundColor: theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      padding: '16px 8px 8px 0',
      marginTop: 10,
    }}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.border}
            opacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: theme.textSecondary, fontSize: 11 }}
            axisLine={{ stroke: theme.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: theme.textSecondary, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatYAxis}
            domain={[Math.floor(minVal - padding), Math.ceil(maxVal + padding)]}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              fontSize: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
            labelStyle={{ color: theme.textPrimary, fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ padding: '1px 0' }}
            formatter={(value: number, name: string) => {
              const prefix = value >= 0 ? '+' : '';
              const formatted = Math.abs(value) >= 1000
                ? `${prefix}$${(value / 1000).toFixed(2)}K`
                : `${prefix}$${value.toFixed(2)}`;
              return [formatted, name];
            }}
          />
          <Legend
            iconType="line"
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          {lines.map((l, i) => (
            <Line
              key={l.label}
              type="monotone"
              dataKey={l.label}
              stroke={l.color}
              strokeWidth={l.dashed ? 2.5 : 2}
              strokeDasharray={l.dashed ? '6 4' : undefined}
              dot={{ r: 3, fill: l.color, stroke: theme.bgPanel, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: l.color, stroke: theme.bgPanel, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const PoolScoreDrawerContent: React.FC<{ result: PoolScoreResponse }> = ({ result }) => {
  const { theme } = useTheme();
  const hasSuggestions = result.suggestions.length > 0;
  const pool = result.yourPool;

  return (
    <div>
      <SectionTitle first>Your Pool</SectionTitle>

      {pool ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary, fontFamily: 'monospace' }}>
              {pool.pair}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 6,
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              color: '#a78bfa',
              border: '1px solid rgba(139, 92, 246, 0.25)',
            }}>
              {pool.poolType || 'Pool'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ProtocolBadge protocol={pool.protocol} />
            <span style={{ color: theme.textSecondary }}>·</span>
            <ChainBadge chain={pool.chain} />
            <span style={{ color: theme.textSecondary }}>·</span>
            <span style={{ color: theme.textSecondary, fontSize: 11 }}>{pool.feeTier}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricCard
              label="Total APR"
              value={`${pool.totalApr.toFixed(2)}%`}
              valueColor={apyColor(pool.totalApr)}
            />
            <MetricCard
              label="Rank"
              value={result.score != null ? `#${result.score}` : '—'}
              valueColor="#a78bfa"
              sub={`of ${result.totalComparable} pools`}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
            <MetricCard label="TVL" value={formatUsd(pool.tvlUsd)} />
            <MetricCard label="Volume 24h" value={formatUsd(pool.volume24h)} />
            <MetricCard label="Turnover" value={`${pool.turnoverRatio24h.toFixed(2)}x`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <MetricCard label="Fee APR (24h)" value={`${pool.feeApr24h.toFixed(2)}%`} valueColor={apyColor(pool.feeApr24h)} />
            <MetricCard label="Fee APR (7d)" value={`${pool.feeApr7d.toFixed(2)}%`} valueColor={apyColor(pool.feeApr7d)} />
          </div>
        </>
      ) : (
        <div style={{
          padding: '14px 16px',
          borderRadius: 12,
          backgroundColor: theme.bgSecondary,
          border: `1px solid ${theme.border}`,
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: theme.textPrimary, fontFamily: 'monospace' }}>
              {result.normalizedPair}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricCard
              label="Rank"
              value={result.score != null ? `#${result.score}` : 'N/A'}
              valueColor="#a78bfa"
              sub={`of ${result.totalComparable} pools`}
            />
            <MetricCard
              label="Status"
              value="Not ranked"
              sub="Pool not found in index"
            />
          </div>
        </div>
      )}

      {!hasSuggestions ? (
        <div style={{
          textAlign: 'center',
          padding: '24px 0',
          fontSize: 14,
          fontWeight: 600,
        }}>
          <div style={{ color: '#10b981', marginBottom: 4 }}>Your pool is already the best option!</div>
          <div style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 400 }}>
            No better alternatives across {result.totalComparable} pools
          </div>
        </div>
      ) : (
        <>
          <SectionTitle>Better Alternatives</SectionTitle>
          {result.suggestions.map((s, i) => (
            <PoolSuggestionRow key={i} suggestion={s} yourApr={pool?.totalApr} />
          ))}
        </>
      )}

      <PoolProjectionSection pool={pool} suggestions={result.suggestions} />
    </div>
  );
};

const PoolProjectionSection: React.FC<{
  pool: PoolScoreSuggestion | null;
  suggestions: PoolScoreSuggestion[];
}> = ({ pool, suggestions }) => {
  const totalValue = pool?.tvlUsd ? Math.min(pool.tvlUsd, 10000) : 10000;

  const lines: ProjectionLine[] = [];

  if (pool) {
    lines.push({
      label: `Current (${capitalize(pool.protocol)})`,
      apy: pool.totalApr,
      color: LINE_COLORS[0],
      dashed: true,
    });
  }

  suggestions.slice(0, 3).forEach((s, i) => {
    lines.push({
      label: `#${s.rank} ${capitalize(s.protocol)} · ${capitalize(s.chain)}`,
      apy: s.totalApr,
      color: LINE_COLORS[i + 1],
    });
  });

  if (lines.length === 0) return null;

  return (
    <>
      <SectionTitle>Projected Earnings ($10K)</SectionTitle>
      <ProjectionChart lines={lines} totalValue={10000} />
    </>
  );
};

const LendingScoreDrawerContent: React.FC<{ result: LendingScoreResponse }> = ({ result }) => {
  const { theme } = useTheme();
  const hasSuggestions = result.suggestions.length > 0;
  const pos = result.yourPosition;

  return (
    <div>
      <SectionTitle first>Your Position</SectionTitle>

      {pos ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ProtocolBadge protocol={pos.protocol} size={16} />
            <span style={{ color: theme.textSecondary }}>·</span>
            <ChainBadge chain={pos.chain} size={14} />
            <span style={{ color: theme.textSecondary }}>·</span>
            <span style={{ color: theme.textSecondary, fontSize: 11 }}>
              {pos.assetsMatched}/{pos.assetsTotal} assets
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricCard
              label="Net APY"
              value={`${pos.combinedNetApy.toFixed(2)}%`}
              valueColor={apyColor(pos.combinedNetApy)}
            />
            <MetricCard
              label="Rank"
              value={result.score != null ? `#${result.score}` : '—'}
              valueColor="#a78bfa"
              sub={`of ${result.totalComparable} protocols`}
            />
          </div>

          {pos.supplyRates.length > 0 && (
            <>
              <SectionTitle>Supply Rates</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pos.supplyRates.map((r, i) => (
                  <RateRow key={i} rate={r} />
                ))}
              </div>
            </>
          )}

          {pos.borrowRates.length > 0 && (
            <>
              <SectionTitle>Borrow Rates</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pos.borrowRates.map((r, i) => (
                  <RateRow key={i} rate={r} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div style={{
          padding: '14px 16px',
          borderRadius: 12,
          backgroundColor: theme.bgSecondary,
          border: `1px solid ${theme.border}`,
          fontSize: 12,
          color: theme.textSecondary,
          textAlign: 'center',
        }}>
          Position not found in index
        </div>
      )}

      {!hasSuggestions ? (
        <div style={{
          textAlign: 'center',
          padding: '24px 0',
          fontSize: 14,
          fontWeight: 600,
        }}>
          <div style={{ color: '#10b981', marginBottom: 4 }}>Your position is already optimal!</div>
          <div style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 400 }}>
            No better alternatives across {result.totalComparable} protocols
          </div>
        </div>
      ) : (
        <>
          <SectionTitle>Better Alternatives</SectionTitle>
          {result.suggestions.map((s, i) => (
            <LendingSuggestionRow key={i} suggestion={s} yourApy={pos?.combinedNetApy} />
          ))}
        </>
      )}

      <LendingProjectionSection position={pos} suggestions={result.suggestions} />
    </div>
  );
};

const LendingProjectionSection: React.FC<{
  position: LendingScoreSuggestion | null;
  suggestions: LendingScoreSuggestion[];
}> = ({ position, suggestions }) => {
  const totalValue = position
    ? [...position.supplyRates, ...position.borrowRates].reduce((sum, r) => sum + (r.valueUsd || 0), 0)
    : 10000;
  const displayValue = totalValue > 0 ? totalValue : 10000;

  const lines: ProjectionLine[] = [];

  if (position) {
    lines.push({
      label: `Current (${capitalize(position.protocol)})`,
      apy: position.combinedNetApy,
      color: LINE_COLORS[0],
      dashed: true,
    });
  }

  suggestions.slice(0, 3).forEach((s, i) => {
    lines.push({
      label: `#${s.rank} ${capitalize(s.protocol)} · ${capitalize(s.chain)}`,
      apy: s.combinedNetApy,
      color: LINE_COLORS[i + 1],
    });
  });

  if (lines.length === 0) return null;

  const label = totalValue > 0
    ? `Projected Earnings (${formatUsd(displayValue)})`
    : 'Projected Earnings ($10K)';

  return (
    <>
      <SectionTitle>{label}</SectionTitle>
      <ProjectionChart lines={lines} totalValue={displayValue} />
    </>
  );
};

const RateRow: React.FC<{ rate: LendingAssetRate }> = ({ rate }) => {
  const { theme } = useTheme();
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 14px',
      borderRadius: 10,
      backgroundColor: theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      fontSize: 12,
    }}>
      <div>
        <div style={{ fontWeight: 600, color: theme.textPrimary }}>{rate.asset}</div>
        {rate.liquidity > 0 && (
          <div style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
            Liq: {formatUsd(rate.liquidity)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: theme.textSecondary }}>Base</div>
          <div style={{ fontWeight: 500, color: theme.textPrimary }}>{rate.apy.toFixed(2)}%</div>
        </div>
        {rate.rewards > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: theme.textSecondary }}>Rewards</div>
            <div style={{ fontWeight: 500, color: '#a78bfa' }}>+{rate.rewards.toFixed(2)}%</div>
          </div>
        )}
        <div style={{ textAlign: 'right', minWidth: 56 }}>
          <div style={{ fontSize: 10, color: theme.textSecondary }}>Net</div>
          <div style={{ fontWeight: 700, color: apyColor(rate.netApy), fontSize: 14 }}>
            {rate.netApy.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
};

const apyColor = (v: number) => v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#a2a9b5';

const LendingRatesTable: React.FC<{ rates: LendingAssetRate[]; label: string }> = ({ rates, label }) => {
  const { theme } = useTheme();
  if (rates.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
        color: theme.textSecondary,
        marginBottom: 4,
      }}>
        {label}
      </div>
      {rates.map((r, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '3px 0',
          fontSize: 11,
          borderBottom: i < rates.length - 1 ? `1px solid ${theme.border}` : 'none',
        }}>
          <span style={{ color: theme.textPrimary, fontWeight: 500 }}>{r.asset}</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: theme.textSecondary }}>
              {r.apy.toFixed(2)}%
            </span>
            {r.rewards > 0 && (
              <span style={{ color: '#a78bfa', fontSize: 10 }}>
                +{r.rewards.toFixed(2)}%
              </span>
            )}
            <span style={{ color: apyColor(r.netApy), fontWeight: 600, minWidth: 52, textAlign: 'right' }}>
              {r.netApy.toFixed(2)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const PoolSuggestionRow: React.FC<{ suggestion: PoolScoreSuggestion; yourApr?: number }> = ({ suggestion, yourApr }) => {
  const { theme } = useTheme();
  const diff = yourApr != null ? suggestion.totalApr - yourApr : null;

  const content = (
    <div style={{
      padding: '14px 16px',
      borderRadius: 12,
      backgroundColor: theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      marginBottom: 10,
      fontSize: 12,
      cursor: suggestion.url ? 'pointer' : 'default',
      transition: 'border-color 0.2s ease',
    }}
      onMouseEnter={(e) => { if (suggestion.url) e.currentTarget.style.borderColor = theme.accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.border; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#a78bfa',
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              padding: '2px 7px',
              borderRadius: 4,
            }}>
              #{suggestion.rank}
            </span>
            <span style={{ fontWeight: 700, color: theme.textPrimary, fontSize: 14 }}>
              {suggestion.pair}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ProtocolBadge protocol={suggestion.protocol} size={12} />
            <span style={{ color: theme.textSecondary, fontSize: 10 }}>·</span>
            <ChainBadge chain={suggestion.chain} size={12} />
            <span style={{ color: theme.textSecondary, fontSize: 10 }}>·</span>
            <span style={{ color: theme.textSecondary, fontSize: 11 }}>{suggestion.feeTier}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: apyColor(suggestion.totalApr), fontFamily: 'monospace' }}>
            {suggestion.totalApr.toFixed(2)}%
          </div>
          <div style={{ fontSize: 10, color: theme.textSecondary }}>APR</div>
          {diff != null && diff > 0 && (
            <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginTop: 2 }}>
              +{diff.toFixed(2)}% vs yours
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div style={{
          padding: '6px 8px',
          borderRadius: 8,
          backgroundColor: theme.bgPanel,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, color: theme.textSecondary, fontWeight: 500, marginBottom: 2 }}>TVL</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary, fontFamily: 'monospace' }}>
            {formatUsd(suggestion.tvlUsd)}
          </div>
        </div>
        <div style={{
          padding: '6px 8px',
          borderRadius: 8,
          backgroundColor: theme.bgPanel,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, color: theme.textSecondary, fontWeight: 500, marginBottom: 2 }}>Vol 24h</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary, fontFamily: 'monospace' }}>
            {formatUsd(suggestion.volume24h)}
          </div>
        </div>
        <div style={{
          padding: '6px 8px',
          borderRadius: 8,
          backgroundColor: theme.bgPanel,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, color: theme.textSecondary, fontWeight: 500, marginBottom: 2 }}>Turnover</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary, fontFamily: 'monospace' }}>
            {suggestion.turnoverRatio24h.toFixed(2)}x
          </div>
        </div>
      </div>

      {suggestion.url && (
        <div style={{ marginTop: 10, fontSize: 11, color: theme.accent, textAlign: 'right', fontWeight: 500 }}>
          Open on {capitalize(suggestion.protocol)} ↗
        </div>
      )}
    </div>
  );

  if (suggestion.url) {
    return (
      <a href={suggestion.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}
        onClick={(e) => e.stopPropagation()}>
        {content}
      </a>
    );
  }
  return content;
};

const LendingSuggestionRow: React.FC<{ suggestion: LendingScoreSuggestion; yourApy?: number }> = ({ suggestion, yourApy }) => {
  const { theme } = useTheme();
  const diff = yourApy != null ? suggestion.combinedNetApy - yourApy : null;

  const content = (
    <div style={{
      padding: '14px 16px',
      borderRadius: 12,
      backgroundColor: theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      marginBottom: 10,
      fontSize: 12,
      cursor: suggestion.url ? 'pointer' : 'default',
      transition: 'border-color 0.2s ease',
    }}
      onMouseEnter={(e) => { if (suggestion.url) e.currentTarget.style.borderColor = theme.accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.border; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#a78bfa',
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              padding: '2px 7px',
              borderRadius: 4,
            }}>
              #{suggestion.rank}
            </span>
            <ProtocolBadge protocol={suggestion.protocol} size={14} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChainBadge chain={suggestion.chain} size={12} />
            <span style={{ color: theme.textSecondary, fontSize: 10 }}>·</span>
            <span style={{ color: theme.textSecondary, fontSize: 11 }}>
              {suggestion.assetsMatched}/{suggestion.assetsTotal} assets
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: apyColor(suggestion.combinedNetApy), fontFamily: 'monospace' }}>
            {suggestion.combinedNetApy.toFixed(2)}%
          </div>
          <div style={{ fontSize: 10, color: theme.textSecondary }}>Net APY</div>
          {diff != null && diff > 0 && (
            <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginTop: 2 }}>
              +{diff.toFixed(2)}% vs yours
            </div>
          )}
        </div>
      </div>
      <LendingRatesTable rates={suggestion.supplyRates} label="Supply" />
      <LendingRatesTable rates={suggestion.borrowRates} label="Borrow" />
      {suggestion.url && (
        <div style={{ marginTop: 8, fontSize: 11, color: theme.accent, textAlign: 'right', fontWeight: 500 }}>
          Open on {capitalize(suggestion.protocol)} ↗
        </div>
      )}
    </div>
  );

  if (suggestion.url) {
    return (
      <a href={suggestion.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}
        onClick={(e) => e.stopPropagation()}>
        {content}
      </a>
    );
  }
  return content;
};

export default OmniScoreBadge;
