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

  // Get available types
  const typeOptions = useMemo(() => {
    const types = normalizedProjections.map(p => p.type);
    // Map type names for display
    return types.map(type => {
      switch (type.toLowerCase()) {
        case 'apr': return 'APR';
        case 'aprhistorical': return 'APR Historical';
        default: return type.charAt(0).toUpperCase() + type.slice(1);
      }
    });
  }, [normalizedProjections]);

  // Get current projection based on selected type
  const currentProjection = useMemo(() => {
    const typeIndex = typeOptions.findIndex(t => 
      t.toLowerCase() === selectedType.toLowerCase() || 
      (t === 'APR Historical' && selectedType.toLowerCase() === 'aprhistorical') ||
      (t === 'APR' && selectedType.toLowerCase() === 'apr')
    );
    return normalizedProjections[typeIndex >= 0 ? typeIndex : 0];
  }, [normalizedProjections, selectedType, typeOptions]);

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
