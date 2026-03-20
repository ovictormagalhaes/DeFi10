/**
 * Strategy Module - Central Export
 * Import tudo que você precisa para trabalhar com estratégias de alocação
 */

// ============================================================================
// TYPES
// ============================================================================
export type {
  Strategy,
  StrategyType,
  TargetAllocation,
  StrategyItem,
  StrategyAssetMetadata,
  TokenMetadata,
  ProtocolMetadata,
  StrategyAsset,
  AllocationDelta,
  SaveStrategyRequest,
  SaveStrategyResponse,
  GroupType,
} from './types/strategy';

export { GroupTypeMapping } from './types/strategy';

// ============================================================================
// HOOKS
// ============================================================================
export { useStrategy, type UseStrategyResult } from './hooks/useStrategy';

// ============================================================================
// COMPONENTS
// ============================================================================
export { StrategyAllocationView } from './components/StrategyAllocationView';
export { AllocationChart } from './components/charts/AllocationChart';
export { default as StrategyManagementExample } from './components/StrategyManagementExample';

// ============================================================================
// UTILITIES - Metadata
// ============================================================================
export {
  extractMetadata,
  findAssetInPortfolio,
  getAssetType,
  getPositionTypeNumber,
  getTokenTypeNumber,
  mapGroupToType,
  getChainId,
  matchesAsset,
  getSymbolFromPortfolio,
  getNameFromPortfolio,
  getFirstTokenLogo,
  getSecondTokenLogo,
  getTierPercent,
  getTotalValueUsd,
  validateGroupAllocation,
  validateAssetsExist,
} from './utils/strategyMetadata';

// ============================================================================
// UTILITIES - Calculations
// ============================================================================
export {
  calculateAllocationDeltas,
  getAllocationSummary,
  getDeltasForGroup,
  getAssetsNeedingRebalance,
  sortByDeviation,
  suggestRebalanceActions,
  type RebalanceAction,
} from './utils/allocationCalculations';

// ============================================================================
// UTILITIES - Helpers
// ============================================================================
export {
  createAllocationStrategyExample,
  formatAllocationDelta,
  getRebalanceActionLabel,
  calculateRequiredAction,
  needsAttention,
} from './utils/strategyHelpers';

// ============================================================================
// API CLIENT
// ============================================================================
export { saveStrategy, getStrategyByGroup } from './services/apiClient';
