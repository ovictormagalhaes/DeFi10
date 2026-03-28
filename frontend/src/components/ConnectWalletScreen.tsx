import { WALLETS } from '../constants/wallets';
import { SUPPORTED_CHAINS } from '../constants/chains';
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
            background: 'rgba(20, 24, 32, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(53, 247, 165, 0.2)',
            padding: '12px',
            border: '1.5px solid rgba(53, 247, 165, 0.25)',
          }}
        >
          <img
            src="/logo.svg"
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
              background: theme.brandGrad,
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: theme.brandGlow,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = theme.brandGlowHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.brandGlow;
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
              e.currentTarget.style.borderColor = theme.accent || theme.primary;
              e.currentTarget.style.background = theme.bgAccentSoft;
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
            💡 Create groups to track multiple wallets together
          </p>
        </div>

        {/* Features */}
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            textAlign: 'left',
          }}
        >
          {[
            { text: 'Multi-wallet — group and track wallets together', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.accent || theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
            { text: 'Multi-chain — Ethereum, Solana, Base and more', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.accent || theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg> },
            { text: 'Multi-protocol — Aave, Kamino, Uniswap, Pendle', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.accent || theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
            { text: 'Non-custodial and read-only', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.accent || theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> },
          ].map((feature, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                color: theme.textSecondary,
              }}
            >
              <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: theme.bgAccentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {feature.icon}
              </div>
              <span>{feature.text}</span>
            </div>
          ))}
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
                    padding: 6,
                  }}
                >
                  <img src={wallet.icon} alt={wallet.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: 11, color: theme.textSecondary }}>{wallet.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Protocols */}
        <div
          style={{
            marginTop: 28,
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
            Supported Protocols
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            {[
              { name: 'Aave', icon: '/resources/protocols/aave.svg' },
              { name: 'Uniswap', icon: '/resources/protocols/uniswap.svg' },
              { name: 'Kamino', icon: '/resources/protocols/kamino.svg' },
              { name: 'Pendle', icon: '/resources/protocols/pendle.svg' },
              { name: 'Raydium', icon: '/resources/protocols/raydium.svg' },
            ].map((p) => (
              <div key={p.name} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    margin: '0 auto 4px',
                    borderRadius: 8,
                    background: theme.bgPanel,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 5,
                  }}
                >
                  <img
                    src={p.icon}
                    alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <span style={{ fontSize: 10, color: theme.textSecondary }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Chains */}
        <div
          style={{
            marginTop: 12,
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
            Supported Chains
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            {SUPPORTED_CHAINS.map((chain) => (
              <div key={chain.id} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    margin: '0 auto 4px',
                    borderRadius: '50%',
                    background: theme.bgPanel,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                  }}
                >
                  <img
                    src={chain.iconUrl}
                    alt={chain.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <span style={{ fontSize: 10, color: theme.textSecondary }}>{chain.displayName}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ConnectWalletScreen;
