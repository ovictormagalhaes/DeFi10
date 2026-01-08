import React, { useState } from 'react';

import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { formatPrice } from '../../utils/walletUtils';

import RebalancingCards from './RebalancingCards';

/**
 * StrategyGroupCard - Agrupa strategy entries por referência (Portfolio %, Wallet, etc)
 * Similar ao ProtocolGroupCard mas para estratégias
 */
const StrategyGroupCard = ({
  label,
  entries = [],
  onEdit,
  onDelete,
  entryCurrentValues,
  bucketCurrentSums,
  bucketNoteSums,
  bucketKey,
  tokensList,
  poolsList,
  lendingList,
  stakingList,
  totalCurrentGeneral = 0,
  totalTargetGeneral = 0,
}) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!entries || entries.length === 0) return null;

  // Use general totals passed from parent
  const totalCurrent = totalCurrentGeneral;
  const totalTarget = totalTargetGeneral;
  const diff = totalCurrent - totalTarget;

  return (
    <div
      style={{
        backgroundColor: theme.bgPanel,
        border: `2px solid ${theme.border}`,
        borderRadius: 16,
        marginBottom: 24,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header - Label + Metrics */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: theme.bgSecondary,
          borderBottom: isExpanded ? `1px solid ${theme.border}` : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.2s ease',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = theme.bgHover || theme.bgSecondary)
        }
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.bgSecondary)}
      >
        {/* Left: Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Reference Type Icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: theme.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {label.charAt(0).toUpperCase()}
          </div>

          {/* Label */}
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: theme.textPrimary,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: theme.textSecondary,
                marginTop: 2,
              }}
            >
              {entries.length} strateg{entries.length > 1 ? 'ies' : 'y'}
            </div>
          </div>
        </div>

        {/* Right: Total Value + Expand Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Total Value */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <span style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 600 }}>
              TOTAL
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: theme.textPrimary,
                marginTop: 2,
              }}
            >
              {maskValue(formatPrice(totalCurrent))}
            </span>
          </div>

          {/* Expand/Collapse Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.textSecondary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'transform 0.2s ease',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Content - Cards */}
      {isExpanded && (
        <div style={{ padding: '20px' }}>
          <RebalancingCards
            entries={entries}
            onEdit={onEdit}
            onDelete={onDelete}
            entryCurrentValues={entryCurrentValues}
            bucketCurrentSums={bucketCurrentSums}
            bucketNoteSums={bucketNoteSums}
            bucketKey={bucketKey}
            tokensList={tokensList}
            poolsList={poolsList}
            lendingList={lendingList}
            stakingList={stakingList}
          />
        </div>
      )}
    </div>
  );
};

export default StrategyGroupCard;
