import { useTheme } from '../context/ThemeProvider';

interface ColumnConfig {
  flex?: number;
  align?: 'left' | 'right' | 'center';
  style?: React.CSSProperties;
  label?: string;
  monospace?: boolean;
  fontSize?: number | string;
  fontWeight?: number | string;
  highlight?: boolean;
  color?: string;
  getValue?: (data: Record<string, unknown>) => React.ReactNode;
}

interface DynamicCellProps {
  data: Record<string, unknown>;
  columns: Record<string, ColumnConfig>;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  className?: string;
}

const DynamicCell = ({ data, columns, onMouseEnter, onMouseLeave, style = {}, className = '' }: DynamicCellProps) => {
  const { theme } = useTheme();
  const totalFlex = Object.values(columns).reduce((sum, col) => sum + (col.flex || 1), 0);

  const baseBg = theme.tableBg || theme.bgPanel || 'transparent';
  const hoverBg = theme.tableRowHoverBg || theme.bgPanelAlt || baseBg;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: baseBg,
        borderRadius: 8,
        border: 'none',
        boxShadow: 'none',
        transition: 'background-color 0.18s ease',
        ...style,
      }}
      className={className}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.backgroundColor = hoverBg;
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.backgroundColor = baseBg;
        onMouseLeave?.(e);
      }}
    >
      {Object.entries(columns).map(([key, column], index) => {
        const flexValue = ((column.flex || 1) / totalFlex) * 100;
        const value = typeof column.getValue === 'function' ? column.getValue(data) : (data[key] as React.ReactNode);

        return (
          <div
            key={key}
            style={{
              flex: `0 0 ${flexValue}%`,
              textAlign: column.align || (index === 0 ? 'left' : 'right'),
              ...column.style,
            }}
          >
            {column.label && (
              <div
                style={{
                  fontSize: 11,
                  color: theme.textMuted,
                  marginBottom: 2,
                }}
              >
                {column.label}
              </div>
            )}
            <div
              style={{
                fontFamily: column.monospace ? 'monospace' : 'inherit',
                fontSize: column.fontSize || 14,
                fontWeight: column.fontWeight || (column.highlight ? 600 : 'normal'),
                color: column.color || (column.highlight ? theme.textPrimary : theme.textSecondary),
              }}
            >
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface TokenData extends Record<string, unknown> {
  logo?: string;
  symbol?: string;
  type?: string;
  rewardValue?: string;
  formattedPrice?: string;
  totalPrice?: string;
}

interface TokenCellProps {
  token: TokenData;
  showRewards?: boolean;
  showType?: boolean;
  isLast?: boolean;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

// Componente especializado para células de token
const TokenCell = ({
  token,
  showRewards = false,
  showType = false,
  isLast = false,
  onMouseEnter,
  onMouseLeave,
}: TokenCellProps) => {
  const { theme } = useTheme();
  const columns: Record<string, ColumnConfig> = {
    token: {
      flex: 3,
      align: 'left',
      getValue: (data: Record<string, unknown>) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {(data as TokenData).logo && (
            <img
              src={(data as TokenData).logo}
              alt={(data as TokenData).symbol}
              style={{
                width: 20,
                height: 20,
                marginRight: 10,
                borderRadius: '50%',
                border: `1px solid ${theme.border}`,
              }}
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => (e.currentTarget.style.display = 'none')}
            />
          )}
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: theme.textPrimary,
            }}
          >
            {(data as TokenData).symbol}
          </span>
          {showType && (data as TokenData).type && (
            <span
              style={{
                marginLeft: 8,
                color: (data as TokenData).type === 'supplied' ? theme.success : theme.danger,
                padding: '0 4px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {(data as TokenData).type}
            </span>
          )}
        </div>
      ),
    },
  };

  if (showRewards) {
    columns.rewards = {
      label: 'Rewards',
      flex: 1,
      monospace: true,
      fontSize: '13px',
      fontWeight: '500',
      getValue: (data: Record<string, unknown>) => (data as TokenData).rewardValue || '0.00',
    };
  }

  columns.balance = {
    label: 'Balance',
    flex: 2,
    monospace: true,
    fontSize: '14px',
    fontWeight: '600',
    highlight: true,
    getValue: (data: Record<string, unknown>) => (data as TokenData).formattedPrice || (data as TokenData).totalPrice || '0.00',
  };

  return (
    <DynamicCell
      data={token}
      columns={columns}
      style={{
        marginBottom: isLast ? 0 : 6,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
};

interface CellContainerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  title?: string;
  subtitle?: string;
}

// Componente para container de células
const CellContainer = ({ children, style = {}, title, subtitle }: CellContainerProps) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        backgroundColor: theme.bgPanel,
        padding: '16px 24px',
        margin: '8px 0',
        borderRadius: 8,
        border: 'none',
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontWeight: 600,
            marginBottom: subtitle ? 4 : 12,
            color: theme.textPrimary,
            fontSize: 14,
          }}
        >
          {title}
        </div>
      )}
      {subtitle && (
        <div
          style={{
            fontSize: 12,
            color: theme.textSecondary,
            marginBottom: 12,
          }}
        >
          {subtitle}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export { DynamicCell, TokenCell, CellContainer };
export default DynamicCell;
