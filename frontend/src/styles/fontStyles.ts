import type { CSSProperties } from 'react';
import type { ThemePalette } from './colors';

// Unified font styles for the application
// Automatically handles dark/light mode through theme context

export interface FontStyles {
  normal: CSSProperties;
  tableHeader: CSSProperties;
  menuHeader: CSSProperties;
  secondary: CSSProperties;
  small: CSSProperties;
  monospace: CSSProperties;
  monospaceSmall: CSSProperties;
  button: CSSProperties;
}

export const getFontStyles = (theme: ThemePalette): FontStyles => ({
  normal: {
    fontSize: 13,
    fontWeight: 400,
    color: theme.textPrimary,
    fontFamily: 'inherit',
  },

  tableHeader: {
    fontSize: 12,
    fontWeight: 400,
    color: theme.textSecondary,
    fontFamily: 'inherit',
    letterSpacing: '0.4px',
  },

  menuHeader: {
    fontSize: 16,
    fontWeight: 700,
    color: theme.textPrimary,
    fontFamily: 'inherit',
  },

  secondary: {
    fontSize: 12,
    fontWeight: 400,
    color: theme.textSecondary,
    fontFamily: 'inherit',
  },

  small: {
    fontSize: 11,
    fontWeight: 400,
    color: theme.textSecondary,
    fontFamily: 'inherit',
  },

  monospace: {
    fontSize: 13,
    fontWeight: 400,
    color: theme.textPrimary,
    fontFamily: 'monospace',
  },

  monospaceSmall: {
    fontSize: 11,
    fontWeight: 400,
    color: theme.textSecondary,
    fontFamily: 'monospace',
  },

  button: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.textSecondary,
    fontFamily: 'monospace',
  },
});
