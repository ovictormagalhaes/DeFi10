import { useTheme } from '../context/ThemeProvider';
import { useMaskValues } from '../context/MaskValuesContext';
import { useChainIcons } from '../context/ChainIconsProvider';

export function useCardContext() {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const { getIcon: getChainIcon } = useChainIcons();
  return { theme, maskValue, getChainIcon };
}
