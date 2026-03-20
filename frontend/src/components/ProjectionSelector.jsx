import React, { useState, useMemo } from 'react';
import { useTheme } from '../context/ThemeProvider.tsx';
import { useMaskValues } from '../context/MaskValuesContext.tsx';
import { formatPrice } from '../utils/walletUtils';
import PeriodDropdown from './PeriodDropdown.jsx';

/**
 * ProjectionSelector - Dropdown selector for projection types and periods
 * @param {Array} projections - Array of projection objects with type, projection, and metadata
 * @param {Object} projection - Legacy: Single projection object (for backward compatibility)
 * @param {string} defaultType - Default selected type ('apr', 'aprHistorical', etc.)
 * @param {string} defaultPeriod - Default selected period ('Day', 'Week', 'Month', 'Year')
 * @param {boolean} showTypeWhenSingle - Show type dropdown even when there's only 1 type (default: true)
 * @param {Object} dropdownButtonStyle - Custom styles for dropdown buttons
 * @param {boolean} disableDropdownHoverEffects - Disable hover effects on dropdowns
 */
const ProjectionSelector = ({ 
  projections, 
  projection,
  defaultType = 'apr',
  defaultPeriod = 'Day',
  showTypeWhenSingle = true,
  dropdownButtonStyle = {},
  disableDropdownHoverEffects = false
}) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const [selectedType, setSelectedType] = useState(defaultType);
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  // Default button style for dropdowns if not provided
  const defaultDropdownStyle = {
    fontSize: 13,
    fontWeight: 400,
    fontFamily: 'inherit',
    color: 'rgb(162, 169, 181)',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    transition: 'none',
  };

  const finalButtonStyle = Object.keys(dropdownButtonStyle).length > 0 
    ? dropdownButtonStyle 
    : defaultDropdownStyle;

  // Normalize projections array (support both new and legacy format)
  const normalizedProjections = useMemo(() => {
    if (projections && Array.isArray(projections) && projections.length > 0) {
      return projections;
    }
    // Legacy: single projection object
    if (projection) {
      return [{ type: 'apr', projection, metadata: {} }];
    }
    return [];
  }, [projections, projection]);

  // Get available types (deduped by display label)
  const typeOptions = useMemo(() => {
    const labels = [];
    const seen = new Set();

    normalizedProjections.forEach((p) => {
      const rawType = (p.type || '').toString();
      let label;
      switch (rawType.toLowerCase()) {
        case 'apr':
          label = 'APR';
          break;
        case 'aprhistorical':
          label = 'APR Historical';
          break;
        case 'apy':
          label = 'APY';
          break;
        default:
          label = rawType
            ? rawType.charAt(0).toUpperCase() + rawType.slice(1)
            : 'APR';
      }

      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    });

    return labels;
  }, [normalizedProjections]);

  // Get current projection based on selected type
  const currentProjection = useMemo(() => {
    if (!normalizedProjections.length) return null;

    const target = selectedType.toLowerCase();
    const directMatch = normalizedProjections.find((p) => {
      const t = (p.type || '').toString().toLowerCase();
      if (!t) return false;
      if (t === target) return true;
      if (t === 'apr' && target === 'apr') return true;
      if (t === 'aprhistorical' && (target === 'aprhistorical' || target === 'historical'))
        return true;
      if (t === 'apy' && target === 'apy') return true;
      return false;
    });

    return directMatch || normalizedProjections[0];
  }, [normalizedProjections, selectedType]);

  // Map periods to projection values
  const periodMap = {
    'Day': currentProjection?.projection?.oneDay,
    'Week': currentProjection?.projection?.oneWeek,
    'Month': currentProjection?.projection?.oneMonth,
    'Year': currentProjection?.projection?.oneYear,
  };

  const currentValue = periodMap[selectedPeriod];

  // Determine color based on value
  const getValueColor = (value) => {
    if (value == null) return theme.textPrimary;
    if (value > 0) return '#10b981'; // Verde
    if (value < 0) return '#ef4444'; // Vermelho
    return theme.textPrimary; // Branco/padrão para zero
  };

  // Handler for type change
  const handleTypeChange = (displayType) => {
    // Map display name back to original type
    const typeMapping = {
      'APR': 'apr',
      'Historical': 'aprHistorical',
      'APR Historical': 'aprHistorical',
      'APY': 'apy',
    };
    setSelectedType(typeMapping[displayType] || displayType.toLowerCase());
  };

  // Don't render if no projections available
  if (normalizedProjections.length === 0) {
    return null;
  }

  // Decide whether to show type dropdown
  const showTypeDropdown = normalizedProjections.length > 1 || showTypeWhenSingle;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: theme.textSecondary }}>Projection</span>
        
        {/* Type Selector Dropdown */}
        {showTypeDropdown && (
          <PeriodDropdown
            periods={typeOptions}
            selectedPeriod={typeOptions.find(t => 
              t.toLowerCase() === selectedType.toLowerCase() || 
              (t === 'Historical' && selectedType.toLowerCase() === 'createdat') ||
              (t === 'APR' && selectedType.toLowerCase() === 'apr')
            ) || typeOptions[0]}
            onPeriodChange={handleTypeChange}
            compact={true}
            disableHoverEffects={disableDropdownHoverEffects}
            buttonStyle={finalButtonStyle}
          />
        )}

        {/* Period Selector Dropdown */}
        <PeriodDropdown
          periods={['Day', 'Week', 'Month', 'Year']}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          compact={true}
          disableHoverEffects={disableDropdownHoverEffects}
          buttonStyle={finalButtonStyle}
        />
      </div>

      {/* Value Display */}
      <span style={{ fontSize: 14, fontWeight: 600, color: getValueColor(currentValue) }}>
        {currentValue != null ? maskValue(formatPrice(currentValue)) : '-'}
      </span>
    </div>
  );
};

export default ProjectionSelector;
