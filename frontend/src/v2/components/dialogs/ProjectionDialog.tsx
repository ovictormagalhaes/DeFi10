import React, { useState, useEffect } from 'react';
import { formatPrice } from '../../../utils/walletUtils';
import type { ProjectionBreakdownItem, PoolShareData } from '../../context/V2Context';
import PoolShareBanner from '../../../components/cards/PoolShareBanner';
import s from './ProjectionDialog.module.css';

interface ProjectionTarget {
  level: 'token' | 'protocol' | 'global';
  name: string;
  context: string;
  rate?: number;
  baseUsd?: number;
  logoUrl?: string;
  preCalculated?: {
    oneDay?: number;
    oneWeek?: number;
    oneMonth?: number;
    oneYear?: number;
  };
  breakdownItems?: ProjectionBreakdownItem[];
  shareData?: PoolShareData;
}

interface Props {
  target: ProjectionTarget;
  onClose: () => void;
}

const PERIODS = [
  { key: '1D', label: '1 Day', days: 1 },
  { key: '1W', label: '1 Week', days: 7 },
  { key: '1M', label: '1 Month', days: 30 },
  { key: '3M', label: '3 Months', days: 90 },
  { key: '1Y', label: '1 Year', days: 365 },
] as const;

type PeriodKey = typeof PERIODS[number]['key'];

function projectLinear(base: number, annualRate: number, days: number): number {
  return base * annualRate * (days / 365);
}

function projectCompound(base: number, annualRate: number, days: number): number {
  return base * (Math.pow(1 + annualRate, days / 365) - 1);
}

function itemGain(item: ProjectionBreakdownItem, period: PeriodKey, days: number, customRate: string): number {
  const rate = customRate !== '' ? parseFloat(customRate) / 100 : item.rate;
  const pc = item.preCalculated;
  const pcMap: Record<string, number | undefined> = pc ? {
    '1D': pc.oneDay, '1W': pc.oneWeek, '1M': pc.oneMonth,
    '3M': pc.oneMonth != null ? pc.oneMonth * 3 : undefined, '1Y': pc.oneYear,
  } : {};
  const gain = (customRate === '' && pcMap[period] != null)
    ? pcMap[period]!
    : projectLinear(item.baseUsd, rate, days);
  return item.type === 'cost' ? -gain : gain;
}

