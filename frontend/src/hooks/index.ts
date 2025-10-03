/**
 * Custom Hooks TypeScript para MyWebWallet
 * Hooks reutilizáveis e type-safe para operações comuns
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { WalletItem, Token, Range } from '../types/wallet';
import { extractHealthFactor, extractPoolFees24h, extractPoolRange } from '../types/wallet';
import { useTypeValidation } from '../types/validators';

// Interface para métricas de portfolio
export interface PortfolioMetrics {
  totalValue: number;
  totalItems: number;
  liquidityPoolsCount: number;
  lendingPositionsCount: number;
  stakingPositionsCount: number;
  walletTokensCount: number;
  totalFees24h: number;
  averageHealthFactor: number | null;
  poolsInRange: number;
  poolsOutOfRange: number;
  riskScore: number;
  diversificationScore: number;
}

// Interface para análise de risco
export interface RiskAnalysis {
  totalRisk: number;
  riskCategories: {
    low: number;
    medium: number;
    high: number;
  };
  healthFactorRisk: number;
  liquidityRisk: number;
  concentrationRisk: number;
}

// Interface para cache de dados
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Hook para dados da wallet com validação
export const useWalletData = (
  initialData: any[] = [],
  validateOnChange: boolean = true
) => {
  const [rawData, setRawData] = useState<any[]>(initialData);
  const [validatedData, setValidatedData] = useState<WalletItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  
  const { validateWalletData } = useTypeValidation();
  
  // Validar dados sempre que mudarem
  useEffect(() => {
    if (!validateOnChange || rawData.length === 0) {
      setValidatedData([]);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = validateWalletData(rawData);
      setValidatedData(result.validItems);
      setErrors(result.errors);
      setWarnings(result.warnings);
    } catch (error) {
      console.error('Validation error:', error);
      setErrors([`Validation failed: ${error}`]);
      setValidatedData([]);
    } finally {
      setIsLoading(false);
    }
  }, [rawData, validateOnChange, validateWalletData]);
  
  const updateData = useCallback((newData: any[]) => {
    setRawData(newData);
  }, []);
  
  const addItem = useCallback((item: any) => {
    setRawData(prev => [...prev, item]);
  }, []);
  
  const removeItem = useCallback((index: number) => {
    setRawData(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  return {
    data: validatedData,
    rawData,
    updateData,
    addItem,
    removeItem,
    isLoading,
    errors,
    warnings,
    isValid: errors.length === 0,
    validationSummary: {
      total: rawData.length,
      valid: validatedData.length,
      invalid: rawData.length - validatedData.length
    }
  };
};

// Hook para métricas de portfolio
export const usePortfolioMetrics = (data: WalletItem[]): PortfolioMetrics => {
  return useMemo(() => {
    // Filtros por tipo
    const liquidityPools = data.filter(item => item.type === "LiquidityPool");
    const lendingPositions = data.filter(item => item.type === "LendingAndBorrowing");
    const stakingPositions = data.filter(item => item.type === "Staking");
    const walletTokens = data.filter(item => item.type === "Wallet");
    
    // Valor total
    const totalValue = data.reduce((sum, item) => {
      const value = item.totalPrice || item.totalValueUsd || 0;
      return sum + Number(value);
    }, 0);
    
    // Fees 24h
    const totalFees24h = liquidityPools
      .map(pool => extractPoolFees24h(pool))
      .filter((fee): fee is number => fee !== null)
      .reduce((sum, fee) => sum + fee, 0);
    
    // Health Factor médio
    const healthFactors = lendingPositions
      .map(position => extractHealthFactor(position))
      .filter((hf): hf is number => hf !== null);
    
    const averageHealthFactor = healthFactors.length > 0
      ? healthFactors.reduce((sum, hf) => sum + hf, 0) / healthFactors.length
      : null;
    
    // Pools in/out of range
    const poolRanges = liquidityPools
      .map(pool => extractPoolRange(pool))
      .filter((range): range is Range => range !== null);
    
    const poolsInRange = poolRanges.filter(range => range.inRange).length;
    const poolsOutOfRange = poolRanges.length - poolsInRange;
    
    // Risk Score calculation
    let riskScore = 0;
    
    // Health factor risk
    const lowHealthFactors = healthFactors.filter(hf => hf < 1.5).length;
    riskScore += (lowHealthFactors / Math.max(healthFactors.length, 1)) * 30;
    
    // Out of range pools risk
    riskScore += (poolsOutOfRange / Math.max(poolRanges.length, 1)) * 25;
    
    // Concentration risk
    const protocolDistribution = data.reduce((acc, item) => {
      const protocol = item.protocol?.name || 'Unknown';
      const value = Number(item.totalPrice || item.totalValueUsd || 0);
      acc[protocol] = (acc[protocol] || 0) + value;
      return acc;
    }, {} as Record<string, number>);
    
    const protocols = Object.keys(protocolDistribution);
    const concentrationScore = protocols.length > 0 
      ? Math.max(...Object.values(protocolDistribution)) / totalValue * 100
      : 0;
    
    riskScore += concentrationScore > 50 ? 25 : concentrationScore > 25 ? 15 : 5;
    
    // Diversification score
    const diversificationScore = Math.max(0, 100 - concentrationScore);
    
    return {
      totalValue,
      totalItems: data.length,
      liquidityPoolsCount: liquidityPools.length,
      lendingPositionsCount: lendingPositions.length,
      stakingPositionsCount: stakingPositions.length,
      walletTokensCount: walletTokens.length,
      totalFees24h,
      averageHealthFactor,
      poolsInRange,
      poolsOutOfRange,
      riskScore: Math.min(100, riskScore),
      diversificationScore
    };
  }, [data]);
};

// Hook para análise de risco detalhada
export const useRiskAnalysis = (data: WalletItem[]): RiskAnalysis => {
  return useMemo(() => {
    const metrics = data.map(item => {
      const value = Number(item.totalPrice || item.totalValueUsd || 0);
      let risk = 0;
      
      if (item.type === "LiquidityPool") {
        const range = extractPoolRange(item);
        if (range && !range.inRange) risk += value * 0.3;
      }
      
      if (item.type === "LendingAndBorrowing") {
        const healthFactor = extractHealthFactor(item);
        if (healthFactor && healthFactor < 1.5) risk += value * 0.5;
        if (healthFactor && healthFactor < 1.2) risk += value * 0.3;
      }
      
      return { value, risk };
    });
    
    const totalValue = metrics.reduce((sum, m) => sum + m.value, 0);
    const totalRisk = metrics.reduce((sum, m) => sum + m.risk, 0);
    
    // Categorizar risco por item
    const categories = { low: 0, medium: 0, high: 0 };
    metrics.forEach(({ value, risk }) => {
      const riskRatio = value > 0 ? risk / value : 0;
      if (riskRatio < 0.1) categories.low += value;
      else if (riskRatio < 0.3) categories.medium += value;
      else categories.high += value;
    });
    
    return {
      totalRisk,
      riskCategories: categories,
      healthFactorRisk: totalRisk * 0.6, // 60% do risco vem do health factor
      liquidityRisk: totalRisk * 0.3,    // 30% do risco vem da liquidez
      concentrationRisk: totalRisk * 0.1  // 10% do risco vem da concentração
    };
  }, [data]);
};

// Hook para cache com TTL
export const useCache = <T>(key: string, defaultTTL: number = 5 * 60 * 1000) => {
  const cache = useRef<Map<string, CacheEntry<T>>>(new Map());
  
  const get = useCallback((cacheKey?: string): T | null => {
    const finalKey = cacheKey || key;
    const entry = cache.current.get(finalKey);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      cache.current.delete(finalKey);
      return null;
    }
    
    return entry.data;
  }, [key]);
  
  const set = useCallback((data: T, ttl?: number, cacheKey?: string) => {
    const finalKey = cacheKey || key;
    const finalTTL = ttl || defaultTTL;
    
    cache.current.set(finalKey, {
      data,
      timestamp: Date.now(),
      ttl: finalTTL
    });
  }, [key, defaultTTL]);
  
  const remove = useCallback((cacheKey?: string) => {
    const finalKey = cacheKey || key;
    cache.current.delete(finalKey);
  }, [key]);
  
  const clear = useCallback(() => {
    cache.current.clear();
  }, []);
  
  const has = useCallback((cacheKey?: string): boolean => {
    const finalKey = cacheKey || key;
    const entry = cache.current.get(finalKey);
    
    if (!entry) return false;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      cache.current.delete(finalKey);
      return false;
    }
    
    return true;
  }, [key]);
  
  return { get, set, remove, clear, has };
};

// Hook para debounced values
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

// Hook para localStorage tipado
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });
  
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);
  
  return [storedValue, setValue];
};

// Hook para intersection observer
export const useIntersectionObserver = (
  options?: IntersectionObserverInit
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);
    
    observer.observe(element);
    
    return () => {
      observer.unobserve(element);
    };
  }, [options]);
  
  return { targetRef, isIntersecting };
};

// Hook para window size
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });
  
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return windowSize;
};

// Hook para async operations
export const useAsync = <T, E = string>(
  asyncFunction: () => Promise<T>,
  dependencies: React.DependencyList = []
) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    let isCancelled = false;
    
    setLoading(true);
    setError(null);
    
    asyncFunction()
      .then(result => {
        if (!isCancelled) {
          setData(result);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });
    
    return () => {
      isCancelled = true;
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
  
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    
    asyncFunction()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [asyncFunction]);
  
  return { data, error, loading, retry };
};

export default {
  useWalletData,
  usePortfolioMetrics,
  useRiskAnalysis,
  useCache,
  useDebounce,
  useLocalStorage,
  useIntersectionObserver,
  useWindowSize,
  useAsync
};