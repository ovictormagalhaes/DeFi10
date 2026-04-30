/**
 * Allocation Strategy Form
 * Form to create/edit Allocation by Weight strategies
 *
 * New Flow:
 * 1. Add Group (by Asset Type) - creates empty group
 * 2. Dialog appears to add tokens with weights to that group
 */

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
import React, { useState, useMemo } from 'react';

import { getProtocolConfig } from '../../constants/protocols';
import { WalletItemType } from '../../constants/walletItemTypes';
import { useChainIcons } from '../../context/ChainIconsProvider';
import { useTheme } from '../../context/ThemeProvider';
import { RebalanceAssetType, ASSET_TYPE_OPTIONS } from '../../types/rebalancing';
import type { AllocationByWeightConfig } from '../../types/strategies/allocationByWeight';
import type { AllocationStrategy, SaveStrategiesResponse } from '../../types/strategy';
import type { WalletItem } from '../../types/wallet';
import { capitalize } from '../../utils/format';
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
  ) => Promise<SaveStrategiesResponse>;
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
  isGeneral?: boolean;
}

interface GeneralTokenOption {
  symbol: string;
  logo?: string;
  value: number;
}

const aggregateGeneralTokens = (portfolio: WalletItem[]): GeneralTokenOption[] => {
  const map = new Map<string, GeneralTokenOption>();
  portfolio.forEach((item) => {
    const tokens = item.position?.tokens || [];
    tokens.forEach((t: any) => {
      const tokenType = (t.type || '').toString().toLowerCase();
      if (tokenType === 'borrowed' || tokenType === 'borrow') return;
      if (!t.symbol) return;
      const value = Math.abs(t.financials?.totalPrice || 0);
      const existing = map.get(t.symbol);
      if (existing) {
        existing.value += value;
        if (!existing.logo && t.logo) existing.logo = t.logo;
      } else {
        map.set(t.symbol, { symbol: t.symbol, logo: t.logo, value });
      }
    });
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
};

interface SortableAllocationCardProps {
  allocation: AllocationItem;
  logo: string | undefined;
  assetValue: number;
  onRemove: (id: string) => void;
  onUpdateWeight: (id: string, weight: number) => void;
}

const SortableAllocationCard: React.FC<SortableAllocationCardProps> = ({
  allocation,
  logo,
  assetValue,
  onRemove,
  onUpdateWeight,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: allocation.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="alloc-row">
      <div {...attributes} {...listeners} className="alloc-drag" title="Drag to reorder">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
          <circle cx="3" cy="3" r="1.5" fill="currentColor" />
          <circle cx="9" cy="3" r="1.5" fill="currentColor" />
          <circle cx="3" cy="8" r="1.5" fill="currentColor" />
          <circle cx="9" cy="8" r="1.5" fill="currentColor" />
          <circle cx="3" cy="13" r="1.5" fill="currentColor" />
          <circle cx="9" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </div>

      <div className="alloc-identity">
        {logo ? (
          <img src={logo} alt={allocation.symbol} className="alloc-logo" />
        ) : (
          <div className="alloc-logo-placeholder">{allocation.symbol[0]}</div>
        )}
        <div className="alloc-meta">
          <span className="alloc-symbol">{allocation.symbol}</span>
          {(allocation.protocolName || allocation.chain) && (
            <div className="alloc-badges">
              {allocation.protocolLogo && (
                <img src={allocation.protocolLogo} alt="" className="alloc-badge-icon" />
              )}
              {allocation.protocolName && (
                <span className="alloc-badge">{allocation.protocolName}</span>
              )}
              {allocation.chain && (
                <span className="alloc-badge alloc-badge-chain">
                  {capitalize(allocation.chain)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <span className="alloc-value">
        $
        {assetValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>

      <div className="alloc-weight-ctrl">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={allocation.weight}
          onChange={(e) => onUpdateWeight(allocation.id, Number(e.target.value))}
          className="alloc-slider"
        />
        <div className="alloc-weight-input-wrap">
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={allocation.weight}
            onChange={(e) => onUpdateWeight(allocation.id, Number(e.target.value))}
            className="alloc-weight-input"
          />
          <span className="alloc-weight-pct">%</span>
        </div>
      </div>

      <button onClick={() => onRemove(allocation.id)} className="alloc-remove" title="Remove">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M1 1l10 10M11 1L1 11"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
};

export const AllocationStrategyForm: React.FC<AllocationStrategyFormProps> = ({
  walletGroupId,
  portfolio,
  initialStrategy,
  onSave,
  onCancel,
  onSuccess,
  saving,
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
    if (!initialStrategy)
      return { assetType: null, assetTypeLabel: '', name: '', description: '', allocations: [] };

    // Check for new structure (allocations) or old structure (items/targetAllocations)
    const hasNewStructure = !!(initialStrategy as any).allocations;
    const allocationsData = hasNewStructure
      ? (initialStrategy as any).allocations
      : initialStrategy.targetAllocations || [];

    // Determine asset type from first allocation
    let detectedType: RebalanceAssetType | null = null;
    let detectedLabel = '';

    if (allocationsData.length > 0) {
      const firstAlloc = allocationsData[0];

      if (hasNewStructure) {
        // New structure has groupType directly in allocation
        if (firstAlloc.groupType === RebalanceAssetType.General || firstAlloc.group === 'General') {
          detectedType = RebalanceAssetType.General;
        } else {
          detectedType = firstAlloc.groupType as RebalanceAssetType;
        }
      } else {
        // Old structure needs to check items
        if (initialStrategy.items && initialStrategy.items.length > 0) {
          const firstItem = initialStrategy.items[0];
          detectedType = firstItem.groupType as RebalanceAssetType;
        }
      }

      const typeOption = ASSET_TYPE_OPTIONS.find((opt) => opt.value === detectedType);
      if (typeOption) {
        detectedLabel = typeOption.label;
      }
    }

    // Map allocations to form items
    const existingAllocations: AllocationItem[] = allocationsData.map((alloc: any, idx: number) => {
      const isGeneralAlloc =
        hasNewStructure &&
        (alloc.groupType === RebalanceAssetType.General || alloc.group === 'General');

      if (isGeneralAlloc) {
        const symbol = alloc.token?.symbol || alloc.assetKey;
        const tokenLogo = alloc.token?.logo || '';
        const aggregated = aggregateGeneralTokens(portfolio).find((t) => t.symbol === symbol);
        return {
          id: `existing-${idx}`,
          assetKey: symbol,
          symbol,
          tokenLogo: tokenLogo || aggregated?.logo,
          weight: alloc.targetWeight,
          value: aggregated?.value || 0,
          isGeneral: true,
        };
      }

      if (hasNewStructure) {
        // NEW structure: data is already in the allocation object
        const protocol = alloc.protocol?.id || alloc.protocol;
        const protocolName = alloc.protocol?.name || '';
        const protocolLogo = getProtocolConfig(
          alloc.protocol?.id || alloc.protocol?.name || ''
        ).logo;
        const chain = alloc.chain?.id || alloc.chain;
        const symbol = alloc.token?.symbol || alloc.assetKey;
        const tokenLogo = alloc.token?.logo || '';

        // Find current value in portfolio
        const portfolioItem = portfolio.find(
          (p) =>
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
          if (alloc.positionType === 1) {
            // Supplied
            targetToken = tokens.find((t: any) => {
              const tokenType = t.type?.toLowerCase() || '';
              return t.symbol === symbol && (tokenType === 'supplied' || tokenType === 'supply');
            });
          } else if (alloc.positionType === 2) {
            // Borrowed
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
          group: alloc.group,
        };
      } else {
        // OLD structure: need to match with items array
        let item = initialStrategy.items?.[idx];

        // Verify the item matches the symbol
        if (item && item.metadata?.symbol !== alloc.symbol) {
          console.warn(
            '[initializeFromStrategy] Item index mismatch, falling back to find by symbol+protocol'
          );

          // Fallback: Find corresponding item matching symbol AND protocol/chain if available
          item = initialStrategy.items?.find((i: any) => {
            const symbolMatch = i.metadata?.symbol === alloc.symbol;
            if (!symbolMatch) return false;

            // If backend provides protocol/chain in targetAllocation, use it for matching
            if (alloc.protocol && alloc.chain && i.metadata?.protocol) {
              return (
                i.metadata.protocol.id === alloc.protocol &&
                i.metadata.protocol.chain === alloc.chain
              );
            }

            // Otherwise just match by symbol (legacy behavior, will find first match)
            return true;
          });
        }

        if (item?.metadata) {
          const protocol = item.metadata.protocol;
          const symbol = alloc.symbol || alloc.assetKey;

          // Find current value in portfolio
          const portfolioItem = portfolio.find(
            (p) =>
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
            protocolLogo: getProtocolConfig(protocol?.id || protocol?.name || '').logo,
            chainLogo: protocol?.chain ? getChainIcon(protocol.chain) : undefined,
            tokenLogo: item.metadata.tokens?.[0]?.logo,
            weight: alloc.targetWeight,
            value: currentValue,
          };
        }

        // Fallback if metadata not found
        return {
          id: `existing-${idx}`,
          assetKey: alloc.symbol || alloc.assetKey,
          symbol: alloc.symbol || alloc.assetKey,
          weight: alloc.targetWeight,
          value: 0,
        };
      }
    });

    return {
      assetType: detectedType,
      assetTypeLabel: detectedLabel,
      name: initialStrategy.name || '',
      description: initialStrategy.description || '',
      allocations: existingAllocations,
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

    portfolio.forEach((item) => {
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

  // Aggregate tokens across all non-borrow positions for the General type
  const generalTokens = useMemo(() => aggregateGeneralTokens(portfolio), [portfolio]);

  // Get available asset types (that have portfolio items)
  const availableAssetTypes = useMemo(() => {
    return ASSET_TYPE_OPTIONS.filter((opt) => {
      if (opt.value === RebalanceAssetType.General) return generalTokens.length > 0;
      return portfolioByAssetType.has(opt.value);
    });
  }, [portfolioByAssetType, generalTokens]);

  // Get assets for selected asset type
  const assetsInType = useMemo(() => {
    if (!assetType) return [];
    if (assetType === RebalanceAssetType.General) return [];
    const items = portfolioByAssetType.get(assetType) || [];

    // For Lending Supply, only show supply positions
    if (assetType === RebalanceAssetType.LendingSupply) {
      return items.filter((item) => {
        const tokens = item.position?.tokens || [];
        return tokens.some((t) => {
          const tokenType = t.type?.toLowerCase() || '';
          return tokenType === 'supplied' || tokenType === 'supply';
        });
      });
    }

    // For Lending Borrow, only show borrow positions
    if (assetType === RebalanceAssetType.LendingBorrow) {
      return items.filter((item) => {
        const tokens = item.position?.tokens || [];
        return tokens.some((t) => {
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
    const assetKeys = allocations.map((a) => a.assetKey);
    const duplicates = assetKeys.filter((key, index) => assetKeys.indexOf(key) !== index);
    if (duplicates.length > 0) {
      return {
        valid: false,
        errors: [`Duplicate tokens found: ${[...new Set(duplicates)].join(', ')}`],
        warnings: [],
      };
    }

    // Validate that allocations total 100%
    if (Math.abs(totalWeight - 100) > 0.01) {
      return {
        valid: false,
        errors: [`Total must be 100% (currently ${totalWeight.toFixed(1)}%)`],
        warnings: [],
      };
    }

    return { valid: true, errors: [], warnings: [] };
  }, [assetType, allocations, totalWeight]);

  const handleSelectAssetType = (type: RebalanceAssetType) => {
    const typeOption = ASSET_TYPE_OPTIONS.find((opt) => opt.value === type);
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
    const exists = allocations.some((a) => a.assetKey === selectedAsset);
    if (exists) {
      alert('This token is already added');
      return;
    }

    if (assetType === RebalanceAssetType.General) {
      const token = generalTokens.find((t) => t.symbol === selectedAsset);
      if (!token) {
        alert('Token not found');
        return;
      }
      const newAllocation: AllocationItem = {
        id: `${selectedAsset}-${Date.now()}`,
        assetKey: token.symbol,
        symbol: token.symbol,
        tokenLogo: token.logo,
        weight,
        value: token.value,
        isGeneral: true,
      };
      setAllocations([...allocations, newAllocation]);
      setWeight(0);
      setSelectedAsset('');
      setShowTokenDialog(false);
      return;
    }

    // Get symbol from portfolio
    const portfolioItem = assetsInType.find((item) => {
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
      targetToken =
        portfolioItem.position.tokens?.find((t) => {
          const tokenType = t.type?.toLowerCase() || '';
          return tokenType === 'supplied' || tokenType === 'supply';
        }) || portfolioItem.position.tokens?.[0];
    } else if (assetType === RebalanceAssetType.LendingBorrow) {
      targetToken =
        portfolioItem.position.tokens?.find((t) => {
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

    const chainLogo = portfolioItem.protocol.chain
      ? getChainIcon(portfolioItem.protocol.chain)
      : undefined;

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
      value,
    };

    setAllocations([...allocations, newAllocation]);
    setWeight(0);
    setSelectedAsset('');
    setShowTokenDialog(false);
  };

  const handleRemoveToken = (allocationId: string) => {
    setAllocations(allocations.filter((a) => a.id !== allocationId));
  };

  const handleUpdateWeight = (allocationId: string, newWeight: number) => {
    setAllocations(
      allocations.map((a) => (a.id === allocationId ? { ...a, weight: newWeight } : a))
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
      const isGeneralStrategy = assetType === RebalanceAssetType.General;
      const config: AllocationByWeightConfig = {
        allocations: allocations.map((a, index) => ({
          assetKey: a.symbol,
          group: isGeneralStrategy ? 'General' : assetTypeLabel,
          weight: a.weight,
          protocol: isGeneralStrategy ? undefined : a.protocol,
          protocolName: isGeneralStrategy ? undefined : a.protocolName,
          chain: isGeneralStrategy ? undefined : a.chain,
          displayOrder: index,
        })),
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      };

      await onSave(walletGroupId, config, portfolio, initialStrategy?.id);
      onSuccess();
    } catch (err) {
      console.error('Failed to save strategy:', err);
      alert(`Failed to save strategy: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="allocation-form">
      {/* Step 1: Select Asset Type */}
      {!assetType ? (
        <div className="form-section">
          <h3 className="section-title">
            {initialStrategy ? 'Edit Allocation Strategy' : 'Create Allocation Strategy'}
          </h3>
          <p className="section-description">
            Select the asset type for this strategy. Each strategy manages allocations for one asset
            type.
          </p>

          <div className="asset-type-grid">
            {availableAssetTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleSelectAssetType(type.value)}
                className="asset-type-card"
              >
                <div className="type-label">{type.label}</div>
                <div className="type-description">{type.description}</div>
                <div className="type-count">
                  {type.value === RebalanceAssetType.General
                    ? generalTokens.length
                    : portfolioByAssetType.get(type.value)?.length || 0}{' '}
                  assets
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
                <span
                  className={`total-badge ${Math.abs(totalWeight - 100) < 0.01 ? 'valid' : 'invalid'}`}
                >
                  Total: {totalWeight.toFixed(1)}%{Math.abs(totalWeight - 100) < 0.01 ? ' ✓' : ''}
                </span>
              </div>
              <button
                onClick={handleOpenTokenDialog}
                className="btn-add-token"
                disabled={
                  assetType === RebalanceAssetType.General
                    ? generalTokens.length === 0
                    : assetsInType.length === 0
                }
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
                  items={allocations.map((a) => a.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="allocations-grid">
                    {allocations.map((allocation) => {
                      // Get logo from allocation or try to find in portfolio
                      const logo =
                        allocation.tokenLogo ||
                        (() => {
                          const portfolioItem = assetsInType.find((item) => {
                            const key = `${item.protocol.id}-${item.protocol.chain}-${item.position.tokens?.[0]?.symbol || ''}`;
                            return key === allocation.assetKey;
                          });
                          return portfolioItem?.position.tokens?.[0]?.logo;
                        })();

                      const assetValue = allocation.value || 0;

                      return (
                        <SortableAllocationCard
                          key={allocation.id}
                          allocation={allocation}
                          logo={logo}
                          assetValue={assetValue}
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
          {saving ? 'Saving...' : initialStrategy ? 'Update Strategy' : 'Create Strategy'}
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
              <button onClick={() => setShowTokenDialog(false)} className="dialog-close">
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
                    {selectedAsset && assetType === RebalanceAssetType.General ? (
                      (() => {
                        const token = generalTokens.find((t) => t.symbol === selectedAsset);
                        if (!token) return null;
                        return (
                          <>
                            <div className="dropdown-card-left">
                              {token.logo && (
                                <img
                                  src={token.logo}
                                  alt={token.symbol}
                                  className="dropdown-card-logo"
                                />
                              )}
                              <div className="dropdown-card-info">
                                <span className="dropdown-card-symbol">{token.symbol}</span>
                                <div className="dropdown-card-meta">
                                  <span>All positions (excl. borrow)</span>
                                </div>
                              </div>
                            </div>
                            <span className="dropdown-card-value">${token.value.toFixed(2)}</span>
                            <span className="trigger-card-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                          </>
                        );
                      })()
                    ) : selectedAsset ? (
                      (() => {
                        const asset = assetsInType.find(
                          (a) =>
                            `${a.protocol.id}-${a.protocol.chain}-${a.position.tokens?.[0]?.symbol || ''}` ===
                            selectedAsset
                        );
                        if (!asset) return null;

                        const tokenLogo = asset.position.tokens?.[0]?.logo;
                        const symbol = asset.position.tokens?.[0]?.symbol || '';
                        const value = asset.position.tokens?.[0]?.financials?.totalPrice || 0;
                        const protocolLogo = asset.protocol.logo;
                        const protocolName = asset.protocol.name;
                        const chain = asset.protocol.chain;
                        const chainLogo = chain ? getChainIcon(chain) : null;
                        const isLending =
                          assetType === RebalanceAssetType.LendingSupply ||
                          assetType === RebalanceAssetType.LendingBorrow;

                        return (
                          <>
                            <div className="dropdown-card-left">
                              {tokenLogo && (
                                <img src={tokenLogo} alt={symbol} className="dropdown-card-logo" />
                              )}
                              <div className="dropdown-card-info">
                                <span className="dropdown-card-symbol">{symbol}</span>
                                {(protocolName || chain) && (
                                  <div className="dropdown-card-meta">
                                    {protocolLogo && (
                                      <img
                                        src={protocolLogo}
                                        alt="protocol"
                                        className="dropdown-meta-logo"
                                      />
                                    )}
                                    {protocolName && <span>{protocolName}</span>}
                                    {chainLogo && (
                                      <img
                                        src={chainLogo}
                                        alt="chain"
                                        className="dropdown-meta-logo"
                                      />
                                    )}
                                    {chain && <span>{chain}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="dropdown-card-value">${value.toFixed(2)}</span>
                            <span className="trigger-card-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                          </>
                        );
                      })()
                    ) : (
                      <>
                        <span className="trigger-card-placeholder">Choose a token...</span>
                        <span className="trigger-card-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                      </>
                    )}
                  </button>

                  {dropdownOpen && assetType === RebalanceAssetType.General && (
                    <div className="dropdown-menu-enhanced">
                      {generalTokens.map((token) => (
                        <button
                          key={token.symbol}
                          type="button"
                          className={`dropdown-card ${selectedAsset === token.symbol ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedAsset(token.symbol);
                            setDropdownOpen(false);
                          }}
                        >
                          <div className="dropdown-card-left">
                            {token.logo && (
                              <img
                                src={token.logo}
                                alt={token.symbol}
                                className="dropdown-card-logo"
                              />
                            )}
                            <div className="dropdown-card-info">
                              <span className="dropdown-card-symbol">{token.symbol}</span>
                              <div className="dropdown-card-meta">
                                <span>All positions (excl. borrow)</span>
                              </div>
                            </div>
                          </div>
                          <span className="dropdown-card-value">${token.value.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {dropdownOpen && assetType !== RebalanceAssetType.General && (
                    <div className="dropdown-menu-enhanced">
                      {assetsInType.map((asset) => {
                        const key = `${asset.protocol.id}-${asset.protocol.chain}-${asset.position.tokens?.[0]?.symbol || ''}`;
                        const symbol = asset.position.tokens?.[0]?.symbol || 'Unknown';
                        const tokenLogo = asset.position.tokens?.[0]?.logo;
                        const value = asset.position.tokens?.[0]?.financials?.totalPrice || 0;
                        const protocolLogo = asset.protocol.logo;
                        const protocolName = asset.protocol.name;
                        const chain = asset.protocol.chain;
                        const chainLogo = chain ? getChainIcon(chain) : null;
                        const isLending =
                          assetType === RebalanceAssetType.LendingSupply ||
                          assetType === RebalanceAssetType.LendingBorrow;

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
                              {tokenLogo && (
                                <img src={tokenLogo} alt={symbol} className="dropdown-card-logo" />
                              )}
                              <div className="dropdown-card-info">
                                <span className="dropdown-card-symbol">{symbol}</span>
                                {(protocolName || chain) && (
                                  <div className="dropdown-card-meta">
                                    {protocolLogo && (
                                      <img
                                        src={protocolLogo}
                                        alt="protocol"
                                        className="dropdown-meta-logo"
                                      />
                                    )}
                                    {protocolName && <span>{protocolName}</span>}
                                    {chainLogo && (
                                      <img
                                        src={chainLogo}
                                        alt="chain"
                                        className="dropdown-meta-logo"
                                      />
                                    )}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && selectedAsset && weight > 0) handleAddToken();
                      }}
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
              <button onClick={() => setShowTokenDialog(false)} className="btn-flat">
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

      <style>{`
        .allocation-form {
          width: 100%;
        }

        .form-section {
          background: ${theme.bgPanel};
          border: 1px solid ${theme.border};
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
          background: ${theme.bgSecondary};
          border: 1px solid ${theme.border};
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .asset-type-card:hover {
          border-color: ${theme.accent};
          box-shadow: 0 4px 12px ${theme.accent}33;
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
          background: ${theme.accent}26;
          color: ${theme.accent};
          border: 1px solid ${theme.accent};
        }

        .total-badge.invalid {
          background: ${theme.warning}1f;
          color: ${theme.warning};
          border: 1px solid ${theme.warning};
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
          display: flex;
          flex-direction: column;
          gap: 0;
          margin-top: 12px;
          border: 1px solid ${theme.border};
          border-radius: 10px;
          overflow: hidden;
        }

        .alloc-row {
          display: grid;
          grid-template-columns: 20px 1fr auto 260px 28px;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: ${theme.bgPanel};
          border-bottom: 1px solid ${theme.border};
          transition: background 0.15s;
        }

        .alloc-row:last-child {
          border-bottom: none;
        }

        .alloc-row:hover {
          background: ${theme.bgSecondary};
        }

        .alloc-drag {
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${theme.textSecondary};
          cursor: grab;
          opacity: 0.4;
          transition: opacity 0.15s;
          user-select: none;
        }

        .alloc-drag:hover {
          opacity: 1;
        }

        .alloc-identity {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .alloc-logo {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .alloc-logo-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: ${theme.textSecondary};
          flex-shrink: 0;
        }

        .alloc-meta {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .alloc-symbol {
          font-size: 14px;
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .alloc-badges {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }

        .alloc-badge-icon {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          object-fit: cover;
        }

        .alloc-badge {
          font-size: 11px;
          color: ${theme.textSecondary};
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 4px;
          padding: 1px 5px;
          white-space: nowrap;
        }

        .alloc-badge-chain {
          color: ${theme.accent};
          border-color: ${theme.accent}44;
          background: ${theme.accent}0f;
        }

        .alloc-value {
          font-size: 13px;
          font-weight: 500;
          color: ${theme.textSecondary};
          white-space: nowrap;
          text-align: right;
        }

        .alloc-weight-ctrl {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .alloc-slider {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: ${theme.bgInteractive};
          outline: none;
          -webkit-appearance: none;
          cursor: pointer;
        }

        .alloc-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 2px solid ${theme.bgPanel};
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }

        .alloc-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 2px solid ${theme.bgPanel};
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }

        .alloc-weight-input-wrap {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .alloc-weight-input {
          width: 44px;
          height: 30px;
          font-size: 14px;
          font-weight: 600;
          color: ${theme.accent};
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 6px;
          text-align: center;
          padding: 0 4px;
          transition: border-color 0.15s;
        }

        .alloc-weight-input:focus {
          outline: none;
          border-color: ${theme.accent};
        }

        .alloc-weight-input::-webkit-inner-spin-button,
        .alloc-weight-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
        }

        .alloc-weight-pct {
          font-size: 13px;
          font-weight: 600;
          color: ${theme.accent};
        }

        .alloc-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: ${theme.textSecondary};
          border-radius: 6px;
          cursor: pointer;
          opacity: 0.4;
          transition: all 0.15s;
          padding: 0;
        }

        .alloc-remove:hover {
          background: ${theme.danger}22;
          color: ${theme.danger};
          opacity: 1;
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
          background: ${theme.danger}1f;
          border-color: ${theme.danger};
          color: ${theme.danger};
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
          border: 1px solid ${theme.border};
          background: ${theme.bgInteractive};
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
          box-shadow: 0 0 0 3px ${theme.accent}33;
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
          box-shadow: 0 8px 24px ${theme.shadow};
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
          border: 1px solid ${theme.border};
          border-radius: 10px;
          box-shadow: 0 8px 24px ${theme.shadow};
          z-index: 1000;
          padding: 6px;
        }

        .dropdown-card {
          width: 100%;
          padding: 12px;
          border: 1px solid ${theme.border};
          background: ${theme.bgInteractive};
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
          background: ${theme.bgInteractiveHover};
          border-color: ${theme.accent};
          transform: translateY(-1px);
          box-shadow: 0 2px 8px ${theme.shadow};
        }

        .dropdown-card.selected {
          background: ${theme.accent}26;
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
          background: ${theme.accent}26;
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
          box-shadow: 0 0 0 3px ${theme.accent}33;
        }

        .validation-section {
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .validation-section.valid {
          background: ${theme.accent}1f;
          border: 1px solid ${theme.accent};
        }

        .validation-section.invalid {
          background: ${theme.warning}1f;
          border: 1px solid ${theme.warning};
        }

        .validation-header {
          font-weight: 600;
          margin-bottom: 8px;
        }

        .validation-section.valid .validation-header {
          color: ${theme.accent};
        }

        .validation-section.invalid .validation-header {
          color: ${theme.warning};
        }

        .validation-errors {
          margin: 0;
          padding-left: 20px;
          color: ${theme.warning};
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
          background: ${theme.accent}26;
          border: 1px solid ${theme.accent};
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
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 12px;
          text-align: center;
          padding: 0 12px;
          transition: all 0.2s;
        }

        .dialog-weight-input:focus {
          outline: none;
          border-color: ${theme.accent};
          box-shadow: 0 0 0 3px ${theme.accent}33;
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
          background: ${theme.bgInteractiveHover};
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
