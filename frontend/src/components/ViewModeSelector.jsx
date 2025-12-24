import React from 'react';
import { useTheme } from '../context/ThemeProvider.tsx';

/**
 * ViewModeSelector - Toggle between different view modes
 * @param {string} value - Current selected view mode: 'chart' | 'table' | 'cards' | 'strategies'
 * @param {Function} onChange - Callback when view mode changes
 */
const ViewModeSelector = ({ value = 'table', onChange }) => {
  const { theme } = useTheme();

  const modes = [
    {
      id: 'chart',
      label: 'Chart',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M2 15V9M6 15V3M10 15V7M14 15V5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      id: 'table',
      label: 'Table',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect
            x="2"
            y="3"
            width="14"
            height="12"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M2 7H16M2 11H16"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      id: 'cards',
      label: 'Cards',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect
            x="2"
            y="2"
            width="6"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="10"
            y="2"
            width="6"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="2"
            y="10"
            width="6"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="10"
            y="10"
            width="6"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      ),
    },
    {
      id: 'strategies',
      label: 'Strategies',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle
            cx="9"
            cy="9"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            cx="9"
            cy="9"
            r="2.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M9 3V6M9 12V15M3 9H6M12 9H15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        backgroundColor: theme.bgSecondary,
        borderRadius: 8,
        border: `1px solid ${theme.border}`,
      }}
    >
      {modes.map((mode) => {
        const isActive = value === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            title={mode.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              backgroundColor: isActive ? theme.bgPanel : 'transparent',
              color: isActive ? theme.textPrimary : theme.textSecondary,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = theme.bgHover;
                e.currentTarget.style.color = theme.textPrimary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.textSecondary;
              }
            }}
          >
            {mode.icon}
          </button>
        );
      })}
    </div>
  );
};

export default ViewModeSelector;
