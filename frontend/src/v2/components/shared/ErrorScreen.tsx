import React from 'react';
import s from './ErrorScreen.module.css';

interface Props {
  error?: string | Error | null;
  onRetry?: () => void;
  onGoBack?: () => void;
  retrying?: boolean;
}

const ErrorScreen: React.FC<Props> = ({ error, onRetry, onGoBack, retrying }) => {
  const message = !error
    ? null
    : typeof error === 'string'
      ? error
      : error.message || 'Unknown error';

  return (
    <div className={s.overlay}>
      <div className={s.card}>
        <div className={s.iconWrap}>
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className={s.title}>Something went wrong</div>
        <div className={s.subtitle}>We encountered an error while loading your portfolio data.</div>

        {message && (
          <div className={s.detail}>
            <span className={s.detailLabel}>Error</span>
            <span className={s.detailMsg}>{message}</span>
          </div>
        )}

        <div className={s.actions}>
          {onGoBack && (
            <button className={s.btnSecondary} onClick={onGoBack}>
              Go Back
            </button>
          )}
          {onRetry && (
            <button className={s.btnPrimary} onClick={onRetry} disabled={retrying}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={retrying ? { animation: 'spin 0.8s linear infinite' } : undefined}
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {retrying ? 'Connecting...' : 'Try Again'}
            </button>
          )}
        </div>

        <div className={s.hints}>
          <div className={s.hintsLabel}>Possible Solutions</div>
          <ul className={s.hintsList}>
            <li>Check your internet connection</li>
            <li>Make sure your wallet is properly connected</li>
            <li>Try refreshing the page</li>
            <li>Contact support if the problem persists</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ErrorScreen;