export const ProjectionDialog: React.FC<Props> = ({ target, onClose }) => {
  const [period, setPeriod] = useState<PeriodKey>('1M');
  const [customRate, setCustomRate] = useState<string>('');
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const base = target.baseUsd ?? 0;
  const defaultRate = target.rate ?? 0;
  const rate = customRate !== '' ? parseFloat(customRate) / 100 : defaultRate;
  const selectedPeriod = PERIODS.find(p => p.key === period) ?? PERIODS[2];

  const pc = target.preCalculated;
  const preCalcMap: Record<string, number | undefined> = pc ? {
    '1D': pc.oneDay, '1W': pc.oneWeek, '1M': pc.oneMonth,
    '3M': pc.oneMonth != null ? pc.oneMonth * 3 : undefined, '1Y': pc.oneYear,
  } : {};
  const usePreCalc = pc != null && customRate === '';

  const getGain = (key: string, days: number): number => {
    if (target.breakdownItems?.length) {
      return target.breakdownItems.reduce((s, item) => s + itemGain(item, key as PeriodKey, days, customRate), 0);
    }
    if (usePreCalc && preCalcMap[key] != null) return preCalcMap[key]!;
    return projectCompound(base, rate, days);
  };

  const gain = getGain(period, selectedPeriod.days);
  const projected = base + gain;
  const hasBreakdown = (target.breakdownItems?.length ?? 0) > 0;

  const netAvgApy = hasBreakdown && target.breakdownItems
    ? (() => {
        const netAnnual = target.breakdownItems.reduce((sum, item) => {
          const ann = item.rate * item.baseUsd;
          return sum + (item.type === 'cost' ? -ann : ann);
        }, 0);
        const totalBase = target.breakdownItems.reduce((sum, item) => sum + item.baseUsd, 0);
        return totalBase > 0 ? netAnnual / totalBase : 0;
      })()
    : defaultRate;

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} onClick={e => e.stopPropagation()}>

        <div className={s.header}>
          <div className={s.headerLeft}>
            <div className={s.icon}>
              {target.logoUrl ? (
                <img src={target.logoUrl} alt={target.name} className={s.iconImg}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span className={s.iconInitial}>{target.name[0].toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className={s.title}>{target.name}</div>
              <div className={s.sub}>
                {target.context}
                {rate > 0 && (
                  <>
                    {' · '}
                    <span className={customRate !== '' ? s.subRateCustom : undefined}>
                      {(rate * 100).toFixed(2)}% {hasBreakdown && customRate === '' ? 'avg ' : ''}APY{customRate !== '' && ' (custom)'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button className={s.closeBtn} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={s.miniChart}>
          {PERIODS.map(p => {
            const g = getGain(p.key, p.days);
            const maxG = Math.max(...PERIODS.map(pp => Math.abs(getGain(pp.key, pp.days))));
            const pct = maxG > 0 ? (Math.abs(g) / maxG) * 100 : 0;
            const on = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                className={`${s.miniBar} ${on ? s.miniBarOn : ''}`}
                onClick={() => setPeriod(p.key)}
                title={`Switch to ${p.label}`}
              >
                <div className={s.miniBarVal}>{formatPrice(g)}</div>
                <div className={s.miniBarTrack}>
                  <div
                    className={s.miniBarFill}
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      background: on ? 'var(--v2-accent)' : 'var(--v2-bg-hover)',
                    }}
                  />
                </div>
                <div className={s.miniBarLabel}>{p.key}</div>
              </button>
            );
          })}
        </div>

        {hasBreakdown ? (
          <div className={s.breakdownSection}>
            {target.breakdownItems!.map((item, i) => {
              const g = itemGain(item, period, selectedPeriod.days, customRate);
              const annual = itemGain(item, '1Y', 365, customRate);
              const rateDisplay = `${(item.rate * 100).toFixed(1)}% APY · ${formatPrice(item.baseUsd)}`;
              return (
                <div key={i} className={s.bdRow}>
                  <div className={s.bdLeft}>
                    <div className={s.bdIcon} style={{
                      background: item.type === 'cost' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                      color: item.type === 'cost' ? 'var(--v2-red)' : 'var(--v2-green)',
                    }}>
                      {item.logoUrl ? (
                        <img src={item.logoUrl} alt={item.symbol ?? ''} width={14} height={14}
                          style={{ borderRadius: '50%' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        (item.symbol ?? item.name)[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className={s.bdName}>{item.name}</div>
                      <div className={s.bdRate}>{rateDisplay}</div>
                    </div>
                  </div>
                  <div className={s.bdRight}>
                    <div className={s.bdEarn} style={{ color: g >= 0 ? 'var(--v2-green)' : 'var(--v2-red)' }}>
                      {g >= 0 ? '+' : ''}{formatPrice(g)}
                    </div>
                    <div className={s.bdAnnual}>{annual >= 0 ? '+' : ''}{formatPrice(annual)} / yr</div>
                  </div>
                </div>
              );
            })}

            <div className={s.bdNet}>
              <div className={s.bdLeft}>
                <div className={s.bdIcon} style={{ background: gain >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: gain >= 0 ? 'var(--v2-green)' : 'var(--v2-red)', fontWeight: 800 }}>
                  Σ
                </div>
                <div>
                  <div className={s.bdName} style={{ fontWeight: 700 }}>Net earnings</div>
                  {netAvgApy !== 0 && (
                    <div className={s.bdRate}>{(netAvgApy * 100).toFixed(2)}% avg APY</div>
                  )}
                </div>
              </div>
              <div className={s.bdRight}>
                <div className={s.bdEarnBig} style={{ color: gain >= 0 ? 'var(--v2-green)' : 'var(--v2-red)' }}>
                  {gain >= 0 ? '+' : ''}{formatPrice(gain)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={s.result}>
            <div className={s.resultLabel}>Projected · {selectedPeriod.label}</div>
            <div className={s.fromTo}>
              <span className={s.fromVal}>{formatPrice(base)}</span>
              <span className={s.arrow}>→</span>
              <span className={s.toVal}>{formatPrice(projected)}</span>
            </div>
            <div className={s.resultGain} style={{ color: gain >= 0 ? 'var(--v2-green)' : 'var(--v2-red)' }}>
              {gain >= 0 ? '+' : ''}{formatPrice(gain)} ({gain >= 0 ? '+' : ''}{base > 0 ? ((gain / base) * 100).toFixed(2) : '0.00'}%)
            </div>
          </div>
        )}

        <div className={s.rateRow}>
          <label className={s.rateLabel}>{netAvgApy === 0 ? 'Enter APY %' : 'Custom APY %'}</label>
          <input
            type="number"
            className={s.rateInput}
            placeholder={`${(netAvgApy * 100).toFixed(2)}`}
            value={customRate}
            onChange={e => setCustomRate(e.target.value)}
            min="0"
            max="10000"
            step="0.1"
          />
          {customRate !== '' && (
            <button
              type="button"
              className={s.resetBtn}
              onClick={() => setCustomRate('')}
              title="Reset to default APY"
            >
              ↺
            </button>
          )}
        </div>

        {target.shareData && (
          <div className={s.actionRow}>
            <button
              type="button"
              className={s.shareBtn}
              onClick={() => setShowShare(true)}
              title="Share pool"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Share pool
            </button>
          </div>
        )}

        <div className={s.disclaimer}>
          Projections are estimates. Past performance is not indicative of future results.
        </div>
      </div>

      {showShare && target.shareData && (
        <PoolShareBanner
          {...target.shareData}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
};

export default ProjectionDialog;
