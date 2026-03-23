import { WALLETS } from '../constants/wallets';

interface WalletSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (walletId: string) => void;
  availableWallets: Record<string, boolean>;
}

const WalletSelectorDialog = ({ isOpen, onClose, onSelectWallet, availableWallets }: WalletSelectorDialogProps) => {
  if (!isOpen) return null;

  const wallets = WALLETS.map((wallet) => ({
    ...wallet,
    available: availableWallets[wallet.id] || false,
  }));

  const availableWalletsList = wallets.filter((w) => w.available);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--mw-bg-primary, #0f1419)',
          borderRadius: 20,
          maxWidth: 480,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--mw-border, #2a3441)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '28px 28px 20px',
            borderBottom: '1px solid var(--mw-border, #2a3441)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--mw-text-primary, #e4e7eb)',
              }}
            >
              Connect Wallet
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                transition: 'background 0.2s',
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
                stroke="var(--mw-text-secondary, #9ca3af)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description */}
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--mw-text-secondary, #9ca3af)',
              lineHeight: 1.5,
            }}
          >
            Choose a wallet to connect to your account
          </p>
        </div>

        {/* Scrollable Wallet List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 28px 28px',
            minHeight: 0,
          }}
        >
          {availableWalletsList.length === 0 ? (
            <div
              style={{
                padding: '32px 24px',
                textAlign: 'center',
                color: 'var(--mw-text-secondary, #9ca3af)',
                background: 'var(--mw-bg-secondary, #1a2028)',
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 16px',
                  borderRadius: '50%',
                  background: 'var(--mw-border, #2a3441)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                🔌
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 600 }}>
                No wallet extension detected
              </p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                Please install any supported wallet to continue
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {availableWalletsList.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => onSelectWallet(wallet.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    background: 'var(--mw-bg-secondary, #1a2028)',
                    border: '1px solid var(--mw-border, #2a3441)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(4px)';
                    e.currentTarget.style.borderColor = wallet.color;
                    e.currentTarget.style.background = `${wallet.color}08`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.borderColor = 'var(--mw-border, #2a3441)';
                    e.currentTarget.style.background = 'var(--mw-bg-secondary, #1a2028)';
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: wallet.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    {wallet.icon}
                  </div>
                  <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'var(--mw-text-primary, #e4e7eb)',
                        marginBottom: 2,
                      }}
                    >
                      {wallet.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--mw-text-secondary, #9ca3af)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {wallet.description}
                    </div>
                  </div>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--mw-text-secondary, #9ca3af)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletSelectorDialog;
