import React, { createContext, useContext, useMemo } from 'react'

const ChainIconsContext = createContext({ getIcon: () => undefined })

export function ChainIconsProvider({ supportedChains = [], children }) {
  const value = useMemo(() => {
    const map = {}
    if (Array.isArray(supportedChains)) {
      supportedChains.forEach(sc => {
        const keyVariants = [sc.id, sc.chainId, sc.chainID, sc.name, sc.displayName, sc.shortName]
        const icon = sc.iconUrl || sc.icon || sc.logo || sc.image
        if (!icon) return
        keyVariants.filter(Boolean).forEach(v => {
          const k = String(v).trim().toLowerCase()
          if (k && !map[k]) map[k] = icon
        })
      })
    }
    return {
      getIcon: (raw) => {
        if (!raw) return undefined
        const norm = String(raw).trim().toLowerCase()
        return map[norm]
      }
    }
  }, [supportedChains])

  return <ChainIconsContext.Provider value={value}>{children}</ChainIconsContext.Provider>
}

export function useChainIcons() {
  return useContext(ChainIconsContext)
}
