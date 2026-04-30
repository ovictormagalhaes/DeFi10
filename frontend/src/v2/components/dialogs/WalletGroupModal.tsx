import React, { useState, useEffect } from 'react';
import { detectAvailableWallets, getWalletById } from '../../../constants/wallets';
import { WALLET_GROUPS_KEY } from '../../../constants/storageKeys';
import { useWalletGroups } from '../../../hooks/useWalletGroups';
import * as apiClient from '../../../services/apiClient';
import { solveChallenge } from '../../../services/proofOfWork';
import {
  WalletGroup,
  validateSingleAddress,
  getAddressType,
  formatAddress,
  validateWalletGroup,
} from '../../../types/wallet-groups';
import WalletSelectorDialog from '../../../components/WalletSelectorDialog';
import s from './WalletGroupModal.module.css';

interface WalletGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
  onGroupSelected?: (groupId: string, isReconnect?: boolean) => void;
  onDisconnectGroup?: (groupId: string) => void;
  currentWalletAddress?: string | null;
  onConnectToGroup?: (groupId: string) => void;
  initialGroupId?: string | null;
}

const WalletGroupModal: React.FC<WalletGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
  onGroupSelected,
  currentWalletAddress,
  onConnectToGroup,
  initialGroupId,
}) => {
  const { groups, loading, error, createGroup, updateGroup, deleteGroup, clearError } =
    useWalletGroups();

  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'addWallet' | 'connect'>('list');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  const [connectGroupId, setConnectGroupId] = useState<string>('');
  const [connectPassword, setConnectPassword] = useState<string>('');
  const [isCheckingGroup, setIsCheckingGroup] = useState(false);
  const [groupIsPublic, setGroupIsPublic] = useState<boolean | null>(null);
  const [passwordRequired, setPasswordRequired] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [noPassword, setNoPassword] = useState(false);
  const [walletInputs, setWalletInputs] = useState(['', '', '']);
  const [validationErrors, setValidationErrors] = useState<(string | null)[]>([null, null, null]);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [powStatus, setPowStatus] = useState<'idle' | 'solving' | 'solved' | 'error'>('idle');
  const [powProgress, setPowProgress] = useState<string>('');
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [walletSelectorIndex, setWalletSelectorIndex] = useState<number | null>(null);
  const [connectedWallets, setConnectedWallets] = useState<boolean[]>([false, false, false]);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMode('list');
      setEditingGroupId(null);
      setAddingToGroupId(null);
      setConnectGroupId('');
      setConnectPassword('');
      setIsCheckingGroup(false);
      setGroupIsPublic(null);
      setPasswordRequired(null);
      setDisplayName('');
      setPassword('');
      setNoPassword(false);
      setWalletInputs(['', '', '']);
      setValidationErrors([null, null, null]);
      setGroupError(null);
      setPowStatus('idle');
      setPowProgress('');
      setConnectedWallets([false, false, false]);
      setIsConnecting(false);
      clearError();
    }
  }, [isOpen, clearError]);

  useEffect(() => {
    if (isOpen && initialGroupId) {
      setMode('connect');
      setConnectGroupId(initialGroupId);

      const tryAutoReconnect = async () => {
        try {
          setIsConnecting(true);
          const response = await apiClient.connectWalletGroup(initialGroupId, {});
          const group: WalletGroup = {
            id: response.walletGroupId,
            wallets: response.wallets,
            displayName: response.displayName,
            createdAt: response.createdAt,
          };
          const storedGroups = localStorage.getItem(WALLET_GROUPS_KEY);
          const existingGroups: WalletGroup[] = storedGroups ? JSON.parse(storedGroups) : [];
          const updatedGroups = existingGroups.map((g) => (g.id === group.id ? group : g));
          localStorage.setItem(WALLET_GROUPS_KEY, JSON.stringify(updatedGroups));
          if (onGroupSelected) onGroupSelected(group.id, true);
          onClose();
        } catch {
          setIsConnecting(false);
        }
      };

      tryAutoReconnect();
    }
  }, [isOpen, initialGroupId]);

  const checkGroupPasswordRequirement = async (groupId: string) => {
    if (!groupId.trim()) {
      setGroupIsPublic(null);
      setPasswordRequired(null);
      return;
    }
    try {
      setIsCheckingGroup(true);
      setGroupError(null);
      setPasswordRequired(true);
      setGroupIsPublic(false);
    } catch (err: any) {
      setGroupError(err.message || 'Group not found');
      setGroupIsPublic(null);
      setPasswordRequired(null);
    } finally {
      setIsCheckingGroup(false);
    }
  };

  const handleWalletInput = (index: number, value: string) => {
    const updated = [...walletInputs];
    updated[index] = value.trim();
    setWalletInputs(updated);

    if (!value.trim()) {
      const updatedConnected = [...connectedWallets];
      updatedConnected[index] = false;
      setConnectedWallets(updatedConnected);
    }

    const errors = [...validationErrors];
    if (value.trim().length > 0) {
      const validation = validateSingleAddress(value.trim());
      errors[index] = validation.valid ? null : validation.error || null;
    } else {
      errors[index] = null;
    }
    setValidationErrors(errors);

    const nonEmpty = updated.filter((w) => w.length > 0);
    if (nonEmpty.length > 0) {
      const groupValidation = validateWalletGroup(nonEmpty);
      setGroupError(groupValidation.valid ? null : groupValidation.error || null);
    } else {
      setGroupError(null);
    }
  };

  const handleDisconnectWallet = (index: number) => {
    const updatedInputs = [...walletInputs];
    updatedInputs[index] = '';
    setWalletInputs(updatedInputs);
    const updatedConnected = [...connectedWallets];
    updatedConnected[index] = false;
    setConnectedWallets(updatedConnected);
    const errors = [...validationErrors];
    errors[index] = null;
    setValidationErrors(errors);
    setGroupError(null);
  };

  const handleWalletSelection = async (walletType: string) => {
    if (walletSelectorIndex === null) return;
    setShowWalletSelector(false);
    const wallet = getWalletById(walletType);
    if (!wallet) return;
    try {
      let address = null;
      if (wallet.type === 'solana') {
        const response = await window.solana.connect({ onlyIfTrusted: false });
        address = response.publicKey.toString();
      } else if (wallet.type === 'evm') {
        const provider = walletType === 'rabby' && window.rabby ? window.rabby : window.ethereum;
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        address = accounts[0];
      }
      if (address) {
        handleWalletInput(walletSelectorIndex, address);
        const updated = [...connectedWallets];
        updated[walletSelectorIndex] = true;
        setConnectedWallets(updated);
      }
    } catch (error: any) {
      if (error.code !== 4001 && !error.message?.includes('User rejected')) {
        alert(`Failed to connect ${wallet.name}. Please try again.`);
      }
    } finally {
      setWalletSelectorIndex(null);
    }
  };

  const handleCreateGroup = async () => {
    const wallets = walletInputs.filter((w) => w.length > 0);
    if (wallets.length === 0) {
      setGroupError('Please add at least one wallet address');
      return;
    }
    if (!noPassword && (!password || password.length < 8)) {
      setGroupError('Password must be at least 8 characters or check "Create without password"');
      return;
    }
    try {
      let result;
      if (noPassword) {
        result = await createGroup({ wallets, displayName: displayName.trim() || undefined });
      } else {
        setPowStatus('solving');
        setPowProgress('Initializing secure connection...');
        const challengeData = await apiClient.getChallenge();
        setPowProgress('Creating wallet group securely...');
        const { nonce } = await solveChallenge(
          challengeData.challenge,
          challengeData.difficulty,
          () => { setPowProgress('Processing wallet group...'); }
        );
        setPowStatus('solved');
        setPowProgress('Finalizing wallet group...');
        result = await createGroup({
          wallets,
          displayName: displayName.trim() || undefined,
          password,
          challenge: challengeData.challenge,
          nonce: nonce.toString(),
        });
      }
      if (result) {
        resetForm();
        setPowStatus('idle');
        setPowProgress('');
        if (onGroupCreated) onGroupCreated(result.id);
        setMode('list');
      } else {
        setPowStatus('error');
        setPowProgress('Failed to create group');
      }
    } catch (err: any) {
      setPowStatus('error');
      setPowProgress('');
      setGroupError(err.message || 'Failed to create group');
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroupId) return;
    const wallets = walletInputs.filter((w) => w.length > 0);
    if (wallets.length === 0) {
      setGroupError('Please add at least one wallet address');
      return;
    }
    const result = await updateGroup(editingGroupId, {
      wallets,
      displayName: displayName.trim() || undefined,
    });
    if (result) {
      resetForm();
      setMode('list');
      setEditingGroupId(null);
    }
  };

  const handleEditGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setEditingGroupId(groupId);
    setDisplayName(group.displayName || '');
    const wallets = [...group.wallets];
    while (wallets.length < 3) wallets.push('');
    setWalletInputs(wallets);
    setValidationErrors([null, null, null]);
    setGroupError(null);
    setMode('edit');
  };

  const handleAddWalletToGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setAddingToGroupId(groupId);
    setDisplayName(group.displayName || '');
    setWalletInputs(['', '', '']);
    setValidationErrors([null, null, null]);
    setGroupError(null);
    setMode('addWallet');
  };

  const handleAddWalletSubmit = async () => {
    if (!addingToGroupId) return;
    const group = groups.find((g) => g.id === addingToGroupId);
    if (!group) return;
    const newWallets = walletInputs.filter((w) => w.length > 0);
    if (newWallets.length === 0) {
      setGroupError('Please add at least one wallet address');
      return;
    }
    const result = await updateGroup(addingToGroupId, {
      wallets: [...group.wallets, ...newWallets],
      displayName: group.displayName || undefined,
    });
    if (result) {
      resetForm();
      setMode('list');
    }
  };

  const resetForm = () => {
    setDisplayName('');
    setPassword('');
    setWalletInputs(['', '', '']);
    setValidationErrors([null, null, null]);
    setGroupError(null);
    setEditingGroupId(null);
    setAddingToGroupId(null);
    setConnectGroupId('');
    setConnectPassword('');
    setConnectedWallets([false, false, false]);
  };

  const cancelForm = () => {
    resetForm();
    setMode('list');
  };

  const handleCopyGroupId = (groupId: string) => {
    navigator.clipboard.writeText(groupId).catch(() => {});
  };

  const handleDisconnectGroup = (groupId: string) => {
    if (!window.confirm('Disconnect from this wallet group? You can reconnect later using the Group ID.')) return;
    try {
      apiClient.removeToken(groupId);
      const updatedGroups = groups.filter((g) => g.id !== groupId);
      localStorage.setItem(WALLET_GROUPS_KEY, JSON.stringify(updatedGroups));
      window.location.reload();
    } catch {}
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this wallet group?')) return;
    await deleteGroup(id);
  };

  const handleConnectToExistingGroup = async () => {
    const trimmedId = connectGroupId.trim();
    if (!trimmedId) {
      setGroupError('Please enter a Group ID');
      return;
    }
    if (connectPassword && connectPassword.length < 8) {
      setGroupError('Password must be at least 8 characters or leave empty');
      return;
    }
    try {
      setIsConnecting(true);
      setGroupError(null);
      const authData = connectPassword ? { password: connectPassword } : {};
      const response = await apiClient.connectWalletGroup(trimmedId, authData);
      const group: WalletGroup = {
        id: response.walletGroupId,
        wallets: response.wallets,
        displayName: response.displayName,
        createdAt: response.createdAt,
      };
      const existingGroup = groups.find((g) => g.id === group.id);
      let updatedGroups: WalletGroup[];
      if (existingGroup) {
        if (initialGroupId) {
          updatedGroups = groups.map((g) => (g.id === group.id ? group : g));
        } else {
          setGroupError('This group is already in your list');
          return;
        }
      } else {
        updatedGroups = [...groups, group];
      }
      localStorage.setItem(WALLET_GROUPS_KEY, JSON.stringify(updatedGroups));
      if (onGroupSelected) onGroupSelected(group.id, !!initialGroupId);
      onClose();
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 404) {
        setGroupError('Invalid Group ID or password. Please check and try again.');
      } else {
        setGroupError(err.message || 'Failed to connect to group. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  const hasValidationError = validationErrors.some((e) => e !== null);
  const canSubmit = walletInputs.some((w) => w.length > 0) && !hasValidationError && !groupError;

  const isSubmitDisabled =
    loading ||
    powStatus === 'solving' ||
    isConnecting ||
    (mode === 'connect'
      ? !connectGroupId.trim() || (!!passwordRequired && !connectPassword.trim())
      : !canSubmit);

  const submitLabel =
    loading || powStatus === 'solving' || isConnecting
      ? powStatus === 'solving'
        ? 'Solving Challenge...'
        : 'Connecting...'
      : mode === 'edit'
        ? 'Update Group'
        : mode === 'addWallet'
          ? 'Add Wallets'
          : mode === 'connect'
            ? 'Connect to Group'
            : 'Create Group';

  const subText =
    mode === 'list'
      ? 'Manage your wallet collections'
      : mode === 'create'
        ? 'Create a new wallet group'
        : mode === 'addWallet'
          ? 'Add wallet to group'
          : mode === 'connect'
            ? 'Connect to existing group'
            : 'Edit wallet group';

  return (
    <div className={s.overlay}>
      <div className={s.modal}>
        <div className={s.header}>
          <div>
            <h2 className={s.headerTitle}>Wallet Groups</h2>
            <p className={s.headerSub}>{subText}</p>
          </div>
          <button className={s.closeBtn} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={s.body}>
          {mode === 'list' ? (
            <>
              <div className={s.topActions}>
                <button className={s.btnPrimary} onClick={() => { resetForm(); setMode('create'); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create New Group
                </button>
                <button className={s.btnSecondary} onClick={() => { resetForm(); setMode('connect'); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  Connect to Group
                </button>
              </div>

              {groups.length === 0 ? (
                <div className={s.emptyState}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.5, display: 'block' }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <p className={s.emptyTitle}>No wallet groups yet</p>
                  <p className={s.emptyDesc}>Create your first group to get started</p>
                </div>
              ) : (
                <div className={s.groupsList}>
                  {groups.map((group) => (
                    <div key={group.id} className={s.groupCard}>
                      <div className={s.groupCardTop}>
                        <div className={s.groupInfo}>
                          <h4 className={s.groupName}>{group.displayName || 'Unnamed Group'}</h4>
                          <p className={s.groupMeta}>
                            {group.wallets.length} wallet{group.wallets.length !== 1 ? 's' : ''} • Created {new Date(group.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className={s.groupBtns}>
                          {onGroupSelected && (
                            <button
                              className={`${s.btnSm} ${s.btnSmSelect}`}
                              onClick={() => { onGroupSelected(group.id); onClose(); }}
                              disabled={loading}
                            >
                              Select
                            </button>
                          )}
                          <button
                            className={`${s.btnSm} ${s.btnSmCopy}`}
                            onClick={() => handleCopyGroupId(group.id)}
                            disabled={loading}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy ID
                          </button>
                          <button
                            className={`${s.btnSm} ${s.btnSmDisconnect}`}
                            onClick={() => handleDisconnectGroup(group.id)}
                            disabled={loading}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <polyline points="16 17 21 12 16 7" />
                              <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Disconnect
                          </button>
                          <button
                            className={`${s.btnSm} ${s.btnSmEdit}`}
                            onClick={() => handleEditGroup(group.id)}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button
                            className={`${s.btnSm} ${s.btnSmDelete}`}
                            onClick={() => handleDeleteGroup(group.id)}
                            disabled={loading}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className={s.walletList}>
                        {group.wallets.map((w, i) => (
                          <div key={i} className={s.walletRow}>
                            <span className={s.walletTypeBadge}>{getAddressType(w)}</span>
                            <code className={s.walletAddress}>{formatAddress(w, 10)}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : mode === 'connect' ? (
            <div className={s.form}>
              {initialGroupId && (
                <div className={s.reconnectBanner}>
                  <p className={s.reconnectTitle}>Session Expired</p>
                  <p className={s.reconnectDesc}>
                    Your authentication session has expired. Please enter your password to reconnect to this wallet group.
                  </p>
                </div>
              )}

              <div className={s.fieldGroup}>
                <label htmlFor="group-id" className={s.label}>Group ID</label>
                <input
                  id="group-id"
                  type="text"
                  placeholder="Enter the wallet group ID"
                  value={connectGroupId}
                  readOnly={!!initialGroupId}
                  onChange={(e) => {
                    if (!initialGroupId) {
                      const value = e.target.value;
                      setConnectGroupId(value);
                      setGroupError(null);
                      if (value.trim().length > 10) checkGroupPasswordRequirement(value);
                      else { setGroupIsPublic(null); setPasswordRequired(null); }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && !isConnecting && connectGroupId.trim() && (!passwordRequired || connectPassword.trim()))
                      handleConnectToExistingGroup();
                  }}
                  className={`${s.input} ${s.inputMono} ${groupError?.includes('Group ID') ? s.inputErr : ''} ${initialGroupId ? s.inputReadonly : ''}`}
                />
                {isCheckingGroup && (
                  <p className={s.checkingText}>
                    <div className={s.spinner} />
                    Checking group...
                  </p>
                )}
                {!isCheckingGroup && groupIsPublic !== null && (
                  <div className={`${s.groupStatusBadge} ${groupIsPublic ? s.groupStatusPublic : s.groupStatusLocked}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {groupIsPublic ? (
                        <>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </>
                      ) : (
                        <>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </>
                      )}
                    </svg>
                    {groupIsPublic ? 'Public Group' : 'Password Protected'}
                  </div>
                )}
              </div>

              <div className={s.fieldGroup}>
                <label htmlFor="connect-password" className={s.label}>
                  Password{' '}
                  {passwordRequired
                    ? <span style={{ color: 'var(--v2-red)' }}>*</span>
                    : <span className={s.labelHint}>(if required)</span>
                  }
                </label>
                <input
                  id="connect-password"
                  type="password"
                  placeholder={passwordRequired ? 'Enter group password' : 'Enter password if group is protected'}
                  value={connectPassword}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConnectPassword(val);
                    if (val.length > 0 && val.length < 8) setGroupError('Password must be at least 8 characters');
                    else if (groupError?.includes('Password')) setGroupError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && !isConnecting && connectGroupId.trim() && (!passwordRequired || connectPassword.trim()))
                      handleConnectToExistingGroup();
                  }}
                  className={`${s.input} ${(connectPassword.length > 0 && connectPassword.length < 8) || groupError ? s.inputErr : ''}`}
                />
                {connectPassword.length > 0 && connectPassword.length < 8 && (
                  <p className={s.errorText}>Password must be at least 8 characters</p>
                )}
                {groupError?.includes('Group ID') && (
                  <p className={s.errorText}>{groupError}</p>
                )}
                {!groupError && !(connectPassword.length > 0 && connectPassword.length < 8) && (
                  <p className={s.hint}>Leave empty if the group has no password</p>
                )}
              </div>

              <div className={s.infoBanner}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                Enter the Group ID from another device to sync your wallet collections across devices.
              </div>

              {error && <div className={s.errorBanner}>{error}</div>}
            </div>
          ) : (
            <div className={s.form}>
              {mode !== 'addWallet' && (
                <div className={s.fieldGroup}>
                  <label htmlFor="group-name" className={s.label}>
                    Group Name <span className={s.labelHint}>(optional)</span>
                  </label>
                  <input
                    id="group-name"
                    type="text"
                    placeholder="e.g., Main Portfolio"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    className={s.input}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && noPassword && !loading && powStatus !== 'solving' && canSubmit)
                        handleCreateGroup();
                    }}
                  />
                </div>
              )}

              {mode === 'create' && (
                <>
                  <div className={s.fieldGroup}>
                    <label className={s.checkRow}>
                      <input
                        type="checkbox"
                        checked={noPassword}
                        onChange={(e) => {
                          setNoPassword(e.target.checked);
                          if (e.target.checked) {
                            setPassword('');
                            if (groupError?.includes('Password')) setGroupError(null);
                          }
                        }}
                      />
                      <span>Create without password</span>
                    </label>

                    {noPassword && (
                      <div className={s.warningBannerRow}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2, color: 'var(--v2-yellow)' }}>
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div>
                          <p className={s.warningBannerTitle}>Security Warning</p>
                          <p className={s.warningBannerText}>
                            Anyone with the Group ID will be able to view and modify this wallet group. We recommend using a password for better security.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!noPassword && (
                    <div className={s.fieldGroup}>
                      <label htmlFor="group-password" className={s.label}>
                        Password <span className={s.labelHint}>(min 8 characters)</span>
                      </label>
                      <input
                        id="group-password"
                        type="password"
                        placeholder="Enter a secure password"
                        value={password}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPassword(val);
                          if (val.length > 0 && val.length < 8) setGroupError('Password must be at least 8 characters');
                          else if (groupError?.includes('Password')) setGroupError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !loading && powStatus !== 'solving' && canSubmit)
                            handleCreateGroup();
                        }}
                        minLength={8}
                        className={`${s.input} ${password.length > 0 && password.length < 8 ? s.inputErr : ''}`}
                      />
                      {password.length > 0 && password.length < 8 && (
                        <p className={s.errorText}>Password must be at least 8 characters</p>
                      )}
                      {groupError?.includes('Password') && (
                        <p className={s.errorText}>{groupError}</p>
                      )}
                      <p className={s.hint}>
                        This password is required to access and modify this wallet group. Use a strong password — there is no recovery option if forgotten.
                      </p>
                    </div>
                  )}
                </>
              )}

              {mode === 'addWallet' && (
                <div className={s.fieldGroup}>
                  <label className={s.label}>Adding to Group</label>
                  <div className={s.fieldReadonly}>{displayName || 'Unnamed Group'}</div>
                </div>
              )}

              <div className={s.fieldGroup}>
                <label className={s.label}>
                  Wallet Addresses <span className={s.labelHint}>(max 3)</span>
                </label>
                <div className={s.walletInputFields}>
                  {walletInputs.map((wallet, idx) => (
                    <div key={idx}>
                      <div className={s.walletInputRow}>
                        <span className={s.walletNum}>{idx + 1}</span>
                        <div className={s.walletInputMain}>
                          <div className={s.walletInputInner}>
                            <div className={s.walletInputContainer}>
                              <input
                                id={`wallet-${idx}`}
                                type="text"
                                placeholder={`0x... or Solana address${idx === 0 ? ' (required)' : ''}`}
                                value={wallet}
                                onChange={(e) => handleWalletInput(idx, e.target.value)}
                                readOnly={connectedWallets[idx]}
                                className={[
                                  s.input,
                                  s.inputMono,
                                  validationErrors[idx] ? s.inputErr : '',
                                  connectedWallets[idx] ? s.inputConnected : '',
                                  wallet && !validationErrors[idx] ? s.inputHasBadge : '',
                                ].filter(Boolean).join(' ')}
                              />
                              {wallet && !validationErrors[idx] && (
                                <div className={s.walletInputBadgeOverlay}>
                                  <span className={s.addrTypeBadge}>{getAddressType(wallet)}</span>
                                  {connectedWallets[idx] ? (
                                    <button
                                      type="button"
                                      className={`${s.addrActionBtn} ${s.addrDisconnectBtn}`}
                                      onClick={() => handleDisconnectWallet(idx)}
                                      title="Disconnect wallet"
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className={`${s.addrActionBtn} ${s.addrConnectBtn}`}
                                      onClick={() => { setWalletSelectorIndex(idx); setShowWalletSelector(true); }}
                                      title="Connect wallet"
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                                        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                                      </svg>
                                      Connect
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              className={s.walletConnectBtn}
                              onClick={() => { setWalletSelectorIndex(idx); setShowWalletSelector(true); }}
                              title="Connect wallet"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                              </svg>
                              Connect
                            </button>
                          </div>

                          {wallet && !validationErrors[idx] && (
                            <div className={s.walletMobileBadgeRow}>
                              <span className={s.addrTypeBadge}>{getAddressType(wallet)}</span>
                              {connectedWallets[idx] && (
                                <button
                                  type="button"
                                  className={`${s.addrActionBtn} ${s.addrDisconnectBtn}`}
                                  onClick={() => handleDisconnectWallet(idx)}
                                >
                                  Disconnect
                                </button>
                              )}
                            </div>
                          )}

                          {validationErrors[idx] && (
                            <p className={s.errorText}>{validationErrors[idx]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(groupError || error) && (
                <div className={s.errorBanner}>{groupError || error}</div>
              )}

              {mode === 'create' && powStatus !== 'idle' && (
                <div className={`${s.powBanner} ${powStatus === 'error' ? s.powError : powStatus === 'solved' ? s.powSolved : s.powSolving}`}>
                  {powStatus === 'solving' && <div className={s.spinner} />}
                  {powStatus === 'solved' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                  <span>{powProgress}</span>
                  {powStatus === 'solving' && (
                    <span className={s.powNote}>This may take a moment...</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {mode !== 'list' && (
          <div className={s.footer}>
            <button className={s.btnCancel} onClick={cancelForm}>Cancel</button>
            <button
              className={s.btnSubmit}
              onClick={
                mode === 'edit'
                  ? handleUpdateGroup
                  : mode === 'addWallet'
                    ? handleAddWalletSubmit
                    : mode === 'connect'
                      ? handleConnectToExistingGroup
                      : handleCreateGroup
              }
              disabled={isSubmitDisabled}
            >
              {submitLabel}
            </button>
          </div>
        )}
      </div>

      <WalletSelectorDialog
        isOpen={showWalletSelector}
        onClose={() => { setShowWalletSelector(false); setWalletSelectorIndex(null); }}
        onSelectWallet={handleWalletSelection}
        availableWallets={detectAvailableWallets()}
      />
    </div>
  );
};

export default WalletGroupModal;
