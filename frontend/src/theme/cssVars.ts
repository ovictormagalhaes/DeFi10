import { ThemeTokens } from './tokens';

// Prefix curto para evitar colisões caso incorporemos libs externas.
const VAR_PREFIX = '--app';

// Mapeia chaves do objeto de tokens para custom properties.
// Convenção: camelCase => kebab-case após prefixo.
function tokenKeyToVarName(key: string): string {
  return `${VAR_PREFIX}-${key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

export function applyThemeCssVars(
  tokens: ThemeTokens,
  target: HTMLElement = document.documentElement
) {
  const entries = Object.entries(tokens);
  for (const [k, v] of entries) {
    if (typeof v === 'string') {
      const appVarName = tokenKeyToVarName(k);
      const mwVarName = appVarName.replace('--app-', '--mw-');
      
      // Define both --app-* and --mw-* variables for compatibility
      target.style.setProperty(appVarName, v);
      target.style.setProperty(mwVarName, v);
    }
  }
  // Expor modo também
  target.style.setProperty(`${VAR_PREFIX}-mode`, tokens.mode);
}

export function buildVarRef(key: keyof ThemeTokens): string {
  return `var(${tokenKeyToVarName(String(key))})`;
}
