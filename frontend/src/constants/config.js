// Application constants and configuration

export const STORAGE_KEY = 'wallet_account'
export const EXPIRY_HOURS = 48
export const API_BASE = 'https://localhost:10001/api/v1'

// Default state configurations
export const DEFAULT_COLUMN_VISIBILITY = {
  showBalanceColumn: true,
  showUnitPriceColumn: true,
  showPoolSubtotals: true
}

export const DEFAULT_EXPANSION_STATES = {
  tokensExpanded: true,
  liquidityPoolsExpanded: true,
  defiPositionsExpanded: true
}

export const DEFAULT_FILTER_SETTINGS = {
  showOnlyPositiveBalance: true
}
