interface LoadingScreenProps {
  theme: Record<string, string>;
  message?: string;
}

const LoadingScreen = ({ theme, message = 'Loading your portfolio...' }: LoadingScreenProps) => {
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
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            margin: '0 auto 32px',
            border: `6px solid ${theme.bgInteractive || 'rgba(255,255,255,0.1)'}`,
            borderTop: `6px solid ${theme.accent || theme.primary}`,
            borderRight: `6px solid ${theme.info || theme.accentAlt}`,
            borderRadius: '50%',
            animation: 'spin 0.85s linear infinite',
          }}
        />

        {/* Message */}
        <h2
          style={{
            margin: '0 0 12px 0',
            fontSize: 24,
            fontWeight: 600,
            color: theme.textPrimary,
            letterSpacing: '0.5px',
          }}
        >
          {message}
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: theme.textSecondary,
            lineHeight: 1.5,
          }}
        >
          This may take a few moments while we fetch your data across multiple chains
        </p>

        {/* Animated dots */}
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: theme.textMuted,
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LoadingScreen;
