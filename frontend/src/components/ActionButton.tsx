import React from 'react';
import { useTheme } from '../context/ThemeProvider';

export interface ActionButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  kind?: 'neutral' | 'danger' | 'primary';
  label?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  loadingIcon?: React.ReactNode;
  width?: number;
  title?: string;
}

// Reusable action button with fixed width to prevent layout shift
export default function ActionButton({
  onClick = () => {},
  disabled = false,
  kind = 'neutral',
  label = '',
  loading = false,
  icon,
  loadingIcon,
  width = 140,
  title,
}: ActionButtonProps) {
  // Always call hook unconditionally (previous version attempted conditional falling back)
  const { theme } = useTheme();
  const variantClass = {
    neutral: 'btn-neutral',
    danger: 'btn-danger',
    primary: 'btn-primary',
  }[kind];

  const classes = [
    'btn-base',
    variantClass,
    disabled ? 'is-disabled' : '',
    loading ? 'is-loading' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const spinIcon =
    loadingIcon || icon ? <span className="mono-icon icon-spin">{loadingIcon || icon}</span> : null;

  return (
    <button
      title={title || label}
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      className={classes}
      /* Width kept inline for now; could be replaced by a size utility (e.g., w-[140px]) */
      style={{ width }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !disabled && !loading) {
          (e.currentTarget as HTMLButtonElement).click();
        }
      }}
    >
      {loading ? (
        spinIcon
      ) : icon ? (
        <span className="mono-icon inline-flex items-center">{icon}</span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}
