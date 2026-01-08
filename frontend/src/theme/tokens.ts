// Central design tokens (dark / light) usados em theming.
// Mantidos como fonte única de verdade: ThemeProvider aplica estes valores como CSS custom properties e estilos inline mínimos.
// Qualquer nova cor deve entrar aqui primeiro para permitir geração futura (ex: export JSON, design docs, CSS variables SSR).

export interface ColorPalette {
  mode: 'dark' | 'light';
  bgApp: string;
  bgAppAlt: string;
  bgPanel: string;
  bgPanelAlt: string;
  bgInteractive: string;
  bgInteractiveHover: string;
  bgAccentSoft: string;
  headerBg: string;
  headerBgAlt: string;
  tableBg: string;
  tableHeaderBg: string;
  tableBorder: string;
  tableStripeBg: string;
  tableRowHoverBg: string;
  border: string;
  borderStrong: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primarySubtle: string;
  accent: string;
  accentAlt: string;
  accentGrad: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  shadowLight: string;
  shadowHover: string;
  focusRing: string;
}

export const darkTokens: ColorPalette = {
  mode: 'dark',
  bgApp: '#15171f',
  bgAppAlt: '#191b24',
  bgPanel: '#22242b',
  bgPanelAlt: '#272a33',
  bgInteractive: 'rgba(255,255,255,0.06)',
  bgInteractiveHover: 'rgba(255,255,255,0.1)',
  bgAccentSoft: 'rgba(69,183,115,0.18)',
  headerBg: '#22242b',
  headerBgAlt: '#272a33',
  tableBg: '#22242b',
  tableHeaderBg: '#262830',
  tableBorder: '#2a2d35',
  tableStripeBg: '#24272f',
  tableRowHoverBg: '#2b2e37',
  border: '#30333b',
  borderStrong: '#3a3e47',
  divider: '#30333b',
  textPrimary: '#f4f4f4',
  textSecondary: '#a2a9b5',
  textMuted: '#6d757f',
  textOnAccent: '#0f1712',
  primary: '#45b773',
  primaryHover: '#54c381',
  primaryActive: '#379f62',
  primarySubtle: '#1c2d24',
  accent: '#45b773',
  accentAlt: '#45b773',
  accentGrad: 'linear-gradient(135deg,#45b773 0%, #6fd299 50%, #9fe8c0 100%)',
  success: '#45b773',
  warning: '#d99738',
  danger: '#ff5f56',
  info: '#6fd299',
  shadowLight: '0 2px 4px -1px rgba(0,0,0,0.45), 0 4px 18px -4px rgba(0,0,0,0.55)',
  shadowHover: '0 4px 10px -2px rgba(0,0,0,0.55), 0 6px 22px -6px rgba(0,0,0,0.6)',
  focusRing: '0 0 0 2px rgba(69,183,115,0.55)',
};

export const lightTokens: ColorPalette = {
  mode: 'light',
  bgApp: '#f0f2f4',
  bgAppAlt: '#e8ebee',
  bgPanel: '#ffffff',
  bgPanelAlt: '#f7f9fb',
  bgInteractive: 'rgba(0,0,0,0.04)',
  bgInteractiveHover: 'rgba(0,0,0,0.07)',
  bgAccentSoft: 'rgba(45,152,115,0.15)',
  headerBg: '#ffffff',
  headerBgAlt: '#f4f6f8',
  tableBg: '#ffffff',
  tableHeaderBg: '#f4f6f8',
  tableBorder: '#d9dde2',
  tableStripeBg: '#f7f9fa',
  tableRowHoverBg: '#ecf0f3',
  border: '#d9dde2',
  borderStrong: '#c7ccd2',
  divider: '#e3e6ea',
  textPrimary: '#2f3137',
  textSecondary: '#798698',
  textMuted: '#909aa6',
  textOnAccent: '#ffffff',
  primary: '#2d9873',
  primaryHover: '#32a77e',
  primaryActive: '#257e60',
  primarySubtle: '#d8efe6',
  accent: '#2d9873',
  accentAlt: '#4abf95',
  accentGrad: 'linear-gradient(120deg,#2d9873 0%, #4abf95 55%, #8ad9ba 100%)',
  success: '#2d9873',
  warning: '#e29a29',
  danger: '#e14f48',
  info: '#4abf95',
  shadowLight: '0 1px 2px rgba(0,0,0,0.05), 0 3px 6px rgba(0,0,0,0.08)',
  shadowHover: '0 4px 10px -2px rgba(0,0,0,0.14), 0 8px 24px -6px rgba(0,0,0,0.18)',
  focusRing: '0 0 0 2px rgba(45,152,115,0.45)',
};

export const TOKENS = { dark: darkTokens, light: lightTokens };
export type ThemeTokens = typeof darkTokens;
export const getTokensByMode = (mode: 'dark' | 'light') =>
  mode === 'light' ? lightTokens : darkTokens;
