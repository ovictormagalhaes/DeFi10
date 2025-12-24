/**
 * Sistema de Validação de Tipos em Runtime
 * Garante que os dados da API correspondem às interfaces TypeScript definidas
 */

import type {
  WalletItem,
  Token,
  Position,
  Protocol,
  AdditionalData,
  Range,
  Financials,
} from './wallet';

const validationLog = {
  errors: [] as string[],
  warnings: [] as string[],

  error(message: string) {
    this.errors.push(message);
    console.error(`[TypeScript Validator] ERROR: ${message}`);
  },

  warn(message: string) {
    this.warnings.push(message);
    console.warn(`[TypeScript Validator] WARNING: ${message}`);
  },

  clear() {
    this.errors = [];
    this.warnings = [];
  },

  getReport() {
    return {
      errors: [...this.errors],
      warnings: [...this.warnings],
      isValid: this.errors.length === 0,
    };
  },
};

export const TypeGuards = {
  isString(value: any): value is string {
    return typeof value === 'string';
  },

  isNumber(value: any): value is number {
    return typeof value === 'number' && !isNaN(value);
  },

  isBoolean(value: any): value is boolean {
    return typeof value === 'boolean';
  },

  isObject(value: any): value is object {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  },

  isArray(value: any): value is any[] {
    return Array.isArray(value);
  },

  isFinancials(value: any): value is Financials {
    if (!this.isObject(value)) return false;
    const obj = value as any;

    const required = ['amount', 'totalPrice'];
    const optional = ['decimalPlaces', 'amountFormatted', 'balanceFormatted', 'price'];

    for (const field of required) {
      if (!(field in obj) || !this.isNumber(obj[field])) {
        validationLog.error(`Financials.${field} is missing or not a number`);
        return false;
      }
    }

    for (const field of optional) {
      if (field in obj && !this.isNumber(obj[field])) {
        validationLog.warn(`Financials.${field} exists but is not a number`);
      }
    }

    return true;
  },

  isToken(value: any): value is Token {
    if (!this.isObject(value)) {
      validationLog.error('Token is not an object');
      return false;
    }
    const obj = value as any;

    const required = ['name', 'symbol', 'contractAddress', 'financials'];

    for (const field of required) {
      if (!(field in value)) {
        validationLog.error(`Token.${field} is missing`);
        return false;
      }
    }

    if (!this.isString(obj.name)) {
      validationLog.error('Token.name is not a string');
      return false;
    }

    if (!this.isString(obj.symbol)) {
      validationLog.error('Token.symbol is not a string');
      return false;
    }

    if (!this.isString(obj.contractAddress)) {
      validationLog.error('Token.contractAddress is not a string');
      return false;
    }

    if (!this.isFinancials(obj.financials)) {
      validationLog.error('Token.financials is invalid');
      return false;
    }

    return true;
  },

  isRange(value: any): value is Range {
    if (!this.isObject(value)) return false;
    const obj = value as any;

    const required = ['upper', 'lower', 'current', 'inRange'];

    for (const field of required) {
      if (!(field in value)) {
        validationLog.error(`Range.${field} is missing`);
        return false;
      }
    }

    if (!this.isNumber(obj.upper) || !this.isNumber(obj.lower) || !this.isNumber(obj.current)) {
      validationLog.error('Range numeric fields are invalid');
      return false;
    }

    if (!this.isBoolean(obj.inRange)) {
      validationLog.error('Range.inRange is not a boolean');
      return false;
    }

    return true;
  },

  isAdditionalData(value: any): value is AdditionalData {
    if (!this.isObject(value)) return false;

    if ('range' in value && value.range !== null && !this.isRange(value.range)) {
      validationLog.error('AdditionalData.range is invalid');
      return false;
    }

    if ('fees24h' in value && value.fees24h !== null && !this.isNumber(value.fees24h)) {
      validationLog.warn('AdditionalData.fees24h is not a number');
    }

    if (
      'healthFactor' in value &&
      value.healthFactor !== null &&
      !this.isNumber(value.healthFactor)
    ) {
      validationLog.warn('AdditionalData.healthFactor is not a number');
    }

    return true;
  },
  isPosition(value: any): value is Position {
    if (!this.isObject(value)) {
      validationLog.error('Position is not an object');
      return false;
    }

    if (!('label' in value) || !this.isString(value.label)) {
      validationLog.error('Position.label is missing or not a string');
      return false;
    }

    if (!('tokens' in value) || !this.isArray(value.tokens)) {
      validationLog.error('Position.tokens is missing or not an array');
      return false;
    }

    // Validar cada token
    for (let i = 0; i < value.tokens.length; i++) {
      if (!this.isToken(value.tokens[i])) {
        validationLog.error(`Position.tokens[${i}] is invalid`);
        return false;
      }
    }

    return true;
  },

  isProtocol(value: any): value is Protocol {
    if (!this.isObject(value)) return false;
    const obj = value as any;

    const required = ['name', 'chain', 'id'];

    for (const field of required) {
      if (!(field in obj) || !this.isString(obj[field])) {
        validationLog.error(`Protocol.${field} is missing or not a string`);
        return false;
      }
    }

    return true;
  },

  // Validação de WalletItem
  isWalletItem(value: any): value is WalletItem {
    if (!this.isObject(value)) {
      validationLog.error('WalletItem is not an object');
      return false;
    }
    const obj = value as any;

    // Validar type
    const validTypes = [
      'Wallet',
      'LiquidityPool',
      'LendingAndBorrowing',
      'Staking',
      'Locking',
      'Depositing',
    ];
    if (!('type' in obj) || !validTypes.includes(obj.type)) {
      validationLog.error(
        `WalletItem.type is invalid. Expected: ${validTypes.join(', ')}, got: ${obj.type}`
      );
      return false;
    }

    // Validar protocol
    if (!('protocol' in obj) || !this.isProtocol(obj.protocol)) {
      validationLog.error('WalletItem.protocol is invalid');
      return false;
    }

    // Validar position
    if (!('position' in obj) || !this.isPosition(obj.position)) {
      validationLog.error('WalletItem.position is invalid');
      return false;
    }

    // Validar additionalData (pode ser null)
    if ('additionalData' in obj && obj.additionalData !== null) {
      if (!this.isAdditionalData(obj.additionalData)) {
        validationLog.error('WalletItem.additionalData is invalid');
        return false;
      }
    }

    return true;
  },
};

