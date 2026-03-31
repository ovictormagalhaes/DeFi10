import { useState, useEffect } from 'react';

import { useTheme } from '../context/ThemeProvider';

interface DataFreshnessProps {
  lastUpdatedAt: Date | null;
  onRefresh?: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 30) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export default function DataFreshness({ lastUpdatedAt, onRefresh }: DataFreshnessProps) {
  const { theme } = useTheme();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  if (!lastUpdatedAt) return null;

  const ageMs = Date.now() - lastUpdatedAt.getTime();
  const isStale = ageMs > 5 * 60_000;
  const isVeryStale = ageMs > 15 * 60_000;

  const color = isVeryStale ? theme.danger : isStale ? theme.warning : theme.textMuted;

  return (
    <button
      onClick={onRefresh}
      title={
        isStale
          ? 'Data may be outdated — click to refresh'
          : `Last updated: ${lastUpdatedAt.toLocaleTimeString()}`
      }
      aria-label={`Data updated ${formatRelativeTime(lastUpdatedAt)}. Click to refresh.`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'transparent',
        border: 'none',
        cursor: onRefresh ? 'pointer' : 'default',
        padding: '4px 8px',
        borderRadius: 8,
        fontSize: 11,
        color,
        fontFamily: 'inherit',
        transition: 'opacity 0.2s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.7';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>{formatRelativeTime(lastUpdatedAt)}</span>
    </button>
  );
}
