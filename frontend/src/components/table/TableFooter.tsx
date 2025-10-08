import React from 'react';
import { formatPrice } from '../../utils/walletUtils';
import { useMaskValues } from '../../context/MaskValuesContext';

interface TableFooterProps {
  totalValue?: number;
  itemsCount?: number;
  columns?: string[] | null;
  columnDefs?: any[] | null;
  showRange?: boolean;
  className?: string;
}

/**
 * Footer component for tables showing total value when there's more than 1 element
 */
const TableFooter: React.FC<TableFooterProps> = ({
  totalValue = 0,
  itemsCount = 0,
  columns = null,
  columnDefs = null,
  showRange = true,
  className = '',
}) => {
  const { maskValue } = useMaskValues();
  
  // Don't show footer if less than 2 items
  if (itemsCount < 2) return null;

  // Determine column structure (same logic as StandardHeader)
  let sequence = null;
  let advanced = null;
  
  if (Array.isArray(columnDefs) && columnDefs.length) {
    advanced = columnDefs;
  } else {
    sequence = columns && Array.isArray(columns) && columns.length ? columns : null;
    if (!sequence) {
      // Legacy fallback
      sequence = [showRange ? 'range' : null, 'amount', 'rewards', 'value'].filter(Boolean);
    }
  }

  const renderEmptyCell = (key: string | null, index: number) => (
    <td key={key || index} className="td td-right text-muted">
      {/* Empty cell */}
    </td>
  );

  const renderTotalCell = (key: string | null, index: number) => (
    <td key={key || index} className="td td-right td-mono tabular-nums td-mono-strong text-primary font-semibold">
      {maskValue(formatPrice(totalValue))}
    </td>
  );

  return (
    <tfoot>
      <tr className={`table-footer-row border-t ${className}`.trim()}>
        {/* Token column - always shows "Total" */}
        <td className="td td-left font-semibold text-primary">
          Total
        </td>
        
        {/* Dynamic columns based on table structure */}
        {advanced
          ? advanced.map((col, index) => 
              col.key === 'value' 
                ? renderTotalCell(col.key, index)
                : renderEmptyCell(col.key, index)
            )
          : sequence?.map((col, index) => 
              col === 'value' 
                ? renderTotalCell(col, index)
                : renderEmptyCell(col, index)
            )}
      </tr>
    </tfoot>
  );
};

export default TableFooter;