// Theme palettes (Dark Mint + Light counterpart) plus legacy default export (for backward compatibility)

export const darkMint = {
  mode: 'dark',
  // NEW DARK THEME (user spec)
  // core backgrounds
  bgApp: '#15171f',          // main app background
  bgAppAlt: '#191b24',       // slight elevation / alt section
  bgPanel: '#22242b',        // cards / tables
  bgPanelAlt: '#272a33',     // hover / elevated card
  bgInteractive: 'rgba(255,255,255,0.06)',
  bgInteractiveHover: 'rgba(255,255,255,0.1)',
  bgAccentSoft: 'rgba(69,183,115,0.18)', // subtle tint of highlight

  // header & table surfaces
  headerBg: '#22242b',       // unify header with panels
  headerBgAlt: '#272a33',    // hover / active state
  tableBg: '#22242b',
  tableHeaderBg: '#262830',  // slight differentiation for header row
  tableBorder: '#2a2d35',    // subdued border
  tableStripeBg: '#24272f',
  tableRowHoverBg: '#2b2e37',

  // borders / dividers
  border: '#30333b',
  borderStrong: '#3a3e47',
  divider: '#30333b',

  // text
  textPrimary: '#f4f4f4',          // main text
  textSecondary: '#a2a9b5',        // button / secondary text
  textMuted: '#6d757f',            // muted / placeholders
  textOnAccent: '#0f1712',

  // brand / primary actions (using "highlighted text" color)
  primary: '#45b773',
  primaryHover: '#54c381',  // lighter
  primaryActive: '#379f62', // pressed / darker
  primarySubtle: '#1c2d24', // subtle background tint

  // accents (use graph color as accent for charts)
  accent: '#9fe8c0',
  accentAlt: '#45b773',
  accentGrad: 'linear-gradient(135deg,#45b773 0%, #6fd299 50%, #9fe8c0 100%)',

  // states
  success: '#45b773',
  warning: '#d99738',
  danger: '#ff5f56',
  info: '#6fd299',

  // shadows
  shadowLight: '0 2px 4px -1px rgba(0,0,0,0.45), 0 4px 18px -4px rgba(0,0,0,0.55)',
  shadowHover: '0 4px 10px -2px rgba(0,0,0,0.55), 0 6px 22px -6px rgba(0,0,0,0.6)',

  // focus / outlines
  focusRing: '0 0 0 2px rgba(69,183,115,0.55)'
}

export const lightMint = {
  mode: 'light',
  // NEW LIGHT THEME (user spec)
  // core backgrounds
  bgApp: '#f0f2f4',
  bgAppAlt: '#e8ebee',
  bgPanel: '#ffffff',
  bgPanelAlt: '#f7f9fb',
  bgInteractive: 'rgba(0,0,0,0.04)',
  bgInteractiveHover: 'rgba(0,0,0,0.07)',
  bgAccentSoft: 'rgba(45,152,115,0.15)',

  // header & table surfaces
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

  // text
  textPrimary: '#2f3137',
  textSecondary: '#798698', // button / secondary text
  textMuted: '#909aa6',
  textOnAccent: '#ffffff',

  // primary / highlight (using graph color as unified brand)
  primary: '#2d9873',
  primaryHover: '#32a77e',
  primaryActive: '#257e60',
  primarySubtle: '#d8efe6',

  // accents (slightly brighter alt + gradient)
  accent: '#2d9873',
  accentAlt: '#4abf95',
  accentGrad: 'linear-gradient(120deg,#2d9873 0%, #4abf95 55%, #8ad9ba 100%)',

  success: '#2d9873',
  warning: '#e29a29',
  danger: '#e14f48',
  info: '#4abf95',

  shadowLight: '0 1px 2px rgba(0,0,0,0.05), 0 3px 6px rgba(0,0,0,0.08)',
  shadowHover: '0 4px 10px -2px rgba(0,0,0,0.14), 0 8px 24px -6px rgba(0,0,0,0.18)',

  focusRing: '0 0 0 2px rgba(45,152,115,0.45)'
}

// Legacy default export retains original keys for older components still importing `colors`.
// We point it to darkMint for now to maintain dark-first experience.
const colors = { ...darkMint }

export const THEMES = { darkMint, lightMint }
export const getThemeByMode = (mode = 'dark') => mode === 'light' ? lightMint : darkMint

export default colors
