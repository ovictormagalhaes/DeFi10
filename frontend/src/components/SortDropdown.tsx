import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeProvider';

export type SortOption = 'value-desc' | 'value-asc' | 'apy-desc' | 'protocol-asc' | 'chain-asc';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'value-desc', label: 'Value (High to Low)' },
  { id: 'value-asc', label: 'Value (Low to High)' },
  { id: 'apy-desc', label: 'APY (High to Low)' },
  { id: 'protocol-asc', label: 'Protocol A-Z' },
  { id: 'chain-asc', label: 'Chain A-Z' },
];

export function getItemValue(item: any): number {
  const pos = item?.position || item;
  const tokens = Array.isArray(pos?.tokens) ? pos.tokens : [];
  const tokensTotal = tokens.reduce((s: number, t: any) => {
    const v = t.financials?.totalPrice ?? t.totalPrice ?? 0;
    return s + (typeof v === 'number' ? Math.abs(v) : Math.abs(parseFloat(v) || 0));
  }, 0);
  const posValue = pos?.totalPrice ?? pos?.value ?? 0;
  return tokensTotal || (typeof posValue === 'number' ? posValue : parseFloat(posValue) || 0);
}

export function getItemApy(item: any): number {
  const pos = item?.position || item;
  const info = item?.additionalInfo || pos?.additionalInfo || {};
  const data = item?.additionalData || pos?.additionalData || {};
  const projApr = (data?.projections as any[])?.find((p: any) => p.type === 'apr')?.metadata?.value;
  return info.apr || info.apy || projApr || pos?.apr || pos?.apy || 0;
}

export function getItemProtocol(item: any): string {
  const pos = item?.position || item;
  return (pos?.protocol?.name || item?.protocol?.name || item?.protocolName || '').toLowerCase();
}

export function getItemChain(item: any): string {
  const pos = item?.position || item;
  return (pos?.chain || pos?.blockchain || item?.chain || '').toLowerCase();
}

export function sortItems<T = any>(items: T[], sort: SortOption): T[] {
  const sorted = [...items];
  switch (sort) {
    case 'value-desc':
      return sorted.sort((a, b) => getItemValue(b) - getItemValue(a));
    case 'value-asc':
      return sorted.sort((a, b) => getItemValue(a) - getItemValue(b));
    case 'apy-desc':
      return sorted.sort((a, b) => getItemApy(b) - getItemApy(a));
    case 'protocol-asc':
      return sorted.sort((a, b) => getItemProtocol(a).localeCompare(getItemProtocol(b)));
    case 'chain-asc':
      return sorted.sort((a, b) => getItemChain(a).localeCompare(getItemChain(b)));
    default:
      return sorted;
  }
}

export function sortWalletTokens<T = any>(items: T[], sort: SortOption): T[] {
  const sorted = [...items];
  switch (sort) {
    case 'value-desc':
      return sorted.sort((a: any, b: any) => {
        const va = (a.token || a).totalPrice ?? (a.token || a).value ?? 0;
        const vb = (b.token || b).totalPrice ?? (b.token || b).value ?? 0;
        return (typeof vb === 'number' ? vb : parseFloat(vb) || 0) - (typeof va === 'number' ? va : parseFloat(va) || 0);
      });
    case 'value-asc':
      return sorted.sort((a: any, b: any) => {
        const va = (a.token || a).totalPrice ?? (a.token || a).value ?? 0;
        const vb = (b.token || b).totalPrice ?? (b.token || b).value ?? 0;
        return (typeof va === 'number' ? va : parseFloat(va) || 0) - (typeof vb === 'number' ? vb : parseFloat(vb) || 0);
      });
    default:
      return sorted;
  }
}

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = OPTIONS.find((o) => o.id === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: theme.bgPanel,
          border: `1px solid ${theme.border}`,
          borderRadius: 10,
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: 12,
          color: theme.textSecondary,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5h10M11 9h7M11 13h4" />
          <path d="m3 17 3 3 3-3" />
          <path d="M6 18V4" />
        </svg>
        <span>{current?.label || 'Sort'}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 180,
            background: theme.bgPanel,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 60,
          }}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                background: value === opt.id ? theme.bgAccentSoft : 'transparent',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                color: value === opt.id ? theme.accent || theme.primary : theme.textPrimary,
                fontWeight: value === opt.id ? 600 : 400,
                fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                if (value !== opt.id) e.currentTarget.style.background = theme.bgHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = value === opt.id ? theme.bgAccentSoft : 'transparent';
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
