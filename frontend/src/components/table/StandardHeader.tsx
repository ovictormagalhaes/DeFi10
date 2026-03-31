type ColumnKey = 'range' | 'price' | 'amount' | 'rewards' | 'value' | 'unlock';

interface ColumnDef {
  key: string;
  label?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  thProps?: React.ThHTMLAttributes<HTMLTableCellElement>;
}

interface StandardHeaderProps {
  className?: string;
  showRange?: boolean;
  labels?: Partial<Record<ColumnKey | 'token', string>>;
  columns?: ColumnKey[];
  columnDefs?: ColumnDef[];
}

export default function StandardHeader({
  className = '',
  showRange = true,
  labels = {},
  columns,
  columnDefs,
}: StandardHeaderProps): React.ReactElement {
  const defaultLabels: Record<ColumnKey | 'token', string> = {
    token: 'Token',
    range: 'Range',
    price: 'Price',
    amount: 'Amount',
    rewards: 'Rewards',
    value: 'Value',
    unlock: 'Unlock At',
  };
  const merged = { ...defaultLabels, ...labels };

  let sequence: ColumnKey[] | null = null;
  let advanced: Array<{
    key: string;
    label: string;
    align: string;
    className: string;
    thProps: React.ThHTMLAttributes<HTMLTableCellElement>;
  }> | null = null;
  if (Array.isArray(columnDefs) && columnDefs.length) {
    advanced = columnDefs.map((d) => {
      // Preserve intentionally empty string labels (e.g., blank placeholder column header)
      const provided = Object.prototype.hasOwnProperty.call(d, 'label');
      const finalLabel = provided ? d.label : merged[d.key] || d.key;
      return {
        key: d.key,
        label: finalLabel,
        align: d.align || (d.key === 'range' ? 'center' : 'right'),
        className: d.className || `col-${d.key}`,
        thProps: d.thProps || {},
      };
    });
  } else {
    sequence = columns && Array.isArray(columns) && columns.length ? columns : null;
    if (!sequence) {
      // Legacy fallback
      sequence = [showRange ? 'range' : null, 'amount', 'rewards', 'value'].filter(
        Boolean
      ) as ColumnKey[];
    }
  }

  return (
    <thead>
      <tr className={`thead-row ${className}`.trim()}>
        <th className="th-head th-left col-name">{merged.token}</th>
        {advanced
          ? advanced.map((col) => (
              <th
                key={col.key}
                className={`th-head ${col.align === 'center' ? 'th-center' : col.align === 'left' ? 'th-left' : 'th-right'} ${col.className}`}
                {...col.thProps}
              >
                {col.label}
              </th>
            ))
          : sequence.map((col) => {
              const label = merged[col] || col;
              const align = col === 'range' ? 'th-center' : 'th-right';
              const baseClass = `th-head ${align} col-${col}`;
              return (
                <th key={col} className={baseClass}>
                  {label}
                </th>
              );
            })}
      </tr>
    </thead>
  );
}
