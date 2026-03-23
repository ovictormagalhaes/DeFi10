import { WALLETS } from '../constants/wallets';
import type { ThemeShape } from '../context/ThemeProvider';

interface ConnectWalletScreenProps {
  theme: ThemeShape;
  onConnect: () => void;
  onManageGroups: () => void;
}

const ConnectWalletScreen: React.FC<ConnectWalletScreenProps> = ({ theme, onConnect, onManageGroups }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: `linear-gradient(135deg, ${theme.bgPrimary} 0%, ${theme.bgSecondary || theme.bgPrimary} 100%)`,
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
        {/* Logo/Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            margin: '0 auto 24px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, #35f7a5 0%, #2fbfd9 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(53, 247, 165, 0.25)',
            padding: '12px',
          }}
        >
          <img
            src="/logo_white_border.svg"
            alt="DeFi10"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
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
          Welcome to DeFi10
        </h1>

        {/* Description */}
        <p
          style={{
            margin: '0 0 32px 0',
            fontSize: 15,
            color: theme.textSecondary,
            lineHeight: 1.6,
          }}
        >
          Connect your wallet to view and manage your DeFi portfolio across multiple chains
        </p>

        {/* Connect Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={onConnect}
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: 16,
              fontWeight: 600,
              color: 'white',
              background: 'linear-gradient(135deg, #35f7a5 0%, #2fbfd9 100%)',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(53, 247, 165, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(53, 247, 165, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(53, 247, 165, 0.3)';
            }}
          >
            Connect Wallet
          </button>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '8px 0',
            }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: theme.border,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: theme.textMuted,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              or
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: theme.border,
              }}
            />
          </div>

          {/* Manage Wallet Groups Button */}
          <button
            onClick={onManageGroups}
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: 16,
              fontWeight: 600,
              color: theme.textPrimary,
              background: 'transparent',
              border: `2px solid ${theme.textMuted || theme.border}`,
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = '#35f7a5';
              e.currentTarget.style.background = 'rgba(53, 247, 165, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = theme.textMuted || theme.border;
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Manage Wallet Groups
          </button>

          {/* Info about Wallet Groups */}
          <p
            style={{
              margin: '12px 0 0 0',
              fontSize: 12,
              color: theme.textMuted,
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            💡 Create groups with up to 3 wallets to track multiple addresses together
          </p>
        </div>

        {/* Supported Wallets Info */}
        <div
          style={{
            marginTop: 24,
            padding: '16px',
            background: theme.bgSecondary || theme.bgPrimary,
            borderRadius: 12,
            border: `1px solid ${theme.border}`,
          }}
        >
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: 12,
              fontWeight: 600,
              color: theme.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Supported Wallets
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {WALLETS.map((wallet) => (
              <div key={wallet.id} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    margin: '0 auto 4px',
                    borderRadius: 8,
                    background: wallet.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  {wallet.icon}
                </div>
                <span style={{ fontSize: 11, color: theme.textSecondary }}>{wallet.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            textAlign: 'left',
          }}
        >
          {[
            { icon: '📊', text: 'Track your DeFi portfolio in real-time' },
            { icon: '🔗', text: 'Multi-chain support (Ethereum, Solana, BSC)' },
            { icon: '👥', text: 'Manage multiple wallets in groups (up to 3)' },
            { icon: '🔒', text: 'Secure and decentralized' },
          ].map((feature, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 13,
                color: theme.textSecondary,
              }}
            >
              <span style={{ fontSize: 18 }}>{feature.icon}</span>
              <span>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConnectWalletScreen;
