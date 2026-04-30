import React, { useState } from 'react';
import type {
  BestPurchaseWindowStrategy,
  BestPurchaseWindowEntry,
  PurchaseWindowEvalResult,
  PurchaseTrigger,
} from '../../../types/strategy';
import s from './StrategyCard.module.css';

interface Props {
  strategy: BestPurchaseWindowStrategy;
  onEdit?: () => void;
  onDelete?: () => void;
}

const WINDOW_ORDER: Record<string, number> = { h1: 0, h24: 1, d7: 2, d14: 3, d30: 4, d90: 5, d200: 6, y1: 7, ytd: 8 };
const WINDOW_LABELS: Record<string, string> = { h1: '1h', h24: '24h', d7: '7d', d14: '14d', d30: '30d', d90: '90d', d200: '200d', y1: '1y', ytd: 'YTD' };

function triggersEqual(a?: PurchaseTrigger, b?: PurchaseTrigger): boolean {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'price' && b.type === 'price') return a.target === b.target && a.direction === b.direction;
  if (a.type === 'window' && b.type === 'window') return a.window === b.window && a.direction === b.direction;
  return false;
}

function sortTriggers(triggers: PurchaseTrigger[]): PurchaseTrigger[] {
  return [...triggers].sort((a, b) => {
    if (a.type === 'window' && b.type === 'window') return (WINDOW_ORDER[a.window] ?? 999) - (WINDOW_ORDER[b.window] ?? 999);
    if (a.type === 'window') return -1;
    return 1;
  });
}

function entryTriggers(entry: BestPurchaseWindowEntry): PurchaseTrigger[] {
  const list = entry.triggers?.length ? entry.triggers : entry.trigger ? [entry.trigger] : [];
  return sortTriggers(list);
}

function triggerLabel(t: PurchaseTrigger): string {
  if (t.type === 'price') return t.direction === 'below' ? `below $${t.target}` : `above $${t.target}`;
  return `${WINDOW_LABELS[t.window] ?? t.window} ${t.direction === 'min' ? 'negative' : 'positive'}`;
}

function fmtPct(n?: number | null): string {
  if (n == null || !isFinite(n)) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}
function fmtPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

