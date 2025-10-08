import React from 'react';

import { useTheme } from '../context/ThemeProvider.tsx';

// Reusable Uniswap V3-style range chip
// Props:
// - range: { lower: number, upper: number, current: number, inRange: boolean }
// - width?: number (default 90)
// - height?: number (default 14)
// - lowerP?: number (default 28)  // visual position of lower pipe inside pill
// - upperP?: number (default 72)  // visual position of upper pipe inside pill
// - markerOvershoot?: number (default 2) // how many px the marker extends beyond pill vertically
export default function RangeChip({
  range,
  width = 90,
  height = 14,
  lowerP = 28,
  upperP = 72,
  markerOvershoot = 2,
}) {
  const { theme } = useTheme();
  if (!range) return <span className="opacity-60">-</span>;

  const { lower, upper, current, inRange } = range || {};

  // Helper to apply alpha to hex or rgb colors
  const applyAlpha = (color, alpha) => {
    if (!color) return color;
    // rgb or rgba
    if (color.startsWith('rgb')) {
      const nums = color
        .replace(/rgba?\(/, '')
        .replace(/\)/, '')
        .split(',')
        .map((s) => parseFloat(s.trim()));
      const [r, g, b] = nums;
      return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
    }
    // hex formats #RGB or #RRGGBB
    if (color[0] === '#') {
      let hex = color.slice(1);
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((ch) => ch + ch)
          .join('');
      }
      if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    // Fallback: return original (no alpha applied)
    return color;
  };

  // Compute marker position
  let markerPercent;
  if (
    typeof lower === 'number' &&
    typeof upper === 'number' &&
    typeof current === 'number' &&
    upper !== lower
  ) {
    if (current < lower) {
      markerPercent = lowerP - 6;
    } else if (current > upper) {
      markerPercent = upperP + 6;
    } else {
      const ratio = (current - lower) / (upper - lower);
      markerPercent = lowerP + ratio * (upperP - lowerP);
    }
  } else {
    markerPercent = 50;
  }

  markerPercent = Math.max(2, Math.min(98, markerPercent));

  const barColor = theme.border;
  const fillColor = inRange ? theme.success || '#16a34a' : theme.danger || '#dc2626';
  const markerColor = theme.textPrimary;
  const borderBase = inRange ? theme.success || '#16a34a' : theme.danger || '#dc2626';
  const border = applyAlpha(borderBase, 0.5);

  return (
    <div
      title={`Min: ${lower}\nMax: ${upper}\nCurrent: ${current}\nIn Range: ${!!inRange}`}
      style={{
        width,
        height,
        border: '1px solid',
        borderColor: border,
        borderRadius: 9999,
        position: 'relative',
        background: 'transparent',
        display: 'inline-block',
      }}
    >
      {/* parentheses accents */}

      {/* in-range segment fill */}
      <div
        style={{
          position: 'absolute',
          top: 1,
          bottom: 1,
          left: `${lowerP}%`,
          right: `${100 - upperP}%`,
          background: fillColor,
          opacity: 0.85,
          borderRadius: 3,
        }}
      />

      {/* current marker (taller than pill) */}
      <div
        style={{
          position: 'absolute',
          top: -markerOvershoot,
          bottom: -markerOvershoot,
          width: 3,
          left: `calc(${markerPercent}% - 1.5px)`,
          background: markerColor,
          borderRadius: 1,
        }}
      />
    </div>
  );
}
