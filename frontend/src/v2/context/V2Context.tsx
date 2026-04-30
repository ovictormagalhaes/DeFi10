import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAggregationJob } from '../../hooks/useAggregationJob';
import { ChainIconsProvider } from '../../context/ChainIconsProvider';

export interface ProjectionBreakdownItem {
  name: string;
  symbol?: string;
  logoUrl?: string;
  color?: string;
  rate: number;
  baseUsd: number;
  type: 'earn' | 'cost';
  preCalculated?: {
    oneDay?: number;
    oneWeek?: number;
    oneMonth?: number;
    oneYear?: number;
  };
}

export interface PoolShareData {
  token0Symbol: string;
  token1Symbol: string;
  token0Logo?: string;
  token1Logo?: string;
  protocolName?: string;
  protocolLogo?: string;
  chain?: string;
  apr?: number;
  createdAt?: number;
  inRange?: boolean;
  totalValue?: number;
  totalFees?: number;
  rangeData?: { lower: number; upper: number; current: number };
  tierPercent?: number;
}

interface ProjectionTarget {
  level: 'token' | 'protocol' | 'global';
  name: string;
  context: string;
  rate?: number;
  baseUsd?: number;
  logoUrl?: string;
  preCalculated?: {
    oneDay?: number;
    oneWeek?: number;
    oneMonth?: number;
    oneYear?: number;
  };
  breakdownItems?: ProjectionBreakdownItem[];
  shareData?: PoolShareData;
}

interface V2ContextValue {
  account: string | null;
  setAccount: (a: string | null) => void;
  selectedWalletGroupId: string | null;
  setSelectedWalletGroupId: (id: string | null) => void;
  walletData: Record<string, any> | null;
  setWalletData: (d: Record<string, any> | null) => void;
  maskValues: boolean;
  toggleMaskValues: () => void;
  selectedChains: Set<string> | null;
  setSelectedChains: (chains: Set<string> | null) => void;
  positionSearch: string;
  setPositionSearch: (s: string) => void;
  supportedChains: any[];
  setSupportedChains: (c: any[]) => void;
  projectionTarget: ProjectionTarget | null;
  openProjection: (t: ProjectionTarget) => void;
  closeProjection: () => void;
  agg: ReturnType<typeof useAggregationJob>;
}

const V2Context = createContext<V2ContextValue>({} as V2ContextValue);

export const V2Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [selectedWalletGroupId, setSelectedWalletGroupId] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<Record<string, any> | null>(null);
  const [maskValues, setMaskValues] = useState(() => {
    try {
      return localStorage.getItem('defi10_mask_values') === 'true';
    } catch {
      return false;
    }
  });
  const [selectedChains, setSelectedChains] = useState<Set<string> | null>(null);
  const [positionSearch, setPositionSearch] = useState('');
  const [supportedChains, setSupportedChains] = useState<any[]>([]);
  const [projectionTarget, setProjectionTarget] = useState<ProjectionTarget | null>(null);

  const agg = useAggregationJob();

  const toggleMaskValues = useCallback(() => {
    setMaskValues((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('defi10_mask_values', String(next));
      } catch {}
      return next;
    });
  }, []);

  const openProjection = useCallback((t: ProjectionTarget) => setProjectionTarget(t), []);
  const closeProjection = useCallback(() => setProjectionTarget(null), []);

  return (
    <V2Context.Provider
      value={{
        account,
        setAccount,
        selectedWalletGroupId,
        setSelectedWalletGroupId,
        walletData,
        setWalletData,
        maskValues,
        toggleMaskValues,
        selectedChains,
        setSelectedChains,
        positionSearch,
        setPositionSearch,
        supportedChains,
        setSupportedChains,
        projectionTarget,
        openProjection,
        closeProjection,
        agg,
      }}
    >
      <ChainIconsProvider supportedChains={supportedChains}>{children}</ChainIconsProvider>
    </V2Context.Provider>
  );
};

export const useV2 = () => useContext(V2Context);
