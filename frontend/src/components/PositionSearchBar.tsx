import { useTheme } from '../context/ThemeProvider';

interface PositionSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}

export default function PositionSearchBar({
  value,
  onChange,
  totalCount,
  filteredCount,
}: PositionSearchBarProps) {
  const { theme } = useTheme();
  const isFiltering = value.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: '6px 12px',
        maxWidth: 320,
        width: '100%',
        transition: 'border-color 0.2s',
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = theme.accent || theme.primary;
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = theme.border;
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={theme.textMuted}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search positions..."
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: theme.textPrimary,
          fontSize: 13,
          fontFamily: 'inherit',
          padding: 0,
        }}
      />
      {isFiltering && (
        <>
          <span
            style={{
              fontSize: 11,
              color: theme.textMuted,
              whiteSpace: 'nowrap',
            }}
          >
            {filteredCount} / {totalCount}
          </span>
          <button
            onClick={() => onChange('')}
            aria-label="Clear search"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: 6,
              border: 'none',
              background: theme.bgInteractive,
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.textMuted}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
