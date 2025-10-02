import React from 'react';

export interface DataTableColumn<T extends Record<string, unknown>> {
  id: string; // data key fallback
  label?: string;
  align?: 'left' | 'center' | 'right';
  width?: number | string; // optional fixed width (px or any css unit)
  headerClassName?: string;
  cellClassName?: string;
  render?: (row: T, rowIndex: number) => React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string | number;
  className?: string;
  headerRowClassName?: string;
  zebra?: boolean;
  hover?: boolean;
}

// Div-based lightweight table without inline styles; relies on utility CSS classes.
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  className = '',
  headerRowClassName = 'table-header-row',
  zebra = true,
  hover = true,
}: DataTableProps<T>) {
  return (
    <div className={`data-table w-full ${className}`.trim()}>
      <div className={`table ${headerRowClassName}`.trim()}>
        <div className="table-row">
          {columns.map((col) => {
            const style: React.CSSProperties = {};
            if (col.width !== undefined) {
              style.width = typeof col.width === 'number' ? `${col.width}px` : col.width;
              style.flex = '0 0 auto';
            }
            return (
              <div
                key={col.id}
                className={`table-cell table-header-cell ${col.headerClassName || ''} ${
                  col.align ? `text-${col.align}` : ''
                }`.trim()}
                style={style}
              >
                {col.label || ''}
              </div>
            );
          })}
        </div>
      </div>
      <div className="table">
        {rows.map((row, rIdx) => {
          const key = rowKey ? rowKey(row, rIdx) : rIdx;
          const rowClasses = [
            'table-row',
            hover ? 'row-hover' : '',
            'token-row',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={key} className={rowClasses}>
              {columns.map((col) => {
                let content: React.ReactNode;
                if (col.render) content = col.render(row, rIdx);
                else if (col.accessor) content = col.accessor(row);
                else content = (row as Record<string, unknown>)[col.id] as React.ReactNode;
                const style: React.CSSProperties = {};
                if (col.width !== undefined) {
                  style.width = typeof col.width === 'number' ? `${col.width}px` : col.width;
                  style.flex = '0 0 auto';
                }
                return (
                  <div
                    key={col.id}
                    className={`table-cell ${col.cellClassName || ''} ${
                      col.align ? `text-${col.align}` : ''
                    }`.trim()}
                    style={style}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DataTable;
