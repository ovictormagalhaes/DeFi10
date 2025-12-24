import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeProvider.tsx';

/**
 * ChainSelector - Multi-select dropdown for blockchain networks
 * Similar to the image provided with "Todas as redes", "Ethereum", "Unichain", etc.
 * 
 * @param {Array} supportedChains - Array of chain objects with: name, displayName, iconUrl, id
 * @param {Set|null} selectedChains - Set of selected chain IDs (null = all selected)
 * @param {Function} onSelectionChange - Callback when selection changes (receives Set or null)
 */
const ChainSelector = ({ supportedChains = [], selectedChains, onSelectionChange }) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Helper to normalize chain keys (must match App.jsx logic)
  const normalizeChainKey = (v) => {
    if (v === undefined || v === null) return undefined;
    return String(v).trim().toLowerCase();
  };

  // Helper to get chain key for comparison
  const getChainKey = (chain) => {
    const raw = chain.displayName || chain.name || chain.shortName || 
                chain.id || chain.chainId || chain.chain || chain.network || chain.networkId;
    return normalizeChainKey(raw);
  };

  // Helper to check if all chains are selected
  const isAllSelected = selectedChains === null || 
    (selectedChains.size === supportedChains.length && 
     supportedChains.every(chain => selectedChains.has(getChainKey(chain))));

  // Toggle "All Networks"
  const handleToggleAll = () => {
    if (isAllSelected) {
      // If all selected, deselect all
      onSelectionChange(new Set());
    } else {
      // Select all
      onSelectionChange(null);
    }
  };

  // Toggle individual chain
  const handleToggleChain = (chain) => {
    const key = getChainKey(chain);
    const currentSelection = selectedChains === null 
      ? new Set(supportedChains.map(getChainKey))
      : new Set(selectedChains);

    if (currentSelection.has(key)) {
      currentSelection.delete(key);
    } else {
      currentSelection.add(key);
    }

    // If all chains are now selected, set to null (optimization)
    if (currentSelection.size === supportedChains.length &&
        supportedChains.every(c => currentSelection.has(getChainKey(c)))) {
      onSelectionChange(null);
    } else {
      onSelectionChange(currentSelection);
    }
  };

  // Check if a specific chain is selected
  const isChainSelected = (chain) => {
    if (selectedChains === null) return true;
    return selectedChains.has(getChainKey(chain));
  };

  // Get display text for button
  const getButtonText = () => {
    if (isAllSelected) {
      return 'All networks';
    }
    const count = selectedChains.size;
    if (count === 0) return 'No networks';
    if (count === 1) {
      const selectedKey = Array.from(selectedChains)[0];
      const chain = supportedChains.find(c => getChainKey(c) === selectedKey);
      return chain?.displayName || chain?.name || 'Selected network';
    }
    return `${count} networks`;
  };

  // Get icon for "All Networks"
  const getAllNetworksIcon = () => {
    // Stack of first 4 chain icons
    const firstFour = supportedChains.slice(0, 4);
    return (
      <div style={{
        position: 'relative',
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '12px 12px',
          gridTemplateRows: '12px 12px',
          gap: 2,
        }}>
          {firstFour.map((chain, idx) => (
            <div
              key={idx}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: theme.bgSecondary,
              }}
            >
              {chain.iconUrl && (
                <img
                  src={chain.iconUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!supportedChains || supportedChains.length === 0) {
    return null;
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          minWidth: 180,
          maxWidth: 200,
          backgroundColor: theme.bgPanel,
          color: theme.textPrimary,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.bgHover;
          e.currentTarget.style.borderColor = theme.textSecondary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = theme.bgPanel;
          e.currentTarget.style.borderColor = theme.border;
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {getButtonText()}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path
            d="M2 4L6 8L10 4"
            stroke={theme.textSecondary}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 240,
            maxHeight: 400,
            overflowY: 'auto',
            backgroundColor: theme.bgPanel,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            padding: '8px 0',
          }}
        >
          {/* All Networks Option */}
          <div
            onClick={handleToggleAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.bgHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 500,
                color: theme.textPrimary,
              }}
            >
              All networks
            </span>

            {/* Checkbox */}
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                border: `2px solid ${isAllSelected ? theme.accent : theme.border}`,
                backgroundColor: isAllSelected ? theme.accent : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              {isAllSelected && (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                  <path
                    d="M1 5L4.5 8.5L11 1.5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              backgroundColor: theme.border,
              margin: '8px 0',
            }}
          />

          {/* Individual Chain Options */}
          {supportedChains.map((chain, index) => {
            const isSelected = isChainSelected(chain);
            const displayName = chain.displayName || chain.name || `Chain ${index + 1}`;

            return (
              <div
                key={getChainKey(chain)}
                onClick={() => handleToggleChain(chain)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.bgHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Chain Icon */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: theme.bgSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {chain.iconUrl ? (
                    <img
                      src={chain.iconUrl}
                      alt={displayName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'fill',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        color: theme.textSecondary,
                      }}
                    >
                      {displayName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Chain Name */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 400,
                    color: theme.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </span>

                {/* Checkbox */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: `2px solid ${isSelected ? theme.accent : theme.border}`,
                    backgroundColor: isSelected ? theme.accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isSelected && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path
                        d="M1 5L4.5 8.5L11 1.5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChainSelector;
