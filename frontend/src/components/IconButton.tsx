import { useTheme } from '../context/ThemeProvider';

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: number;
  variant?: 'neutral' | 'danger';
}

export default function IconButton({
  icon,
  label,
  onClick,
  size = 32,
  variant = 'neutral',
}: IconButtonProps) {
  const { theme } = useTheme();
  const variants: Record<
    string,
    { bg: string; border: string; color: string; hoverBg: string; hoverBorder: string }
  > = {
    neutral: {
      bg: theme.bgPanel,
      border: theme.border,
      color: theme.textPrimary,
      hoverBg: theme.bgPanelAlt || theme.bgPanel,
      hoverBorder: theme.border,
    },
    danger: {
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.35)',
      color: '#ef4444',
      hoverBg: 'rgba(239,68,68,0.18)',
      hoverBorder: 'rgba(239,68,68,0.55)',
    },
  };
  const v = variants[variant] || variants.neutral;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        border: `1px solid ${v.border}`,
        background: v.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        color: v.color,
        transition: 'background .18s, border-color .18s, color .18s',
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.background = v.hoverBg;
        e.currentTarget.style.borderColor = v.hoverBorder;
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.background = v.bg;
        e.currentTarget.style.borderColor = v.border;
      }}
    >
      {icon}
    </button>
  );
}
