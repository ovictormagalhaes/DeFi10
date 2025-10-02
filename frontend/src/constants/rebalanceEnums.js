// Frontend mirror of backend RebalanceAssetType and RebalanceReferenceType numeric values
// Backend: Unknown=0, Wallet=1, LiquidityPool=2, LendingAndBorrowing=3, Staking=4, Token=5, Group=6, Protocol=7, Other=50
// NOTE: Previously frontend used ITEM_TYPES.GROUP = 98 (virtual). We'll migrate to backend-aligned numeric enums.

export const RebalanceAssetType = Object.freeze({
  Unknown: 0,
  Wallet: 1,
  LiquidityPool: 2,
  LendingAndBorrowing: 3,
  Staking: 4,
  Token: 5,
  Group: 6,
  Protocol: 7,
  Other: 50,
});

// Reference types (ByGroupType in backend RebalanceItem): Token=0, Protocol=1, Group=2, TotalWallet=3
export const RebalanceReferenceTypeEnum = Object.freeze({
  Token: 0,
  Protocol: 1,
  Group: 2,
  TotalWallet: 3,
});

export const RebalanceAssetTypeLabel = {
  [RebalanceAssetType.Wallet]: 'Wallet',
  [RebalanceAssetType.LiquidityPool]: 'Liquidity Pools',
  [RebalanceAssetType.LendingAndBorrowing]: 'Lending Position', // singular naming safe now
  [RebalanceAssetType.Staking]: 'Staking Position',
  [RebalanceAssetType.Group]: 'Group',
  [RebalanceAssetType.Protocol]: 'Protocol',
  [RebalanceAssetType.Token]: 'Token',
  [RebalanceAssetType.Other]: 'Other',
};

export function getAssetTypeLabel(t){
  return RebalanceAssetTypeLabel[t] || 'Unknown';
}
