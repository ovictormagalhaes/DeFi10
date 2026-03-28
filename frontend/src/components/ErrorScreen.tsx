interface ErrorScreenProps {
  theme: Record<string, string>;
  error?: string | Error | null;
  onRetry?: () => void;
  onGoBack?: () => void;
}

const ErrorScreen = ({ theme, error, onRetry, onGoBack }: ErrorScreenProps) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: theme.bgPrimary,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: theme.bgPanel,
          borderRadius: 24,
          padding: '48px 40px',
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowHover,
          textAlign: 'center',
        }}
      >
        {/* Error Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            margin: '0 auto 24px',
            borderRadius: '50%',
            background: theme.dangerGrad,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: theme.dangerGlow,
          }}
        >
          <svg
            width="40"
            height="40"
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

        {/* Title */}
        <h1
          style={{
            margin: '0 0 12px 0',
            fontSize: 28,
            fontWeight: 700,
            color: theme.textPrimary,
            letterSpacing: '0.5px',
          }}
        >
          Oops! Something went wrong
        </h1>

        {/* Description */}
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: 15,
            color: theme.textSecondary,
            lineHeight: 1.6,
          }}
        >
          We're sorry, but we encountered an error while loading your data.
        </p>

        {/* Error Details */}
        {error && (
          <div
            style={{
              marginTop: 16,
              marginBottom: 24,
              padding: '12px 16px',
              background: theme.bgSecondary || theme.bgPrimary,
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              textAlign: 'left',
            }}
          >
            <p
              style={{
                margin: '0 0 4px 0',
                fontSize: 11,
                fontWeight: 600,
                color: theme.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Error Details
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: theme.textSecondary,
                fontFamily: 'monospace',
                wordBreak: 'break-word',
              }}
            >
              {typeof error === 'string' ? error : error?.message || 'Unknown error'}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 32,
          }}
        >
          {onGoBack && (
            <button
              onClick={onGoBack}
              style={{
                flex: 1,
                padding: '12px 20px',
                fontSize: 15,
                fontWeight: 600,
                color: theme.textPrimary,
                background: 'transparent',
                border: `2px solid ${theme.border}`,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.background = theme.bgSecondary || theme.bgPrimary;
                e.currentTarget.style.borderColor = theme.textMuted;
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = theme.border;
              }}
            >
              Go Back
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                flex: 1,
                padding: '12px 20px',
                fontSize: 15,
                fontWeight: 600,
                color: 'white',
                background: theme.brandGrad,
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: theme.brandGlow,
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = theme.brandGlowHover;
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.brandGlow;
              }}
            >
              Try Again
            </button>
          )}
        </div>

        {/* Help Text */}
        <div
          style={{
            marginTop: 32,
            padding: '16px',
            background: theme.bgSecondary || theme.bgPrimary,
            borderRadius: 12,
            border: `1px solid ${theme.border}`,
            textAlign: 'left',
          }}
        >
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: 12,
              fontWeight: 600,
              color: theme.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Possible Solutions
          </p>
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 20px',
              fontSize: 13,
              color: theme.textSecondary,
              lineHeight: 1.8,
            }}
          >
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
