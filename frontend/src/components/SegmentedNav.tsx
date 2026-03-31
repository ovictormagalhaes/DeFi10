import { useTheme } from '../context/ThemeProvider';

interface Tab {
  key: string;
  label: string;
}

interface SegmentedNavProps {
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  selectedWalletGroupId?: string | null;
}

// Fixed three main tabs per request
const TABS: Tab[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'overview', label: 'Overview' },
  { key: 'pools', label: 'Pools' },
  { key: 'strategies', label: 'Strategies' }, // maps to previous rebalancing view
];

export default function SegmentedNav({
  value,
  onChange,
  disabled,
  selectedWalletGroupId,
}: SegmentedNavProps) {
  const { theme } = useTheme() as { theme: Record<string, string> };

  const baseBtn: React.CSSProperties = {
    flex: 1,
    border: 'none',
    padding: '10px 18px',
    background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
    fontWeight: 500,
    color: theme.textSecondary,
    borderRadius: 6,
    position: 'relative',
    transition: 'background .15s, color .15s',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  const activeStyle: React.CSSProperties = {
    background: theme.primarySubtle,
    color: theme.textPrimary,
    fontWeight: 600,
  };

  return (
    <div
      role="tablist"
      aria-label="Main navigation"
      style={{
        display: 'flex',
        gap: 6,
        background: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        padding: 4,
        borderRadius: 10,
        width: '100%',
        maxWidth: 640,
        boxShadow: theme.shadow || '0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      {TABS.map((it) => {
        // Hide Strategies tab if no wallet group is selected
        if (it.key === 'strategies' && !selectedWalletGroupId) {
          return null;
        }

        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={value === it.key}
            tabIndex={value === it.key ? 0 : -1}
            onClick={() => !disabled && onChange(it.key)}
            style={{
              ...baseBtn,
              ...(value === it.key ? activeStyle : {}),
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (value !== it.key) e.currentTarget.style.background = theme.bgPanelHover;
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (value !== it.key) e.currentTarget.style.background = 'transparent';
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