// Validadores de alto nível
export const Validators = {
  // Validar array de WalletItems
  validateWalletData(data: any[]): {
    isValid: boolean;
    validItems: WalletItem[];
    errors: string[];
    warnings: string[];
  } {
    validationLog.clear();

    if (!TypeGuards.isArray(data)) {
      validationLog.error('Wallet data is not an array');
      return {
        isValid: false,
        validItems: [],
        errors: validationLog.errors,
        warnings: validationLog.warnings,
      };
    }

    const validItems: WalletItem[] = [];

    data.forEach((item, index) => {
      if (TypeGuards.isWalletItem(item)) {
        validItems.push(item);
      } else {
        validationLog.error(`Item at index ${index} is not a valid WalletItem`);
      }
    });

    const report = validationLog.getReport();

    return {
      isValid: report.isValid,
      validItems,
      errors: report.errors,
      warnings: report.warnings,
    };
  },

  // Validar item individual
  validateSingleItem(item: any): {
    isValid: boolean;
    item: WalletItem | null;
    errors: string[];
    warnings: string[];
  } {
    validationLog.clear();

    const isValid = TypeGuards.isWalletItem(item);
    const report = validationLog.getReport();

    return {
      isValid,
      item: isValid ? item : null,
      errors: report.errors,
      warnings: report.warnings,
    };
  },

  // Validação parcial (mais tolerante)
  validatePartialItem(item: any): { hasValidStructure: boolean; warnings: string[] } {
    validationLog.clear();

    let hasValidStructure = true;

    if (!TypeGuards.isObject(item)) {
      hasValidStructure = false;
      validationLog.warn('Item is not an object');
    }

    // Verificações básicas necessárias para funcionalidade
    if (!('type' in item)) {
      validationLog.warn('Missing type field - using fallback logic');
    }

    if (!('position' in item) && !('tokens' in item)) {
      validationLog.warn('Missing both position and tokens - may cause display issues');
    }

    return {
      hasValidStructure,
      warnings: validationLog.warnings,
    };
  },
};

// Hook para usar validação em componentes React
export const useTypeValidation = () => {
  return {
    validateWalletData: Validators.validateWalletData,
    validateItem: Validators.validateSingleItem,
    validatePartial: Validators.validatePartialItem,
    TypeGuards,
  };
};

// Função utilitária para logging de validação em desenvolvimento
export const enableValidationLogging = (enable: boolean = true) => {
  if (!enable) {
    console.warn = () => {};
    console.error = () => {};
  }
};

export default {
  TypeGuards,
  Validators,
  useTypeValidation,
  enableValidationLogging,
};
