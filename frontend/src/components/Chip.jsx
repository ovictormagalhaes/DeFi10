import React from 'react';

import { useTheme } from '../context/ThemeProvider.tsx';

// Generic small badge/chip component
// Props: variant ('default' | 'accent' | 'success' | 'danger' | 'warning' | 'muted' | 'outline'),
// size ('sm' | 'xs'), minimal (boolean), children, title
export default function Chip({
  children,
  variant = 'default',
  size = 'xs',
  minimal = false,
  title,
  style = {},
}) {
  const { theme } = useTheme();

  const sizes = {
    xs: { fontSize: 10, padY: 2, padX: 6, radius: 10 },
    sm: { fontSize: 11, padY: 3, padX: 8, radius: 12 },
  };
  const s = sizes[size] || sizes.xs;

  const palette = {
    default: { bg: theme.bgInteractive, color: theme.textSecondary, border: theme.border },
    accent: { bg: theme.bgAccentSoft, color: theme.accent, border: theme.border },
    success: { bg: theme.primarySubtle, color: theme.success, border: theme.border },
    danger: { bg: 'rgba(255,95,86,0.12)', color: theme.danger, border: theme.border },
    warning: { bg: 'rgba(217,151,56,0.15)', color: theme.warning, border: theme.border },
    muted: { bg: 'transparent', color: theme.textMuted, border: theme.border },
    outline: { bg: 'transparent', color: theme.textSecondary, border: theme.border },
  };
  const p = palette[variant] || palette.default;

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        letterSpacing: 0.3,
        fontSize: s.fontSize,
        padding: `${s.padY}px ${s.padX}px`,
        lineHeight: 1,
        borderRadius: s.radius,
        background: minimal ? 'transparent' : p.bg,
        color: p.color,
        border: minimal ? 'none' : `1px solid ${p.border}`,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
