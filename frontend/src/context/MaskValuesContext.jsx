import React, { createContext, useContext } from 'react'

// Context para mascarar valores financeiros de forma global
export const MaskValuesContext = createContext({
  maskValues: false,
  // função de passagem; será substituída pelo App
  maskValue: (v) => v,
  toggleMaskValues: () => {},
  setMaskValues: () => {}
})

export const MaskValuesProvider = ({ value, children }) => (
  <MaskValuesContext.Provider value={value}>
    {children}
  </MaskValuesContext.Provider>
)

export const useMaskValues = () => useContext(MaskValuesContext)

export default MaskValuesContext