import React, { useState, useEffect } from 'react';
import { useWalletGroups } from '../hooks/useWalletGroups';
import { 
  validateSingleAddress, 
  getAddressType, 
  formatAddress,
  validateWalletGroup 
} from '../types/wallet-groups';

interface WalletGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

const WalletGroupModal: React.FC<WalletGroupModalProps> = ({ 
  isOpen, 
  onClose,
  onGroupCreated 
}) => {
  const { groups, loading, error, createGroup, deleteGroup, clearError } = useWalletGroups();
  
  const [displayName, setDisplayName] = useState('');
  const [walletInputs, setWalletInputs] = useState(['', '', '']);
  const [validationErrors, setValidationErrors] = useState<(string | null)[]>([null, null, null]);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDisplayName('');
      setWalletInputs(['', '', '']);
      setValidationErrors([null, null, null]);
      setGroupError(null);
      clearError();
    }
  }, [isOpen, clearError]);

  const handleWalletInput = (index: number, value: string) => {
    const updated = [...walletInputs];
    updated[index] = value.trim();
    setWalletInputs(updated);

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
    const nonEmpty = updated.filter(w => w.length > 0);
    if (nonEmpty.length > 0) {
      const groupValidation = validateWalletGroup(nonEmpty);
      setGroupError(groupValidation.valid ? null : groupValidation.error || null);
    } else {
      setGroupError(null);
    }
  };

  const handleCreateGroup = async () => {
    const wallets = walletInputs.filter(w => w.length > 0);
    
    if (wallets.length === 0) {
      setGroupError('Please add at least one wallet address');
      return;
    }

    const result = await createGroup({ 
      wallets, 
      displayName: displayName.trim() || undefined 
    });
    
    if (result) {
      // Success - reset form and notify parent
      setWalletInputs(['', '', '']);
      setDisplayName('');
      setValidationErrors([null, null, null]);
      setGroupError(null);
      
      if (onGroupCreated) {
        onGroupCreated(result.id);
      }
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this wallet group?')) {
      return;
    }
    await deleteGroup(id);
  };

  if (!isOpen) return null;

  const hasValidationError = validationErrors.some(e => e !== null);
  const canCreate = walletInputs.some(w => w.length > 0) && 
                    !hasValidationError && 
                    !groupError;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center">
          <h2>Manage Wallet Groups</h2>
          <button 
            className="btn btn--ghost" 
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Create New Group Section */}
          <div className="panel pad-16 mb-4">
            <h3 className="mb-3">Create New Group (Max 3 wallets)</h3>
            
            <div className="form-group mb-3">
              <label htmlFor="group-name">Group Name (optional)</label>
              <input
                id="group-name"
                type="text"
                className="input-text"
                placeholder="e.g., My Portfolio"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
              />
            </div>

            {walletInputs.map((wallet, idx) => (
              <div key={idx} className="form-group mb-2">
                <label htmlFor={`wallet-${idx}`}>Wallet {idx + 1}</label>
                <div className="flex gap-2 align-center">
                  <input
                    id={`wallet-${idx}`}
                    type="text"
                    className={`input-text ${validationErrors[idx] ? 'input-error' : ''}`}
                    placeholder="0x... or Solana address"
                    value={wallet}
                    onChange={(e) => handleWalletInput(idx, e.target.value)}
                  />
                  {wallet && !validationErrors[idx] && (
                    <span className="badge badge-secondary">
                      {getAddressType(wallet)}
                    </span>
                  )}
                </div>
                {validationErrors[idx] && (
                  <div className="text-danger text-xs mt-1">
                    {validationErrors[idx]}
                  </div>
                )}
              </div>
            ))}

            {groupError && (
              <div className="badge badge-danger mt-2 mb-2">
                {groupError}
              </div>
            )}

            {error && (
              <div className="badge badge-danger mt-2 mb-2">
                {error}
              </div>
            )}

            <button 
              className="btn btn--primary w-full mt-3" 
              onClick={handleCreateGroup}
              disabled={loading || !canCreate}
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>

          {/* Existing Groups List */}
          <div className="panel pad-16">
            <h3 className="mb-3">Existing Groups ({groups.length})</h3>
            
            {groups.length === 0 ? (
              <p className="muted text-center py-4">No wallet groups created yet</p>
            ) : (
              <div className="groups-list flex-col gap-3">
                {groups.map(group => (
                  <div key={group.id} className="group-card panel pad-12">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-primary">
                        {group.displayName || 'Unnamed Group'}
                      </h4>
                      <button 
                        className="btn btn--ghost btn--sm"
                        onClick={() => handleDeleteGroup(group.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="flex-col gap-1 mb-2">
                      <div className="text-xs text-secondary">
                        <strong>ID:</strong> <code style={{ fontSize: '10px' }}>{group.id}</code>
                      </div>
                    </div>
                    <div className="flex-col gap-1">
                      {group.wallets.map((w, i) => (
                        <div key={i} className="flex gap-2 align-center text-xs">
                          <span className="badge badge-secondary badge-sm">
                            {getAddressType(w)}
                          </span>
                          <code className="text-secondary">{formatAddress(w, 8)}</code>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-secondary mt-2">
                      Created: {new Date(group.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer flex justify-end gap-2">
          <button className="btn btn--outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: var(--mw-bg-primary, #0f1419);
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          padding: 20px;
          border-bottom: 1px solid var(--mw-border, #2a3441);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
        }

        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--mw-border, #2a3441);
        }

        .input-text {
          width: 100%;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid var(--mw-border, #2a3441);
          background: var(--mw-bg-secondary, #1a2028);
          color: var(--mw-text-primary, #e4e7eb);
          font-size: 14px;
        }

        .input-error {
          border-color: var(--mw-danger, #ef4444);
        }

        .group-card {
          background: var(--mw-bg-secondary, #1a2028);
          border: 1px solid var(--mw-border, #2a3441);
          border-radius: 8px;
        }

        .badge-sm {
          font-size: 10px;
          padding: 2px 6px;
        }

        .w-full {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default WalletGroupModal;
