/**
 * Health Factor Strategy Form
 * Form for creating/editing health factor target strategies
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useState, useMemo, useEffect } from 'react';

import { useChainIcons } from '../../context/ChainIconsProvider';
import { useTheme } from '../../context/ThemeProvider';
import { getProtocolConfig } from '../../constants/protocols';
import type { HealthFactorTargetConfig, Strategy } from '../../types/strategy';
import type { WalletItem } from '../../types/wallet';

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

interface SortablePositionCardProps {
  position: LendingPosition;
  onRemove: (id: string) => void;
  onUpdateTargetHF: (id: string, value: number) => void;
  onUpdateCriticalThreshold: (id: string, value: number) => void;
}

const SortablePositionCard: React.FC<SortablePositionCardProps> = ({
  position,
  onRemove,
  onUpdateTargetHF,
  onUpdateCriticalThreshold,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: position.id,
  });

  return (
    <div
      ref={setNodeRef}
      className="hf-pos-row"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div {...attributes} {...listeners} className="hf-pos-drag" title="Drag to reorder">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
          <circle cx="3" cy="3" r="1.5" fill="currentColor" />
          <circle cx="9" cy="3" r="1.5" fill="currentColor" />
          <circle cx="3" cy="8" r="1.5" fill="currentColor" />
          <circle cx="9" cy="8" r="1.5" fill="currentColor" />
          <circle cx="3" cy="13" r="1.5" fill="currentColor" />
          <circle cx="9" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </div>

      <div className="hf-pos-identity">
        {position.protocolLogo && (
          <img src={position.protocolLogo} alt="" className="hf-pos-logo" />
        )}
        <div className="hf-pos-meta">
          <span className="hf-pos-name">{position.protocolName}</span>
          <div className="hf-pos-badges">
            {position.chainLogo && (
              <img src={position.chainLogo} alt="" className="hf-pos-chain-logo" />
            )}
            <span className="hf-pos-badge hf-pos-badge-chain">
              {position.chain.charAt(0).toUpperCase() + position.chain.slice(1)}
            </span>
            <span className="hf-pos-hf-chip">HF {position.currentHF.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="hf-pos-controls">
        <div className="hf-pos-ctrl-row">
          <span className="hf-pos-ctrl-label">Target</span>
          <input
            type="range"
            className="hf-pos-slider"
            min="1.5"
            max="5.0"
            step="0.1"
            value={position.targetHF}
            onChange={(e) => onUpdateTargetHF(position.id, Number(e.target.value))}
          />
          <input
            type="number"
            className="hf-pos-num"
            min="1.5"
            max="5.0"
            step="0.1"
            value={position.targetHF}
            onChange={(e) => onUpdateTargetHF(position.id, Number(e.target.value))}
          />
        </div>
        <div className="hf-pos-ctrl-row">
          <span className="hf-pos-ctrl-label hf-pos-ctrl-label-critical">Critical</span>
          <input
            type="range"
            className="hf-pos-slider hf-pos-slider-critical"
            min="1.1"
            max={position.targetHF - 0.1}
            step="0.1"
            value={position.criticalThreshold}
            onChange={(e) => onUpdateCriticalThreshold(position.id, Number(e.target.value))}
          />
          <input
            type="number"
            className="hf-pos-num hf-pos-num-critical"
            min="1.1"
            max={position.targetHF - 0.1}
            step="0.1"
            value={position.criticalThreshold}
            onChange={(e) => onUpdateCriticalThreshold(position.id, Number(e.target.value))}
          />
        </div>
      </div>

      <button onClick={() => onRemove(position.id)} className="hf-pos-remove" title="Remove">
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

export const HealthFactorStrategyForm: React.FC<HealthFactorStrategyFormProps> = ({
  portfolio,
  initialStrategy,
  onSave,
  onCancel,
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
      .filter(
        (item) => item.type === 'LendingAndBorrowing' && item.additionalData?.healthFactor != null
      )
      .forEach((item) => {
        const protocolId = item.protocol?.id || 'unknown';
        const chain = item.protocol?.chain || 'unknown';
        const positionKey = `${protocolId}-${chain}`;

        // Skip if already processed
        if (positionsMap.has(positionKey)) return;

        const supplyTokens =
          item.position?.tokens?.filter(
            (t) =>
              !t.symbol?.toLowerCase().includes('debt') && !t.type?.toLowerCase().includes('borrow')
          ) || [];

        const borrowTokens =
          item.position?.tokens?.filter(
            (t) =>
              t.symbol?.toLowerCase().includes('debt') || t.type?.toLowerCase().includes('borrow')
          ) || [];

        const collateralValue = supplyTokens.reduce(
          (sum, t) => sum + (t.financials?.totalPrice || 0),
          0
        );
        const debtValue = borrowTokens.reduce((sum, t) => sum + (t.financials?.totalPrice || 0), 0);

        positionsMap.set(positionKey, {
          id: positionKey,
          protocolId,
          protocolName: item.protocol?.name || 'Unknown',
          protocolLogo:
            getProtocolConfig(item.protocol?.id || item.protocol?.name || '').logo ||
            item.protocol?.logo ||
            '',
          chain,
          chainLogo: getChainLogo(chain),
          currentHF: item.additionalData?.healthFactor || 0,
          collateralValue,
          debtValue,
          walletItem: item,
          targetHF: 2.0,
          criticalThreshold: 1.5,
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
          const matchingPosition = availableLendingPositions.find((p) => p.id === target.assetKey);
          if (matchingPosition) {
            loadedPositions.push({
              ...matchingPosition,
              targetHF: target.targetHealthFactor || 2.0,
              criticalThreshold: target.criticalThreshold || 1.5,
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
          const matchingPosition = availableLendingPositions.find((p) => p.id === posId);
          if (matchingPosition) {
            loadedPositions.push({
              ...matchingPosition,
              targetHF: targetHFsMap[posId] || 2.0,
              criticalThreshold: criticalThresholdsMap[posId] || 1.5,
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
      const avgTargetHF =
        lendingPositions.reduce((sum, p) => sum + p.targetHF, 0) / lendingPositions.length;
      const avgCriticalThreshold =
        lendingPositions.reduce((sum, p) => sum + p.criticalThreshold, 0) / lendingPositions.length;
      const positionIds = lendingPositions.map((p) => p.id);

      // Build position-specific maps
      const positionTargetHFs: Record<string, number> = {};
      const positionCriticalThresholds: Record<string, number> = {};
      lendingPositions.forEach((p) => {
        positionTargetHFs[p.id] = p.targetHF;
        positionCriticalThresholds[p.id] = p.criticalThreshold;
      });

      const warningThreshold = avgCriticalThreshold + (avgTargetHF - avgCriticalThreshold) * 0.5;

      const config: HealthFactorTargetConfig = {
        targetHealthFactor: avgTargetHF,
        warningThreshold: Math.round(warningThreshold * 100) / 100,
        criticalThreshold: avgCriticalThreshold,
        autoSuggest: true,
        protocols: positionIds,
      };

      await onSave(
        config,
        name,
        description,
        positionTargetHFs,
        positionCriticalThresholds,
        initialStrategy?.id
      );
    } catch (error) {
      console.error('Failed to save strategy:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPosition = (position: LendingPosition) => {
    // Check if already added
    const exists = lendingPositions.some((p) => p.id === position.id);
    if (exists) {
      alert('This lending position is already added');
      return;
    }

    setLendingPositions((prev) => [
      ...prev,
      {
        ...position,
        targetHF: dialogTargetHF,
        criticalThreshold: dialogCriticalThreshold,
      },
    ]);
    setShowPositionDialog(false);
    setSelectedPosition(null);
    setDialogTargetHF(2.0);
    setDialogCriticalThreshold(1.5);
  };

  const handleRemovePosition = (id: string) => {
    setLendingPositions((prev) => prev.filter((p) => p.id !== id));
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
    setLendingPositions((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          // Ensure critical threshold stays below target HF
          const adjustedCritical =
            p.criticalThreshold >= targetHF ? Math.max(1.1, targetHF - 0.1) : p.criticalThreshold;
          return { ...p, targetHF, criticalThreshold: adjustedCritical };
        }
        return p;
      })
    );
  };

  const handleUpdateCriticalThreshold = (id: string, criticalThreshold: number) => {
    setLendingPositions((prev) => prev.map((p) => (p.id === id ? { ...p, criticalThreshold } : p)));
  };

  return (
    <div
      style={{
        color: theme.textPrimary,
      }}
    >
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

        .hf-slider-critical::-webkit-slider-thumb {
          background: ${theme.danger};
        }

        .hf-slider-critical::-moz-range-thumb {
          background: ${theme.danger};
        }

        .hf-slider-critical::-moz-range-progress {
          background: ${theme.danger};
        }

        .hf-input-critical {
          color: ${theme.danger};
        }

        .hf-input-critical:focus {
          border-color: ${theme.danger};
        }

        .hf-label-critical {
          color: ${theme.danger};
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

        .hf-pos-list {
          display: flex;
          flex-direction: column;
          border: 1px solid ${theme.border};
          border-radius: 10px;
          overflow: hidden;
          margin-top: 4px;
        }

        .hf-pos-row {
          display: grid;
          grid-template-columns: 20px 1fr 300px 28px;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: ${theme.bgPanel};
          border-bottom: 1px solid ${theme.border};
          transition: background 0.15s;
        }

        .hf-pos-row:last-child {
          border-bottom: none;
        }

        .hf-pos-row:hover {
          background: ${theme.bgSecondary};
        }

        .hf-pos-drag {
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${theme.textSecondary};
          cursor: grab;
          opacity: 0.4;
          transition: opacity 0.15s;
          user-select: none;
        }

        .hf-pos-drag:hover { opacity: 1; }

        .hf-pos-identity {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .hf-pos-logo {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .hf-pos-meta {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .hf-pos-name {
          font-size: 14px;
          font-weight: 600;
          color: ${theme.textPrimary};
        }

        .hf-pos-badges {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }

        .hf-pos-chain-logo {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          object-fit: cover;
        }

        .hf-pos-badge {
          font-size: 11px;
          color: ${theme.textSecondary};
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 4px;
          padding: 1px 5px;
          white-space: nowrap;
        }

        .hf-pos-badge-chain {
          color: ${theme.textSecondary};
          border-color: ${theme.border};
          background: ${theme.bgInteractive};
        }

        .hf-pos-hf-chip {
          font-size: 11px;
          font-weight: 600;
          color: ${theme.textSecondary};
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 4px;
          padding: 1px 5px;
          white-space: nowrap;
        }

        .hf-pos-controls {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hf-pos-ctrl-row {
          display: grid;
          grid-template-columns: 52px 1fr 52px;
          align-items: center;
          gap: 8px;
        }

        .hf-pos-ctrl-label {
          font-size: 11px;
          font-weight: 600;
          color: ${theme.accent};
          white-space: nowrap;
        }

        .hf-pos-ctrl-label-critical {
          color: ${theme.danger};
        }

        .hf-pos-slider {
          height: 4px;
          border-radius: 2px;
          background: ${theme.bgInteractive};
          outline: none;
          -webkit-appearance: none;
          cursor: pointer;
          width: 100%;
        }

        .hf-pos-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 2px solid ${theme.bgPanel};
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }

        .hf-pos-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${theme.accent};
          cursor: pointer;
          border: 2px solid ${theme.bgPanel};
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }

        .hf-pos-slider-critical::-webkit-slider-thumb {
          background: ${theme.danger};
        }

        .hf-pos-slider-critical::-moz-range-thumb {
          background: ${theme.danger};
        }

        .hf-pos-num {
          width: 100%;
          height: 28px;
          font-size: 13px;
          font-weight: 600;
          color: ${theme.accent};
          background: ${theme.bgInteractive};
          border: 1px solid ${theme.border};
          border-radius: 6px;
          text-align: center;
          padding: 0 4px;
          transition: border-color 0.15s;
        }

        .hf-pos-num:focus {
          outline: none;
          border-color: ${theme.accent};
        }

        .hf-pos-num::-webkit-inner-spin-button,
        .hf-pos-num::-webkit-outer-spin-button {
          -webkit-appearance: none;
        }

        .hf-pos-num-critical {
          color: ${theme.danger};
        }

        .hf-pos-num-critical:focus {
          border-color: ${theme.danger};
        }

        .hf-pos-remove {
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

        .hf-pos-remove:hover {
          background: ${theme.danger}22;
          color: ${theme.danger};
          opacity: 1;
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Lending Positions</h3>
          <button
            onClick={() => setShowPositionDialog(true)}
            className="btn-primary"
            type="button"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            disabled={availableLendingPositions.every((p) =>
              lendingPositions.some((lp) => lp.id === p.id)
            )}
          >
            + Add Position
          </button>
        </div>

        {availableLendingPositions.length === 0 && (
          <div
            style={{
              padding: '16px',
              background: `${theme.warning}1f`,
              border: `1px solid ${theme.warning}`,
              borderRadius: '8px',
              fontSize: '13px',
              color: theme.textSecondary,
              textAlign: 'center',
            }}
          >
            No lending positions found in your portfolio
          </div>
        )}

        {lendingPositions.length === 0 && availableLendingPositions.length > 0 && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.textSecondary,
              fontSize: '14px',
            }}
          >
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
              <div className="hf-pos-list">
                {lendingPositions.map((position) => (
                  <SortablePositionCard
                    key={position.id}
                    position={position}
                    onRemove={handleRemovePosition}
                    onUpdateTargetHF={handleUpdateTargetHF}
                    onUpdateCriticalThreshold={handleUpdateCriticalThreshold}
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
            zIndex: 1000,
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
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Add Lending Position</h3>
              <button
                onClick={() => setShowPositionDialog(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '24px',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="hf-form-label">Select Position</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableLendingPositions
                  .filter((pos) => !lendingPositions.some((p) => p.id === pos.id))
                  .map((position) => (
                    <div
                      key={position.id}
                      style={{
                        padding: '10px 14px',
                        background:
                          selectedPosition === position.walletItem
                            ? `${theme.accent}15`
                            : theme.bgPanel,
                        border: `1px solid ${selectedPosition === position.walletItem ? theme.accent : theme.border}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                      onClick={() => setSelectedPosition(position.walletItem)}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: theme.bgInteractive,
                          border: `1px solid ${theme.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {position.protocolLogo && (
                          <img
                            src={position.protocolLogo}
                            alt=""
                            style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                          />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ fontWeight: 600, fontSize: '14px', color: theme.textPrimary }}
                        >
                          {position.protocolName}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '3px',
                          }}
                        >
                          {position.chainLogo && (
                            <img
                              src={position.chainLogo}
                              alt=""
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span style={{ fontSize: '11px', color: theme.textSecondary }}>
                            {position.chain.charAt(0).toUpperCase() + position.chain.slice(1)}
                          </span>
                          <span
                            style={{ fontSize: '11px', color: theme.textSecondary, opacity: 0.5 }}
                          >
                            ·
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: theme.textSecondary,
                            }}
                          >
                            HF {position.currentHF.toFixed(2)}
                          </span>
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && selectedPosition) {
                          const position = availableLendingPositions.find(
                            (p) => p.walletItem === selectedPosition
                          );
                          if (position) handleAddPosition(position);
                        }
                      }}
                      style={{ width: '80px', textAlign: 'center' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className="hf-form-label hf-label-critical">
                    Critical Threshold (Alert Level)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      className="hf-slider hf-slider-critical"
                      min="1.1"
                      max={dialogTargetHF - 0.1}
                      step="0.1"
                      value={dialogCriticalThreshold}
                      onChange={(e) => setDialogCriticalThreshold(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      className="hf-form-input hf-input-critical"
                      min="1.1"
                      max={dialogTargetHF - 0.1}
                      step="0.1"
                      value={dialogCriticalThreshold}
                      onChange={(e) => setDialogCriticalThreshold(Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && selectedPosition) {
                          const position = availableLendingPositions.find(
                            (p) => p.walletItem === selectedPosition
                          );
                          if (position) handleAddPosition(position);
                        }
                      }}
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
              <button onClick={() => setShowPositionDialog(false)} className="btn-flat">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedPosition) {
                    const position = availableLendingPositions.find(
                      (p) => p.walletItem === selectedPosition
                    );
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
        <div
          className="hf-form-section"
          style={{
            background: `${theme.danger}1f`,
            borderColor: theme.danger,
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.danger,
              marginBottom: '8px',
            }}
          >
            ⚠️ Validation Errors
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '13px',
              color: theme.textSecondary,
            }}
          >
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '20px',
        }}
      >
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
    </div>
  );
};
