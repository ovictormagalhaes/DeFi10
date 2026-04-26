const COLORS: Record<string, string> = {
  uniswap: '#ff007a',
  aave: '#b6509e',
  kamino: '#4ade80',
  raydium: '#9945ff',
  pendle: '#3b82f6',
  orca: '#00e5d0',
  meteora: '#f97316',
  jupiter: '#d6a84d',
  marinade: '#ff6b35',
  lido: '#00a3ff',
  compound: '#00d395',
  curve: '#e63946',
  'magic eden': '#e42575',
  drift: '#7c3aed',
  mango: '#f2a93b',
};

export function getProtocolColor(name?: string): string | undefined {
  if (!name) return undefined;
  return COLORS[name.toLowerCase()];
}
