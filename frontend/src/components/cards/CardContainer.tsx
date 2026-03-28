import React from 'react';
import { useTheme } from '../../context/ThemeProvider';

interface CardContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const CardContainer: React.FC<CardContainerProps> = ({ children, style, ...rest }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        backgroundColor: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: 16,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.accent;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = theme.shadowHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

export default CardContainer;
