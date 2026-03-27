import React, { useState, useCallback } from 'react';
import { useTheme } from '../context/ThemeProvider';
import type {
  PoolScoreResponse,
  PoolScoreSuggestion,
  LendingScoreResponse,
  LendingScoreSuggestion,
} from '../services/omniClient';
import { scorePool, scoreLending } from '../services/omniClient';

type ScoreType = 'pool' | 'lending';

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
  supply: string[];
  borrow: string[];
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
          supply: props.supply,
          borrow: props.borrow,
          protocol: props.protocol,
          chain: props.chain,
        });
        setLendingResult(res);
      }
      setStatus('done');
      setExpanded(true);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to fetch');
    }
  }, [props, status, expanded]);

  const isOptimal =
    status === 'done' &&
    ((props.type === 'pool' && poolResult && poolResult.suggestions.length === 0) ||
     (props.type === 'lending' && lendingResult && lendingResult.suggestions.length === 0));

  const badgeBg = status === 'done'
    ? isOptimal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)'
    : status === 'error' ? 'rgba(239, 68, 68, 0.15)'
    : 'transparent';

  const badgeBorder = status === 'done'
    ? isOptimal ? 'rgba(16, 185, 129, 0.4)' : 'rgba(251, 191, 36, 0.4)'
    : status === 'error' ? 'rgba(239, 68, 68, 0.4)'
    : theme.border;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
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
            animation: status === 'loading' ? 'omni-spin 1s linear infinite' : 'none',
          }}
        />
        {status === 'idle' && <span style={{ color: theme.textSecondary }}>Score</span>}
        {status === 'loading' && <span style={{ color: theme.textSecondary }}>...</span>}
        {status === 'done' && (
          <span style={{ color: isOptimal ? '#10b981' : '#fbbf24' }}>
            {isOptimal ? 'Optimal' : 'Suggestions'}
          </span>
        )}
        {status === 'error' && <span style={{ color: '#ef4444' }}>Error</span>}
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
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            minWidth: 320,
            maxWidth: 420,
            zIndex: 50,
            backgroundColor: theme.bgPanel,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          {props.type === 'pool' && poolResult && (
            <PoolScorePanel result={poolResult} />
          )}
          {props.type === 'lending' && lendingResult && (
            <LendingScorePanel result={lendingResult} />
          )}
        </div>
      )}

      {expanded && status === 'done' && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 49 }}
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
        />
      )}

      {status === 'error' && errorMsg && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          padding: '6px 10px',
          borderRadius: 8,
          backgroundColor: theme.bgPanel,
          border: `1px solid rgba(239, 68, 68, 0.3)`,
          fontSize: 11,
          color: '#ef4444',
          whiteSpace: 'nowrap',
          zIndex: 50,
        }}>
          {errorMsg}
        </div>
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

const PoolScorePanel: React.FC<{ result: PoolScoreResponse }> = ({ result }) => {
  const { theme } = useTheme();
  const hasSuggestions = result.suggestions.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>
          Pool Score
        </span>
        {result.score != null && (
          <span style={{ fontSize: 12, color: theme.textSecondary }}>
            Rank #{result.score} / {result.totalComparable}
          </span>
        )}
      </div>

      {result.yourPool && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 8,
          backgroundColor: theme.bgSecondary,
          border: `1px solid ${theme.border}`,
          marginBottom: 12,
          fontSize: 12,
        }}>
          <div style={{ color: theme.textSecondary, marginBottom: 4 }}>Your Pool</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: theme.textPrimary, fontWeight: 600 }}>
              {result.yourPool.protocol} · {result.yourPool.chain}
            </span>
            <span style={{ color: theme.accent, fontWeight: 600 }}>
              {result.yourPool.totalApr.toFixed(2)}% APR
            </span>
          </div>
        </div>
      )}

      {!hasSuggestions ? (
        <div style={{
          textAlign: 'center',
          padding: '12px 0',
          color: '#10b981',
          fontSize: 13,
          fontWeight: 600,
        }}>
          Your pool is already the best option!
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>
            Better alternatives found:
          </div>
          {result.suggestions.map((s, i) => (
            <SuggestionRow key={i} suggestion={s} type="pool" />
          ))}
        </div>
      )}
    </div>
  );
};

const LendingScorePanel: React.FC<{ result: LendingScoreResponse }> = ({ result }) => {
  const { theme } = useTheme();
  const hasSuggestions = result.suggestions.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>
          Lending Score
        </span>
        {result.score != null && (
          <span style={{ fontSize: 12, color: theme.textSecondary }}>
            Rank #{result.score} / {result.totalComparable}
          </span>
        )}
      </div>

      {result.yourPosition && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 8,
          backgroundColor: theme.bgSecondary,
          border: `1px solid ${theme.border}`,
          marginBottom: 12,
          fontSize: 12,
        }}>
          <div style={{ color: theme.textSecondary, marginBottom: 4 }}>Your Position</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: theme.textPrimary, fontWeight: 600 }}>
              {result.yourPosition.protocol} · {result.yourPosition.chain}
            </span>
            <span style={{ color: theme.accent, fontWeight: 600 }}>
              {result.yourPosition.combinedNetApy.toFixed(2)}% Net APY
            </span>
          </div>
        </div>
      )}

      {!hasSuggestions ? (
        <div style={{
          textAlign: 'center',
          padding: '12px 0',
          color: '#10b981',
          fontSize: 13,
          fontWeight: 600,
        }}>
          Your position is already optimal!
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>
            Better alternatives found:
          </div>
          {result.suggestions.map((s, i) => (
            <LendingSuggestionRow key={i} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  );
};

const SuggestionRow: React.FC<{ suggestion: PoolScoreSuggestion; type: string }> = ({ suggestion }) => {
  const { theme } = useTheme();

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 10px',
      borderRadius: 8,
      backgroundColor: theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      marginBottom: 6,
      fontSize: 12,
      transition: 'all 0.2s ease',
    }}>
      <div>
        <div style={{ fontWeight: 600, color: theme.textPrimary }}>
          #{suggestion.rank} {suggestion.protocol}
        </div>
        <div style={{ color: theme.textSecondary, fontSize: 11 }}>
          {suggestion.chain} · {suggestion.feeTier} · TVL ${(suggestion.tvlUsd / 1000).toFixed(0)}K
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, color: '#10b981' }}>
          {suggestion.totalApr.toFixed(2)}%
        </div>
        <div style={{ color: theme.textSecondary, fontSize: 11 }}>APR</div>
      </div>
    </div>
  );
};

const LendingSuggestionRow: React.FC<{ suggestion: LendingScoreSuggestion }> = ({ suggestion }) => {
  const { theme } = useTheme();

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 10px',
      borderRadius: 8,
      backgroundColor: theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      marginBottom: 6,
      fontSize: 12,
    }}>
      <div>
        <div style={{ fontWeight: 600, color: theme.textPrimary }}>
          #{suggestion.rank} {suggestion.protocol}
        </div>
        <div style={{ color: theme.textSecondary, fontSize: 11 }}>
          {suggestion.chain} · {suggestion.assetsMatched}/{suggestion.assetsTotal} assets
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, color: '#10b981' }}>
          {suggestion.combinedNetApy.toFixed(2)}%
        </div>
        <div style={{ color: theme.textSecondary, fontSize: 11 }}>Net APY</div>
      </div>
    </div>
  );
};

export default OmniScoreBadge;