export const BestPurchaseWindowCard: React.FC<Props> = ({ strategy, onEdit, onDelete }) => {
  const [collapsed, setCollapsed] = useState(false);
  const results = strategy.purchaseWindowResults;

  function getResult(entry: BestPurchaseWindowEntry, idx: number): PurchaseWindowEvalResult | undefined {
    if (!results) return undefined;
    const triggers = entryTriggers(entry);
    const match = results.find(r => {
      if (r.assetKey !== entry.assetKey) return false;
      const rt = r.evaluations?.length ? r.evaluations.map(e => e.trigger) : r.trigger ? [r.trigger] : [];
      return triggers.length === rt.length && triggers.every((t, i) => triggersEqual(t, rt[i]));
    });
    return match ?? results[idx];
  }

  const activeSignals = (results || []).filter(r => r.signal).length;
  const dotColor = activeSignals > 0 ? 'var(--v2-green)' : 'var(--v2-dim)';
  const statColor = activeSignals > 0 ? 'var(--v2-green)' : 'var(--v2-muted)';
  const statText = activeSignals > 0 ? `${activeSignals} active` : 'Waiting';

  return (
    <div className={s.card}>
      <div className={s.header} onClick={() => setCollapsed(v => !v)}>
        <div className={s.dot} style={{ background: dotColor }} />
        <div className={s.headerMeta}>
          <div className={s.name}>{strategy.name || 'Best Purchase Window'}</div>
          <div className={s.sub}>{strategy.purchaseWindowEntries.length} asset{strategy.purchaseWindowEntries.length !== 1 ? 's' : ''}</div>
        </div>
        <div className={s.stat}>
          <div className={s.statVal} style={{ color: statColor }}>{statText}</div>
          <div className={s.statLbl}>Signals</div>
        </div>
        <div className={s.actions} onClick={e => e.stopPropagation()}>
          {onEdit && (
            <button className={s.iconBtn} onClick={onEdit} title="Edit">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"/></svg>
            </button>
          )}
          {onDelete && (
            <button className={`${s.iconBtn} ${s.iconBtnDanger}`} onClick={onDelete} title="Delete">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 4h10M6 4V2h4v2M5 4l.5 9h5l.5-9"/></svg>
            </button>
          )}
        </div>
        <svg className={`${s.chevron} ${!collapsed ? s.chevronOpen : ''}`} width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {!collapsed && strategy.purchaseWindowEntries.length > 0 && (
        <div className={s.body}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={s.tl}>Asset</th>
                  <th className={s.tr}>Price</th>
                  <th className={s.tr}>1h</th>
                  <th className={s.tr}>24h</th>
                  <th className={s.tr}>7d</th>
                  <th className={s.tr}>30d</th>
                  <th className={s.tr}>200d</th>
                  <th className={s.tr}>1y</th>
                  <th className={s.tr}>YTD</th>
                  <th className={s.tl}>Trigger</th>
                  <th className={s.tr}>Reference</th>
                  <th className={s.tc}>Signal</th>
                </tr>
              </thead>
              <tbody>
                {strategy.purchaseWindowEntries.map((entry, ei) => {
                  const result = getResult(entry, ei);
                  const md = result?.marketData;
                  const signal = result?.signal ?? false;
                  const triggers = entryTriggers(entry);

                  const pctCell = (n?: number | null) => {
                    const label = fmtPct(n);
                    if (label === '—') return <span className={s.deltaNeu}>{label}</span>;
                    return <span className={(n ?? 0) >= 0 ? s.deltaPos : s.deltaNeg}>{label}</span>;
                  };

                  if (triggers.length <= 1) {
                    const t = triggers[0];
                    const evalForT = t ? result?.evaluations?.find(e => triggersEqual(e.trigger, t)) : undefined;
                    const triggerSignal = evalForT?.signal ?? false;
                    const refLabel = t ? (() => {
                      if (t.type === 'price') return result ? fmtPrice(result.currentPriceUsd) : '—';
                      const wmap: Record<string, number | undefined> = { h1: md?.priceChangePercentage1h, h24: md?.priceChangePercentage24h, d7: md?.priceChangePercentage7d, d30: md?.priceChangePercentage30d, d200: md?.priceChangePercentage200d, y1: md?.priceChangePercentage1y, ytd: md?.priceChangePercentageYtd };
                      return fmtPct(wmap[t.window]);
                    })() : '—';

                    return (
                      <tr key={ei}>
                        <td className={s.tl}>
                          <div className={s.cellWithLogo}>
                            {entry.token?.logo ? <img src={entry.token.logo} alt={entry.symbol} className={s.tokenImg} onError={e => (e.target as HTMLImageElement).style.display = 'none'} /> : <div className={s.logoFallback}>{entry.symbol.slice(0, 2)}</div>}
                            <span className={s.bold}>{entry.symbol}</span>
                          </div>
                        </td>
                        <td className={s.tr}>{result ? fmtPrice(result.currentPriceUsd) : '—'}</td>
                        <td className={s.tr}>{pctCell(md?.priceChangePercentage1h)}</td>
                        <td className={s.tr}>{pctCell(md?.priceChangePercentage24h)}</td>
                        <td className={s.tr}>{pctCell(md?.priceChangePercentage7d)}</td>
                        <td className={s.tr}>{pctCell(md?.priceChangePercentage30d)}</td>
                        <td className={s.tr}>{pctCell(md?.priceChangePercentage200d)}</td>
                        <td className={s.tr}>{pctCell(md?.priceChangePercentage1y)}</td>
                        <td className={s.tr}>{pctCell(md?.priceChangePercentageYtd)}</td>
                        <td className={s.tl} style={{ fontSize: 11, color: triggerSignal ? 'var(--v2-green)' : 'var(--v2-muted)' }}>{t ? triggerLabel(t) : '—'}</td>
                        <td className={s.tr} style={{ fontSize: 11, color: triggerSignal ? 'var(--v2-green)' : 'var(--v2-muted)' }}>{refLabel}</td>
                        <td className={s.tc}>
                          <span className={s.pwSignal}>
                            <span className={`${s.pwDot} ${signal ? s.pwDotOn : s.pwDotOff}`} />
                            <span style={{ color: signal ? 'var(--v2-green)' : 'var(--v2-dim)' }}>{result ? (signal ? 'Active' : 'Waiting') : '—'}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  return triggers.map((t, ti) => {
                    const evalForT = result?.evaluations?.find(e => triggersEqual(e.trigger, t));
                    const triggerSignal = evalForT?.signal ?? false;
                    const refLabel = (() => {
                      if (t.type === 'price') return result ? fmtPrice(result.currentPriceUsd) : '—';
                      const wmap: Record<string, number | undefined> = { h1: md?.priceChangePercentage1h, h24: md?.priceChangePercentage24h, d7: md?.priceChangePercentage7d, d30: md?.priceChangePercentage30d, d200: md?.priceChangePercentage200d, y1: md?.priceChangePercentage1y, ytd: md?.priceChangePercentageYtd };
                      return fmtPct(wmap[t.window]);
                    })();

                    return (
                      <tr key={`${ei}-${ti}`}>
                        {ti === 0 && (
                          <>
                            <td className={s.tl} rowSpan={triggers.length} style={{ borderRight: '1px solid var(--v2-border-sub)', verticalAlign: 'top', paddingTop: 10 }}>
                              <div className={s.cellWithLogo}>
                                {entry.token?.logo ? <img src={entry.token.logo} alt={entry.symbol} className={s.tokenImg} onError={e => (e.target as HTMLImageElement).style.display = 'none'} /> : <div className={s.logoFallback}>{entry.symbol.slice(0, 2)}</div>}
                                <span className={s.bold}>{entry.symbol}</span>
                              </div>
                            </td>
                            <td className={s.tr} rowSpan={triggers.length} style={{ verticalAlign: 'top', paddingTop: 10 }}>{result ? fmtPrice(result.currentPriceUsd) : '—'}</td>
                            <td className={s.tr} rowSpan={triggers.length} style={{ verticalAlign: 'top', paddingTop: 10 }}>{pctCell(md?.priceChangePercentage1h)}</td>
                            <td className={s.tr} rowSpan={triggers.length} style={{ verticalAlign: 'top', paddingTop: 10 }}>{pctCell(md?.priceChangePercentage24h)}</td>
                            <td className={s.tr} rowSpan={triggers.length} style={{ verticalAlign: 'top', paddingTop: 10 }}>{pctCell(md?.priceChangePercentage7d)}</td>
                            <td className={s.tr} rowSpan={triggers.length} style={{ verticalAlign: 'top', paddingTop: 10 }}>{pctCell(md?.priceChangePercentage30d)}</td>
                            <td className={s.tr} rowSpan={triggers.length} style={{ verticalAlign: 'top', paddingTop: 10 }}>{pctCell(md?.priceChangePercentage200d)}</td>
                            <td className={s.tr} rowSpan={triggers.length} style={{ verticalAlign: 'top', paddingTop: 10 }}>{pctCell(md?.priceChangePercentage1y)}</td>
                            <td className={s.tr} rowSpan={triggers.length} style={{ verticalAlign: 'top', paddingTop: 10 }}>{pctCell(md?.priceChangePercentageYtd)}</td>
                          </>
                        )}
                        <td className={s.tl} style={{ fontSize: 11, color: triggerSignal ? 'var(--v2-green)' : 'var(--v2-muted)' }}>{triggerLabel(t)}</td>
                        <td className={s.tr} style={{ fontSize: 11, color: triggerSignal ? 'var(--v2-green)' : 'var(--v2-muted)' }}>{refLabel}</td>
                        {ti === 0 && (
                          <td className={s.tc} rowSpan={triggers.length} style={{ verticalAlign: 'middle', borderLeft: '1px solid var(--v2-border-sub)' }}>
                            <span className={s.pwSignal}>
                              <span className={`${s.pwDot} ${signal ? s.pwDotOn : s.pwDotOff}`} />
                              <span style={{ color: signal ? 'var(--v2-green)' : 'var(--v2-dim)' }}>{result ? (signal ? 'Active' : 'Waiting') : '—'}</span>
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BestPurchaseWindowCard;
