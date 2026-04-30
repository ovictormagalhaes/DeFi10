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
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { useAllocationStrategy } from '../../../hooks/strategies/useAllocationStrategy';
import { useHealthFactorStrategy } from '../../../hooks/useHealthFactorStrategy';
import { clearStrategyCache, loadStrategyWithCache } from '../../../hooks/useSharedStrategyCache';
import { getStrategyByGroup, saveStrategies } from '../../../services/apiClient';
import type {
  Strategy,
  HealthFactorTargetConfig,
  AllocationStrategy,
  HealthFactorStrategy,
  BestPurchaseWindowStrategy,
} from '../../../types/strategy';
import type { WalletItem } from '../../../types/wallet';
import { AllocationStrategyCard } from './AllocationStrategyCard';
import { BestPurchaseWindowCard } from './BestPurchaseWindowCard';
import { HealthFactorCard } from './HealthFactorCard';
import { PortfolioMixCard } from './PortfolioMixCard';
import { AllocationStrategyForm } from '../../../components/strategies/AllocationStrategyForm';
import { BestPurchaseWindowStrategyForm } from '../../../components/strategies/BestPurchaseWindowStrategyForm';
import { HealthFactorStrategyForm } from '../../../components/strategies/HealthFactorStrategyForm';
import ErrorScreen from '../shared/ErrorScreen';

import s from './AllocationStrategySection.module.css';

const SEGMENT_GROUP_TYPES = new Set([11, 21, 31, 41]);

function isPortfolioMixStrategy(s: Strategy): s is AllocationStrategy {
  if (s.strategyType !== 1) return false;
  const allocs = (s as AllocationStrategy).allocations;
  return Array.isArray(allocs) && allocs.length > 0 && allocs.every(a => SEGMENT_GROUP_TYPES.has(a.groupType));
}

const SECTION_TITLES: Record<number, string> = {
  1: 'Allocation Strategies',
  2: 'Health Factor Strategies',
  8: 'Purchase Window Strategies',
};

const EMPTY_STATES: Record<number, { icon: string; title: string; sub: string }> = {
  1: { icon: '⚖️', title: 'No allocation strategies yet', sub: 'Define target weights for your assets and get rebalancing recommendations.' },
  2: { icon: '🛡️', title: 'No health factor strategies yet', sub: 'Monitor lending positions and get alerts when approaching liquidation risk.' },
  8: { icon: '📈', title: 'No purchase windows yet', sub: 'Monitor token prices and get notified when entry conditions are met.' },
};

interface Props {
  walletGroupId: string;
  portfolio: WalletItem[];
  activeType: number;
  onCountsChange?: (counts: Record<number, number>) => void;
}

type ViewMode = 'list' | 'create' | 'edit';

