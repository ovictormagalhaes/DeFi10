import { useChainIcons } from '../context/ChainIconsProvider';
import { useMaskValues } from '../context/MaskValuesContext';
import { useTheme } from '../context/ThemeProvider';

export function useCardContext() {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const { getIcon: getChainIcon } = useChainIcons();
  return { theme, maskValue, getChainIcon };
}
