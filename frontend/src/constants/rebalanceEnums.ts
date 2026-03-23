export const RebalanceAssetType = {
  Unknown: 0,
  Wallet: 1,
  LiquidityPool: 2,
  LendingAndBorrowing: 3,
  Staking: 4,
  Token: 5,
  Group: 6,
  Protocol: 7,
  Depositing: 8,
  Locking: 9,
  LendingSupply: 10,
  LendingBorrow: 11,
  Other: 50,
} as const;

export type RebalanceAssetTypeValue = typeof RebalanceAssetType[keyof typeof RebalanceAssetType];

export const RebalanceReferenceTypeEnum = {
  Token: 0,
  Protocol: 1,
  Group: 2,
  TotalWallet: 3,
} as const;

export type RebalanceReferenceTypeValue = typeof RebalanceReferenceTypeEnum[keyof typeof RebalanceReferenceTypeEnum];

export const RebalanceAssetTypeLabel: Record<number, string> = {
  [RebalanceAssetType.Wallet]: 'Wallet',
  [RebalanceAssetType.LiquidityPool]: 'Liquidity Pools',
  [RebalanceAssetType.LendingAndBorrowing]: 'Lending Position',
  [RebalanceAssetType.Staking]: 'Staking Position',
  [RebalanceAssetType.Depositing]: 'Depositing Position',
  [RebalanceAssetType.Locking]: 'Locking Position',
  [RebalanceAssetType.LendingSupply]: 'Lending Supply',
  [RebalanceAssetType.LendingBorrow]: 'Lending Borrow',
  [RebalanceAssetType.Group]: 'Group',
  [RebalanceAssetType.Protocol]: 'Protocol',
  [RebalanceAssetType.Token]: 'Token',
  [RebalanceAssetType.Other]: 'Other',
};

export function getAssetTypeLabel(t: number): string {
  return RebalanceAssetTypeLabel[t] || 'Unknown';
}
