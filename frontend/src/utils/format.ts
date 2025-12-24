// Formatting & parsing helpers

export function parseNumeric(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    return fallback;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export interface FormatNumberOptions {
  decimals?: number;
  trim?: boolean;
  minCompact?: number;
}

export function formatNumber(value: number, opts: FormatNumberOptions = {}): string {
  const { decimals = 2, trim = true, minCompact } = opts;
  if (!Number.isFinite(value)) return '—';

  if (minCompact && Math.abs(value) >= minCompact) {
    const units = [
      { v: 1e12, s: 'T' },
      { v: 1e9, s: 'B' },
      { v: 1e6, s: 'M' },
      { v: 1e3, s: 'K' },
    ];
    for (const u of units) {
      if (Math.abs(value) >= u.v) {
        const base = value / u.v;
        const str = base.toFixed(decimals);
        return trim ? trimZeros(str) + u.s : str + u.s;
      }
    }
  }
  const out = value.toFixed(decimals);
  return trim ? trimZeros(out) : out;
}

export function formatCurrencyValue(value: number, currency = 'USD', decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // fallback manual
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    return sign + '$' + formatNumber(abs, { decimals });
  }
}

export function maskValue(show: boolean, value: string | number): string {
  if (!show) return '••••••';
  return String(value);
}

function trimZeros(numStr: string): string {
  if (!numStr.includes('.')) return numStr;
  return numStr.replace(/\.\d*?0+$/, '').replace(/\.$/, '');
}
