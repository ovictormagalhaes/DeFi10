import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeProvider.tsx';

/**
 * PeriodDropdown - Reusable dropdown component for period selection
 * @param {Array} periods - Array of period options (e.g., ['Day', 'Week', 'Month', 'Year'])
 * @param {string} selectedPeriod - Currently selected period
 * @param {Function} onPeriodChange - Callback when period changes
 * @param {Object} style - Custom style overrides for the button
 */
const PeriodDropdown = ({ 
  periods = ['Day', 'Week', 'Month', 'Year'],
  selectedPeriod,
  onPeriodChange,
  style = {},
  buttonStyle = {},
  compact = false // If true, uses compact styling
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, direction: 'bottom' });
  const dropdownRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  const isClickingInsideRef = useRef(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if we're clicking inside
      if (isClickingInsideRef.current) {
        isClickingInsideRef.current = false;
        return;
      }
      
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          dropdownMenuRef.current && !dropdownMenuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Calculate dropdown position when opening
  const handleDropdownClick = (e) => {
    e.stopPropagation();
    
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const itemHeight = compact ? 32 : 35;
      const containerPadding = 8;
      const dropdownHeight = (periods.length * itemHeight) + containerPadding;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Determine if dropdown should open upwards or downwards
      const direction = (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) ? 'top' : 'bottom';
      
      // Calculate absolute position
      const top = direction === 'bottom' ? rect.bottom + 4 : rect.top - dropdownHeight - 4;
      const left = rect.left; // Align with button left edge
      
      setDropdownPosition({ top, left, direction });
    }
    
    setIsOpen(!isOpen);
  };

  const defaultButtonStyle = compact ? {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    width: 'auto',
  } : {
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    width: 'auto',
  };

  const itemPadding = compact ? '6px 10px' : '8px 12px';
  const itemFontSize = compact ? 11 : 12;

  return (
    <div style={style}>
      {/* Period Selector Button */}
      <div
        ref={dropdownRef}
        onClick={handleDropdownClick}
        style={{
          ...defaultButtonStyle,
          ...buttonStyle,
          backgroundColor: theme.bgSecondary,
          border: `1px solid ${theme.border}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: theme.textPrimary,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = theme.border;
        }}
      >
        <span style={{ fontSize: compact ? 10 : 12, whiteSpace: 'nowrap' }}>{selectedPeriod}</span>
        <svg 
          width={compact ? "8" : "10"}
          height={compact ? "8" : "10"}
          viewBox="0 0 12 12" 
          fill="none"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          <path 
            d="M3 5L6 8L9 5" 
            stroke={theme.textSecondary} 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Dropdown Menu via Portal */}
      {isOpen && createPortal(
        <div 
          ref={dropdownMenuRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            backgroundColor: theme.bgPanel,
            border: `1px solid ${theme.border}`,
            borderRadius: compact ? 6 : 8,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 10000,
            width: 'fit-content',
            overflow: 'hidden',
          }}
        >
          {periods.map((period) => (
            <div
              key={period}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isClickingInsideRef.current = true;
                onPeriodChange(period);
                setIsOpen(false);
              }}
              style={{
                padding: itemPadding,
                fontSize: itemFontSize,
                fontWeight: 600,
                color: selectedPeriod === period ? theme.accent : theme.textPrimary,
                backgroundColor: selectedPeriod === period ? theme.bgSecondary : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedPeriod !== period) {
                  e.currentTarget.style.backgroundColor = theme.bgSecondary;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPeriod !== period) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {period}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default PeriodDropdown;
