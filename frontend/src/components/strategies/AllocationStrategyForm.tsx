/**
 * Allocation Strategy Form
 * Form to create/edit Allocation by Weight strategies
 * 
 * New Flow:
 * 1. Add Group (by Asset Type) - creates empty group
 * 2. Dialog appears to add tokens with weights to that group
 */

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTheme } from '../../context/ThemeProvider';
import { useChainIcons } from '../../context/ChainIconsProvider';

import { RebalanceAssetType, ASSET_TYPE_OPTIONS } from '../../types/rebalancing';
import type { AllocationByWeightConfig } from '../../types/strategies/allocationByWeight';
import type { SaveStrategyResponse } from '../../types/strategy';
import type { WalletItem } from '../../types/wallet';
import { WalletItemType } from '../../constants/walletItemTypes';

// Helper to map WalletItemType to RebalanceAssetType
const mapWalletTypeToRebalanceType = (type: WalletItemType): RebalanceAssetType => {
  switch (type) {
    case WalletItemType.WALLET:
      return RebalanceAssetType.Wallet;
    case WalletItemType.LIQUIDITY_POOL:
      return RebalanceAssetType.LiquidityPool;
    case WalletItemType.LENDING_AND_BORROWING:
      return RebalanceAssetType.LendingAndBorrowing;
    case WalletItemType.STAKING:
      return RebalanceAssetType.Staking;
    default:
      return RebalanceAssetType.Wallet;
  }
};

interface AllocationStrategyFormProps {
  walletGroupId: string;
  portfolio: WalletItem[];
  initialStrategy?: any; // Strategy to edit
  onSave: (
    walletGroupId: string,
    config: AllocationByWeightConfig,
    portfolio: WalletItem[],
    strategyId?: string // Optional: when editing, pass the ID to update
  ) => Promise<SaveStrategyResponse>;
  onCancel: () => void;
  onSuccess: () => void;
  saving: boolean;
}

interface AllocationItem {
  id: string;
  assetKey: string;
  symbol: string;
  protocol?: string;
  protocolName?: string;
  chain?: string;
  protocolLogo?: string;
  chainLogo?: string;
  tokenLogo?: string;
  weight: number;
  value?: number;
}

