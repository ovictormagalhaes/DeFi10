import React from 'react';

import { useTheme } from '../../context/ThemeProvider';

interface CardContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const CardContainer: React.FC<CardContainerProps> = ({ children, style, ...rest }) => {
  const { theme, mode } = useTheme();

  const bg =
    mode === 'dark'
      ? `linear-gradient(160deg, ${theme.bgPanelAlt} 0%, ${theme.bgCard} 100%)`
      : `linear-gradient(160deg, ${theme.bgPanel} 0%, ${theme.bgCard} 100%)`;

  const border =
    mode === 'dark'
      ? '1px solid rgba(255,255,255,0.07)'
      : `1px solid ${theme.border}`;

  const hoverBorder =
    mode === 'dark'
      ? `1px solid ${theme.accent}55`
      : `1px solid ${theme.accent}80`;

  const restingShadow =
    mode === 'dark'
      ? `inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 12px rgba(0,0,0,0.35)`
      : `0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)`;

  const hoverShadow =
    mode === 'dark'
      ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px ${theme.accent}40, 0 8px 28px rgba(0,0,0,0.50), 0 4px 16px ${theme.accent}10`
      : `0 0 0 1px ${theme.accent}45, 0 6px 24px rgba(0,0,0,0.12), 0 2px 8px ${theme.accent}10`;

  return (
    <div
      style={{
        background: bg,
        border,
        borderRadius: 12,
        padding: 16,
        boxShadow: restingShadow,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease',
        cursor: 'pointer',
        ...style,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.border = hoverBorder;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = hoverShadow;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.border = border;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = restingShadow;
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

export default CardContainer;
