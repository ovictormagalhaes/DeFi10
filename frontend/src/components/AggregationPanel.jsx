import React, { useEffect } from 'react';
import { useAggregationJob } from '../hooks/useAggregationJob';
import ValueWithTooltip from './ValueWithTooltip';

// Deriva net lending (supplies - borrows) se ambos presentes
function computeNet(summary) {
  if (!summary) return null;
  const sup = typeof summary.TotalAaveSupplies === 'number' ? summary.TotalAaveSupplies : null;
  const bor = typeof summary.TotalAaveBorrows === 'number' ? summary.TotalAaveBorrows : null;
  if (sup == null && bor == null) return null;
  if (sup == null) return -bor;
  if (bor == null) return sup;
  return sup - bor;
}

export default function AggregationPanel({ account, chain = 'Base', auto = true }) {
  const {
    ensure,
    start,
    reset,
    jobId,
    snapshot,
    summary,
    progress,
    pending,
    processed,
    isCompleted,
    loading,
    error,
    expired,
    pollingAttempt,
    maxPollingAttempts,
    nextPollInterval,
  } = useAggregationJob();

  // Auto start / ensure when account changes
  useEffect(() => {
    if (!auto) return;
    if (!account) return;
    if (jobId) return; // já temos job
    if (loading) return; // já em progresso
    ensure(account, chain);
  }, [account, chain, auto, ensure, jobId, loading]);

  const net = computeNet(summary);

  const status = snapshot?.status;
  const showWarning = status === 'CompletedWithErrors';
  const showTimeout = status === 'TimedOut';

  const pct = Math.min(100, Math.max(0, (progress || 0) * 100));

  return (
    <div className="panel pad-16" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="flex justify-between items-center">
        <h3 className="panel-title" style={{ margin: 0 }}>Aggregation</h3>
        <div className="flex gap-8">
          {!jobId && (
            <button className="btn btn--primary" disabled={!account} onClick={() => start(account, chain)}>Start</button>
          )}
          {jobId && !isCompleted && (
            <button className="btn btn--outline" onClick={reset}>Reset</button>
          )}
          {jobId && (isCompleted || expired) && (
            <button className="btn btn--primary" onClick={() => ensure(account, chain)}>Restart</button>
          )}
        </div>
      </div>

      {error && (
        <div className="badge badge-danger" style={{ alignSelf: 'flex-start' }}>
          {error.message || 'Error'}
        </div>
      )}

      {expired && !isCompleted && (
        <div className="badge badge-warning" style={{ alignSelf: 'flex-start' }}>
          Expired / not found — restart to run again
        </div>
      )}

      {showWarning && (
        <div className="badge badge-warning" style={{ alignSelf: 'flex-start' }}>
          Partial completion (some providers failed)
        </div>
      )}
      {showTimeout && (
        <div className="badge" style={{ alignSelf: 'flex-start' }}>
          Timed out - retrying {pollingAttempt}/{maxPollingAttempts} (next in {Math.round(nextPollInterval/1000)}s)
        </div>
      )}

      {/* Progress bar */}
      {jobId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="flex justify-between text-xs" style={{ fontSize: 11 }}>
            <span>Progress</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--mw-bg-interactive, #1f2733)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: 'var(--mw-accent-bg,#2563eb)', transition: 'width .4s' }} />
          </div>
          {/* Polling indicator */}
          {!isCompleted && pollingAttempt > 0 && (
            <div className="text-xs" style={{ fontSize: 10, color: 'var(--mw-text-secondary)', textAlign: 'center' }}>
              Polling attempt {pollingAttempt}/{maxPollingAttempts}
            </div>
          )}
        </div>
      )}

      {/* Summary badges */}
      {summary && (
        <div className="flex gap-8 flex-wrap" style={{ marginTop: 4 }}>
          {typeof summary.TotalTokens === 'number' && (
            <span className="badge">Tokens {summary.TotalTokens}</span>
          )}
          {typeof summary.TotalUniswapPositions === 'number' && (
            <span className="badge">Uniswap V3 {summary.TotalUniswapPositions}</span>
          )}
          {net != null && (
            <span className="badge badge-secondary">Net Lending <ValueWithTooltip value={net.toFixed(2)} tooltip={`Supplies - Borrows (${summary.TotalAaveSupplies || 0} - ${summary.TotalAaveBorrows || 0})`} /></span>
          )}
        </div>
      )}

      {/* Providers */}
      {jobId && (
        <div style={{ marginTop: 8 }}>
          <div className="text-xs" style={{ fontWeight: 600, marginBottom: 6 }}>Providers</div>
          <div className="flex gap-8 flex-wrap" style={{ marginBottom: 8 }}>
            <span className="badge badge-secondary">Expected {snapshot?.expected ?? '-'}</span>
            <span className="badge badge-success">Succeeded {snapshot?.succeeded ?? 0}</span>
            <span className="badge badge-danger">Failed {snapshot?.failed ?? 0}</span>
            <span className="badge">TimedOut {snapshot?.timedOut ?? 0}</span>
            <span className="badge badge-secondary">Pending {pending.length}</span>
          </div>
          <div className="flex column gap-4" style={{ fontSize: 12 }}>
            {processed.map(p => (
              <div key={p.provider} className="flex justify-between" style={{ gap: 12 }}>
                <span style={{ fontWeight: 500 }}>{p.provider}</span>
                <span className={p.status === 'Success' ? 'text-success' : p.status === 'Failed' ? 'text-danger' : ''}>
                  {p.status}{p.error ? ' • err' : ''}
                </span>
              </div>
            ))}
            {pending.map(name => (
              <div key={'pend-' + name} className="flex justify-between text-secondary" style={{ gap: 12 }}>
                <span>{name}</span>
                <span>...</span>
              </div>
            ))}
            {!processed.length && !pending.length && (
              <div className="text-secondary">No providers yet</div>
            )}
          </div>
        </div>
      )}

      {/* Footer status */}
      {jobId && (
        <div className="text-xs text-secondary" style={{ marginTop: 12 }}>
          Status: {status || (loading ? 'Loading...' : '—')} {isCompleted ? '(final)' : ''}
        </div>
      )}
    </div>
  );
}
