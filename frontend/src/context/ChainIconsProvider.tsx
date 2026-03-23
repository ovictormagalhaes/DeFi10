import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface SupportedChainEntry {
  id?: string | number;
  chainId?: string | number;
  chainID?: string | number;
  name?: string;
  displayName?: string;
  shortName?: string;
  iconUrl?: string;
  icon?: string;
  logo?: string;
  image?: string;
}

interface ChainIconsContextValue {
  getIcon: (raw: string | number | null | undefined) => string | undefined;
}

interface ChainIconsProviderProps {
  supportedChains?: SupportedChainEntry[];
  children: ReactNode;
}

const ChainIconsContext = createContext<ChainIconsContextValue>({ getIcon: () => undefined });

export function ChainIconsProvider({ supportedChains = [], children }: ChainIconsProviderProps) {
  const value = useMemo<ChainIconsContextValue>(() => {
    const map: Record<string, string> = {};
    if (Array.isArray(supportedChains)) {
      supportedChains.forEach((sc) => {
        const keyVariants = [sc.id, sc.chainId, sc.chainID, sc.name, sc.displayName, sc.shortName];
        const icon = sc.iconUrl || sc.icon || sc.logo || sc.image;
        if (!icon) return;
        keyVariants.filter(Boolean).forEach((v) => {
          const k = String(v).trim().toLowerCase();
          if (k && !map[k]) map[k] = icon;
        });
      });
    }
    return {
      getIcon: (raw: string | number | null | undefined): string | undefined => {
        if (!raw) return undefined;
        const norm = String(raw).trim().toLowerCase();
        return map[norm];
      },
    };
  }, [supportedChains]);

  return <ChainIconsContext.Provider value={value}>{children}</ChainIconsContext.Provider>;
}

export function useChainIcons(): ChainIconsContextValue {
  return useContext(ChainIconsContext);
}