export const AllocationStrategyForm: React.FC<AllocationStrategyFormProps> = ({
  walletGroupId,
  portfolio,
  initialStrategy,
  onSave,
  onCancel,
  onSuccess,
  saving
}) => {
  const { theme } = useTheme();
  const { getIcon: getChainIcon } = useChainIcons();
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Initialize state from existing strategy if editing
  const initializeFromStrategy = () => {
    if (!initialStrategy) return { assetType: null, assetTypeLabel: '', name: '', description: '', allocations: [] };
    
    console.log('[initializeFromStrategy] initialStrategy:', initialStrategy);
    console.log('[initializeFromStrategy] initialStrategy.id:', initialStrategy.id);
    
    // Check for new structure (allocations) or old structure (items/targetAllocations)
    const hasNewStructure = !!(initialStrategy as any).allocations;
    const allocationsData = hasNewStructure 
      ? (initialStrategy as any).allocations 
      : initialStrategy.targetAllocations || [];
    
    console.log('[initializeFromStrategy] Using', hasNewStructure ? 'NEW' : 'OLD', 'structure');
    console.log('[initializeFromStrategy] allocationsData:', allocationsData);
    
    // Determine asset type from first allocation
    let detectedType: RebalanceAssetType | null = null;
    let detectedLabel = '';
    
    if (allocationsData.length > 0) {
      const firstAlloc = allocationsData[0];
      
      if (hasNewStructure) {
        // New structure has groupType directly in allocation
        detectedType = firstAlloc.groupType as RebalanceAssetType;
      } else {
        // Old structure needs to check items
        if (initialStrategy.items && initialStrategy.items.length > 0) {
          const firstItem = initialStrategy.items[0];
          detectedType = firstItem.groupType as RebalanceAssetType;
        }
      }
      
      console.log('[initializeFromStrategy] detectedType:', detectedType);
      const typeOption = ASSET_TYPE_OPTIONS.find(opt => opt.value === detectedType);
      console.log('[initializeFromStrategy] typeOption:', typeOption);
      if (typeOption) {
        detectedLabel = typeOption.label;
      }
    }
    
    // Map allocations to form items
    const existingAllocations: AllocationItem[] = allocationsData.map((alloc: any, idx: number) => {
      console.log('[initializeFromStrategy] Processing allocation:', alloc);
      
      if (hasNewStructure) {
        // NEW structure: data is already in the allocation object
        const protocol = alloc.protocol?.id || alloc.protocol;
        const protocolName = alloc.protocol?.name || '';
        const protocolLogo = alloc.protocol?.logo || '';
        const chain = alloc.chain?.id || alloc.chain;
        const symbol = alloc.token?.symbol || alloc.assetKey;
        const tokenLogo = alloc.token?.logo || '';
        
        // Find current value in portfolio
        const portfolioItem = portfolio.find(p => 
          p.protocol.id === protocol && 
          p.protocol.chain === chain &&
          p.position?.tokens?.some((t: any) => t.symbol === symbol)
        );
        
        // Get token with correct type (supply/borrow) from current portfolio
        let currentValue = 0;
        if (portfolioItem) {
          const tokens = portfolioItem.position?.tokens || [];
          let targetToken = tokens.find((t: any) => t.symbol === symbol);
          
          // For lending, filter by positionType
          if (alloc.positionType === 1) { // Supplied
            targetToken = tokens.find((t: any) => {
              const tokenType = t.type?.toLowerCase() || '';
              return t.symbol === symbol && (tokenType === 'supplied' || tokenType === 'supply');
            });
          } else if (alloc.positionType === 2) { // Borrowed
            targetToken = tokens.find((t: any) => {
              const tokenType = t.type?.toLowerCase() || '';
              return t.symbol === symbol && (tokenType === 'borrowed' || tokenType === 'borrow');
            });
          }
          
          currentValue = targetToken?.financials?.totalPrice || 0;
        }
        
        return {
          id: `existing-${idx}`,
          assetKey: `${protocol || ''}-${chain || ''}-${symbol}`,
          symbol,
          protocol,
          protocolName,
          chain,
          protocolLogo,
          chainLogo: chain ? getChainIcon(chain) : undefined,
          tokenLogo,
          weight: alloc.targetWeight,
          value: currentValue,
          group: alloc.group
        };
      } else {
        // OLD structure: need to match with items array
        let item = initialStrategy.items?.[idx];
        
        // Verify the item matches the symbol
        if (item && item.metadata?.symbol !== alloc.symbol) {
          console.warn('[initializeFromStrategy] Item index mismatch, falling back to find by symbol+protocol');
          
          // Fallback: Find corresponding item matching symbol AND protocol/chain if available
          item = initialStrategy.items?.find((i: any) => {
            const symbolMatch = i.metadata?.symbol === alloc.symbol;
            if (!symbolMatch) return false;
            
            // If backend provides protocol/chain in targetAllocation, use it for matching
            if (alloc.protocol && alloc.chain && i.metadata?.protocol) {
              return i.metadata.protocol.id === alloc.protocol && 
                     i.metadata.protocol.chain === alloc.chain;
            }
            
            // Otherwise just match by symbol (legacy behavior, will find first match)
            return true;
          });
        }
        
        console.log('[initializeFromStrategy] Found item:', item);
        
        if (item?.metadata) {
          const protocol = item.metadata.protocol;
          const symbol = alloc.symbol || alloc.assetKey;
          
          // Find current value in portfolio
          const portfolioItem = portfolio.find(p => 
            p.protocol.id === protocol?.id && 
            p.protocol.chain === protocol?.chain &&
            p.position?.tokens?.some((t: any) => t.symbol === symbol)
          );
          
          // Get token with correct type (supply/borrow) from current portfolio
          let currentValue = 0;
          if (portfolioItem) {
            const tokens = portfolioItem.position?.tokens || [];
            let targetToken = tokens.find((t: any) => t.symbol === symbol);
            
            // For lending, filter by type
            if (detectedType === RebalanceAssetType.LendingSupply) {
              targetToken = tokens.find((t: any) => {
                const tokenType = t.type?.toLowerCase() || '';
                return t.symbol === symbol && (tokenType === 'supplied' || tokenType === 'supply');
              });
            } else if (detectedType === RebalanceAssetType.LendingBorrow) {
              targetToken = tokens.find((t: any) => {
                const tokenType = t.type?.toLowerCase() || '';
                return t.symbol === symbol && (tokenType === 'borrowed' || tokenType === 'borrow');
              });
            }
            
            currentValue = targetToken?.financials?.totalPrice || 0;
          }
          
          return {
            id: `existing-${idx}`,
            assetKey: `${protocol?.id || ''}-${protocol?.chain || ''}-${symbol}`,
            symbol,
            protocol: protocol?.id,
            protocolName: protocol?.name,
            chain: protocol?.chain,
            protocolLogo: protocol?.logo,
            chainLogo: protocol?.chain ? getChainIcon(protocol.chain) : undefined,
            tokenLogo: item.metadata.tokens?.[0]?.logo,
            weight: alloc.targetWeight,
            value: currentValue
          };
        }
        
        // Fallback if metadata not found
        return {
          id: `existing-${idx}`,
          assetKey: alloc.symbol || alloc.assetKey,
          symbol: alloc.symbol || alloc.assetKey,
          weight: alloc.targetWeight,
          value: 0
        };
      }
    });
    
    return {
      assetType: detectedType,
      assetTypeLabel: detectedLabel,
      name: initialStrategy.name || '',
      description: initialStrategy.description || '',
      allocations: existingAllocations
    };
  };
  
  const initialState = initializeFromStrategy();
  
  // Step 1: Select Asset Type
  const [assetType, setAssetType] = useState<RebalanceAssetType | null>(initialState.assetType);
  const [assetTypeLabel, setAssetTypeLabel] = useState<string>(initialState.assetTypeLabel);
  
  // Step 2: Configure strategy
  const [name, setName] = useState(initialState.name);
  const [description, setDescription] = useState(initialState.description);
  const [allocations, setAllocations] = useState<AllocationItem[]>(initialState.allocations);
  
  // Dialog state for adding tokens
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [weight, setWeight] = useState<number>(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get portfolio grouped by asset type
  const portfolioByAssetType = useMemo(() => {
    const grouped = new Map<RebalanceAssetType, WalletItem[]>();
    
    portfolio.forEach(item => {
      const type = mapWalletTypeToRebalanceType(item.type);
      
      // For lending items, add to both Supply and Borrow groups
      // The filtering will happen later in assetsInType
      if (type === RebalanceAssetType.LendingAndBorrowing) {
        if (!grouped.has(RebalanceAssetType.LendingSupply)) {
          grouped.set(RebalanceAssetType.LendingSupply, []);
        }
        if (!grouped.has(RebalanceAssetType.LendingBorrow)) {
          grouped.set(RebalanceAssetType.LendingBorrow, []);
        }
        grouped.get(RebalanceAssetType.LendingSupply)!.push(item);
        grouped.get(RebalanceAssetType.LendingBorrow)!.push(item);
      }
      
      // Add to original group
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(item);
    });
    
    return grouped;
  }, [portfolio]);

  // Get available asset types (that have portfolio items)
  const availableAssetTypes = useMemo(() => {
    return ASSET_TYPE_OPTIONS.filter(opt => 
      portfolioByAssetType.has(opt.value)
    );
  }, [portfolioByAssetType]);

  // Get assets for selected asset type
  const assetsInType = useMemo(() => {
    if (!assetType) return [];
    const items = portfolioByAssetType.get(assetType) || [];
    
    // For Lending Supply, only show supply positions
    if (assetType === RebalanceAssetType.LendingSupply) {
      return items.filter(item => {
        const tokens = item.position?.tokens || [];
        return tokens.some(t => {
          const tokenType = t.type?.toLowerCase() || '';
          return tokenType === 'supplied' || tokenType === 'supply';
        });
      });
    }

    // For Lending Borrow, only show borrow positions
    if (assetType === RebalanceAssetType.LendingBorrow) {
      return items.filter(item => {
        const tokens = item.position?.tokens || [];
        return tokens.some(t => {
          const tokenType = t.type?.toLowerCase() || '';
          return tokenType === 'borrowed' || tokenType === 'borrow';
        });
      });
    }
    
    return items;
  }, [assetType, portfolioByAssetType]);

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return allocations.reduce((sum, item) => sum + item.weight, 0);
  }, [allocations]);

  // Validation
  const validation = useMemo(() => {
    if (!assetType) {
      return { valid: false, errors: ['Select an Asset Type'], warnings: [] };
    }

    if (allocations.length === 0) {
      return { valid: false, errors: ['Add at least one token'], warnings: [] };
    }

    // Check for duplicate assets
    const assetKeys = allocations.map(a => a.assetKey);
    const duplicates = assetKeys.filter((key, index) => assetKeys.indexOf(key) !== index);
    if (duplicates.length > 0) {
      return {
        valid: false,
        errors: [`Duplicate tokens found: ${[...new Set(duplicates)].join(', ')}`],
        warnings: []
      };
    }

    // Validate that allocations total 100%
    if (Math.abs(totalWeight - 100) > 0.01) {
      return {
        valid: false,
        errors: [`Total must be 100% (currently ${totalWeight.toFixed(1)}%)`],
        warnings: []
      };
    }

    return { valid: true, errors: [], warnings: [] };
  }, [assetType, allocations, totalWeight]);

  const handleSelectAssetType = (type: RebalanceAssetType) => {
    const typeOption = ASSET_TYPE_OPTIONS.find(opt => opt.value === type);
    if (!typeOption) return;

    setAssetType(type);
    setAssetTypeLabel(typeOption.label);
    
    // Set default name
    setName(`Allocation - ${typeOption.label}`);
  };

  const handleOpenTokenDialog = () => {
    setSelectedAsset('');
    setWeight(0);
    setShowTokenDialog(true);
  };

  const handleAddToken = () => {
    if (!selectedAsset || weight <= 0) {
      alert('Please select an asset and enter a valid weight');
      return;
    }

    // Check if asset already exists
    const exists = allocations.some(a => a.assetKey === selectedAsset);
    if (exists) {
      alert('This token is already added');
      return;
    }

    // Get symbol from portfolio
    const portfolioItem = assetsInType.find(item => {
      const key = `${item.protocol.id}-${item.protocol.chain}-${item.position.tokens?.[0]?.symbol || ''}`;
      return key === selectedAsset;
    });

    if (!portfolioItem) {
      alert('Asset not found in portfolio');
      return;
    }

    // Get the correct token based on asset type
    let targetToken = portfolioItem.position.tokens?.[0];
    
    if (assetType === RebalanceAssetType.LendingSupply) {
      targetToken = portfolioItem.position.tokens?.find(t => {
        const tokenType = t.type?.toLowerCase() || '';
        return tokenType === 'supplied' || tokenType === 'supply';
      }) || portfolioItem.position.tokens?.[0];
    } else if (assetType === RebalanceAssetType.LendingBorrow) {
      targetToken = portfolioItem.position.tokens?.find(t => {
        const tokenType = t.type?.toLowerCase() || '';
        return tokenType === 'borrowed' || tokenType === 'borrow';
      }) || portfolioItem.position.tokens?.[0];
    }

    const symbol = targetToken?.symbol || '';
    const value = targetToken?.financials?.totalPrice || 0;
    
    if (!symbol) {
      alert('Asset symbol not found');
      return;
    }

    const chainLogo = portfolioItem.protocol.chain ? getChainIcon(portfolioItem.protocol.chain) : undefined;

    const newAllocation: AllocationItem = {
      id: `${selectedAsset}-${Date.now()}`,
      assetKey: selectedAsset,
      symbol,
      protocol: portfolioItem.protocol.id,
      protocolName: portfolioItem.protocol.name,
      chain: portfolioItem.protocol.chain,
      protocolLogo: portfolioItem.protocol.logo,
      chainLogo: chainLogo,
      tokenLogo: targetToken?.logo,
      weight,
      value
    };

    setAllocations([...allocations, newAllocation]);
    setWeight(0);
    setSelectedAsset('');
    setShowTokenDialog(false);
  };

  const handleRemoveToken = (allocationId: string) => {
    setAllocations(allocations.filter(a => a.id !== allocationId));
  };

  const handleUpdateWeight = (allocationId: string, newWeight: number) => {
    setAllocations(
      allocations.map(a =>
        a.id === allocationId ? { ...a, weight: newWeight } : a
      )
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = allocations.findIndex((a) => a.id === active.id);
      const newIndex = allocations.findIndex((a) => a.id === over.id);

      setAllocations(arrayMove(allocations, oldIndex, newIndex));
    }
  };

  const handleSubmit = async () => {
    if (!validation.valid) {
      alert(`Validation failed:\n${validation.errors.join('\n')}`);
      return;
    }

    try {
      console.log('[AllocationStrategyForm] Current allocations state:', allocations);
      
      const config: AllocationByWeightConfig = {
        allocations: allocations.map((a, index) => ({
          assetKey: a.symbol,
          group: assetTypeLabel,
          weight: a.weight,
          protocol: a.protocol, // Protocol ID (e.g., 'aave-v3', 'kamino')
          protocolName: a.protocolName, // Protocol display name (e.g., 'Aave V3', 'Kamino')
          chain: a.chain, // Chain name (e.g., 'base', 'solana')
          displayOrder: index // Preserve order
        })),
        name: name.trim() || undefined,
        description: description.trim() || undefined
      };

      console.log('[AllocationStrategyForm] Mapped config to send:', config);
      console.log('[AllocationStrategyForm] Tokens being sent:', config.allocations.map(a => ({
        symbol: a.assetKey,
        protocol: a.protocol,
        protocolName: a.protocolName,
        chain: a.chain,
        weight: a.weight
      })));
      console.log('[AllocationStrategyForm] Saving with strategyId:', initialStrategy?.id);
      
      await onSave(walletGroupId, config, portfolio, initialStrategy?.id);
      onSuccess();
    } catch (err) {
      console.error('Failed to save strategy:', err);
      alert(`Failed to save strategy: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const SortableAllocationCard: React.FC<{
    allocation: AllocationItem;
    logo: string | undefined;
    assetValue: number;
    isLending: boolean;
    onRemove: (id: string) => void;
    onUpdateWeight: (id: string, weight: number) => void;
  }> = ({ allocation, logo, assetValue, isLending, onRemove, onUpdateWeight }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: allocation.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      display: 'flex',
      gap: '8px',
    };

    return (
      <div ref={setNodeRef} style={style} className="allocation-card-wrapper">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            cursor: 'grab',
            background: theme.bgInteractive,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            color: theme.textSecondary,
            fontSize: '16px',
            userSelect: 'none',
            flexShrink: 0,
          }}
          title="Drag to reorder"
        >
          ⋮⋮
        </div>

        {/* Card Content */}
        <div className="allocation-card" style={{ flex: 1, position: 'relative' }}>
          <button
            onClick={() => onRemove(allocation.id)}
            className="card-remove-btn"
            title="Remove token"
          >
            ×
          </button>
          
          <div className="card-header">
            {logo && <img src={logo} alt={allocation.symbol} className="card-token-logo" />}
            <div className="card-token-info">
              <span className="card-token-symbol">{allocation.symbol}</span>
              {(allocation.protocol || allocation.chain) && (
                <div className="card-protocol-chain">
                  {allocation.protocolLogo && <img src={allocation.protocolLogo} alt="protocol" className="card-small-logo" />}
                  {allocation.protocolName && <span>{allocation.protocolName}</span>}
                  {allocation.chainLogo && <img src={allocation.chainLogo} alt="chain" className="card-small-logo" />}
                  {allocation.chain && <span>{allocation.chain.charAt(0).toUpperCase() + allocation.chain.slice(1)}</span>}
                </div>
              )}
              <span className="card-asset-value">${assetValue.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="card-weight">
            <div className="card-weight-input-group">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={allocation.weight}
                onChange={(e) => onUpdateWeight(allocation.id, Number(e.target.value))}
                className="card-weight-input"
              />
              <span className="card-weight-percent">%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={allocation.weight}
              onChange={(e) => onUpdateWeight(allocation.id, Number(e.target.value))}
              className="card-weight-slider"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="allocation-form">
      {/* Step 1: Select Asset Type */}
      {!assetType ? (
        <div className="form-section">
          <h3 className="section-title">{initialStrategy ? 'Edit Allocation Strategy' : 'Create Allocation Strategy'}</h3>
          <p className="section-description">
            Select the asset type for this strategy. Each strategy manages allocations for one asset type.
          </p>
          
          <div className="asset-type-grid">
            {availableAssetTypes.map(type => (
              <button
                key={type.value}
                onClick={() => handleSelectAssetType(type.value)}
                className="asset-type-card"
              >
                <div className="type-label">{type.label}</div>
                <div className="type-description">{type.description}</div>
                <div className="type-count">
                  {portfolioByAssetType.get(type.value)?.length || 0} assets
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>

          {/* Step 2: Configure Strategy */}
          <div className="form-section">
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  Strategy: {assetTypeLabel}
                  <button
                    onClick={() => {
                      setAssetType(null);
                      setAllocations([]);
                      setName('');
                      setDescription('');
                    }}
                    className="btn-change-type"
                  >
                    Change Type
                  </button>
                </h3>
                <p className="section-description">
                  Add tokens from {assetTypeLabel} and set their target allocations
                </p>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Strategy Name <span className="optional">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g., Conservative ${assetTypeLabel}`}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Description <span className="optional">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your allocation strategy..."
                rows={3}
                className="form-textarea"
              />
            </div>
          </div>

          {/* Allocations */}
          <div className="form-section">
            <div className="section-header">
              <div className="header-info">
                <h3 className="section-title">Token Allocations</h3>
                <span className={`total-badge ${Math.abs(totalWeight - 100) < 0.01 ? 'valid' : 'invalid'}`}>
                  Total: {totalWeight.toFixed(1)}%
                  {Math.abs(totalWeight - 100) < 0.01 ? ' ✓' : ''}
                </span>
              </div>
              <button
                onClick={handleOpenTokenDialog}
                className="btn-add-token"
                disabled={assetsInType.length === 0}
              >
                + Add Token
              </button>
            </div>

            {allocations.length === 0 ? (
              <div className="empty-state">
                <p>No tokens added yet. Click "Add Token" to start building your allocation.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={allocations.map(a => a.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="allocations-grid">
                    {allocations.map((allocation) => {
                      // Get logo from allocation or try to find in portfolio
                      const logo = allocation.tokenLogo || (() => {
                        const portfolioItem = assetsInType.find(item => {
                          const key = `${item.protocol.id}-${item.protocol.chain}-${item.position.tokens?.[0]?.symbol || ''}`;
                          return key === allocation.assetKey;
                        });
                        return portfolioItem?.position.tokens?.[0]?.logo;
                      })();
                      
                      const assetValue = allocation.value || 0;
                      const isLending = assetType === RebalanceAssetType.LendingSupply || assetType === RebalanceAssetType.LendingBorrow;
                      
                      return (
                        <SortableAllocationCard
                          key={allocation.id}
                          allocation={allocation}
                          logo={logo}
                          assetValue={assetValue}
                          isLending={isLending}
                          onRemove={handleRemoveToken}
                          onUpdateWeight={handleUpdateWeight}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Validation errors are shown subtly in the total badge above */}
        </>
      )}

      {/* Actions */}
      <div className="form-actions">
        <button onClick={onCancel} className="btn-flat" disabled={saving}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="btn-primary"
          disabled={!validation.valid || saving}
        >
          {saving ? 'Saving...' : (initialStrategy ? 'Update Strategy' : 'Create Strategy')}
        </button>
      </div>

      {/* Token Dialog */}
      {showTokenDialog && assetType && (
        <div 
          className="dialog-overlay" 
          onClick={() => {
            setShowTokenDialog(false);
            setDropdownOpen(false);
          }}
        >
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Add Token - {assetTypeLabel}</h3>
              <button
                onClick={() => setShowTokenDialog(false)}
                className="dialog-close"
              >
                ×
              </button>
            </div>

            <div className="dialog-body">
              <div className="form-group">
                <label htmlFor="dialog-asset" className="form-label">
                  Select Token
                </label>
                <div className="custom-dropdown">
                  <button
                    type="button"
                    className={`dropdown-card ${selectedAsset ? 'trigger-selected' : ''}`}
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    style={{ position: 'relative' }}
                  >
                    {selectedAsset ? (() => {
                      const asset = assetsInType.find(a => 
                        `${a.protocol.id}-${a.protocol.chain}-${a.position.tokens?.[0]?.symbol || ''}` === selectedAsset
                      );
                      if (!asset) return null;
                      
                      const tokenLogo = asset.position.tokens?.[0]?.logo;
                      const symbol = asset.position.tokens?.[0]?.symbol || '';
                      const value = asset.position.tokens?.[0]?.financials?.totalPrice || 0;
                      const protocolLogo = asset.protocol.logo;
                      const protocolName = asset.protocol.name;
                      const chain = asset.protocol.chain;
                      const chainLogo = chain ? getChainIcon(chain) : null;
                      const isLending = assetType === RebalanceAssetType.LendingSupply || assetType === RebalanceAssetType.LendingBorrow;
                      
                      return (
                        <>
                          <div className="dropdown-card-left">
                            {tokenLogo && <img src={tokenLogo} alt={symbol} className="dropdown-card-logo" />}
                            <div className="dropdown-card-info">
                              <span className="dropdown-card-symbol">{symbol}</span>
                              {(protocolName || chain) && (
                                <div className="dropdown-card-meta">
                                  {protocolLogo && <img src={protocolLogo} alt="protocol" className="dropdown-meta-logo" />}
                                  {protocolName && <span>{protocolName}</span>}
                                  {chainLogo && <img src={chainLogo} alt="chain" className="dropdown-meta-logo" />}
                                  {chain && <span>{chain}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="dropdown-card-value">${value.toFixed(2)}</span>
                          <span className="trigger-card-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                        </>
                      );
                    })() : (
                      <>
                        <span className="trigger-card-placeholder">Choose a token...</span>
                        <span className="trigger-card-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                      </>
                    )}
                  </button>
                  
                  {dropdownOpen && (
                    <div className="dropdown-menu-enhanced">
                      {assetsInType.map(asset => {
                        const key = `${asset.protocol.id}-${asset.protocol.chain}-${asset.position.tokens?.[0]?.symbol || ''}`;
                        const symbol = asset.position.tokens?.[0]?.symbol || 'Unknown';
                        const tokenLogo = asset.position.tokens?.[0]?.logo;
                        const value = asset.position.tokens?.[0]?.financials?.totalPrice || 0;
                        const protocolLogo = asset.protocol.logo;
                        const protocolName = asset.protocol.name;
                        const chain = asset.protocol.chain;
                        const chainLogo = chain ? getChainIcon(chain) : null;
                        const isLending = assetType === RebalanceAssetType.LendingSupply || assetType === RebalanceAssetType.LendingBorrow;
                        
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`dropdown-card ${selectedAsset === key ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedAsset(key);
                              setDropdownOpen(false);
                            }}
                          >
                            <div className="dropdown-card-left">
                              {tokenLogo && <img src={tokenLogo} alt={symbol} className="dropdown-card-logo" />}
                              <div className="dropdown-card-info">
                                <span className="dropdown-card-symbol">{symbol}</span>
                                {(protocolName || chain) && (
                                  <div className="dropdown-card-meta">
                                    {protocolLogo && <img src={protocolLogo} alt="protocol" className="dropdown-meta-logo" />}
                                    {protocolName && <span>{protocolName}</span>}
                                    {chainLogo && <img src={chainLogo} alt="chain" className="dropdown-meta-logo" />}
                                    {chain && <span>{chain}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="dropdown-card-value">${value.toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="dialog-weight" className="form-label">
                  Target Weight
                </label>
                <div className="dialog-weight-section">
                  <div className="dialog-weight-input-group">
                    <input
                      type="number"
                      id="dialog-weight"
                      min="0"
                      max="100"
                      step="1"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="dialog-weight-input"
                    />
                    <span className="dialog-weight-percent">%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="dialog-weight-slider"
                  />
                </div>
              </div>
            </div>

            <div className="dialog-actions">
              <button
                onClick={() => setShowTokenDialog(false)}
                className="btn-flat"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToken}
                className="btn-primary"
                disabled={!selectedAsset || weight <= 0}
              >
                Add Token
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .allocation-form {
          width: 100%;
        }

        .form-section {
          background: ${theme.bgPanel};
          border: 2px solid ${theme.border};
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .form-section .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .section-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: ${theme.textPrimary};
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-description {
          margin: 8px 0 20px 0;
          color: ${theme.textSecondary};
          font-size: 14px;
        }

        .btn-change-type {
          padding: 4px 12px;
          background: transparent;
          border: 1px solid ${theme.border};
          border-radius: 6px;
          font-size: 13px;
          color: ${theme.textSecondary};
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-change-type:hover {
          background: ${theme.bgSecondary};
          border-color: ${theme.accent};
          color: ${theme.accent};
        }

        /* Asset Type Selection */
        .asset-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .asset-type-card {
          padding: 20px;
          background: ${theme.bgPanel};
          border: 2px solid ${theme.border};
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .asset-type-card:hover {
          border-color: ${theme.accent};
          box-shadow: 0 4px 12px ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 123, 255, 0.15)'};
          transform: translateY(-2px);
        }

        .type-label {
          font-weight: 600;
          font-size: 16px;
          color: ${theme.textPrimary};
          margin-bottom: 8px;
        }

        .type-description {
          font-size: 13px;
          color: ${theme.textSecondary};
          margin-bottom: 12px;
        }

        .type-count {
          font-size: 12px;
          font-weight: 600;
          color: ${theme.accent};
        }

        .total-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .total-badge.valid {
          background: #d1fae5;
          color: #065f46;
        }

        .total-badge.invalid {
          background: #fef3c7;
          color: #92400e;
        }

        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: ${theme.textSecondary};
          font-size: 14px;
        }

        .btn-add-token {
          padding: 8px 16px;
          background: ${theme.accent};
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-add-token:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-add-token:disabled {
          background: ${theme.border};
          color: ${theme.textSecondary};
          cursor: not-allowed;
        }

        .allocations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .allocation-card {
          position: relative;
          background: ${theme.bgSecondary};
          border: 2px solid ${theme.border};
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s;
        }

        .allocation-card:hover {
          border-color: ${theme.accent};
          box-shadow: 0 2px 8px ${theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)'};
        }

        .card-remove-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          border: none;
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
          color: ${theme.textSecondary};
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: all 0.2s;
          opacity: 0.7;
        }

        .card-remove-btn:hover {
          background: ${theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'};
          color: #ef4444;
          opacity: 1;
        }

        .card-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding-bottom: 12px;
          border-bottom: 1px solid ${theme.border};
        }

        .card-token-logo {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .card-token-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          width: 100%;
        }

        .card-token-symbol {
          font-size: 16px;
          font-weight: 700;
          color: ${theme.textPrimary};
        }

        .card-asset-value {
          font-size: 13px;
          font-weight: 600;
          color: ${theme.textSecondary};
        }

        .card-protocol-chain {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: ${theme.textSecondary};
          flex-wrap: wrap;
          justify-content: center;
        }

        .card-small-logo {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          object-fit: cover;
        }

        .card-weight {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .card-weight-input-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin-left: -10px;
        }

        .card-weight-input {
          width: 70px;
          height: 40px;
          font-size: 24px;
          font-weight: 700;
          color: ${theme.accent};
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'};
          border: 2px solid ${theme.border};
          border-radius: 8px;
          text-align: center;
          padding: 0 8px;
          transition: all 0.2s;
        }

        .card-weight-input:focus {
          outline: none;
          border-color: ${theme.accent};
          background: ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 123, 255, 0.05)'};
        }

        .card-weight-input::-webkit-inner-spin-button,
        .card-weight-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .card-weight-percent {
          font-size: 20px;
          font-weight: 600;
          color: ${theme.accent};
        }

        .card-weight-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          outline: none;
          -webkit-appearance: none;
        }

        .card-weight-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s;
        }

        .card-weight-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .card-weight-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s;
        }

        .card-weight-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
        }

        @media (max-width: 768px) {
          .allocations-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px;
          }
          
          .allocation-card {
            padding: 12px;
          }
          
          .card-token-logo {
            width: 40px;
            height: 40px;
          }
          
          .card-weight-value {
            font-size: 20px;
          }
        }

        /* Legacy styles - keep for backward compatibility */
        .allocations-list {
          display: flex;
          flex-direction: column;
        }

        .allocation-row {
          display: grid;
          grid-template-columns: 120px 1fr 40px;
          gap: 12px;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid ${theme.border};
        }

        .allocation-row:last-child {
          border-bottom: none;
        }

        .asset-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .asset-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .asset-logo {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
        }

        .asset-symbol {
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .asset-meta {
          font-size: 11px;
          color: ${theme.textSecondary};
          opacity: 0.8;
        }

        .weight-control {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .weight-slider {
          flex: 1;
        }

        .weight-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .weight-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .weight-slider::-moz-range-progress {
          background: ${theme.accent};
          height: 4px;
          border-radius: 2px;
        }

        .weight-input {
          width: 70px;
          padding: 6px 8px;
          border: 1px solid ${theme.border};
          border-radius: 6px;
          text-align: right;
          font-size: 14px;
          background: ${theme.bgPanel};
          color: ${theme.textPrimary};
        }

        .weight-label {
          font-size: 14px;
          color: ${theme.textSecondary};
        }

        .btn-remove-token {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid ${theme.border};
          border-radius: 6px;
          font-size: 20px;
          color: ${theme.textSecondary};
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-remove-token:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #ef4444;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .optional {
          font-weight: 400;
          color: ${theme.textSecondary};
        }

        .form-input,
        .form-textarea,
        .form-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid ${theme.border};
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s;
          background: ${theme.bgPanel};
          color: ${theme.textPrimary};
        }

        /* Custom Dropdown Styles */
        .custom-dropdown {
          position: relative;
          width: 100%;
        }

        .dropdown-card {
          width: 100%;
          padding: 12px;
          border: 2px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'};
          color: ${theme.textPrimary};
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: all 0.2s;
          border-radius: 8px;
          margin-bottom: 6px;
        }

        .dropdown-card.trigger-selected {
          margin-bottom: 0;
        }

        .trigger-card-placeholder {
          color: ${theme.textSecondary};
          font-size: 15px;
          opacity: 0.7;
        }

        .trigger-card-arrow {
          color: ${theme.textSecondary};
          font-size: 16px;
          flex-shrink: 0;
        }

        .dropdown-trigger {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid ${theme.border};
          border-radius: 8px;
          background: ${theme.bgPanel};
          color: ${theme.textPrimary};
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s;
        }

        .dropdown-trigger:hover {
          border-color: ${theme.accent};
        }

        .dropdown-trigger:focus {
          outline: none;
          border-color: ${theme.accent};
          box-shadow: 0 0 0 3px ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 123, 255, 0.1)'};
        }

        .selected-option {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .placeholder {
          color: ${theme.textSecondary};
          opacity: 0.7;
        }

        .dropdown-arrow {
          color: ${theme.textSecondary};
          font-size: 12px;
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 300px;
          overflow-y: auto;
          background: ${theme.bgPanel};
          border: 1px solid ${theme.border};
          border-radius: 8px;
          box-shadow: 0 4px 12px ${theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'};
          z-index: 1000;
        }

        .dropdown-menu-enhanced {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 400px;
          overflow-y: auto;
          background: ${theme.bgPanel};
          border: 2px solid ${theme.border};
          border-radius: 12px;
          box-shadow: 0 8px 24px ${theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)'};
          z-index: 1000;
          padding: 8px;
        }

        .dropdown-card {
          width: 100%;
          padding: 12px;
          border: 2px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'};
          color: ${theme.textPrimary};
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: all 0.2s;
          border-radius: 8px;
          margin-bottom: 6px;
        }

        .dropdown-card:last-child {
          margin-bottom: 0;
        }

        .dropdown-card:hover {
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'};
          border-color: ${theme.accent};
          transform: translateY(-1px);
          box-shadow: 0 2px 8px ${theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)'};
        }

        .dropdown-card.selected {
          background: ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 123, 255, 0.1)'};
          border-color: ${theme.accent};
        }

        .dropdown-card-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .dropdown-card-logo {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .dropdown-card-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .dropdown-card-symbol {
          font-size: 15px;
          font-weight: 700;
          color: ${theme.textPrimary};
        }

        .dropdown-card-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: ${theme.textSecondary};
          flex-wrap: wrap;
        }

        .dropdown-meta-logo {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          object-fit: cover;
        }

        .dropdown-card-value {
          font-size: 14px;
          font-weight: 600;
          color: ${theme.accent};
          flex-shrink: 0;
        }

        .dropdown-option {
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: transparent;
          color: ${theme.textPrimary};
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s;
          border-bottom: 1px solid ${theme.border};
        }

        .token-logos {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .dropdown-option:last-child {
          border-bottom: none;
        }

        .dropdown-option:hover {
          background: ${theme.bgSecondary};
        }

        .dropdown-option.selected {
          background: ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 123, 255, 0.1)'};
          color: ${theme.accent};
        }

        .token-logo {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .token-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .token-symbol {
          font-weight: 600;
          font-size: 14px;
        }

        .token-value {
          font-size: 12px;
          color: ${theme.textSecondary};
        }

        .form-input:focus,
        .form-textarea:focus,
        .form-select:focus {
          outline: none;
          border-color: ${theme.accent};
          box-shadow: 0 0 0 3px ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 123, 255, 0.1)'};
        }

        .validation-section {
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .validation-section.valid {
          background: #d1fae5;
          border: 2px solid #10b981;
        }

        .validation-section.invalid {
          background: #fef3c7;
          border: 2px solid #f59e0b;
        }

        .validation-header {
          font-weight: 600;
          margin-bottom: 8px;
        }

        .validation-section.valid .validation-header {
          color: #065f46;
        }

        .validation-section.invalid .validation-header {
          color: #92400e;
        }

        .validation-errors {
          margin: 0;
          padding-left: 20px;
          color: #92400e;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: ${theme.accent};
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-primary:disabled {
          background: ${theme.border};
          color: ${theme.textSecondary};
          cursor: not-allowed;
        }

        .btn-flat {
          background: transparent;
          color: ${theme.textPrimary};
          border: none;
          padding: 8px 16px;
        }

        .btn-flat:hover:not(:disabled) {
          background: ${theme.bgSecondary};
        }

        /* Dialog Styles */
        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s;
          padding: 20px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .dialog-content {
          background: ${theme.bgPanel};
          border-radius: 16px;
          width: 100%;
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          animation: scaleIn 0.3s;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid ${theme.border};
        }

        .dialog-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .dialog-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          font-size: 24px;
          color: ${theme.textSecondary};
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .dialog-close:hover {
          background: ${theme.bgSecondary};
        }

        .dialog-body {
          padding: 24px;
          overflow-y: auto;
        }

        .dialog-preview {
          position: relative;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 123, 255, 0.08)'};
          border: 2px solid ${theme.accent};
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .dialog-preview-change {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: ${theme.accent};
          background: ${theme.bgPanel};
          border: 1px solid ${theme.accent};
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dialog-preview-change:hover {
          background: ${theme.accent};
          color: white;
        }

        .dialog-preview-logo {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .dialog-preview-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dialog-preview-symbol {
          font-size: 20px;
          font-weight: 700;
          color: ${theme.textPrimary};
        }

        .dialog-preview-value {
          font-size: 16px;
          font-weight: 600;
          color: ${theme.accent};
        }

        .dialog-preview-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: ${theme.textSecondary};
          margin-top: 4px;
        }

        .dialog-preview-small-logo {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          object-fit: cover;
        }

        .dialog-weight-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .dialog-weight-input-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .dialog-weight-input {
          width: 100px;
          height: 56px;
          font-size: 32px;
          font-weight: 700;
          color: ${theme.accent};
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'};
          border: 2px solid ${theme.border};
          border-radius: 12px;
          text-align: center;
          padding: 0 12px;
          transition: all 0.2s;
        }

        .dialog-weight-input:focus {
          outline: none;
          border-color: ${theme.accent};
          box-shadow: 0 0 0 3px ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 123, 255, 0.1)'};
        }

        .dialog-weight-input::-webkit-inner-spin-button,
        .dialog-weight-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .dialog-weight-percent {
          font-size: 28px;
          font-weight: 700;
          color: ${theme.accent};
        }

        .dialog-weight-slider {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'};
          outline: none;
          -webkit-appearance: none;
        }

        .dialog-weight-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
          transition: transform 0.2s;
        }

        .dialog-weight-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .dialog-weight-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
          transition: transform 0.2s;
        }

        .dialog-weight-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
        }

        .weight-input-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .weight-slider-large {
          width: 100%;
        }

        .weight-slider-large::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .weight-slider-large::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .weight-slider-large::-moz-range-progress {
          background: ${theme.accent};
          height: 6px;
          border-radius: 3px;
        }

        .weight-display {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }

        .weight-input-large {
          width: 100px;
          padding: 12px 16px;
          border: 2px solid ${theme.border};
          border-radius: 8px;
          text-align: center;
          font-size: 24px;
          font-weight: 600;
          background: ${theme.bgPanel};
          color: ${theme.textPrimary};
        }

        .weight-input-large:focus {
          outline: none;
          border-color: ${theme.accent};
        }

        .weight-unit {
          font-size: 20px;
          font-weight: 600;
          color: ${theme.textSecondary};
        }

        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px 24px;
          border-top: 1px solid ${theme.border};
        }

        @media (max-width: 768px) {
          .allocation-row {
            grid-template-columns: 100px 1fr 36px;
          }

          .weight-control {
            flex-direction: column;
            align-items: stretch;
          }

          .weight-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AllocationStrategyForm;
