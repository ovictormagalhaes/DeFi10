/**
 * Health Factor Strategy Form
 * Form for creating/editing health factor target strategies
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../../context/ThemeProvider';
import { useChainIcons } from '../../context/ChainIconsProvider';
import type { HealthFactorTargetConfig, Strategy } from '../../types/strategy';
import type { WalletItem } from '../../types/wallet';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LendingPosition {
  id: string;
  protocolId: string;
  protocolName: string;
  protocolLogo: string;
  chain: string;
  chainLogo: string;
  currentHF: number;
  targetHF: number;
  criticalThreshold: number; // Individual critical threshold per position
  collateralValue: number;
  debtValue: number;
  walletItem: WalletItem;
}

interface HealthFactorStrategyFormProps {
  portfolio: WalletItem[];
  initialStrategy?: Strategy | null;
  onSave: (
    config: HealthFactorTargetConfig, 
    name: string, 
    description?: string,
    positionTargetHFs?: Record<string, number>,
    positionCriticalThresholds?: Record<string, number>,
    strategyId?: string
  ) => Promise<void>;
  onCancel: () => void;
}

export const HealthFactorStrategyForm: React.FC<HealthFactorStrategyFormProps> = ({
  portfolio,
  initialStrategy,
  onSave,
  onCancel
}) => {
  const { theme } = useTheme();
  const { getIcon: getChainLogo } = useChainIcons();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Form state
  const [name, setName] = useState('Health Factor Monitor');
  const [description, setDescription] = useState('');
  const [lendingPositions, setLendingPositions] = useState<LendingPosition[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<WalletItem | null>(null);
  const [dialogTargetHF, setDialogTargetHF] = useState(2.0);
  const [dialogCriticalThreshold, setDialogCriticalThreshold] = useState(1.5);
  const [saving, setSaving] = useState(false);

  // Extract available lending positions from portfolio
  const availableLendingPositions = useMemo(() => {
    // Group by protocol + chain to avoid duplicates
    const positionsMap = new Map<string, LendingPosition>();
    
    portfolio
      .filter(item => 
        item.type === 'LendingAndBorrowing' && 
        item.additionalData?.healthFactor != null
      )
      .forEach(item => {
        const protocolId = item.protocol?.id || 'unknown';
        const chain = item.protocol?.chain || 'unknown';
        const positionKey = `${protocolId}-${chain}`;
        
        // Skip if already processed
        if (positionsMap.has(positionKey)) return;
        
        const supplyTokens = item.position?.tokens?.filter(t => 
          !t.symbol?.toLowerCase().includes('debt') && 
          !t.type?.toLowerCase().includes('borrow')
        ) || [];
        
        const borrowTokens = item.position?.tokens?.filter(t => 
          t.symbol?.toLowerCase().includes('debt') || 
          t.type?.toLowerCase().includes('borrow')
        ) || [];
        
        const collateralValue = supplyTokens.reduce((sum, t) => sum + (t.financials?.totalPrice || 0), 0);
        const debtValue = borrowTokens.reduce((sum, t) => sum + (t.financials?.totalPrice || 0), 0);
        
        positionsMap.set(positionKey, {
          id: positionKey,
          protocolId,
          protocolName: item.protocol?.name || 'Unknown',
          protocolLogo: item.protocol?.logo || '',
          chain,
          chainLogo: getChainLogo(chain),
          currentHF: item.additionalData?.healthFactor || 0,
          collateralValue,
          debtValue,
          walletItem: item,
          targetHF: 2.0,
          criticalThreshold: 1.5
        });
      });
    
    return Array.from(positionsMap.values());
  }, [portfolio, getChainLogo]);

  // Auto-adjust dialogCriticalThreshold when dialogTargetHF changes
  useEffect(() => {
    if (dialogCriticalThreshold >= dialogTargetHF) {
      setDialogCriticalThreshold(Math.max(1.1, dialogTargetHF - 0.1));
    }
  }, [dialogTargetHF]);

  // Initialize form from existing strategy
  useEffect(() => {
    if (initialStrategy && initialStrategy.strategyType === 2) {
      setName(initialStrategy.name || 'Health Factor Monitor');
      setDescription(initialStrategy.description || '');
      
      // Check if using new structure (targets) or old structure (items)
      const hasNewStructure = !!(initialStrategy as any).targets;
      
      if (hasNewStructure) {
        // NEW structure: read from targets array
        const targets = (initialStrategy as any).targets || [];
        const loadedPositions: LendingPosition[] = [];
        
        targets.forEach((target: any) => {
          const matchingPosition = availableLendingPositions.find(p => p.id === target.assetKey);
          if (matchingPosition) {
            loadedPositions.push({
              ...matchingPosition,
              targetHF: target.targetHealthFactor || 2.0,
              criticalThreshold: target.criticalThreshold || 1.5
            });
          }
        });
        
        if (loadedPositions.length > 0) {
          setLendingPositions(loadedPositions);
        }
      } else if ((initialStrategy as any).items && (initialStrategy as any).items.length > 0) {
        // OLD structure: read from items array
        // Target HF items have positionLabel = 'Health Factor Target'
        // Critical threshold items have positionLabel = 'Health Factor Critical'

        const targetHFsMap: Record<string, number> = {};
        const criticalThresholdsMap: Record<string, number> = {};
        const positionIds = new Set<string>();

        (initialStrategy as any).items.forEach((item: any) => {
          const posId = item.value;
          if (!posId) return;
          
          positionIds.add(posId);
          
          if (item.metadata?.positionLabel === 'Health Factor Target') {
            // Target HF: note contains targetHF * 100
            targetHFsMap[posId] = (item.note || 200) / 100;
          } else if (item.metadata?.positionLabel === 'Health Factor Critical') {
            // Critical threshold: note contains criticalThreshold * 100
            criticalThresholdsMap[posId] = (item.note || 150) / 100;
          }
        });
        
        const loadedPositions: LendingPosition[] = [];
        
        Array.from(positionIds).forEach((posId: string) => {
          const matchingPosition = availableLendingPositions.find(p => p.id === posId);
          if (matchingPosition) {
            loadedPositions.push({
              ...matchingPosition,
              targetHF: targetHFsMap[posId] || 2.0,
              criticalThreshold: criticalThresholdsMap[posId] || 1.5
            });
          }
        });
        
        if (loadedPositions.length > 0) {
          setLendingPositions(loadedPositions);
        }
      }
    }
  }, [initialStrategy, availableLendingPositions]);

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (lendingPositions.length === 0) {
      errors.push('Add at least one lending position to monitor');
    }

    lendingPositions.forEach((pos, index) => {
      if (pos.targetHF < 1.5) {
        errors.push(`Position ${index + 1}: Target HF must be at least 1.5`);
      }
      if (pos.targetHF > 5.0) {
        errors.push(`Position ${index + 1}: Target HF cannot exceed 5.0`);
      }
      if (pos.criticalThreshold >= pos.targetHF) {
        errors.push(`Position ${index + 1}: Critical Threshold must be below Target HF`);
      }
      if (pos.criticalThreshold < 1.1) {
        errors.push(`Position ${index + 1}: Critical Threshold must be at least 1.1`);
      }
    });

    return { valid: errors.length === 0, errors };
  }, [lendingPositions]);

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!validation.valid) {
      return;
    }

    setSaving(true);
    try {
      // Build config from lending positions
      const avgTargetHF = lendingPositions.reduce((sum, p) => sum + p.targetHF, 0) / lendingPositions.length;
      const avgCriticalThreshold = lendingPositions.reduce((sum, p) => sum + p.criticalThreshold, 0) / lendingPositions.length;
      const positionIds = lendingPositions.map(p => p.id);
      
      // Build position-specific maps
      const positionTargetHFs: Record<string, number> = {};
      const positionCriticalThresholds: Record<string, number> = {};
      lendingPositions.forEach(p => {
        positionTargetHFs[p.id] = p.targetHF;
        positionCriticalThresholds[p.id] = p.criticalThreshold;
      });
      
      const warningThreshold = avgCriticalThreshold + (avgTargetHF - avgCriticalThreshold) * 0.5;

      const config: HealthFactorTargetConfig = {
        targetHealthFactor: avgTargetHF,
        warningThreshold: Math.round(warningThreshold * 100) / 100,
        criticalThreshold: avgCriticalThreshold,
        autoSuggest: true,
        protocols: positionIds
      };

      await onSave(config, name, description, positionTargetHFs, positionCriticalThresholds, initialStrategy?.id);
    } catch (error) {
      console.error('Failed to save strategy:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPosition = (position: LendingPosition) => {
    // Check if already added
    const exists = lendingPositions.some(p => p.id === position.id);
    if (exists) {
      alert('This lending position is already added');
      return;
    }

    setLendingPositions(prev => [...prev, { 
      ...position, 
      targetHF: dialogTargetHF,
      criticalThreshold: dialogCriticalThreshold
    }]);
    setShowPositionDialog(false);
    setSelectedPosition(null);
    setDialogTargetHF(2.0);
    setDialogCriticalThreshold(1.5);
  };

  const handleRemovePosition = (id: string) => {
    setLendingPositions(prev => prev.filter(p => p.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLendingPositions((positions) => {
      const oldIndex = positions.findIndex((p) => p.id === active.id);
      const newIndex = positions.findIndex((p) => p.id === over.id);
      return arrayMove(positions, oldIndex, newIndex);
    });
  };

  const handleUpdateTargetHF = (id: string, targetHF: number) => {
    setLendingPositions(prev => 
      prev.map(p => {
        if (p.id === id) {
          // Ensure critical threshold stays below target HF
          const adjustedCritical = p.criticalThreshold >= targetHF 
            ? Math.max(1.1, targetHF - 0.1)
            : p.criticalThreshold;
          return { ...p, targetHF, criticalThreshold: adjustedCritical };
        }
        return p;
      })
    );
  };

  const handleUpdateCriticalThreshold = (id: string, criticalThreshold: number) => {
    setLendingPositions(prev => 
      prev.map(p => p.id === id ? { ...p, criticalThreshold } : p)
    );
  };

  const SortablePositionCard: React.FC<{
    position: LendingPosition;
    index: number;
  }> = ({ position, index }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: position.id });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      display: 'flex',
      gap: 8,
      alignItems: 'stretch',
    };

    return (
      <div ref={setNodeRef} style={style}>
        {/* Drag handle on the left */}
        <div
          {...attributes}
          {...listeners}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            cursor: 'grab',
            background: theme.bgInteractive,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            color: theme.textSecondary,
            fontSize: 18,
            userSelect: 'none',
            flexShrink: 0,
          }}
          title="Drag to reorder"
        >
          ⋮⋮
        </div>

        {/* Card content */}
        <div
          style={{
            padding: 16,
            background: theme.bgInteractive,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
            flex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {position.protocolLogo && (
                <img src={position.protocolLogo} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
              )}
              {position.chainLogo && (
                <img src={position.chainLogo} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {position.protocolName}
                </div>
                <div style={{ fontSize: 12, color: theme.textSecondary }}>
                  {position.chain} • Current HF: {position.currentHF.toFixed(2)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => handleRemovePosition(position.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: 18,
                }}
                title="Remove position"
              >
                ×
              </button>
            </div>
          </div>

          <div>
            <label className="hf-form-label">Target Health Factor</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                className="hf-slider"
                min="1.5"
                max="5.0"
                step="0.1"
                value={position.targetHF}
                onChange={(e) => handleUpdateTargetHF(position.id, Number(e.target.value))}
              />
              <input
                type="number"
                className="hf-form-input"
                min="1.5"
                max="5.0"
                step="0.1"
                value={position.targetHF}
                onChange={(e) => handleUpdateTargetHF(position.id, Number(e.target.value))}
                style={{ width: 80, textAlign: 'center' }}
              />
            </div>
          </div>

          <div>
            <label className="hf-form-label">Critical Threshold (must be &lt; Target)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                className="hf-slider"
                min="1.1"
                max={position.targetHF - 0.1}
                step="0.1"
                value={position.criticalThreshold}
                onChange={(e) => handleUpdateCriticalThreshold(position.id, Number(e.target.value))}
              />
              <input
                type="number"
                className="hf-form-input"
                min="1.1"
                max={position.targetHF - 0.1}
                step="0.1"
                value={position.criticalThreshold}
                onChange={(e) => handleUpdateCriticalThreshold(position.id, Number(e.target.value))}
                style={{ width: 80, textAlign: 'center' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      maxWidth: '700px', 
      margin: '0 auto',
      color: theme.textPrimary
    }}>
      <style>{`
        .hf-form-section {
          background: ${theme.bgPanel};
          border: 1px solid ${theme.border};
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .hf-form-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: ${theme.textPrimary};
          margin-bottom: 8px;
        }

        .hf-form-input {
          width: 100%;
          padding: 10px 12px;
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 8px;
          color: ${theme.textPrimary};
          font-size: 14px;
          font-family: inherit;
        }

        .hf-form-input:focus {
          outline: none;
          border-color: ${theme.accent};
        }

        .hf-form-textarea {
          width: 100%;
          padding: 10px 12px;
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 8px;
          color: ${theme.textPrimary};
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          min-height: 80px;
        }

        .hf-form-textarea:focus {
          outline: none;
          border-color: ${theme.accent};
        }

        .hf-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: ${theme.bgInteractive};
          outline: none;
          -webkit-appearance: none;
        }

        .hf-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .hf-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .hf-slider::-moz-range-progress {
          background: ${theme.accent};
          height: 6px;
          border-radius: 3px;
        }

        .hf-checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hf-checkbox-item:hover {
          border-color: ${theme.accent};
          background: ${theme.bgInteractiveHover};
        }

        .hf-checkbox-item.selected {
          border-color: ${theme.accent};
          background: ${theme.accent}15;
        }

        .hf-checkbox {
          width: 18px;
          height: 18px;
          border: 2px solid ${theme.border};
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${theme.bgPanel};
        }

        .hf-checkbox.checked {
          background: ${theme.accent};
          border-color: ${theme.accent};
        }

        .btn-primary {
          background: ${theme.accent};
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-flat {
          background: transparent;
          color: ${theme.textSecondary};
          border: 1px solid ${theme.border};
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-flat:hover {
          border-color: ${theme.accent};
          color: ${theme.accent};
        }
      `}</style>

      {/* Strategy Details */}
      <div className="hf-form-section">
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
          Strategy Details
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label className="hf-form-label">Name</label>
          <input
            type="text"
            className="hf-form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Health Factor Monitor"
          />
        </div>

        <div>
          <label className="hf-form-label">Description (Optional)</label>
          <textarea
            className="hf-form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Monitor health factor and receive alerts..."
          />
        </div>
      </div>

      {/* Lending Positions */}
      <div className="hf-form-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
            Lending Positions
          </h3>
          <button
            onClick={() => setShowPositionDialog(true)}
            className="btn-primary"
            type="button"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            disabled={availableLendingPositions.length === 0}
          >
            + Add Position
          </button>
        </div>

        {availableLendingPositions.length === 0 && (
          <div style={{
            padding: '16px',
            background: '#fbbf2410',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            fontSize: '13px',
            color: theme.textSecondary,
            textAlign: 'center'
          }}>
            No lending positions found in your portfolio
          </div>
        )}

        {lendingPositions.length === 0 && availableLendingPositions.length > 0 && (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: theme.textSecondary,
            fontSize: '14px'
          }}>
            No positions added yet. Click "+ Add Position" to start.
          </div>
        )}

        {lendingPositions.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={lendingPositions.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {lendingPositions.map((position, index) => (
                  <SortablePositionCard
                    key={position.id}
                    position={position}
                    index={index}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Position Dialog */}
      {showPositionDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowPositionDialog(false)}
        >
          <div
            style={{
              background: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                Add Lending Position
              </h3>
              <button
                onClick={() => setShowPositionDialog(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '24px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="hf-form-label">Select Position</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableLendingPositions
                  .filter(pos => !lendingPositions.some(p => p.id === pos.id))
                  .map(position => (
                    <div
                      key={position.id}
                      style={{
                        padding: '12px',
                        background: selectedPosition === position.walletItem ? theme.bgInteractiveHover : theme.bgInteractive,
                        border: `1px solid ${selectedPosition === position.walletItem ? theme.accent : theme.border}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                      onClick={() => setSelectedPosition(position.walletItem)}
                    >
                      {position.protocolLogo && (
                        <img src={position.protocolLogo} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                      )}
                      {position.chainLogo && (
                        <img src={position.chainLogo} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                          {position.protocolName}
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                          {position.chain} • HF: {position.currentHF.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {selectedPosition && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label className="hf-form-label">Target Health Factor</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      className="hf-slider"
                      min="1.5"
                      max="5.0"
                      step="0.1"
                      value={dialogTargetHF}
                      onChange={(e) => setDialogTargetHF(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      className="hf-form-input"
                      min="1.5"
                      max="5.0"
                      step="0.1"
                      value={dialogTargetHF}
                      onChange={(e) => setDialogTargetHF(Number(e.target.value))}
                      style={{ width: '80px', textAlign: 'center' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className="hf-form-label">Critical Threshold (Alert Level)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      className="hf-slider"
                      min="1.1"
                      max={dialogTargetHF - 0.1}
                      step="0.1"
                      value={dialogCriticalThreshold}
                      onChange={(e) => setDialogCriticalThreshold(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      className="hf-form-input"
                      min="1.1"
                      max={dialogTargetHF - 0.1}
                      step="0.1"
                      value={dialogCriticalThreshold}
                      onChange={(e) => setDialogCriticalThreshold(Number(e.target.value))}
                      style={{ width: '80px', textAlign: 'center' }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                    Must be below Target HF. You'll be alerted when HF drops below this value.
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPositionDialog(false)}
                className="btn-flat"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedPosition) {
                    const position = availableLendingPositions.find(p => p.walletItem === selectedPosition);
                    if (position) {
                      handleAddPosition(position);
                    }
                  }
                }}
                className="btn-primary"
                disabled={!selectedPosition}
              >
                Add Position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {submitted && !validation.valid && (
        <div className="hf-form-section" style={{
          background: '#dc262610',
          borderColor: '#dc2626'
        }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 600,
            color: '#dc2626',
            marginBottom: '8px'
          }}>
            ⚠️ Validation Errors
          </div>
          <ul style={{ 
            margin: 0, 
            paddingLeft: '20px',
            fontSize: '13px',
            color: theme.textSecondary
          }}>
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        justifyContent: 'flex-end',
        marginTop: '20px'
      }}>
        <button 
          onClick={onCancel} 
          className="btn-flat"
          disabled={saving}
        >
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
    </div>
  );
};
