import React, { useMemo, useState } from 'react';
import { SUPPORTED_CHAINS } from '../../../constants/chains';
import { getProtocolConfig } from '../../../constants/protocols';
import { useV2 } from '../../context/V2Context';
import type { Strategy } from '../../../types/strategy';
import type { WalletItem } from '../../../types/wallet';
import { capitalize } from '../../../utils/format';
import MaskedValue from '../shared/MaskedValue';
import s from './StrategyCard.module.css';

interface Props {
  strategy: Strategy;
  portfolio: WalletItem[];
  onEdit?: () => void;
  onDelete: () => void;
}

export const AllocationStrategyCard: React.FC<Props> = ({ strategy, portfolio, onEdit, onDelete }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { maskValues } = useV2();

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const chainLogos: Record<string, string> = Object.fromEntries(
    SUPPORTED_CHAINS.map(c => [c.id.toLowerCase(), c.iconUrl])
  );

  const { status, deltas } = useMemo(() => {
    const rawAllocations = (strategy as any).allocations || (strategy as any).targetAllocations || [];
    const allocations = [...rawAllocations].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

    let maxDeviation = 0;
    let needsRebalance = false;
    let totalValue = 0;
    const calculatedDeltas: any[] = [];

    const normalizeGroup = (g: string) => {
      const n = g.replace(' Position', '').replace(' Pools', '').trim();
      if (n === 'Lending Supply' || n === 'Lending Borrow') return 'Lending';
      return n;
    };

    const isGeneralAlloc = (a: any) => a.group === 'General' || a.groupType === 50;

    const sumNonBorrowForSymbol = (symbol: string) => {
      let sum = 0;
      portfolio.forEach(item => {
        const tokens = item.position?.tokens || [];
        tokens.forEach((t: any) => {
          if (t.symbol !== symbol) return;
          const tt = (t.type || '').toString().toLowerCase();
          if (tt === 'borrowed' || tt === 'borrow') return;
          sum += Math.abs(t.financials?.totalPrice || 0);
        });
      });
      return sum;
    };

    const totalNonBorrowValue = portfolio.reduce((acc, item) => {
      const tokens = item.position?.tokens || [];
      return acc + tokens.reduce((s: number, t: any) => {
        const tt = (t.type || '').toString().toLowerCase();
        if (tt === 'borrowed' || tt === 'borrow') return s;
        return s + Math.abs(t.financials?.totalPrice || 0);
      }, 0);
    }, 0);

    if (allocations.length > 0) {
      const allocationsByGroup = new Map<string, typeof allocations>();
      allocations.forEach((a: any) => {
        const ng = isGeneralAlloc(a) ? 'General' : normalizeGroup(a.group);
        if (!allocationsByGroup.has(ng)) allocationsByGroup.set(ng, []);
        allocationsByGroup.get(ng)!.push(a);
      });

      const groupTotals = new Map<string, number>();
      allocationsByGroup.forEach((groupAllocs, ng) => {
        if (ng === 'General') {
          groupTotals.set(ng, totalNonBorrowValue);
          totalValue += totalNonBorrowValue;
          return;
        }
        let gt = 0;
        groupAllocs.forEach((alloc: any) => {
          const protocol = alloc.protocol?.id || alloc.protocol;
          const chain = alloc.chain?.id || alloc.chain;
          const filtered = portfolio.filter(item =>
            ng === 'Lending' ? item.type === 'LendingAndBorrowing' :
            ng === 'Liquidity' ? item.type === 'LiquidityPool' :
            ng === 'Staking' ? item.type === 'Staking' :
            ng === 'Wallet' ? item.type === 'Wallet' : true
          );
          const tokenSymbolForGroup = alloc.token?.symbol || alloc.symbol || alloc.assetKey;
          const matchedAssets = filtered.filter(item => {
            const sym = item.position?.tokens?.[0]?.symbol;
            const match = sym === alloc.assetKey || sym === tokenSymbolForGroup;
            if (!match) return false;
            if (protocol && chain) return item.protocol?.id === protocol && item.protocol?.chain === chain;
            return true;
          });
          const isSupply = alloc.group === 'Lending Supply' || alloc.positionType === 1;
          const isBorrow = alloc.group === 'Lending Borrow' || alloc.positionType === 2;
          matchedAssets.forEach(asset => {
            let tokens = asset.position?.tokens || [];
            if (isSupply) tokens = tokens.filter((t: any) => ['supplied', 'supply'].includes(t.type?.toLowerCase() || ''));
            else if (isBorrow) tokens = tokens.filter((t: any) => ['borrowed', 'borrow'].includes(t.type?.toLowerCase() || ''));
            gt += tokens.reduce((sum: number, t: any) => sum + Math.abs(t.financials?.totalPrice || 0), 0);
          });
        });
        groupTotals.set(ng, gt);
        totalValue += gt;
      });

      allocations.forEach((alloc: any) => {
        const isGeneral = isGeneralAlloc(alloc);
        const ng = isGeneral ? 'General' : normalizeGroup(alloc.group);
        const groupTotal = groupTotals.get(ng) || 0;
        const tokenSymbol = alloc.token?.symbol || alloc.symbol || alloc.assetKey;
        const tokenLogo = alloc.token?.logo || alloc.logo;

        if (isGeneral) {
          const currentValue = sumNonBorrowForSymbol(tokenSymbol);
          const currentWeight = groupTotal > 0 ? (currentValue / groupTotal) * 100 : 0;
          const deltaWeight = alloc.targetWeight - currentWeight;
          const deviation = Math.abs(deltaWeight);
          if (deviation > maxDeviation) maxDeviation = deviation;
          if (deviation > 5) needsRebalance = true;

          calculatedDeltas.push({
            symbol: tokenSymbol, logo: tokenLogo,
            group: 'General', protocolName: 'All', protocolLogo: null,
            chain: 'All', chainLogo: undefined,
            targetWeight: alloc.targetWeight, currentWeight, deltaWeight,
            targetValue: groupTotal * (alloc.targetWeight / 100), currentValue,
            deltaValue: groupTotal * (alloc.targetWeight / 100) - currentValue,
            needsRebalance: deviation > 5,
          });
          return;
        }

        const protocol = alloc.protocol?.id || alloc.protocol;
        const chain = alloc.chain?.id || alloc.chain;
        const protocolName = alloc.protocol?.name || 'Unknown';
        const protocolLogo = getProtocolConfig(alloc.protocol?.id || alloc.protocol?.name || '').logo || null;
        const chainName = chain || 'Unknown';
        const chainLogo = chainLogos[chainName.toLowerCase()] || undefined;

        const filtered = portfolio.filter(item =>
          ng === 'Lending' ? item.type === 'LendingAndBorrowing' :
          ng === 'Liquidity' ? item.type === 'LiquidityPool' :
          ng === 'Staking' ? item.type === 'Staking' :
          ng === 'Wallet' ? item.type === 'Wallet' : true
        );
        const matches = filtered.filter(item => {
          const sym = item.position?.tokens?.[0]?.symbol;
          const match = sym === alloc.assetKey || sym === tokenSymbol;
          if (!match) return false;
          if (protocol && chain) return item.protocol?.id === protocol && item.protocol?.chain === chain;
          return true;
        });

        const isSupply = alloc.group === 'Lending Supply' || alloc.positionType === 1;
        const isBorrow = alloc.group === 'Lending Borrow' || alloc.positionType === 2;
        const currentValue = matches.reduce((total, asset) => {
          let tokens = asset.position?.tokens || [];
          if (isSupply) tokens = tokens.filter((t: any) => ['supplied', 'supply'].includes(t.type?.toLowerCase() || ''));
          else if (isBorrow) tokens = tokens.filter((t: any) => ['borrowed', 'borrow'].includes(t.type?.toLowerCase() || ''));
          return total + tokens.reduce((sum: number, t: any) => sum + Math.abs(t.financials?.totalPrice || 0), 0);
        }, 0);

        const currentWeight = groupTotal > 0 ? (currentValue / groupTotal) * 100 : 0;
        const deltaWeight = alloc.targetWeight - currentWeight;
        const deviation = Math.abs(deltaWeight);
        if (deviation > maxDeviation) maxDeviation = deviation;
        if (deviation > 5) needsRebalance = true;

        calculatedDeltas.push({
          symbol: tokenSymbol, logo: tokenLogo,
          group: alloc.group, protocolName, protocolLogo,
          chain: chainName === 'Unknown' ? 'Unknown' : capitalize(chainName), chainLogo,
          targetWeight: alloc.targetWeight, currentWeight, deltaWeight,
          targetValue: groupTotal * (alloc.targetWeight / 100), currentValue,
          deltaValue: groupTotal * (alloc.targetWeight / 100) - currentValue,
          needsRebalance: deviation > 5,
        });
      });
    }

    const actionCount = calculatedDeltas.filter(d => Math.abs(d.deltaWeight) > 0.5).length;
    return { status: { needsRebalance, maxDeviation, assetsCount: allocations.length, totalValue, actionCount }, deltas: calculatedDeltas };
  }, [strategy, portfolio]);

  const dotColor = status.actionCount === 0 ? 'var(--v2-green)' : status.maxDeviation > 10 ? 'var(--v2-red)' : 'var(--v2-yellow)';
  const statColor = status.actionCount === 0 ? 'var(--v2-green)' : 'var(--v2-yellow)';

  return (
    <div className={s.card}>
      <div className={s.header} onClick={() => setCollapsed(v => !v)}>
        <div className={s.dot} style={{ background: dotColor }} />
        <div className={s.headerMeta}>
          <div className={s.name}>{strategy.name || 'Allocation Strategy'}</div>
          <div className={s.sub}>{status.assetsCount} assets · max deviation {isFinite(status.maxDeviation) ? status.maxDeviation.toFixed(1) : '0.0'}%</div>
        </div>
        <div className={s.stat}>
          <div className={s.statVal} style={{ color: statColor }}>
            {status.actionCount > 0 ? `${status.actionCount} actions` : 'On track'}
          </div>
          <div className={s.statLbl}>Status</div>
        </div>
        <div className={s.actions} onClick={e => e.stopPropagation()}>
          {onEdit && (
            <button className={s.iconBtn} onClick={onEdit} title="Edit">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"/></svg>
            </button>
          )}
          <button className={`${s.iconBtn} ${s.iconBtnDanger}`} onClick={onDelete} title="Delete">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 4h10M6 4V2h4v2M5 4l.5 9h5l.5-9"/></svg>
          </button>
        </div>
        <svg className={`${s.chevron} ${!collapsed ? s.chevronOpen : ''}`} width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {!collapsed && deltas.length > 0 && (
        <div className={s.body}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={s.tl}>Asset</th>
                  <th className={s.tl}>Protocol</th>
                  <th className={s.tl}>Chain</th>
                  <th className={s.tc}>Target</th>
                  <th className={s.tc}>Current</th>
                  <th className={s.tc}>Delta</th>
                  <th className={s.tc}>Value</th>
                  <th className={s.tc}>Action</th>
                </tr>
              </thead>
              <tbody>
                {deltas.map((d, i) => {
                  const actionLabel = Math.abs(d.deltaWeight) <= 0.5 ? 'Hold' :
                    d.group === 'Lending Borrow' ? (d.deltaValue > 0 ? 'Borrow' : 'Repay') :
                    (d.deltaValue > 0 ? 'Buy' : 'Sell');
                  const actionClass = actionLabel === 'Hold' ? s.chipHold :
                    (actionLabel === 'Buy' || actionLabel === 'Borrow') ? s.chipBuy : s.chipSell;
                  const deltaClass = d.deltaWeight > 0.5 ? s.deltaPos : d.deltaWeight < -0.5 ? s.deltaNeg : s.deltaNeu;

                  return (
                    <tr key={i}>
                      <td className={s.tl}>
                        <div className={s.cellWithLogo}>
                          {d.logo ? <img src={d.logo} alt={d.symbol} className={s.tokenImg} onError={e => (e.target as HTMLImageElement).style.display = 'none'} /> : <div className={s.logoFallback}>{(d.symbol || '?')[0]}</div>}
                          <span className={s.bold}>{d.symbol}</span>
                        </div>
                      </td>
                      <td className={s.tl}>
                        <div className={s.cellWithLogo}>
                          {d.protocolLogo && <img src={d.protocolLogo} alt={d.protocolName} className={s.tokenImg} onError={e => (e.target as HTMLImageElement).style.display = 'none'} />}
                          <span>{d.protocolName}</span>
                        </div>
                      </td>
                      <td className={s.tl}>
                        <div className={s.cellWithLogo}>
                          {d.chainLogo && <img src={d.chainLogo} alt={d.chain} className={s.tokenImg} onError={e => (e.target as HTMLImageElement).style.display = 'none'} />}
                          <span>{d.chain ? d.chain.charAt(0).toUpperCase() + d.chain.slice(1) : ''}</span>
                        </div>
                      </td>
                      <td className={s.tc}>
                        <div className={s.targetCell}>
                          <div className={s.barWrap}><div className={s.barFill} style={{ width: `${Math.min(d.targetWeight, 100)}%` }} /></div>
                          <span>{d.targetWeight.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className={s.tc}>{d.currentWeight.toFixed(1)}%</td>
                      <td className={s.tc}><span className={deltaClass}>{d.deltaWeight > 0 ? '+' : ''}{d.deltaWeight.toFixed(1)}%</span></td>
                      <td className={s.tc}><MaskedValue value={fmt(d.currentValue)} /></td>
                      <td className={s.tc}><span className={`${s.chip} ${actionClass}`}>{actionLabel}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllocationStrategyCard;
