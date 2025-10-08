import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { applyThemeCssVars } from '../theme/cssVars';
import { getTokensByMode, ThemeTokens } from '../theme/tokens';

type ThemeMode = 'dark' | 'light';
export type ThemeShape = ThemeTokens;

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ThemeShape;
  toggleTheme: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  theme: getTokensByMode('dark'),
  toggleTheme: () => {},
  setMode: () => {},
});

interface ThemeProviderProps {
  initialMode?: ThemeMode;
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ initialMode = 'dark', children }) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  // Persist choice (localStorage)
  useEffect(() => {
    try {
      localStorage.setItem('defi10_theme_mode', mode);
    } catch (err) {
      // Persist silently ignored (storage disabled or unavailable)
    }
  }, [mode]);

  // Load persisted
  useEffect(() => {
    try {
      const stored = localStorage.getItem('defi10_theme_mode') as ThemeMode | null;
      if (stored && (stored === 'dark' || stored === 'light')) setMode(stored);
    } catch (err) {
      // Read silently ignored
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((m) => (m === 'dark' ? 'light' : 'dark'));
  }, []);

  const value: ThemeContextValue = {
    mode,
    theme: getTokensByMode(mode),
    toggleTheme,
    setMode,
  };

  // Apply body background instantly for full-screen feel
  useEffect(() => {
    const t = getTokensByMode(mode);
    // Aplica como estilos diretos mínimos (progressive enhancement)
    document.body.style.backgroundColor = t.bgApp;
    document.body.style.color = t.textPrimary;
    // Toggle class for CSS variable overrides (light mode selectors rely on body.light)
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(mode === 'light' ? 'light' : 'dark');
    // Aplica também como CSS custom properties para uso em styled components / CSS futuramente
    applyThemeCssVars(t);
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