export const AllocationStrategySection: React.FC<Props> = ({
  walletGroupId,
  portfolio,
  activeType,
  onCountsChange,
}) => {
  const {
    strategy: allocationStrategy,
    loading: allocationLoading,
    error: allocationError,
    saving: allocationSaving,
    loadStrategy: loadAllocationStrategy,
    saveAllocationStrategy,
    clearStrategy: clearAllocationStrategy,
  } = useAllocationStrategy();

  const {
    loading: healthFactorLoading,
    saving: healthFactorSaving,
    error: healthFactorError,
    loadStrategy: loadHealthFactorStrategy,
    saveHealthFactorStrategy,
    monitorHealthFactor,
  } = useHealthFactorStrategy();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [allStrategies, setAllStrategies] = useState<Strategy[]>([]);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadedGroupRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const visibleStrategies = useMemo(
    () => allStrategies.filter(s => s.strategyType === activeType),
    [allStrategies, activeType]
  );

  const healthFactorStrategy = useMemo(
    () => allStrategies.find(s => s.strategyType === 2),
    [allStrategies]
  );

  const loading = allocationLoading || healthFactorLoading;
  const error = loadError || allocationError || healthFactorError;

  const reloadStrategies = useCallback(async () => {
    if (!walletGroupId) return;
    setIsInitialLoading(true);
    setLoadError(null);
    clearStrategyCache(walletGroupId);
    try {
      const cached = await loadStrategyWithCache(walletGroupId);
      setAllStrategies((cached?.strategies || []) as Strategy[]);
      loadAllocationStrategy(walletGroupId);
      loadHealthFactorStrategy(walletGroupId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load strategies');
    } finally {
      setIsInitialLoading(false);
    }
  }, [walletGroupId, loadAllocationStrategy, loadHealthFactorStrategy]);

  useEffect(() => {
    if (walletGroupId && loadedGroupRef.current !== walletGroupId) {
      loadedGroupRef.current = walletGroupId;
      reloadStrategies();
    }
  }, [walletGroupId, reloadStrategies]);

  useEffect(() => {
    if (!onCountsChange) return;
    const counts: Record<number, number> = {};
    allStrategies.forEach(s => {
      counts[s.strategyType] = (counts[s.strategyType] || 0) + 1;
    });
    onCountsChange(counts);
  }, [allStrategies, onCountsChange]);

  useEffect(() => {
    setViewMode('list');
    setEditingStrategy(null);
    setIsReorderMode(false);
  }, [activeType]);

  const handleCreate = () => setViewMode('create');
  const handleEdit = (s: Strategy) => { setEditingStrategy(s); setViewMode('edit'); };
  const handleCancel = () => { setEditingStrategy(null); setViewMode('list'); };

  const handleSaveSuccess = () => {
    setEditingStrategy(null);
    setViewMode('list');
    (async () => {
      clearStrategyCache(walletGroupId);
      const data = await loadStrategyWithCache(walletGroupId);
      setAllStrategies((data?.strategies || []) as Strategy[]);
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

  const handleDelete = async (strategyToDelete: Strategy) => {
    if (!confirm('Are you sure you want to delete this strategy?')) return;
    try {
      const existing = await getStrategyByGroup(walletGroupId);
      const remaining = (existing?.strategies || []).filter((s: any) => s.id !== strategyToDelete.id);
      await saveStrategies({
        walletGroupId,
        strategies: remaining.map((s: any) => {
          const p: any = { id: s.id, strategyType: s.strategyType, name: s.name, description: s.description };
          if (s.strategyType === 1) p.allocations = s.allocations || [];
          else if (s.strategyType === 2) p.targets = s.targets || [];
          else if (s.strategyType === 8) p.purchaseWindowEntries = s.purchaseWindowEntries || [];
          return p;
        }),
      });
      clearStrategyCache(walletGroupId);
      if (strategyToDelete.strategyType === 1) clearAllocationStrategy();
      loadAllocationStrategy(walletGroupId);
      loadHealthFactorStrategy(walletGroupId);
      const data = await loadStrategyWithCache(walletGroupId);
      setAllStrategies((data?.strategies || []) as Strategy[]);
      setViewMode('list');
    } catch {
      alert('Failed to delete strategy. Please try again.');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = allStrategies.findIndex(s => s.id === active.id);
      const newIdx = allStrategies.findIndex(s => s.id === over.id);
      const reordered = arrayMove(allStrategies, oldIdx, newIdx);
      setAllStrategies(reordered);
      saveOrder(reordered);
    }
  };

  const saveOrder = async (strategies: Strategy[]) => {
    try {
      await saveStrategies({
        walletGroupId,
        strategies: strategies.map((s, i) => {
          const p: any = { id: s.id, strategyType: s.strategyType, name: s.name, description: s.description, displayOrder: i };
          if (s.strategyType === 1) p.allocations = (s as AllocationStrategy).allocations?.map((a: any, j: number) => ({ ...a, displayOrder: a.displayOrder ?? j })) || [];
          else if (s.strategyType === 2) p.targets = (s as HealthFactorStrategy).targets?.map((t: any, j: number) => ({ ...t, displayOrder: t.displayOrder ?? j })) || [];
          else if (s.strategyType === 8) p.purchaseWindowEntries = (s as BestPurchaseWindowStrategy).purchaseWindowEntries || [];
          // portfolio mix is type 1; allocations already handled above
          return p;
        }),
      });
      clearStrategyCache(walletGroupId);
    } catch {
      alert('Failed to save order. Please try again.');
    }
  };

  const getConfig = (): HealthFactorTargetConfig | null => {
    if (!healthFactorStrategy) return null;
    const hf = healthFactorStrategy as HealthFactorStrategy;
    if (!hf.targets?.length) return null;
    const targets = [...hf.targets].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
    const protocols = targets.map(t => t.assetKey).filter(Boolean) as string[];
    const avgTarget = targets.reduce((sum, t) => sum + (t.targetHealthFactor || 2.0), 0) / targets.length;
    const avgCritical = targets.reduce((sum, t) => sum + (t.criticalThreshold || 1.5), 0) / targets.length;
    return { targetHealthFactor: avgTarget, warningThreshold: avgTarget - 0.2, criticalThreshold: avgCritical, autoSuggest: true, protocols };
  };

  const getPositionTargetHFs = (): Record<string, number> | undefined => {
    const hf = healthFactorStrategy as HealthFactorStrategy | undefined;
    if (!hf?.targets?.length) return undefined;
    const map: Record<string, number> = {};
    hf.targets.forEach(t => { if (t.assetKey && t.targetHealthFactor != null) map[t.assetKey] = t.targetHealthFactor; });
    return Object.keys(map).length ? map : undefined;
  };

  const getPositionCriticalThresholds = (): Record<string, number> | undefined => {
    const hf = healthFactorStrategy as HealthFactorStrategy | undefined;
    if (!hf?.targets?.length) return undefined;
    const map: Record<string, number> = {};
    hf.targets.forEach(t => { if (t.assetKey && t.criticalThreshold != null) map[t.assetKey] = t.criticalThreshold; });
    return Object.keys(map).length ? map : undefined;
  };

  const config = getConfig();
  const healthFactorStatuses = healthFactorStrategy && config
    ? monitorHealthFactor(portfolio, config, getPositionTargetHFs(), getPositionCriticalThresholds())
    : [];

  if ((loading || isInitialLoading) && viewMode === 'list') {
    return (
      <div className={s.loadingWrap}>
        <div className={s.loadingCard}>
          <div className={s.spinner} />
          <span className={s.loadingText}>Loading strategies…</span>
        </div>
      </div>
    );
  }

  if (error && viewMode === 'list') {
    return (
      <ErrorScreen
        error={error}
        onRetry={() => {
          loadedGroupRef.current = null;
          reloadStrategies();
        }}
      />
    );
  }

  const emptyState = EMPTY_STATES[activeType];

  return (
    <div className={s.root}>
      {viewMode === 'list' && (
        <>
          <div className={s.listHeader}>
            <div>
              <div className={s.listTitle}>{SECTION_TITLES[activeType]}</div>
              <div className={s.listSub}>
                {isReorderMode
                  ? 'Drag to reorder your strategies.'
                  : `${visibleStrategies.length} ${visibleStrategies.length === 1 ? 'strategy' : 'strategies'}`}
              </div>
            </div>
            <div className={s.listActions}>
              {visibleStrategies.length > 1 && (
                <button
                  className={`${s.btnGhost} ${isReorderMode ? s.btnGhostOn : ''}`}
                  onClick={() => setIsReorderMode(v => !v)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="5" cy="4" r="1.2" fill="currentColor"/>
                    <circle cx="5" cy="8" r="1.2" fill="currentColor"/>
                    <circle cx="5" cy="12" r="1.2" fill="currentColor"/>
                    <circle cx="11" cy="4" r="1.2" fill="currentColor"/>
                    <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
                    <circle cx="11" cy="12" r="1.2" fill="currentColor"/>
                  </svg>
                  Reorder
                </button>
              )}
              <button className={s.btnPrimary} onClick={handleCreate}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                New Strategy
              </button>
            </div>
          </div>

          {visibleStrategies.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}>{emptyState.icon}</div>
              <div className={s.emptyTitle}>{emptyState.title}</div>
              <div className={s.emptySub}>{emptyState.sub}</div>
              <button className={s.btnPrimary} onClick={handleCreate}>Create Strategy</button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleStrategies.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className={s.list}>
                  {visibleStrategies.map(strat => (
                    <SortableCard
                      key={strat.id}
                      strategy={strat}
                      portfolio={portfolio}
                      healthFactorStatuses={healthFactorStatuses}
                      config={config || undefined}
                      reorderEnabled={isReorderMode}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <>
          <div className={s.subHeader}>
            <button className={s.btnBack} onClick={handleCancel}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
            <div className={s.subTitle}>
              {viewMode === 'edit' ? 'Edit' : 'New'} · {SECTION_TITLES[activeType]?.replace(' Strategies', '')}
            </div>
          </div>

          {activeType === 1 && (
            <AllocationStrategyForm
              key={editingStrategy?.id || 'new'}
              walletGroupId={walletGroupId}
              portfolio={portfolio}
              initialStrategy={editingStrategy}
              onSave={saveAllocationStrategy}
              onCancel={handleCancel}
              onSuccess={handleSaveSuccess}
              saving={allocationSaving}
            />
          )}
          {activeType === 2 && (
            <HealthFactorStrategyForm
              key={editingStrategy?.id || 'new'}
              portfolio={portfolio}
              initialStrategy={editingStrategy}
              onSave={handleSaveHealthFactor}
              onCancel={handleCancel}
            />
          )}
          {activeType === 8 && (
            <BestPurchaseWindowStrategyForm
              key={editingStrategy?.id || 'new'}
              walletGroupId={walletGroupId}
              portfolio={portfolio}
              initialStrategy={editingStrategy?.strategyType === 8 ? (editingStrategy as BestPurchaseWindowStrategy) : undefined}
              onCancel={handleCancel}
              onSuccess={handleSaveSuccess}
            />
          )}
        </>
      )}

    </div>
  );
};

const SortableCard: React.FC<{
  strategy: Strategy;
  portfolio: WalletItem[];
  healthFactorStatuses: any[];
  config: any;
  reorderEnabled: boolean;
  onEdit: (s: Strategy) => void;
  onDelete: (s: Strategy) => void;
}> = ({ strategy, portfolio, healthFactorStatuses, config, reorderEnabled, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: strategy.id,
    disabled: !reorderEnabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={s.sortableRow}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      {reorderEnabled && (
        <div className={s.dragHandle} {...attributes} {...listeners} title="Drag to reorder">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="4" r="1.2" fill="currentColor"/>
            <circle cx="5" cy="8" r="1.2" fill="currentColor"/>
            <circle cx="5" cy="12" r="1.2" fill="currentColor"/>
            <circle cx="11" cy="4" r="1.2" fill="currentColor"/>
            <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
            <circle cx="11" cy="12" r="1.2" fill="currentColor"/>
          </svg>
        </div>
      )}
      <div className={s.sortableCardContent}>
        {strategy.strategyType === 1 && (
          isPortfolioMixStrategy(strategy) ? (
            <PortfolioMixCard
              strategy={strategy as AllocationStrategy}
              portfolio={portfolio}
              onEdit={() => onEdit(strategy)}
              onDelete={() => onDelete(strategy)}
            />
          ) : (
            <AllocationStrategyCard
              strategy={strategy as AllocationStrategy}
              portfolio={portfolio}
              onEdit={() => onEdit(strategy)}
              onDelete={() => onDelete(strategy)}
            />
          )
        )}
        {strategy.strategyType === 8 && (
          <BestPurchaseWindowCard
            strategy={strategy as BestPurchaseWindowStrategy}
            onEdit={() => onEdit(strategy)}
            onDelete={() => onDelete(strategy)}
          />
        )}
        {strategy.strategyType === 2 && (
          <HealthFactorCard
            statuses={healthFactorStatuses}
            config={config}
            onEdit={() => onEdit(strategy)}
            onDelete={() => onDelete(strategy)}
            onAddCollateral={() => {}}
            onRepayDebt={() => {}}
          />
        )}
      </div>
    </div>
  );
};

export default AllocationStrategySection;
