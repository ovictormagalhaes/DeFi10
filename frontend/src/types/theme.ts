/**
 * Sistema de Themes TypeScript Expandido
 * Tipagem completa para todas as variáveis de tema e componentes
 */

// Cores base do sistema
export interface BaseColors {
  // Primary colors
  primary50: string;
  primary100: string;
  primary200: string;
  primary300: string;
  primary400: string;
  primary500: string;
  primary600: string;
  primary700: string;
  primary800: string;
  primary900: string;
  
  // Semantic colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Neutral colors
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;
  
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Border colors
  border: string;
  borderLight: string;
  borderHeavy: string;
  
  // Status colors
  statusSuccess: string;
  statusWarning: string;
  statusError: string;
  statusInfo: string;
}

// Typography scale
export interface Typography {
  // Font families
  fontPrimary: string;
  fontSecondary: string;
  fontMono: string;
  
  // Font sizes
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  xl2: string;
  xl3: string;
  xl4: string;
  xl5: string;
  
  // Line heights
  lineHeightTight: string;
  lineHeightNormal: string;
  lineHeightRelaxed: string;
  
  // Font weights
  weightThin: string;
  weightLight: string;
  weightNormal: string;
  weightMedium: string;
  weightSemibold: string;
  weightBold: string;
  weightExtrabold: string;
  weightBlack: string;
}

// Spacing scale
export interface Spacing {
  px: string;
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  8: string;
  10: string;
  12: string;
  16: string;
  20: string;
  24: string;
  32: string;
  40: string;
  48: string;
  56: string;
  64: string;
}

// Shadow system
export interface Shadows {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  xl2: string;
  inner: string;
}

// Border radius
export interface BorderRadius {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  xl2: string;
  xl3: string;
  full: string;
}

// Z-index scale
export interface ZIndex {
  hide: number;
  auto: number;
  base: number;
  docked: number;
  dropdown: number;
  sticky: number;
  banner: number;
  overlay: number;
  modal: number;
  popover: number;
  skipLink: number;
  toast: number;
  tooltip: number;
}

// Breakpoints
export interface Breakpoints {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xl2: string;
}

// Animation/Transition
export interface Transitions {
  // Durations
  durationFast: string;
  durationNormal: string;
  durationSlow: string;
  
  // Easings
  easingLinear: string;
  easingIn: string;
  easingOut: string;
  easingInOut: string;
  
  // Common transitions
  all: string;
  colors: string;
  opacity: string;
  shadow: string;
  transform: string;
}

// Component-specific themes
export interface ComponentThemes {
  // Button variants
  button: {
    primary: {
      background: string;
      backgroundHover: string;
      backgroundActive: string;
      text: string;
      border: string;
    };
    secondary: {
      background: string;
      backgroundHover: string;
      backgroundActive: string;
      text: string;
      border: string;
    };
    ghost: {
      background: string;
      backgroundHover: string;
      backgroundActive: string;
      text: string;
      border: string;
    };
    danger: {
      background: string;
      backgroundHover: string;
      backgroundActive: string;
      text: string;
      border: string;
    };
  };
  
  // Card variants
  card: {
    background: string;
    backgroundHover: string;
    border: string;
    shadow: string;
    shadowHover: string;
  };
  
  // Input variants
  input: {
    background: string;
    backgroundFocus: string;
    border: string;
    borderFocus: string;
    borderError: string;
    text: string;
    placeholder: string;
  };
  
  // Metric cards
  metric: {
    background: string;
    backgroundAccent: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textAccent: string;
    iconSuccess: string;
    iconWarning: string;
    iconError: string;
  };
  
  // Table variants
  table: {
    background: string;
    backgroundHover: string;
    backgroundSelected: string;
    header: string;
    border: string;
    text: string;
    textMuted: string;
  };
}

// Complete theme interface
export interface CompleteTheme {
  mode: 'light' | 'dark';
  colors: BaseColors;
  typography: Typography;
  spacing: Spacing;
  shadows: Shadows;
  borderRadius: BorderRadius;
  zIndex: ZIndex;
  breakpoints: Breakpoints;
  transitions: Transitions;
  components: ComponentThemes;
}

// Theme configuration type
export type ThemeConfig = {
  [K in 'light' | 'dark']: CompleteTheme;
};

// Utility types for theme usage
export type ColorValue = keyof BaseColors;
export type SpacingValue = keyof Spacing;
export type FontSizeValue = keyof Pick<Typography, 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'xl2' | 'xl3' | 'xl4' | 'xl5'>;
export type ShadowValue = keyof Shadows;
export type BorderRadiusValue = keyof BorderRadius;

// Props types for themed components
export interface ThemedProps {
  theme?: CompleteTheme;
}

export interface ColorProps {
  color?: ColorValue;
  backgroundColor?: ColorValue;
  borderColor?: ColorValue;
}

export interface SpacingProps {
  margin?: SpacingValue;
  marginTop?: SpacingValue;
  marginRight?: SpacingValue;
  marginBottom?: SpacingValue;
  marginLeft?: SpacingValue;
  marginX?: SpacingValue;
  marginY?: SpacingValue;
  
  padding?: SpacingValue;
  paddingTop?: SpacingValue;
  paddingRight?: SpacingValue;
  paddingBottom?: SpacingValue;
  paddingLeft?: SpacingValue;
  paddingX?: SpacingValue;
  paddingY?: SpacingValue;
}

export interface TypographyProps {
  fontSize?: FontSizeValue;
  fontWeight?: keyof Pick<Typography, 'weightThin' | 'weightLight' | 'weightNormal' | 'weightMedium' | 'weightSemibold' | 'weightBold' | 'weightExtrabold' | 'weightBlack'>;
  lineHeight?: keyof Pick<Typography, 'lineHeightTight' | 'lineHeightNormal' | 'lineHeightRelaxed'>;
  fontFamily?: keyof Pick<Typography, 'fontPrimary' | 'fontSecondary' | 'fontMono'>;
}

export interface LayoutProps extends SpacingProps {
  width?: string | number;
  height?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
}

export interface FlexProps {
  display?: 'flex' | 'inline-flex';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
  alignContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'stretch';
  gap?: SpacingValue;
}

export interface GridProps {
  display?: 'grid' | 'inline-grid';
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridGap?: SpacingValue;
  gridColumnGap?: SpacingValue;
  gridRowGap?: SpacingValue;
  gridColumn?: string;
  gridRow?: string;
  gridArea?: string;
}

// Combined props for full styled system
export type SystemProps = 
  & ColorProps 
  & SpacingProps 
  & TypographyProps 
  & LayoutProps 
  & FlexProps 
  & GridProps 
  & ThemedProps;

// Responsive value type
export type ResponsiveValue<T> = T | {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  xl2?: T;
};

// Component variant system
export interface VariantConfig<T = Record<string, any>> {
  variants: Record<string, T>;
  defaultVariant?: string;
}

// Animation/Motion types
export interface MotionConfig {
  initial?: Record<string, any>;
  animate?: Record<string, any>;
  exit?: Record<string, any>;
  transition?: Record<string, any>;
  whileHover?: Record<string, any>;
  whileTap?: Record<string, any>;
}

export default CompleteTheme;