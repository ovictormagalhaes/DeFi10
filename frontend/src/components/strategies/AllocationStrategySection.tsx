/**
 * Strategy Section
 * List and manage all strategy types (Type 1: Allocation, Type 2: Health Factor)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useAllocationStrategy } from '../../hooks/strategies/useAllocationStrategy';
import { useHealthFactorStrategy } from '../../hooks/useHealthFactorStrategy';
import { clearStrategyCache } from '../../hooks/useSharedStrategyCache';
import { getStrategyByGroup, saveStrategies } from '../../services/apiClient';

import type { WalletItem } from '../../types/wallet';
import type { Strategy, HealthFactorTargetConfig, AllocationStrategy, HealthFactorStrategy } from '../../types/strategy';

import { StrategyAllocationView } from '../StrategyAllocationView';
import { AllocationStrategyCard } from './AllocationStrategyCard';
import { AllocationStrategyForm } from './AllocationStrategyForm';
import { HealthFactorCard } from './HealthFactorCard';
import { HealthFactorStrategyForm } from './HealthFactorStrategyForm';

interface AllocationStrategySectionProps {
  walletGroupId: string;
  portfolio: WalletItem[];
}

type ViewMode = 'list' | 'select-type' | 'create' | 'edit' | 'detail';

export const AllocationStrategySection: React.FC<
  AllocationStrategySectionProps
> = ({ walletGroupId, portfolio }) => {
  const { theme } = useTheme();
  
  // Type 1: Allocation by Weight
  const {
    strategy: allocationStrategy,
    loading: allocationLoading,
    error: allocationError,
    saving: allocationSaving,
    loadStrategy: loadAllocationStrategy,
    saveAllocationStrategy,
    calculateDeltas,
    clearStrategy: clearAllocationStrategy
  } = useAllocationStrategy();

  // Type 2: Health Factor Target
  const {
    strategy: healthFactorStrategyFromHook,
    loading: healthFactorLoading,
    saving: healthFactorSaving,
    error: healthFactorError,
    loadStrategy: loadHealthFactorStrategy,
    saveHealthFactorStrategy,
    monitorHealthFactor
  } = useHealthFactorStrategy();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedStrategyType, setSelectedStrategyType] = useState<number>(1);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [allStrategies, setAllStrategies] = useState<Strategy[]>([]);
  const [isReorderMode, setIsReorderMode] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  
  // Ref to prevent duplicate loads
  const loadedWalletGroupRef = useRef<string | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Extract Type 1 strategies for backward compatibility
  const allType1Strategies = useMemo(() => 
    allStrategies.filter(s => s.strategyType === 1),
    [allStrategies]
  );
  
  // Extract Type 2 strategy for backward compatibility
  const healthFactorStrategy = useMemo(() => 
    allStrategies.find(s => s.strategyType === 2),
    [allStrategies]
  );

  // Determine which strategy is active
  const strategy = allocationStrategy || healthFactorStrategyFromHook;
  const loading = allocationLoading || healthFactorLoading;
  const error = allocationError || healthFactorError;
  const saving = allocationSaving || healthFactorSaving;

  // Load strategies on mount - only when walletGroupId changes
  useEffect(() => {
    // Prevent duplicate loads for same walletGroupId
    if (walletGroupId && loadedWalletGroupRef.current !== walletGroupId) {
      loadedWalletGroupRef.current = walletGroupId;
      setIsInitialLoading(true);
      
      console.log('[AllocationStrategySection] Loading strategies for:', walletGroupId);
      
      // Clear cache first to ensure fresh data with IDs
      clearStrategyCache(walletGroupId);
      
      // Single API call for both strategy types
      (async () => {
        try {
          const { loadStrategyWithCache } = await import('../../hooks/useSharedStrategyCache');
          const cachedData = await loadStrategyWithCache(walletGroupId);
          
          // Keep ALL strategies in the order returned by backend
          const allStrategiesFromBackend = cachedData?.strategies || [];
          setAllStrategies(allStrategiesFromBackend);
          
          // Trigger hook states to update (they will use the cache, no new API call)
          loadAllocationStrategy(walletGroupId);
          loadHealthFactorStrategy(walletGroupId);
        } finally {
          setIsInitialLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletGroupId]);

  // Update selected strategy when loaded
  useEffect(() => {
    if (strategy) {
      setSelectedStrategy(strategy);
      if (viewMode === 'create') {
        setViewMode('detail');
      }
    }
  }, [strategy]);

  const handleCreate = () => {
    setEditingStrategy(null);
    setViewMode('select-type');
  };

  const handleSelectType = (type: number) => {
    setSelectedStrategyType(type);
    setEditingStrategy(null);
    setViewMode('create');
  };

  const handleEdit = (strategyToEdit: Strategy) => {
    console.log('[handleEdit] strategyToEdit:', strategyToEdit);
    console.log('[handleEdit] strategyToEdit.id:', strategyToEdit.id);
    if (strategyToEdit) {
      setEditingStrategy(strategyToEdit);
      setSelectedStrategyType(strategyToEdit.strategyType);
      setViewMode('edit');
    }
  };

  const handleCancelCreate = () => {
    setEditingStrategy(null);
    setViewMode('list');
  };

  const handleSaveSuccess = () => {
    setEditingStrategy(null);
    setViewMode('list');
    
    // Reload all strategies to update the list
    (async () => {
      const { loadStrategyWithCache } = await import('../../hooks/useSharedStrategyCache');
      clearStrategyCache(walletGroupId);
      const data = await loadStrategyWithCache(walletGroupId);
      setAllStrategies(data?.strategies || []);
    })();
  };

  const handleSaveHealthFactor = async (
    config: HealthFactorTargetConfig,
    name: string,
    description?: string,
    positionTargetHFs?: Record<string, number>,
    positionCriticalThresholds?: Record<string, number>,
    strategyId?: string
  ) => {
    await saveHealthFactorStrategy(walletGroupId, config, name, description, positionTargetHFs, positionCriticalThresholds, portfolio, strategyId);
    handleSaveSuccess();
  };

  const handleViewDetails = () => {
    if (strategy) {
      setSelectedStrategy(strategy);
      setViewMode('detail');
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  const toggleReorderMode = () => {
    setIsReorderMode((prev) => !prev);
  };

  const handleDelete = async (strategyToDelete?: Strategy) => {
    // Use the passed strategy or fall back to the current strategy state
    const targetStrategy = strategyToDelete || strategy;
    
    if (!targetStrategy) return;
    
    console.log('[handleDelete] strategy to delete:', targetStrategy);
    console.log('[handleDelete] strategy.id:', targetStrategy.id);
    console.log('[handleDelete] strategy.name:', targetStrategy.name);
    
    if (confirm('Are you sure you want to delete this strategy?')) {
      try {
        // Get all existing strategies
        const existingData = await getStrategyByGroup(walletGroupId);
        
        console.log('[handleDelete] existingData.strategies:', existingData?.strategies);
        
        if (!existingData || !existingData.strategies || existingData.strategies.length === 0) {
          // No data to delete
          if (targetStrategy.strategyType === 1) {
            clearAllocationStrategy();
          }
          setViewMode('list');
          return;
        }
        
        // Remove the strategy we want to delete (by ID)
        const remainingStrategies = existingData.strategies.filter(
          (s: Strategy) => s.id !== targetStrategy.id
        );
        
        console.log('[handleDelete] Filtering strategies...');
        console.log('[handleDelete] Total before:', existingData.strategies.length);
        console.log('[handleDelete] Total after:', remainingStrategies.length);
        console.log('[handleDelete] Removed strategy with id:', targetStrategy.id);
        
        // Save remaining strategies (backend format with allocations/targets, not items)
        const savePayload = {
          walletGroupId,
          strategies: remainingStrategies.map((s: any) => {
            const strategyPayload: any = {
              id: s.id,
              strategyType: s.strategyType,
              name: s.name,
              description: s.description
            };
            
            // Include type-specific data
            if (s.strategyType === 1) {
              strategyPayload.allocations = s.allocations || [];
            } else if (s.strategyType === 2) {
              strategyPayload.targets = s.targets || [];
            }
            
            return strategyPayload;
          })
        };
        
        console.log('[handleDelete] Save payload:', savePayload);
        
        await saveStrategies(savePayload);
        
        clearStrategyCache(walletGroupId);
        
        // Clear local state
        if (targetStrategy.strategyType === 1) {
          clearAllocationStrategy();
        }
        
        // Reload strategies and update the list
        loadAllocationStrategy(walletGroupId);
        loadHealthFactorStrategy(walletGroupId);
        
        // Reload all strategies to update the list in backend order
        (async () => {
          const { loadStrategyWithCache } = await import('../../hooks/useSharedStrategyCache');
          const data = await loadStrategyWithCache(walletGroupId);
          setAllStrategies(data?.strategies || []);
        })();
        
        setViewMode('list');
      } catch (error) {
        console.error('Failed to delete strategy:', error);
        alert('Failed to delete strategy. Please try again.');
      }
    }
  };

  // Handle drag end - reorder strategies
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = allStrategies.findIndex((s) => s.id === active.id);
      const newIndex = allStrategies.findIndex((s) => s.id === over.id);

      const newStrategies = arrayMove(allStrategies, oldIndex, newIndex);
      setAllStrategies(newStrategies);
      
      // Save order immediately
      saveStrategyOrder(newStrategies);
    }
  };

  // Save strategy order to backend
  const saveStrategyOrder = async (strategies: Strategy[]) => {
    try {
      const payload = {
        walletGroupId,
        strategies: strategies.map((s: Strategy, index: number) => {
          const strategyPayload: any = {
            id: s.id,
            strategyType: s.strategyType,
            name: s.name,
            description: s.description,
            displayOrder: index
          };
          
          // Include type-specific data with displayOrder preserved
          if (s.strategyType === 1) {
            const allocStrategy = s as AllocationStrategy;
            strategyPayload.allocations = allocStrategy.allocations?.map((alloc: any, i: number) => ({
              ...alloc,
              displayOrder: alloc.displayOrder ?? i
            })) || [];
          } else if (s.strategyType === 2) {
            const hfStrategy = s as HealthFactorStrategy;
            strategyPayload.targets = hfStrategy.targets?.map((target: any, i: number) => ({
              ...target,
              displayOrder: target.displayOrder ?? i
            })) || [];
          }
          
          return strategyPayload;
        })
      };
      
      await saveStrategies(payload);
      clearStrategyCache(walletGroupId);
    } catch (error) {
      console.error('Failed to save strategy order:', error);
      alert('Failed to save order. Please try again.');
    }
  };

  // Get health factor statuses for Type 2 strategies
  const getPositionTargetHFs = (): Record<string, number> | undefined => {
    if (!healthFactorStrategy) return undefined;
    const hfStrategy = healthFactorStrategy as HealthFactorStrategy;
    const targets = hfStrategy.targets;
    if (!targets || targets.length === 0) return undefined;
    
    const targetHFsMap: Record<string, number> = {};
    targets.forEach((target) => {
      if (target.assetKey && target.targetHealthFactor != null) {
        targetHFsMap[target.assetKey] = target.targetHealthFactor;
      }
    });
    
    return Object.keys(targetHFsMap).length > 0 ? targetHFsMap : undefined;
  };

  const getPositionCriticalThresholds = (): Record<string, number> | undefined => {
    if (!healthFactorStrategy) return undefined;
    const hfStrategy = healthFactorStrategy as HealthFactorStrategy;
    const targets = hfStrategy.targets;
    if (!targets || targets.length === 0) return undefined;
    
    const criticalThresholdsMap: Record<string, number> = {};
    targets.forEach((target) => {
      if (target.assetKey && target.criticalThreshold != null) {
        criticalThresholdsMap[target.assetKey] = target.criticalThreshold;
      }
    });
    
    return Object.keys(criticalThresholdsMap).length > 0 ? criticalThresholdsMap : undefined;
  };

  const getConfig = (): HealthFactorTargetConfig | null => {
    if (!healthFactorStrategy) return null;
    const hfStrategy = healthFactorStrategy as HealthFactorStrategy;
    const rawTargets = hfStrategy.targets;
    if (!rawTargets || rawTargets.length === 0) return null;
    
    // Sort by displayOrder to maintain user's preferred order
    const targets = [...rawTargets].sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });
    
    const protocols = targets.map((t) => t.assetKey).filter(Boolean) as string[];
    
    // Calculate averages from targets
    const avgTargetHF = targets.reduce((sum, t) => sum + (t.targetHealthFactor || 2.0), 0) / targets.length;
    const avgCriticalThreshold = targets.reduce((sum, t) => sum + (t.criticalThreshold || 1.5), 0) / targets.length;
    
    return {
      targetHealthFactor: avgTargetHF,
      warningThreshold: avgTargetHF - 0.2,
      criticalThreshold: avgCriticalThreshold,
      autoSuggest: true,
      protocols
    };
  };

  const healthFactorStatuses = healthFactorStrategy && getConfig()
    ? monitorHealthFactor(portfolio, getConfig()!, getPositionTargetHFs(), getPositionCriticalThresholds())
    : [];

  // Sortable Strategy Card Component
  const SortableStrategyCard: React.FC<{
    strategy: Strategy;
    portfolio: WalletItem[];
    healthFactorStatuses: any[];
    config: any;
    onEdit: (s: Strategy) => void;
    onDelete: (s: Strategy) => void;
    reorderEnabled: boolean;
  }> = ({ strategy, portfolio, healthFactorStatuses, config, onEdit, onDelete, reorderEnabled }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: strategy.id, disabled: !reorderEnabled });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      display: 'flex',
      gap: '8px',
      alignItems: 'stretch',
    };

    return (
      <div ref={setNodeRef} style={style}>
        {/* Drag Handle - only visible when reorder is enabled */}
        {reorderEnabled && (
          <div
            {...attributes}
            {...listeners}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              cursor: 'grab',
              background: theme.bgInteractive,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              color: theme.textSecondary,
              fontSize: '20px',
              userSelect: 'none',
              flexShrink: 0,
            }}
            title="Drag to reorder"
          >
            ⋮⋮
          </div>
        )}

        {/* Card Content */}
        <div style={{ flex: 1 }}>
          {strategy.strategyType === 1 ? (
            <AllocationStrategyCard
              strategy={strategy as AllocationStrategy}
              portfolio={portfolio}
              onEdit={() => onEdit(strategy)}
              onDelete={() => onDelete(strategy)}
            />
          ) : (
            <HealthFactorCard
              statuses={healthFactorStatuses}
              config={config}
              onEdit={() => onEdit(strategy)}
              onDelete={() => onDelete(strategy)}
              onAddCollateral={(action) => console.log('Add collateral:', action)}
              onRepayDebt={(action) => console.log('Repay debt:', action)}
            />
          )}
        </div>
      </div>
    );
  };

  // Loading state (initial bootstrapping or hooks loading)
  if ((loading || isInitialLoading) && viewMode === 'list') {
    return (
      <div
        style={{
          minHeight: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 400,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              margin: '0 auto 32px',
              border: '6px solid rgba(255,255,255,0.1)',
              borderTop: '6px solid #35f7a5',
              borderRight: '6px solid #2fbfd9',
              borderRadius: '50%',
              animation: 'spin 0.85s linear infinite',
            }}
          />

          <h2
            style={{
              margin: '0 0 12px 0',
              fontSize: 22,
              fontWeight: 600,
              color: theme.textPrimary,
              letterSpacing: '0.5px',
            }}
          >
            Loading your strategies...
          </h2>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: theme.textSecondary,
              lineHeight: 1.5,
            }}
          >
            This may take a few moments while we fetch your strategy data.
          </p>

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: theme.textMuted,
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>

          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Error state - styled similarly to global error screen but scoped to strategies area
  if (error && viewMode === 'list') {
    return (
      <div
        style={{
          minHeight: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: theme.bgPanel,
            borderRadius: 24,
            padding: '32px 28px',
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowHover,
            textAlign: 'center',
          }}
        >
          {/* Error Icon */}
          <div
            style={{
              width: 64,
              height: 64,
              margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(255, 107, 107, 0.25)',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* Title */}
          <h2
            style={{
              margin: '0 0 8px 0',
              fontSize: 22,
              fontWeight: 600,
              color: theme.textPrimary,
              letterSpacing: '0.3px',
            }}
          >
            Error loading strategies
          </h2>

          {/* Description */}
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: 14,
              color: theme.textSecondary,
              lineHeight: 1.5,
            }}
          >
            We encountered a problem while fetching your strategies. You can try again below.
          </p>

          {/* Error details */}
          {error && (
            <div
              style={{
                marginTop: 12,
                marginBottom: 20,
                padding: '10px 12px',
                background: theme.bgSecondary || theme.bgPrimary,
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  margin: '0 0 4px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  color: theme.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                Details
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: theme.textSecondary,
                  fontFamily: 'monospace',
                  wordBreak: 'break-word',
                }}
              >
                {typeof error === 'string' ? error : error?.message || 'Unknown error'}
              </p>
            </div>
          )}

          {/* Retry button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            <button
              onClick={() => {
                loadAllocationStrategy(walletGroupId);
                loadHealthFactorStrategy(walletGroupId);
              }}
              type="button"
              style={{
                padding: '10px 22px',
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                background: 'linear-gradient(135deg, #35f7a5 0%, #2fbfd9 100%)',
                border: 'none',
                borderRadius: 999,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 12px rgba(53, 247, 165, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(53, 247, 165, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(53, 247, 165, 0.3)';
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="allocation-strategy-section">
      {/* List View */}
      {viewMode === 'list' && (
        <>
          <div className="section-header">
            <div>
              <h2 className="section-title">Strategies</h2>
              <p className="section-description">
                {isReorderMode
                  ? 'Drag the handle on the left to reorder your strategies.'
                  : 'Manage allocation targets and health factor monitoring.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={toggleReorderMode}
                type="button"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: 8,
                  color: isReorderMode ? theme.accent : theme.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 16 }}>⋮⋮</span>
                <span>Reorder</span>
              </button>
              <button onClick={handleCreate} className="btn-primary">
                <span>+</span> Create Strategy
              </button>
            </div>
          </div>

          {!strategy && !loading && !isInitialLoading && (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No Strategy Yet</h3>
              <p>Create your first strategy to start optimizing your portfolio.</p>
              <button onClick={handleCreate} className="btn-primary">
                Create Strategy
              </button>
            </div>
          )}

          {allStrategies.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={allStrategies.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="strategies-list">
                  {allStrategies.map((strategy) => (
                    <SortableStrategyCard
                      key={strategy.id}
                      strategy={strategy}
                      portfolio={portfolio}
                      healthFactorStatuses={healthFactorStatuses}
                      config={getConfig() || undefined}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      reorderEnabled={isReorderMode}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      {/* Select Type View */}
      {viewMode === 'select-type' && (
        <>
          <div className="page-header">
            <button onClick={handleCancelCreate} className="btn-back">
              ← Back
            </button>
            <h2 className="page-title">Select Strategy Type</h2>
          </div>

          <div className="strategy-types-grid">
            <div
              className="strategy-type-card"
              onClick={() => handleSelectType(1)}
            >
              <div className="type-icon">📊</div>
              <h3>Allocation by Weight</h3>
              <p>Define target allocation percentages for your assets and get rebalancing recommendations.</p>
              <div className="type-badge">Type 1</div>
            </div>

            <div
              className="strategy-type-card"
              onClick={() => handleSelectType(2)}
            >
              <div className="type-icon">🛡️</div>
              <h3>Health Factor Target</h3>
              <p>Monitor lending health factor and receive alerts when approaching liquidation risk.</p>
              <div className="type-badge">Type 2</div>
            </div>
          </div>
        </>
      )}

      {/* Create/Edit View */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <>
          <div className="page-header">
            <button onClick={handleCancelCreate} className="btn-back">
              ← Back
            </button>
            <h2 className="page-title">
              {viewMode === 'edit' ? 'Edit Strategy' : 'Create Strategy'} 
              {selectedStrategyType === 1 && ' - Allocation by Weight'}
              {selectedStrategyType === 2 && ' - Health Factor Target'}
            </h2>
          </div>

          {selectedStrategyType === 1 && (
            <AllocationStrategyForm
              walletGroupId={walletGroupId}
              portfolio={portfolio}
              initialStrategy={editingStrategy}
              onSave={saveAllocationStrategy}
              onCancel={handleCancelCreate}
              onSuccess={handleSaveSuccess}
              saving={allocationSaving}
              key={editingStrategy?.id || 'new'} // Force remount when editing different strategy
            />
          )}

          {selectedStrategyType === 2 && (
            <HealthFactorStrategyForm
              portfolio={portfolio}
              initialStrategy={editingStrategy}
              onSave={handleSaveHealthFactor}
              onCancel={handleCancelCreate}
              key={editingStrategy?.id || 'new'}
            />
          )}
        </>
      )}

      {/* Detail View */}
      {viewMode === 'detail' && selectedStrategy && (
        <>
          <div className="section-header">
            <button onClick={handleBackToList} className="btn-back">
              ← Back to List
            </button>
            <div className="header-content">
              <div>
                <h2 className="section-title">{selectedStrategy.name || 'Allocation Strategy'}</h2>
                {selectedStrategy.description && (
                  <p className="section-description">{selectedStrategy.description}</p>
                )}
              </div>
              <div className="header-actions">
                <button onClick={() => handleEdit(selectedStrategy)} className="btn-primary">
                  Edit
                </button>
                <button onClick={() => handleDelete(selectedStrategy)} className="btn-danger">
                  Delete
                </button>
              </div>
            </div>
          </div>

          <StrategyAllocationView
            strategy={selectedStrategy}
            portfolio={portfolio}
            onRebalance={(delta) => {
              console.log('Rebalance action:', delta);
              // TODO: Implement rebalance flow
            }}
          />
        </>
      )}

      <style>{`
        .allocation-strategy-section {
          width: 100%;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 16px;
        }

        .page-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .page-title {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .header-content {
          display: flex;
          flex: 1;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .section-title {
          margin: 0 0 4px 0;
          font-size: 24px;
          font-weight: 600;
          color: ${theme.textPrimary};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .section-description {
          margin: 0;
          font-size: 14px;
          color: ${theme.textSecondary};
        }

        .btn-primary,
        .btn-danger,
        .btn-back {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-primary {
          background: ${theme.accent};
          color: white;
        }

        .btn-primary:hover {
          opacity: 0.9;
        }

        .btn-secondary {
          background: ${theme.bgPanel};
          color: ${theme.textPrimary};
          border: 1px solid ${theme.border};
        }

        .btn-secondary:hover {
          background: ${theme.border};
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover {
          background: #dc2626;
        }

        .btn-back {
          background: transparent;
          color: ${theme.textSecondary};
          padding: 8px 12px;
        }

        .btn-back:hover {
          background: ${theme.bgPanel};
          color: ${theme.textPrimary};
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
          background: ${theme.bgPanel};
          border-radius: 12px;
          border: 2px dashed ${theme.border};
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .empty-state p {
          margin: 0 0 24px 0;
          font-size: 14px;
          color: ${theme.textSecondary};
          max-width: 400px;
        }

        .strategies-list {
          display: grid;
          gap: 16px;
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid ${theme.border};
          border-top-color: ${theme.accent};
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .error-container h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .error-container p {
          margin: 0 0 24px 0;
          font-size: 14px;
          color: #ef4444;
        }

        .strategy-types-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          padding: 20px 0;
        }

        .strategy-type-card {
          background: ${theme.bgPanel};
          border: 2px solid ${theme.border};
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .strategy-type-card:hover {
          border-color: ${theme.accent};
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .type-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .strategy-type-card h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .strategy-type-card p {
          margin: 0;
          font-size: 14px;
          color: ${theme.textSecondary};
          line-height: 1.5;
        }

        .type-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          background: ${theme.accent}20;
          color: ${theme.accent};
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default AllocationStrategySection;
