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

  return (
    <div
      style={{
        background: bg,
        border,
        borderRadius: 12,
        padding: 16,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease',
        cursor: 'pointer',
        ...style,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.border = hoverBorder;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = theme.shadowHover;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.border = border;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

export default CardContainer;
