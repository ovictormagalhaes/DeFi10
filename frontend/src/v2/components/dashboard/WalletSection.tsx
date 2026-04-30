import React, { useMemo } from 'react';
import { useV2 } from '../../context/V2Context';
import { SectionHeader } from '../shared/SectionHeader';
import { formatPrice, formatTokenAmount } from '../../../utils/walletUtils';
import MaskedValue from '../shared/MaskedValue';
import SafeImage from '../../../components/SafeImage';
import { ChainIcon } from '../shared/ChainIcon';
import s from './WalletSection.module.css';

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function tokenVal(t: any): number {
  const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? 0);
  return isFinite(v) && v > 0 ? v : 0;
}

function useFiltered(items: any[]) {
  const { positionSearch, selectedChains } = useV2();
  return useMemo(() => {
    let result = items;
    if (selectedChains) {
      result = result.filter(item => {
        const chain = item.token?.chain ?? item.protocol?.chain ?? '';
        return selectedChains.has(String(chain).trim().toLowerCase());
      });
    }
    if (positionSearch.trim()) {
      const q = positionSearch.toLowerCase();
      result = result.filter(item => {
        const t = item.token ?? item;
        return (
          (t.symbol ?? '').toLowerCase().includes(q) ||
          (t.name ?? '').toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [items, selectedChains, positionSearch]);
}

interface Props {
  items: any[];
}

export const WalletSection: React.FC<Props> = ({ items }) => {
  const { openProjection } = useV2();
  const filtered = useFiltered(items);

  if (filtered.length === 0) return null;

  const total = filtered.reduce((s, item) => s + tokenVal(item.token ?? item), 0);

  return (
    <div className={s.section}>
      <SectionHeader title="Wallet" count={filtered.length} total={formatPrice(total)} />
      <div className={s.grid}>
        {filtered.map((item, i) => {
          const tok = item.token ?? item;
          const val = tokenVal(tok);
          const amt = formatTokenAmount(tok, 4);
          const logo = tok.logo ?? tok.thumbnail ?? null;
          const symbol = tok.symbol ?? '?';
          const name = tok.name ?? symbol;
          const chain = tok.chain ?? item.protocol?.chain ?? '';

          return (
            <div
              key={i}
              className={s.card}
              onClick={() => openProjection({
                level: 'token',
                name: symbol,
                context: name,
                baseUsd: val,
                logoUrl: logo ?? undefined,
              })}
            >
              <div className={s.cardTop}>
                <div className={s.tokenIcon}>
                  {logo ? (
                    <SafeImage
                      src={logo}
                      alt={symbol}
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className={s.tokenInitial}>{symbol[0]}</div>
                  )}
                </div>
                <div className={s.tokenInfo}>
                  <div className={s.tokenSymbol}>{symbol}</div>
                  {chain && (
                    <div className={s.chainBadge}>
                      <ChainIcon name={chain} />
                      {cap(chain)}
                    </div>
                  )}
                </div>
                <div className={s.tokenValue}>
                  <MaskedValue value={formatPrice(val)} />
                </div>
              </div>
              <div className={s.cardBot}>
                <span className={s.tokenAmt}>
                  <MaskedValue value={`${amt} ${symbol}`} />
                </span>
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WalletSection;
