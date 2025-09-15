import { useTheme } from '../context/ThemeProvider'

// Reusable action button with fixed width to prevent layout shift
export default function ActionButton({
  onClick = () => {},
  disabled = false,
  kind = 'neutral',
  label = '',
  loading = false,
  icon, // optional static icon (string or node)
  loadingIcon, // loading icon (fallback: icon) – if neither provided, we just disable without spinner
  width = 140,
  title
}) {
  const { theme, mode } = useTheme ? useTheme() : { theme: {}, mode: 'dark' }
  const base = {
    width, // fixed width in px
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    lineHeight: '18px',
    whiteSpace: 'nowrap',
    transition: 'background 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s',
    fontFamily: 'inherit'
  }
  let style = { ...base }
  const common = {
    neutral: {
      background: mode === 'light' ? theme.bgInteractive : 'rgba(255,255,255,0.15)',
      border: `1px solid ${mode === 'light' ? theme.border : 'rgba(255,255,255,0.2)'}`,
      color: mode === 'light' ? theme.textPrimary : theme.textPrimary
    },
    danger: {
      background: mode === 'light' ? 'rgba(220,38,38,0.08)' : 'rgba(239, 68, 68, 0.18)',
      border: mode === 'light' ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
      color: mode === 'light' ? '#7f1d1d' : '#fecaca'
    },
    primary: {
      background: mode === 'light' ? theme.primarySubtle : 'rgba(255,255,255,0.22)',
      border: `1px solid ${mode === 'light' ? theme.primary : 'rgba(255,255,255,0.35)'}`,
      color: mode === 'light' ? theme.textPrimary : theme.textPrimary,
      fontWeight: 600
    }
  }
  style = { ...style, ...(common[kind] || common.neutral) }
  if (disabled) style = { ...style, opacity: 0.55 }

  const spinIcon = (loadingIcon || icon) ? (
    <span
      className="mono-icon"
      style={{
        display: 'inline-block',
        animation: 'mw-spin 1s linear infinite'
      }}
    >{loadingIcon || icon}</span>
  ) : null

  return (
    <button
      title={title || label}
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      style={style}
      onKeyDown={(e) => { if (e.key === 'Enter' && !disabled && !loading) onClick(e) }}
    >
  {loading ? spinIcon : (icon ? <span className="mono-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span> : null)}
      <span>{label}</span>
      <style>{`
        @keyframes mw-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        button:focus { outline: ${mode === 'light' ? '2px solid rgba(0,0,0,0.4)' : '2px solid rgba(255,255,255,0.5)'}; outline-offset: 2px; }
        button:hover:not(:disabled) { filter: ${mode === 'light' ? 'brightness(0.97)' : 'brightness(1.08)'}; }
        button:active:not(:disabled) { transform: translateY(1px); }
      `}</style>
    </button>
  )
}
