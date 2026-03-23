import { config } from '../config/api';

export const STORAGE_KEY = 'wallet_account';
export const EXPIRY_HOURS = 48;
export const API_BASE = config.API_BASE_URL + '/api/v1';

export interface ColumnVisibility {
  showBalanceColumn: boolean;
  showUnitPriceColumn: boolean;
  showPoolSubtotals: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  showBalanceColumn: true,
  showUnitPriceColumn: true,
  showPoolSubtotals: true,
};

export interface ExpansionStates {
  tokensExpanded: boolean;
  liquidityPoolsExpanded: boolean;
  defiPositionsExpanded: boolean;
}

export const DEFAULT_EXPANSION_STATES: ExpansionStates = {
  tokensExpanded: true,
  liquidityPoolsExpanded: true,
  defiPositionsExpanded: true,
};

export interface FilterSettings {
  showOnlyPositiveBalance: boolean;
}

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  showOnlyPositiveBalance: true,
};
