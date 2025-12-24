import React, { useState, useRef, useEffect } from 'react';

import { useMaskValues } from '../context/MaskValuesContext.tsx';
import { useTheme } from '../context/ThemeProvider.tsx';
import { useWalletGroups } from '../hooks/useWalletGroups';
import { formatAddress } from '../types/wallet-groups';

/**
 * HeaderBar layout:
 * Left: Brand icon + label
 * Right: Icons: theme toggle, mask toggle, wallet dropdown
 */
export default function HeaderBar({
  account,
  onRefresh,
  onDisconnect,
  onConnect,
  copyToClipboard,
  onManageGroups, // NEW: callback to open wallet groups modal
  selectedWalletGroupId, // NEW: currently selected wallet group
  onSelectWalletGroup, // NEW: callback when group is selected
}) {
  const { theme, mode, toggleTheme } = useTheme();
  const { maskValues, setMaskValues } = useMaskValues();
  const { groups, getGroup } = useWalletGroups();
  const [walletOpen, setWalletOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedGroup = selectedWalletGroupId ? getGroup(selectedWalletGroupId) : null;

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setWalletOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        columnGap: 20,
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
          className="flex-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            overflow: 'hidden',
            padding: 4,
          }}
        >
          <img 
            src="/logo.svg" 
            alt="Defi10" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
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

      {/* Right Icons / Account */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'flex-end',
          minWidth: 0,
        }}
      >
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
                background:
                  account || selectedWalletGroupId
                    ? theme.success || '#16a34a'
                    : theme.danger || '#dc2626',
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
              {selectedWalletGroupId
                ? selectedGroup?.displayName || 'Wallet Group'
                : account
                  ? `${account.slice(0, 6)}...${account.slice(-4)}`
                  : 'Connect'}
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
                      if (!selectedWalletGroupId) {
                        copyToClipboard(account);
                        setWalletOpen(false);
                      }
                    }}
                    label="Copy address"
                    disabled={!!selectedWalletGroupId}
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
                  {/* Divider */}
                  <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                  {/* Wallet Groups Management */}
                  <DropdownItem
                    onClick={() => {
                      onManageGroups?.();
                      setWalletOpen(false);
                    }}
                    label="Manage Groups"
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
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    }
                  />
                  {/* List available groups for quick selection */}
                  {groups.length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: 10,
                          color: theme.textSecondary,
                          padding: '6px 12px',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        Quick Select
                      </div>
                      {groups.slice(0, 3).map((group) => (
                        <DropdownItem
                          key={group.id}
                          onClick={() => {
                            onSelectWalletGroup?.(group.id);
                            setWalletOpen(false);
                          }}
                          label={
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span>{group.displayName || 'Unnamed Group'}</span>
                              <span style={{ fontSize: 10, opacity: 0.6 }}>
                                {group.wallets.length} wallet(s)
                              </span>
                            </span>
                          }
                          icon={
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill={
                                selectedWalletGroupId === group.id
                                  ? theme.accent || theme.primary
                                  : 'none'
                              }
                              stroke={
                                selectedWalletGroupId === group.id
                                  ? theme.accent || theme.primary
                                  : theme.textSecondary
                              }
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              {selectedWalletGroupId === group.id && <path d="m9 12 2 2 4-4" />}
                            </svg>
                          }
                        />
                      ))}
                    </>
                  )}
                  {/* Divider */}
                  <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
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
              ) : selectedWalletGroupId ? (
                <>
                  {/* When wallet group is selected but no direct wallet connection */}
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
                  {/* Divider */}
                  <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                  {/* Wallet Groups Management */}
                  <DropdownItem
                    onClick={() => {
                      onManageGroups?.();
                      setWalletOpen(false);
                    }}
                    label="Manage Groups"
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
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    }
                  />
                  {/* List available groups for quick selection */}
                  {groups.length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: 10,
                          color: theme.textSecondary,
                          padding: '6px 12px',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        Switch Group
                      </div>
                      {groups.slice(0, 3).map((group) => (
                        <DropdownItem
                          key={group.id}
                          onClick={() => {
                            onSelectWalletGroup?.(group.id);
                            setWalletOpen(false);
                          }}
                          label={
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span>{group.displayName || 'Unnamed Group'}</span>
                              <span style={{ fontSize: 10, opacity: 0.6 }}>
                                {group.wallets.length} wallet(s)
                              </span>
                            </span>
                          }
                          icon={
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill={
                                selectedWalletGroupId === group.id
                                  ? theme.accent || theme.primary
                                  : 'none'
                              }
                              stroke={
                                selectedWalletGroupId === group.id
                                  ? theme.accent || theme.primary
                                  : theme.textSecondary
                              }
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              {selectedWalletGroupId === group.id && <path d="m9 12 2 2 4-4" />}
                            </svg>
                          }
                        />
                      ))}
                    </>
                  )}
                  {/* Divider */}
                  <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                  <DropdownItem
                    onClick={() => {
                      onDisconnect?.();
                      setWalletOpen(false);
                    }}
                    label="Disconnect Group"
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
                <>
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
                  {/* Divider */}
                  <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                  {/* Wallet Groups - available even without connection */}
                  <DropdownItem
                    onClick={() => {
                      onManageGroups?.();
                      setWalletOpen(false);
                    }}
                    label="Manage Groups"
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
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    }
                  />
                  {/* List available groups for quick selection */}
                  {groups.length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: 10,
                          color: theme.textSecondary,
                          padding: '6px 12px',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        Select Group
                      </div>
                      {groups.slice(0, 3).map((group) => (
                        <DropdownItem
                          key={group.id}
                          onClick={() => {
                            onSelectWalletGroup?.(group.id);
                            setWalletOpen(false);
                          }}
                          label={
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span>{group.displayName || 'Unnamed Group'}</span>
                              <span style={{ fontSize: 10, opacity: 0.6 }}>
                                {group.wallets.length} wallet(s)
                              </span>
                            </span>
                          }
                          icon={
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill={
                                selectedWalletGroupId === group.id
                                  ? theme.accent || theme.primary
                                  : 'none'
                              }
                              stroke={
                                selectedWalletGroupId === group.id
                                  ? theme.accent || theme.primary
                                  : theme.textSecondary
                              }
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              {selectedWalletGroupId === group.id && <path d="m9 12 2 2 4-4" />}
                            </svg>
                          }
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
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

function DropdownItem({ label, onClick, danger, icon, disabled }) {
  const { theme } = useTheme();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        padding: '8px 10px',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: danger ? theme.danger || '#dc2626' : theme.textPrimary,
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 120ms, color 140ms, opacity 120ms',
      }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.backgroundColor = theme.bgPanelHover)}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.backgroundColor = 'transparent')}
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
