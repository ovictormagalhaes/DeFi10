import { useEffect } from 'react';

interface WalletConnectionPendingProps {
  isOpen: boolean;
  onClose: () => void;
  walletName?: string;
  walletIcon?: React.ReactNode;
  walletColor?: string;
}

const WalletConnectionPending: React.FC<WalletConnectionPendingProps> = ({
  isOpen,
  onClose,
  walletName,
  walletIcon,
  walletColor,
}) => {
  // Auto-close after 30 seconds as safety fallback
  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(() => {
      console.warn('[WalletConnectionPending] Auto-closing after 30s timeout');
      onClose();
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
    >
      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <div
        style={{
          background: 'var(--mw-bg-primary, #0f1419)',
          borderRadius: 24,
          maxWidth: 420,
          width: '100%',
          padding: '48px 40px',
          border: '1px solid var(--mw-border, #2a3441)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            transition: 'background 0.2s',
            color: 'var(--mw-text-secondary, #9ca3af)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--mw-bg-secondary, #1a2028)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Back Button (optional, if you want to go back to wallet selection) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            transition: 'background 0.2s',
            color: 'var(--mw-text-secondary, #9ca3af)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--mw-bg-secondary, #1a2028)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Wallet Icon with Pulse Animation */}
        <div
          style={{
            width: 120,
            height: 120,
            margin: '0 auto 32px',
            borderRadius: 24,
            background: walletColor || '#8697FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            animation: 'pulse 2s ease-in-out infinite',
            boxShadow: `0 8px 32px ${walletColor}40`,
          }}
        >
          {typeof walletIcon === 'string' && walletIcon.endsWith('.svg') ? (
            <img
              src={walletIcon}
              alt={walletName || 'Wallet'}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: 60 }}>{walletIcon || '🔗'}</span>
          )}
        </div>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 12px 0',
            fontSize: 24,
            fontWeight: 600,
            color: 'var(--mw-text-primary, #e4e7eb)',
          }}
        >
          {walletName || 'Wallet'}
        </h2>

        {/* Status */}
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--mw-text-primary, #e4e7eb)',
          }}
        >
          Requesting Connection
        </p>

        {/* Description */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: 14,
            color: 'var(--mw-text-secondary, #9ca3af)',
            lineHeight: 1.6,
          }}
        >
          Open the {walletName || 'wallet'} browser extension to connect your wallet.
        </p>

        {/* Loading Dots */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            margin: '24px 0 0',
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: walletColor || '#8697FF',
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WalletConnectionPending;
