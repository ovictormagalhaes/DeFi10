import React, { useState, useEffect } from 'react';

import { useTheme } from '../context/ThemeProvider.tsx';
import { useWalletGroups } from '../hooks/useWalletGroups';
import {
  validateSingleAddress,
  getAddressType,
  formatAddress,
  validateWalletGroup,
} from '../types/wallet-groups';
import * as apiClient from '../services/apiClient';
import { solveChallenge, estimateSolveTime } from '../services/proofOfWork';
import { detectAvailableWallets, getWalletById } from '../constants/wallets';
import WalletSelectorDialog from './WalletSelectorDialog';

// Extend Window interface for wallet providers
declare global {
  interface Window {
    ethereum?: any;
    rabby?: any;
    solana?: any;
  }
}

interface WalletGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
  onGroupSelected?: (groupId: string, isReconnect?: boolean) => void;
  currentWalletAddress?: string | null; // Current connected wallet to add to group
  onConnectToGroup?: (groupId: string) => void; // Callback when wallet is connected to group
  initialGroupId?: string | null; // Pre-fill connect form with this group ID
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
  const { theme } = useTheme();
  const { groups, loading, error, createGroup, updateGroup, deleteGroup, clearError } = useWalletGroups();

  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
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

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset form when modal closes
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
      clearError();
    }
  }, [isOpen, clearError]);

  // Handle initialGroupId - auto-open connect mode with pre-filled ID
  useEffect(() => {
    if (isOpen && initialGroupId) {
      console.log('[WalletGroupModal] Opening in connect mode with ID:', initialGroupId);
      setMode('connect');
      setConnectGroupId(initialGroupId);
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
      
      const response = await apiClient.checkWalletGroup(groupId.trim());
      
      setPasswordRequired(response.requiresPassword);
      setGroupIsPublic(!response.requiresPassword);
      
      console.log('[WalletGroup] Group check:', { 
        groupId: groupId.trim(), 
        requiresPassword: response.requiresPassword,
        isPublic: !response.requiresPassword
      });
    } catch (err: any) {
      console.error('[WalletGroup] Error checking group:', err);
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

    // If manually editing, mark as not connected
    if (!value.trim()) {
      const updatedConnected = [...connectedWallets];
      updatedConnected[index] = false;
      setConnectedWallets(updatedConnected);
    }

    // Validate individual address
    const errors = [...validationErrors];
    if (value.trim().length > 0) {
      const validation = validateSingleAddress(value.trim());
      errors[index] = validation.valid ? null : validation.error || null;
    } else {
      errors[index] = null;
    }
    setValidationErrors(errors);

    // Validate group as a whole
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
        console.error('Error connecting wallet:', error);
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

    // Validate password only if user wants to use one
    if (!noPassword && (!password || password.length < 8)) {
      setGroupError('Password must be at least 8 characters or check "Create without password"');
      return;
    }

    try {
      let result;

      // If no password, create group directly without PoW
      if (noPassword) {
        console.log('[WalletGroup] Creating group without password...');
        result = await createGroup({
          wallets,
          displayName: displayName.trim() || undefined,
        });
      } else {
        // Step 1: Get challenge from backend
        setPowStatus('solving');
        setPowProgress('Initializing secure connection...');
        
        console.log('[WalletGroup] Requesting challenge from server...');
        const challengeData = await apiClient.getChallenge();
        console.log('[WalletGroup] Challenge received:', {
          challenge: challengeData.challenge.substring(0, 16) + '...',
          difficulty: challengeData.difficulty,
          expiresAt: challengeData.expiresAt
        });
        
        setPowProgress('Creating wallet group securely...');

        // Step 2: Solve Proof-of-Work challenge with progress callback
        const { nonce, hash } = await solveChallenge(
          challengeData.challenge, 
          challengeData.difficulty,
          (currentNonce, currentHash) => {
            // Update progress message without percentage details
            setPowProgress('Processing wallet group...');
          }
        );
        
        console.log('[WalletGroup] Challenge solved, creating group...');
        setPowStatus('solved');
        setPowProgress('Finalizing wallet group...');

        // Step 3: Create group with PoW solution
        result = await createGroup({
          wallets,
          displayName: displayName.trim() || undefined,
          password,
          challenge: challengeData.challenge,
          nonce: nonce.toString(), // Convert to string for backend
        });
      }

      if (result) {
        console.log('[WalletGroup] Group created successfully:', result.id);
        // Success - reset form and notify parent
        resetForm();
        setPowStatus('idle');
        setPowProgress('');

        if (onGroupCreated) {
          onGroupCreated(result.id);
        }
        setMode('list');
      } else {
        console.error('[WalletGroup] Failed to create group - no result returned');
        setPowStatus('error');
        setPowProgress('Failed to create group');
      }
    } catch (err: any) {
      console.error('[WalletGroup] Error creating group:', err);
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
    // Pad to 3 slots
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
    setWalletInputs(['', '', '']); // Empty inputs for new wallets
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

    // Merge existing wallets with new ones
    const allWallets = [...group.wallets, ...newWallets];

    const result = await updateGroup(addingToGroupId, {
      wallets: allWallets,
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
    navigator.clipboard.writeText(groupId).then(() => {
      // Could add a toast notification here in the future
      console.log('[WalletGroup] Group ID copied to clipboard:', groupId);
    }).catch(err => {
      console.error('[WalletGroup] Failed to copy group ID:', err);
    });
  };

  const handleDisconnectGroup = (groupId: string) => {
    if (!window.confirm('Disconnect from this wallet group? You can reconnect later using the Group ID.')) {
      return;
    }

    try {
      // Remove token
      apiClient.removeToken(groupId);
      
      // Remove from local storage
      const updatedGroups = groups.filter(g => g.id !== groupId);
      localStorage.setItem('defi10_wallet_groups', JSON.stringify(updatedGroups));
      
      console.log('[WalletGroup] Disconnected from group:', groupId);
      
      // Force refresh by triggering a re-render
      window.location.reload();
    } catch (err) {
      console.error('[WalletGroup] Failed to disconnect:', err);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this wallet group?')) {
      return;
    }
    await deleteGroup(id);
  };

  const handleConnectCurrentWallet = async (groupId: string) => {
    if (!currentWalletAddress) return;

    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    // Check if wallet is already in the group
    if (group.wallets.includes(currentWalletAddress)) {
      alert('This wallet is already connected to this group');
      return;
    }

    // Add current wallet to the group
    const result = await updateGroup(groupId, {
      wallets: [...group.wallets, currentWalletAddress],
      displayName: group.displayName || undefined,
    });

    if (result && onConnectToGroup) {
      onConnectToGroup(groupId);
      onClose();
    }
  };

  const handleConnectToExistingGroup = async () => {
    const trimmedId = connectGroupId.trim();
    
    if (!trimmedId) {
      setGroupError('Please enter a Group ID');
      return;
    }

    // Validate password if provided
    if (connectPassword && connectPassword.length < 8) {
      setGroupError('Password must be at least 8 characters or leave empty');
      return;
    }

    try {
      setGroupError(null);
      console.log('[WalletGroup] Connecting to group:', trimmedId);

      // Authenticate with the wallet group - response includes all group data
      const authData = connectPassword ? { password: connectPassword } : {};
      const response = await apiClient.connectWalletGroup(trimmedId, authData);
      console.log('[WalletGroup] Authentication successful, group data received');

      // Convert response to WalletGroup format
      const group: WalletGroup = {
        id: response.walletGroupId,
        wallets: response.wallets,
        displayName: response.displayName,
        createdAt: response.createdAt,
      };
      
      // Check if group already exists locally
      const existingGroup = groups.find(g => g.id === group.id);
      
      let updatedGroups: WalletGroup[];
      if (existingGroup) {
        // If reconnecting (initialGroupId present), update existing group data
        if (initialGroupId) {
          console.log('[WalletGroup] Reconnected - updating existing group');
          updatedGroups = groups.map(g => g.id === group.id ? group : g);
        } else {
          // If not reconnecting, show error (group already exists)
          setGroupError('This group is already in your list');
          return;
        }
      } else {
        // Add new group
        updatedGroups = [...groups, group];
      }

      // Save to local storage
      localStorage.setItem('defi10_wallet_groups', JSON.stringify(updatedGroups));
      
      console.log('[WalletGroup] Group connected and saved to local storage');

      // Trigger selection if callback provided
      if (onGroupSelected) {
        // Pass isReconnect flag if it's a reconnection
        onGroupSelected(group.id, !!initialGroupId);
      }
      
      onClose();
      
    } catch (err: any) {
      console.error('[WalletGroup] Error connecting to group:', err);
      
      if (err.response?.status === 401 || err.response?.status === 404) {
        setGroupError('Invalid Group ID or password. Please check and try again.');
      } else {
        setGroupError(err.message || 'Failed to connect to group. Please try again.');
      }
    }
  };

  if (!isOpen) return null;

  const hasValidationError = validationErrors.some((e) => e !== null);
  const canSubmit = walletInputs.some((w) => w.length > 0) && !hasValidationError && !groupError;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: viewportWidth < 640 ? 12 : 20,
      }}
    >
      <div
        style={{
          background: theme.bgPanel,
          borderRadius: viewportWidth < 640 ? 16 : 20,
          maxWidth: viewportWidth < 640 ? '100%' : 700,
          width: '100%',
          maxHeight: viewportWidth < 640 ? '100vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: `1px solid ${theme.border}`,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: viewportWidth < 640 ? '16px 20px' : '24px 28px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: viewportWidth < 640 ? 18 : 22,
                fontWeight: 600,
                color: theme.textPrimary,
                letterSpacing: 0.3,
              }}
            >
              Wallet Groups
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: viewportWidth < 640 ? 12 : 13,
                color: theme.textSecondary,
              }}
            >
              {mode === 'list'
                ? 'Manage your wallet collections'
                : mode === 'create'
                  ? 'Create a new wallet group'
                  : mode === 'addWallet'
                    ? 'Add wallet to group'
                    : mode === 'connect'
                      ? 'Connect to existing group'
                      : 'Edit wallet group'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: theme.textSecondary,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.bgPanelHover;
              e.currentTarget.style.color = theme.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = theme.textSecondary;
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
        </div>

        {/* Body */}
        <div
          style={{
            padding: viewportWidth < 640 ? '16px 20px' : '24px 28px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            boxSizing: 'border-box',
          }}
        >
          {mode === 'list' ? (
            <>
              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: viewportWidth < 640 ? 'column' : 'row', gap: 12, marginBottom: 24 }}>
                <button
                  onClick={() => {
                    resetForm();
                    setMode('create');
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                    border: 'none',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create New Group
                </button>
                
                <button
                  onClick={() => {
                    resetForm();
                    setMode('connect');
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    background: 'transparent',
                    border: `2px solid ${theme.border}`,
                    borderRadius: 12,
                    color: theme.textPrimary,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.bgPanelHover;
                    e.currentTarget.style.borderColor = theme.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = theme.border;
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  Connect to Group
                </button>
              </div>

              {/* Groups List */}
              {groups.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 20px',
                    color: theme.textSecondary,
                  }}
                >
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ margin: '0 auto 16px', opacity: 0.5 }}
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <p style={{ fontSize: 14, margin: 0 }}>No wallet groups yet</p>
                  <p style={{ fontSize: 12, margin: '8px 0 0 0', opacity: 0.7 }}>
                    Create your first group to get started
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      style={{
                        background: theme.bgApp,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 14,
                        padding: 18,
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = theme.borderHover || theme.border;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = theme.border;
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: viewportWidth < 640 ? 'column' : 'row',
                          justifyContent: 'space-between',
                          alignItems: viewportWidth < 640 ? 'stretch' : 'flex-start',
                          marginBottom: 12,
                          gap: viewportWidth < 640 ? 12 : 0,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: 16,
                              fontWeight: 600,
                              color: theme.textPrimary,
                              marginBottom: 4,
                            }}
                          >
                            {group.displayName || 'Unnamed Group'}
                          </h4>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              color: theme.textSecondary,
                            }}
                          >
                            {group.wallets.length} wallet{group.wallets.length !== 1 ? 's' : ''} •{' '}
                            Created {new Date(group.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          gap: 6, 
                          flexShrink: 0, 
                          marginLeft: viewportWidth < 640 ? 0 : 12,
                          flexWrap: 'wrap',
                        }}>
                          {onGroupSelected && (
                            <button
                              onClick={() => {
                                onGroupSelected(group.id);
                                onClose();
                              }}
                              disabled={loading}
                              style={{
                                padding: '6px 14px',
                                background: theme.primarySubtle,
                                border: `1px solid ${theme.border}`,
                                borderRadius: 8,
                                color: theme.textPrimary,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1,
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                if (!loading) e.currentTarget.style.background = theme.primary;
                              }}
                              onMouseLeave={(e) => {
                                if (!loading) e.currentTarget.style.background = theme.primarySubtle;
                              }}
                            >
                              Select
                            </button>
                          )}
                          <button
                            onClick={() => handleCopyGroupId(group.id)}
                            disabled={loading}
                            style={{
                              padding: '6px 14px',
                              background: 'transparent',
                              border: `1px solid ${theme.border}`,
                              borderRadius: 8,
                              color: theme.accent || theme.primary,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: loading ? 0.5 : 1,
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onMouseEnter={(e) => {
                              if (!loading) e.currentTarget.style.background = theme.bgPanelHover;
                            }}
                            onMouseLeave={(e) => {
                              if (!loading) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy ID
                          </button>
                          <button
                            onClick={() => handleDisconnectGroup(group.id)}
                            disabled={loading}
                            style={{
                              padding: '6px 14px',
                              background: 'transparent',
                              border: `1px solid ${theme.border}`,
                              borderRadius: 8,
                              color: theme.warning || '#f59e0b',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: loading ? 0.5 : 1,
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onMouseEnter={(e) => {
                              if (!loading) {
                                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                                e.currentTarget.style.borderColor = theme.warning || '#f59e0b';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!loading) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = theme.border;
                              }
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <polyline points="16 17 21 12 16 7" />
                              <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Disconnect
                          </button>
                          <button
                            onClick={() => handleEditGroup(group.id)}
                            disabled={loading}
                            style={{
                              padding: '6px 14px',
                              background: 'transparent',
                              border: `1px solid ${theme.border}`,
                              borderRadius: 8,
                              color: theme.textPrimary,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: loading ? 0.5 : 1,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!loading) e.currentTarget.style.background = theme.bgPanelHover;
                            }}
                            onMouseLeave={(e) => {
                              if (!loading) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            disabled={loading}
                            style={{
                              padding: '6px 10px',
                              background: 'transparent',
                              border: `1px solid ${theme.border}`,
                              borderRadius: 8,
                              color: theme.danger || '#ef4444',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: loading ? 0.5 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!loading) {
                                e.currentTarget.style.background =
                                  'rgba(239, 68, 68, 0.1)';
                                e.currentTarget.style.borderColor = theme.danger || '#ef4444';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!loading) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = theme.border;
                              }
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Wallets */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {group.wallets.map((w, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: viewportWidth < 640 ? '8px 10px' : '8px 12px',
                              background: theme.bgPanel,
                              border: `1px solid ${theme.border}`,
                              borderRadius: 10,
                              fontSize: 13,
                            }}
                          >
                            <span
                              style={{
                                padding: '3px 8px',
                                background: theme.primarySubtle,
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                color: theme.textPrimary,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                flexShrink: 0,
                              }}
                            >
                              {getAddressType(w)}
                            </span>
                            <code
                              style={{
                                flex: 1,
                                color: theme.textSecondary,
                                fontFamily: 'monospace',
                                fontSize: viewportWidth < 640 ? 11 : 12,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                wordBreak: 'break-all',
                              }}
                            >
                              {formatAddress(w, viewportWidth < 640 ? 6 : 10)}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : mode === 'connect' ? (
            <>
              {/* Connect to Existing Group Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Show reconnection message if initialGroupId is provided */}
                {initialGroupId && (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: theme.warning ? `${theme.warning}15` : '#f59e0b15',
                      border: `1px solid ${theme.warning || '#f59e0b'}`,
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: theme.textPrimary,
                    }}
                  >
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: theme.warning || '#f59e0b' }}>
                      🔐 Session Expired
                    </p>
                    <p style={{ margin: 0, color: theme.textSecondary }}>
                      Your authentication session has expired. Please enter your password to reconnect to this wallet group.
                    </p>
                  </div>
                )}
                
                <div>
                  <label
                    htmlFor="group-id"
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: theme.textPrimary,
                      marginBottom: 8,
                    }}
                  >
                    Group ID
                  </label>
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
                        
                        if (value.trim().length > 10) {
                          checkGroupPasswordRequirement(value);
                        } else {
                          setGroupIsPublic(null);
                          setPasswordRequired(null);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1px solid ${(groupError && groupError.includes('Group ID')) ? theme.danger || '#ef4444' : theme.border}`,
                      background: initialGroupId ? theme.bgElevated || theme.bgPanel : theme.bgApp,
                      color: theme.textPrimary,
                      fontSize: 14,
                      fontFamily: 'monospace',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                      boxSizing: 'border-box',
                      cursor: initialGroupId ? 'not-allowed' : 'text',
                      opacity: initialGroupId ? 0.7 : 1,
                    }}
                    onFocus={(e) => !initialGroupId && (e.currentTarget.style.borderColor = theme.primary)}
                    onBlur={(e) => !initialGroupId && (e.currentTarget.style.borderColor = (groupError && groupError.includes('Group ID')) ? theme.danger || '#ef4444' : theme.border)}
                  />
                  {isCheckingGroup && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ animation: 'spin 1s linear infinite' }}
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Checking group...
                    </p>
                  )}
                  {!isCheckingGroup && groupIsPublic !== null && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '8px 12px',
                        background: groupIsPublic 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'rgba(245, 158, 11, 0.1)',
                        border: `1px solid ${groupIsPublic ? '#10b981' : '#f59e0b'}`,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={groupIsPublic ? '#10b981' : '#f59e0b'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
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
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: groupIsPublic ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {groupIsPublic ? '🌐 Public Group' : '🔒 Password Protected'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="connect-password"
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: theme.textPrimary,
                      marginBottom: 8,
                    }}
                  >
                    Password {passwordRequired ? <span style={{ color: theme.danger || '#ef4444' }}>*</span> : <span style={{ opacity: 0.5 }}>(if required)</span>}
                  </label>
                  <input
                    id="connect-password"
                    type="password"
                    placeholder={passwordRequired ? "Enter group password" : "Enter password if group is protected"}
                    value={connectPassword}
                    onChange={(e) => {
                      const newPassword = e.target.value;
                      setConnectPassword(newPassword);
                      // Validate password in real-time
                      if (newPassword.length > 0 && newPassword.length < 8) {
                        setGroupError('Password must be at least 8 characters');
                      } else {
                        // Clear password error if it was a password error
                        if (groupError?.includes('Password')) {
                          setGroupError(null);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1px solid ${(connectPassword.length > 0 && connectPassword.length < 8) || groupError ? theme.danger || '#ef4444' : theme.border}`,
                      background: theme.bgApp,
                      color: theme.textPrimary,
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.15s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = theme.primary)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = (connectPassword.length > 0 && connectPassword.length < 8) || groupError ? theme.danger || '#ef4444' : theme.border)}
                  />
                  {connectPassword.length > 0 && connectPassword.length < 8 && (
                    <p style={{ 
                      margin: '6px 0 0', 
                      fontSize: 12, 
                      color: theme.danger || '#ef4444' 
                    }}>
                      Password must be at least 8 characters
                    </p>
                  )}
                  {groupError && groupError.includes('Group ID') && (
                    <p
                      style={{
                        margin: '8px 0 0 0',
                        fontSize: 12,
                        color: theme.danger || '#ef4444',
                      }}
                    >
                      {groupError}
                    </p>
                  )}
                  {!groupError && !(connectPassword.length > 0 && connectPassword.length < 8) && (
                    <p style={{ 
                      margin: '6px 0 0', 
                      fontSize: 12, 
                      color: theme.textSecondary,
                      opacity: 0.7 
                    }}>
                      Leave empty if the group has no password
                    </p>
                  )}
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: theme.bgPanel,
                    borderRadius: 10,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, color: theme.textSecondary, lineHeight: 1.6 }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ verticalAlign: 'text-bottom', marginRight: 6 }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    Enter the Group ID from another device to sync your wallet collections across devices.
                  </p>
                </div>

                {error && (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${theme.danger || '#ef4444'}`,
                      borderRadius: 10,
                      color: theme.danger || '#ef4444',
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Form: Create, Edit, or Add Wallet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Group Name - only show in create/edit mode, not in addWallet */}
                {mode !== 'addWallet' && (
                  <div>
                    <label
                      htmlFor="group-name"
                      style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.textPrimary,
                        marginBottom: 8,
                      }}
                    >
                      Group Name <span style={{ opacity: 0.5 }}>(optional)</span>
                    </label>
                    <input
                      id="group-name"
                      type="text"
                      placeholder="e.g., Main Portfolio"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={50}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: `1px solid ${theme.border}`,
                        background: theme.bgApp,
                        color: theme.textPrimary,
                        fontSize: 14,
                        outline: 'none',
                        transition: 'border-color 0.15s',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = theme.primary)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = theme.border)}
                    />
                  </div>
                )}

                {/* Password field - only in create mode */}
                {mode === 'create' && (
                  <>
                    {/* Checkbox to create without password */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                          fontSize: 13,
                          color: theme.textPrimary,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={noPassword}
                          onChange={(e) => {
                            setNoPassword(e.target.checked);
                            if (e.target.checked) {
                              setPassword('');
                              // Clear password-related errors when creating without password
                              if (groupError?.includes('Password')) {
                                setGroupError(null);
                              }
                            }
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            cursor: 'pointer',
                          }}
                        />
                        <span>Create without password</span>
                      </label>

                      {/* Warning alert when no password is selected */}
                      {noPassword && (
                        <div
                          style={{
                            padding: '12px 16px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: `1px solid ${theme.warning || '#f59e0b'}`,
                            borderRadius: 10,
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={theme.warning || '#f59e0b'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0, marginTop: 2 }}
                          >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          <div style={{ flex: 1 }}>
                            <p style={{ 
                              margin: 0, 
                              fontSize: 12, 
                              fontWeight: 600,
                              color: theme.warning || '#f59e0b',
                              marginBottom: 4,
                            }}>
                              ⚠️ Security Warning
                            </p>
                            <p style={{ 
                              margin: 0, 
                              fontSize: 12, 
                              color: theme.textSecondary,
                              lineHeight: 1.5,
                            }}>
                              Anyone with the Group ID will be able to view and modify this wallet group. We recommend using a password for better security.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Password field - only shown when noPassword is false */}
                    {!noPassword && (
                      <div>
                        <label
                          htmlFor="group-password"
                          style={{
                            display: 'block',
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.textPrimary,
                            marginBottom: 8,
                          }}
                        >
                          Password <span style={{ opacity: 0.5 }}>(min 8 characters)</span>
                        </label>
                        <input
                          id="group-password"
                          type="password"
                          placeholder="Enter a secure password"
                          value={password}
                          onChange={(e) => {
                            const newPassword = e.target.value;
                            setPassword(newPassword);
                            // Validate password in real-time
                            if (newPassword.length > 0 && newPassword.length < 8) {
                              setGroupError('Password must be at least 8 characters');
                            } else {
                              // Clear password error if it was a password error
                              if (groupError?.includes('Password')) {
                                setGroupError(null);
                              }
                            }
                          }}
                          minLength={8}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: 10,
                            border: `1px solid ${password.length > 0 && password.length < 8 ? theme.danger || '#ef4444' : theme.border}`,
                            background: theme.bgApp,
                            color: theme.textPrimary,
                            fontSize: 14,
                            outline: 'none',
                            transition: 'border-color 0.15s',
                            boxSizing: 'border-box',
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = theme.primary)}
                          onBlur={(e) => (e.currentTarget.style.borderColor = password.length > 0 && password.length < 8 ? theme.danger || '#ef4444' : theme.border)}
                        />
                        {password.length > 0 && password.length < 8 && (
                          <p style={{ 
                            margin: '6px 0 0', 
                            fontSize: 12, 
                            color: theme.danger || '#ef4444' 
                          }}>
                            Password must be at least 8 characters
                          </p>
                        )}
                        {groupError && groupError.includes('Password') && (
                          <p style={{ 
                            margin: '6px 0 0', 
                            fontSize: 12, 
                            color: theme.danger || '#ef4444' 
                          }}>
                            {groupError}
                          </p>
                        )}
                        <p style={{ 
                          margin: '6px 0 0', 
                          fontSize: 12, 
                          color: theme.textSecondary,
                          opacity: 0.7 
                        }}>
                          🔒 This password is required to access and modify this wallet group. Use a strong password - there is no recovery option if forgotten.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Show group name as readonly in addWallet mode */}
                {mode === 'addWallet' && (
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.textPrimary,
                        marginBottom: 8,
                      }}
                    >
                      Adding to Group
                    </label>
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: theme.bgPanel,
                        color: theme.textPrimary,
                        fontSize: 14,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      {displayName || 'Unnamed Group'}
                    </div>
                  </div>
                )}

                {/* Wallets */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: theme.textPrimary,
                      marginBottom: 8,
                    }}
                  >
                    Wallet Addresses <span style={{ opacity: 0.5 }}>(max 3)</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {walletInputs.map((wallet, idx) => (
                      <div key={idx}>
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: viewportWidth < 640 ? 'column' : 'row',
                          gap: 8, 
                          alignItems: viewportWidth < 640 ? 'stretch' : 'flex-start' 
                        }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              background: theme.primarySubtle,
                              color: theme.textPrimary,
                              fontSize: 11,
                              fontWeight: 700,
                              display: viewportWidth < 480 ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 8,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: viewportWidth < 640 ? 'column' : 'row',
                              gap: 8, 
                              alignItems: viewportWidth < 640 ? 'stretch' : 'center' 
                            }}>
                              <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                id={`wallet-${idx}`}
                                type="text"
                                placeholder={`0x... or Solana address ${idx === 0 ? '(required)' : ''}`}
                                value={wallet}
                                onChange={(e) => handleWalletInput(idx, e.target.value)}
                                readOnly={connectedWallets[idx]}
                                style={{
                                  width: '100%',
                                  padding: wallet && !validationErrors[idx] && viewportWidth >= 640 ? '12px 70px 12px 14px' : '12px 14px',
                                  borderRadius: 10,
                                  border: `1px solid ${validationErrors[idx] ? theme.danger || '#ef4444' : theme.border}`,
                                  background: connectedWallets[idx] ? theme.primarySubtle : theme.bgApp,
                                  color: theme.textPrimary,
                                  fontSize: viewportWidth < 640 ? 12 : 13,
                                  fontFamily: 'monospace',
                                  outline: 'none',
                                  transition: 'border-color 0.15s, padding 0.15s, background 0.15s',
                                  boxSizing: 'border-box',
                                  cursor: connectedWallets[idx] ? 'not-allowed' : 'text',
                                }}
                                onFocus={(e) => {
                                  if (!connectedWallets[idx]) {
                                    e.currentTarget.style.borderColor = validationErrors[idx]
                                      ? theme.danger || '#ef4444'
                                      : theme.primary;
                                  }
                                }}
                                onBlur={(e) =>
                                  (e.currentTarget.style.borderColor = validationErrors[idx]
                                    ? theme.danger || '#ef4444'
                                    : theme.border)
                                }
                              />
                            {wallet && !validationErrors[idx] && viewportWidth >= 640 && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 12,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <span
                                  style={{
                                    padding: '4px 8px',
                                    background: theme.success + '20' || '#10b98120',
                                    color: theme.success || '#10b981',
                                    borderRadius: 6,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  {getAddressType(wallet)}
                                </span>
                                {connectedWallets[idx] ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDisconnectWallet(idx)}
                                    title="Disconnect wallet"
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      border: 'none',
                                      background: theme.danger + '20' || '#ef444420',
                                      color: theme.danger || '#ef4444',
                                      fontSize: 10,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = theme.danger || '#ef4444';
                                      e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = theme.danger + '20' || '#ef444420';
                                      e.currentTarget.style.color = theme.danger || '#ef4444';
                                    }}
                                  >
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <line x1="18" y1="6" x2="6" y2="18"></line>
                                      <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWalletSelectorIndex(idx);
                                      setShowWalletSelector(true);
                                    }}
                                    title="Connect wallet"
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      border: 'none',
                                      background: theme.primary + '20',
                                      color: theme.primary,
                                      fontSize: 10,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = theme.primary;
                                      e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = theme.primary + '20';
                                      e.currentTarget.style.color = theme.primary;
                                    }}
                                  >
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
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
                                onClick={() => {
                                  setWalletSelectorIndex(idx);
                                  setShowWalletSelector(true);
                                }}
                                title="Connect wallet"
                                style={{
                                  padding: viewportWidth < 640 ? '10px 16px' : '8px 12px',
                                  borderRadius: 8,
                                  border: `1px solid ${theme.border}`,
                                  background: theme.bgApp,
                                  color: theme.textPrimary,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  width: viewportWidth < 640 ? '100%' : 'auto',
                                  flexShrink: 0,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = theme.primarySubtle;
                                  e.currentTarget.style.borderColor = theme.primary;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = theme.bgApp;
                                  e.currentTarget.style.borderColor = theme.border;
                                }}
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                                </svg>
                                Connect
                              </button>
                            </div>
                            {wallet && !validationErrors[idx] && viewportWidth < 640 && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '6px 0',
                                }}
                              >
                                <span
                                  style={{
                                    padding: '4px 8px',
                                    background: theme.success + '20' || '#10b98120',
                                    color: theme.success || '#10b981',
                                    borderRadius: 6,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  {getAddressType(wallet)}
                                </span>
                                {connectedWallets[idx] && (
                                  <button
                                    type="button"
                                    onClick={() => handleDisconnectWallet(idx)}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      border: 'none',
                                      background: theme.danger + '20' || '#ef444420',
                                      color: theme.danger || '#ef4444',
                                      fontSize: 10,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                    }}
                                  >
                                    Disconnect
                                  </button>
                                )}
                              </div>
                            )}
                            {validationErrors[idx] && (
                              <div
                                style={{
                                  marginLeft: viewportWidth < 480 ? 0 : 32,
                                  fontSize: 12,
                                  color: theme.danger || '#ef4444',
                                }}
                              >
                                {validationErrors[idx]}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Errors */}
                {(groupError || error) && (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: (theme.danger || '#ef4444') + '15',
                      border: `1px solid ${theme.danger || '#ef4444'}`,
                      borderRadius: 10,
                      color: theme.danger || '#ef4444',
                      fontSize: 13,
                    }}
                  >
                    {groupError || error}
                  </div>
                )}

                {/* Proof-of-Work Progress */}
                {mode === 'create' && powStatus !== 'idle' && (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: powStatus === 'error' 
                        ? (theme.danger || '#ef4444') + '15' 
                        : powStatus === 'solved'
                        ? (theme.primary || '#45b773') + '15'
                        : theme.primarySubtle,
                      border: `1px solid ${
                        powStatus === 'error' 
                          ? theme.danger || '#ef4444'
                          : powStatus === 'solved'
                          ? theme.primary
                          : theme.border
                      }`,
                      borderRadius: 10,
                      color: powStatus === 'error' 
                        ? theme.danger || '#ef4444'
                        : powStatus === 'solved'
                        ? theme.primary
                        : theme.textPrimary,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {powStatus === 'solving' && (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: `2px solid ${theme.primary}`,
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                    )}
                    {powStatus === 'solved' && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    <span>{powProgress}</span>
                    {powStatus === 'solving' && (
                      <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 'auto' }}>
                        This may take a moment...
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Add keyframes for spinner animation */}
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>

        {/* Footer */}
        {mode !== 'list' && (
          <div
            style={{
              padding: viewportWidth < 640 ? '16px 20px' : '20px 28px',
              borderTop: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: viewportWidth < 640 ? 'column' : 'row',
              gap: 10,
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={cancelForm}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                color: theme.textPrimary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                width: viewportWidth < 640 ? '100%' : 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.bgPanelHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Cancel
            </button>
            <button
              onClick={
                mode === 'edit'
                  ? handleUpdateGroup
                  : mode === 'addWallet'
                    ? handleAddWalletSubmit
                    : mode === 'connect'
                      ? handleConnectToExistingGroup
                      : handleCreateGroup
              }
              disabled={loading || powStatus === 'solving' || (mode === 'connect' ? (!connectGroupId.trim() || (passwordRequired && !connectPassword.trim())) : !canSubmit)}
              style={{
                padding: '10px 24px',
                background:
                  loading || powStatus === 'solving' || (mode === 'connect' ? (!connectGroupId.trim() || (passwordRequired && !connectPassword.trim())) : !canSubmit)
                    ? theme.textMuted
                    : `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: loading || powStatus === 'solving' || (mode === 'connect' ? (!connectGroupId.trim() || (passwordRequired && !connectPassword.trim())) : !canSubmit) ? 'not-allowed' : 'pointer',
                opacity: loading || powStatus === 'solving' || (mode === 'connect' ? (!connectGroupId.trim() || (passwordRequired && !connectPassword.trim())) : !canSubmit) ? 0.5 : 1,
                transition: 'all 0.15s',
                width: viewportWidth < 640 ? '100%' : 'auto',
              }}
              onMouseEnter={(e) => {
                if (!loading && powStatus !== 'solving' && (mode === 'connect' ? (connectGroupId.trim() && (!passwordRequired || connectPassword.trim())) : canSubmit)) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && powStatus !== 'solving' && (mode === 'connect' ? (connectGroupId.trim() && (!passwordRequired || connectPassword.trim())) : canSubmit)) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {loading || powStatus === 'solving'
                ? powStatus === 'solving' ? 'Solving Challenge...' : 'Connecting...'
                : mode === 'edit'
                  ? 'Update Group'
                  : mode === 'addWallet'
                    ? 'Add Wallets'
                    : mode === 'connect'
                      ? 'Connect to Group'
                      : 'Create Group'}
            </button>
          </div>
        )}
      </div>

      <WalletSelectorDialog
        isOpen={showWalletSelector}
        onClose={() => {
          setShowWalletSelector(false);
          setWalletSelectorIndex(null);
        }}
        onSelectWallet={handleWalletSelection}
        availableWallets={detectAvailableWallets()}
      />
    </div>
  );
};

export default WalletGroupModal;
