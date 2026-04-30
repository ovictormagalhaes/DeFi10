import type { TokenLike } from '../../utils/walletUtils';

export interface V2Breakdown {
  walletValue: number;
  lendingSupplied: number;
  lendingBorrowed: number;
  lendingNet: number;
  poolValue: number;
  stakingValue: number;
  totalValue: number;
}

function tokenVal(t: any): number {
  const v = parseFloat(t?.financials?.totalPrice ?? t?.totalPrice ?? 0);
  return isFinite(v) && v > 0 ? v : 0;
}

function positionTokens(item: any): any[] {
  return item?.position?.tokens ?? item?.tokens ?? [];
}

export function computeV2Breakdown({
  walletTokens,
  lendingItems,
  poolItems,
  stakingItems,
}: {
  walletTokens: any[];
  lendingItems: any[];
  poolItems: any[];
  stakingItems: any[];
}): V2Breakdown {
  const walletValue = walletTokens.reduce((s, item) => s + tokenVal(item.token ?? item), 0);

  let lendingSupplied = 0;
  let lendingBorrowed = 0;
  lendingItems.forEach((item) => {
    positionTokens(item).forEach((t: any) => {
      const type = (t?.type ?? '').toString().toLowerCase();
      const v = tokenVal(t);
      if (type === 'supplied' || type === 'supply' || type === 'deposit') lendingSupplied += v;
      else if (type === 'borrowed' || type === 'borrow' || type === 'debt') lendingBorrowed += v;
    });
  });

  const poolValue = poolItems.reduce((s, item) => {
    return (
      s +
      positionTokens(item)
        .filter((t: any) => {
          const type = (t?.type ?? '').toString().toLowerCase();
          return type !== 'reward' && type !== 'rewards' && !type.includes('fee');
        })
        .reduce((ts: number, t: any) => ts + tokenVal(t), 0)
    );
  }, 0);

  const stakingValue = stakingItems.reduce((s, item) => {
    return (
      s +
      positionTokens(item)
        .filter((t: any) => {
          const type = (t?.type ?? '').toString().toLowerCase();
          return type !== 'reward' && type !== 'rewards';
        })
        .reduce((ts: number, t: any) => ts + tokenVal(t), 0)
    );
  }, 0);

  const lendingNet = lendingSupplied - lendingBorrowed;
  const totalValue = walletValue + lendingNet + poolValue + stakingValue;

  return {
    walletValue,
    lendingSupplied,
    lendingBorrowed,
    lendingNet,
    poolValue,
    stakingValue,
    totalValue,
  };
}
