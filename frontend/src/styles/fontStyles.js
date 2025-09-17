// Unified font styles for the application
// Automatically handles dark/light mode through theme context

export const getFontStyles = (theme) => ({
  // Texto normal (padrão geral, células das tabelas, subtitle metrics...)
  normal: {
    fontSize: 13,
    fontWeight: 400,
    color: theme.textPrimary,
    fontFamily: 'inherit'
  },

  // Headers das tabelas
  tableHeader: {
    fontSize: 12,
    fontWeight: 400,
    color: theme.textSecondary,
    fontFamily: 'inherit',
    letterSpacing: '0.4px'
  },

  // Headers dos menus (Wallet, Uniswap, Aavee...)
  menuHeader: {
    fontSize: 16,
    fontWeight: 700,
    color: theme.textPrimary,
    fontFamily: 'inherit'
  },

  // Texto secundário (subtítulos, descrições...)
  secondary: {
    fontSize: 12,
    fontWeight: 400,
    color: theme.textSecondary,
    fontFamily: 'inherit'
  },

  // Texto pequeno (labels, badges...)
  small: {
    fontSize: 11,
    fontWeight: 400,
    color: theme.textSecondary,
    fontFamily: 'inherit'
  },

  // Texto monospace (valores monetários, percentuais...)
  monospace: {
    fontSize: 13,
    fontWeight: 400,
    color: theme.textPrimary,
    fontFamily: 'monospace'
  },

  // Texto monospace pequeno (badges)
  monospaceSmall: {
    fontSize: 11,
    fontWeight: 400,
    color: theme.textSecondary,
    fontFamily: 'monospace'
  },

  // Botões
  button: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.textSecondary,
    fontFamily: 'monospace'
  }
})