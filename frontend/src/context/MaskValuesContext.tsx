import React, { createContext, useContext, ReactNode } from 'react';

export type MaskInput = number | string | null | undefined;
interface MaskValuesContextValue {
  maskValues: boolean;
  // Returns a masked string (or placeholder) when masking is enabled; otherwise formatted value string.
  maskValue: (v: MaskInput, opts?: { short?: boolean }) => string;
  toggleMaskValues: () => void;
  setMaskValues: (v: boolean) => void;
}

export const MaskValuesContext = createContext<MaskValuesContextValue>({
  maskValues: false,
  maskValue: (v: MaskInput) => (v == null ? '' : String(v)),
  toggleMaskValues: () => {},
  setMaskValues: () => {},
});

interface ProviderProps {
  value: MaskValuesContextValue;
  children: ReactNode;
}

export const MaskValuesProvider: React.FC<ProviderProps> = ({ value, children }) => (
  <MaskValuesContext.Provider value={value}>{children}</MaskValuesContext.Provider>
);

export const useMaskValues = () => useContext(MaskValuesContext);

export default MaskValuesContext;
