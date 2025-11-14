// Utility to standardize token display formatting
// Accepts an array of token-like objects (logo fields + symbol + name) and returns
// data for rendering a unified visual. Supports up to 2 tokens (if more, only first 2 used).
// API:
// formatTokenDisplay(tokens: Array<object>, options?: { showName?: boolean }) => {
//   logos: [{ src, alt }] // 1 or 2 entries
//   text: string          // SYMBOL or SYMBOL1/SYMBOL2 (or optionally with names)
// }

function pickLogo(t) {
  if (!t || typeof t !== 'object') return '';
  return (
    t.logo ||
    t.logoURI ||
    t.image ||
    t.icon ||
    t.logoUrl ||
    t.logo_url ||
    t.iconUrl ||
    t.icon_url ||
    ''
  );
}

export function formatTokenDisplay(tokens = [], { showName = false } = {}) {
  if (!Array.isArray(tokens)) tokens = tokens ? [tokens] : [];
  const slice = tokens.slice(0, 2);
  if (slice.length === 0) return { logos: [], text: '' };

  const logos = slice.map((tok) => ({
    src: pickLogo(tok),
    alt: (tok.symbol || tok.name || '?').toString(),
  }));

  // Build text part
  if (slice.length === 1) {
    const t = slice[0];
    const sym = (t.symbol || '').toString();
    const name = (t.name || '').toString();
    return {
      logos,
      text:
        showName && name && sym && sym !== name
          ? `${name} (${sym})`
          : sym || name || '',
    };
  }
  // Two tokens
  const t1 = slice[0];
  const t2 = slice[1];
  const s1 = (t1.symbol || t1.name || '').toString();
  const s2 = (t2.symbol || t2.name || '').toString();
  const n1 = (t1.name || '').toString();
  const n2 = (t2.name || '').toString();
  let symbolText = `${s1}/${s2}`;
  if (showName) {
    const namePart = [n1, n2].filter(Boolean).join(' / ');
    if (namePart && namePart.toLowerCase() !== symbolText.toLowerCase()) {
      symbolText += ` · ${namePart}`;
    }
  }
  return { logos, text: symbolText };
}

// Convenience wrapper for a single token object (non-array callers)
export function formatSingleToken(token, opts) {
  return formatTokenDisplay([token], opts);
}
