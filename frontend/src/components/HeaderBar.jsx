import React, { useState, useRef, useEffect } from 'react';

import { useMaskValues } from '../context/MaskValuesContext';
import { useTheme } from '../context/ThemeProvider.tsx';

/**
 * HeaderBar layout:
 * Left: Brand icon + label
 * Center: Search address input
 * Right: Icons: theme toggle, mask toggle, wallet dropdown
 */
export default function HeaderBar({
  account,
  onSearch,
  onRefresh,
  onDisconnect,
  onConnect,
  copyToClipboard,
  searchAddress,
  setSearchAddress,
}) {
  const { theme, mode, toggleTheme } = useTheme();
  const { maskValues, setMaskValues } = useMaskValues();
  const [walletOpen, setWalletOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setWalletOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') onSearch?.();
  };

  const brandGradient = `linear-gradient(135deg, ${theme.accent || '#6366f1'} 0%, ${theme.primary || '#3b82f6'} 60%, ${theme.accentAlt || '#10b981'} 100%)`;
  const ACCOUNT_CHIP_WIDTH = 172; // ensures stable width across connect/disconnect states

  // Simple responsive breakpoint detection
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const isNarrow = vw < 1080;
  const isVeryNarrow = vw < 680;

  return (
    <header
      style={{
        display: 'grid',
        gridTemplateColumns: isVeryNarrow ? '1fr auto' : '1fr 1fr 1fr',
        alignItems: 'center',
        columnGap: isVeryNarrow ? 10 : 20,
        rowGap: 10,
        padding: isVeryNarrow ? '8px 14px' : '10px 24px',
        borderBottom: `1px solid ${theme.border}`,
        background: theme.bgApp,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left Brand (Area 1) */}
      <div className="flex items-center gap-12 min-w-0">
        <div
          className="flex-center font-bold"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: brandGradient,
            fontSize: 16,
            color: '#fff',
            letterSpacing: 0.5,
            boxShadow: theme.shadowLight,
            border: `1px solid ${theme.border}`,
          }}
        >
          DF
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: theme.textPrimary }}>DeFi 10</span>
          <span
            style={{
              fontSize: 11,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: theme.textSecondary,
            }}
          >
            Portfolio
          </span>
        </div>
      </div>

      {/* Center Search (Area 2) - hidden on very narrow */}
      {!isVeryNarrow && (
        <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              padding: '4px 10px',
              width: '100%',
              maxWidth: isNarrow ? 420 : 520,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              stroke={theme.textSecondary}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search address..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyDown={handleSearchKey}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '6px 6px',
                color: theme.textPrimary,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
              aria-label="Search address"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => onSearch?.()}
              style={{
                background: theme.primarySubtle,
                border: `1px solid ${theme.border}`,
                color: theme.textPrimary,
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Go
            </button>
          </div>
        </div>
      )}

  {/* Right Icons / Account (Area 3) */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifySelf: isVeryNarrow ? 'end' : 'stretch', justifyContent: isVeryNarrow ? 'flex-end' : 'flex-end', minWidth: 0 }}>
        {/* Mobile hamburger (shows search overlay) */}
        {isVeryNarrow && (
          <IconButton
            label={showMobileSearch ? 'Close search' : 'Search'}
            onClick={() => setShowMobileSearch((s) => !s)}
            icon={
              showMobileSearch ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  stroke={theme.textPrimary}
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  stroke={theme.textPrimary}
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              )
            }
          />
        )}
        {/* Theme toggle */}
        <IconButton
          label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
          icon={
            mode === 'dark' ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                stroke={theme.textPrimary}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 7.07-1.41-1.41M6.34 6.34 4.93 4.93m0 14.14 1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                stroke={theme.textPrimary}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79" />
              </svg>
            )
          }
        />
        {/* Mask toggle */}
        <IconButton
          label={maskValues ? 'Show values' : 'Hide values'}
          onClick={() => setMaskValues(!maskValues)}
          icon={
            maskValues ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                stroke={theme.textPrimary}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                stroke={theme.textPrimary}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-7.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.83 21.83 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )
          }
        />
        {/* Wallet dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setWalletOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              padding: '6px 12px',
              borderRadius: 14,
              cursor: 'pointer',
              fontSize: 13,
              color: theme.textPrimary,
              fontFamily: 'monospace',
              width: ACCOUNT_CHIP_WIDTH,
              justifyContent: 'flex-start',
              position: 'relative',
              transition: 'background-color 120ms',
            }}
            aria-haspopup="menu"
            aria-expanded={walletOpen}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: account ? theme.success || '#16a34a' : theme.danger || '#dc2626',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect'}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              stroke={theme.textSecondary}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, opacity: 0.6 }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {walletOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 220,
                background: theme.bgPanel,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 8,
                boxShadow: '0 4px 18px -2px rgba(0,0,0,0.45)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                zIndex: 120,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              role="menu"
            >
              {account ? (
                <>
                  <DropdownItem
                    onClick={() => {
                      copyToClipboard(account);
                      setWalletOpen(false);
                    }}
                    label="Copy address"
                    icon={
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={theme.textPrimary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    }
                  />
                  <DropdownItem
                    onClick={() => {
                      onRefresh?.();
                      setWalletOpen(false);
                    }}
                    label="Refresh"
                    icon={
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={theme.textPrimary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 2v6h6" />
                        <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
                        <path d="M21 22v-6h-6" />
                        <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
                      </svg>
                    }
                  />
                  <DropdownItem
                    onClick={() => {
                      onDisconnect?.();
                      setWalletOpen(false);
                    }}
                    label="Disconnect"
                    danger
                    icon={
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={theme.danger || '#dc2626'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 12h11" />
                        <path d="M17 8l4 4-4 4" />
                        <path d="M10 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h3" />
                      </svg>
                    }
                  />
                </>
              ) : (
                <DropdownItem
                  onClick={() => {
                    onConnect?.();
                    setWalletOpen(false);
                  }}
                  label="Connect Wallet"
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={theme.textPrimary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 7v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7" />
                      <path d="M3 7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4" />
                      <path d="M7 7h10" />
                    </svg>
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>
      {/* Full-screen search overlay for very narrow view */}
      {isVeryNarrow && showMobileSearch && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '90px 20px 40px 20px',
            zIndex: 200,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              background: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              borderRadius: 18,
              padding: 16,
              boxShadow: theme.shadowHover,
              display: 'flex',
              gap: 10,
            }}
          >
            <input
              autoFocus
              placeholder="Search address..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSearch?.();
                  setShowMobileSearch(false);
                }
              }}
              style={{
                flex: 1,
                background: theme.bgApp,
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                color: theme.textPrimary,
                fontSize: 14,
              }}
            />
            <button
              onClick={() => {
                onSearch?.();
                setShowMobileSearch(false);
              }}
              style={{
                background: theme.primarySubtle,
                border: `1px solid ${theme.border}`,
                color: theme.textPrimary,
                padding: '10px 16px',
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Go
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function IconButton({ icon, label, onClick }) {
  const { theme } = useTheme();
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        border: `1px solid ${theme.border}`,
        background: theme.bgPanel,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}

function DropdownItem({ label, onClick, danger, icon }) {
  const { theme } = useTheme();
  return (
    <button
      onClick={onClick}
      role="menuitem"
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        padding: '8px 10px',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: danger ? theme.danger || '#dc2626' : theme.textPrimary,
        transition: 'background-color 120ms, color 140ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.bgPanelHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}
