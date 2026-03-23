import { useEffect, useState } from 'react';

import { useTheme, ThemeShape } from '../context/ThemeProvider';
import { getFontStyles, FontStyles } from '../styles/fontStyles';
import { ratioToColGroup } from '../utils/tableLayout';

// A unified component that renders header (icon | title | right balance) and a table beneath it.
// Optional: collapsible behavior if onToggle provided.

// Helper functions for common style patterns
const createBadgeStyle = (fontStyle, theme, additionalProps = {}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 22,
  lineHeight: '18px',
  background: theme.bgInteractive,
  padding: '0 8px',
  borderRadius: 6,
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 70,
  ...fontStyle,
  ...additionalProps,
});

const createCondensedBadgeStyle = (fontStyle, theme, additionalProps = {}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 24,
  lineHeight: '20px',
  background: 'transparent',
  border: `1px solid ${theme.border}`,
  padding: '0 8px',
  borderRadius: 6,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 70,
  ...fontStyle,
  ...additionalProps,
});

const createCellStyle = (fontStyle, additionalProps = {}) => ({
  padding: '0px',
  textAlign: 'right',
  ...fontStyle,
  ...additionalProps,
});

const createFlexRow = (gap = 8, additionalProps = {}) => ({
  display: 'flex',
  alignItems: 'center',
  gap,
  ...additionalProps,
});

const createFlexCenter = (gap = 6, additionalProps = {}) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap,
  ...additionalProps,
});

const createButtonStyle = (theme, fontStyles, additionalProps = {}) => ({
  background: 'transparent',
  ...fontStyles.button,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  transition: 'opacity .18s',
  padding: 0,
  ...additionalProps,
});

const createTableStyle = (additionalProps = {}) => ({
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  ...additionalProps,
});

interface CircleAlertIconProps {
  color: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const CircleAlertIcon: React.FC<CircleAlertIconProps> = ({ color, width = 14, height = 14, style = {}, onClick = undefined }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

import MiniMetric from './MiniMetric';

interface MetricsDescriptor {
  ratio: number[];
  cells: React.ReactNode[];
}

interface MetricsHelpers {
  createFlexRow: (gap?: number, additionalProps?: React.CSSProperties) => React.CSSProperties;
  createFlexCenter: (gap?: number, additionalProps?: React.CSSProperties) => React.CSSProperties;
  createBadgeStyle: (fontStyle: React.CSSProperties, theme: ThemeShape, additionalProps?: React.CSSProperties) => React.CSSProperties;
  createCondensedBadgeStyle: (fontStyle: React.CSSProperties, theme: ThemeShape, additionalProps?: React.CSSProperties) => React.CSSProperties;
  createCellStyle: (fontStyle: React.CSSProperties, additionalProps?: React.CSSProperties) => React.CSSProperties;
  createTableStyle: (additionalProps?: React.CSSProperties) => React.CSSProperties;
  ratioToColGroup: (ratio: number[]) => React.ReactNode;
}

interface RenderMetricsArgs {
  theme: ThemeShape;
  fontStyles: FontStyles;
  helpers: MetricsHelpers;
}

interface RenderMetricsRowArgs extends RenderMetricsArgs {
  context: {
    subtitle: React.ReactNode;
    columns: SectionTableColumn[];
    rows: Record<string, React.ReactNode>[];
  };
}

interface SectionTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
}

interface SectionTableProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  rightValue?: React.ReactNode;
  rightPercent?: React.ReactNode;
  rewardsValue?: React.ReactNode;
  subtitle?: React.ReactNode;
  columns?: SectionTableColumn[];
  rows?: Record<string, React.ReactNode>[];
  getKey?: (row: Record<string, React.ReactNode>, index: number) => string;
  isExpanded?: boolean;
  onToggle?: () => void;
  actions?: React.ReactNode;
  infoBadges?: React.ReactNode;
  optionsMenu?: React.ReactNode;
  customContent?: React.ReactNode;
  transparentBody?: boolean;
  variant?: 'card' | 'plain';
  metricsRatio?: number[];
  renderHeaderMetrics?: ((args: RenderMetricsArgs) => MetricsDescriptor) | null;
  renderMetricsRow?: ((args: RenderMetricsRowArgs) => MetricsDescriptor) | null;
  summaryColumns?: SectionTableColumn[] | null;
  renderSummaryCell?: ((col: SectionTableColumn, index: number) => React.ReactNode) | null;
}

export default function SectionTable({
  icon = null,
  title,
  rightValue = null,
  rightPercent = null,
  rewardsValue = null,
  subtitle = null,
  columns = [],
  rows = [],
  getKey,
  isExpanded: controlledExpanded,
  onToggle,
  actions = null,
  infoBadges = null,
  optionsMenu = null,
  customContent = null,
  transparentBody = false,
  variant = 'card',
  metricsRatio = [2, 1, 1, 1],
  renderHeaderMetrics = null,
  renderMetricsRow = null,
  summaryColumns = null,
  renderSummaryCell = null,
}: SectionTableProps) {
  const { theme } = useTheme();
  const fontStyles = getFontStyles(theme);
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(true);
  const isControlled = typeof controlledExpanded === 'boolean';
  const expanded = isControlled ? controlledExpanded : uncontrolledExpanded;
  const [optionsExpanded, setOptionsExpanded] = useState(false);

  const handleToggle = () => {
    if (onToggle) onToggle();
    else setUncontrolledExpanded(!uncontrolledExpanded);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (optionsExpanded) setOptionsExpanded(false);
    };
    if (optionsExpanded) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [optionsExpanded]);

  const isCard = variant === 'card';
  const cardBg = theme.cardBg || theme.bgPanel;
  const headerBg = 'transparent';
  const bodyBg = transparentBody ? 'transparent' : theme.tableBg || theme.bgPanel;
  const stripeBg = theme.tableStripeBg || (theme.mode === 'light' ? '#f7f9fa' : '#24272f');
  const hoverBg = theme.tableRowHoverBg || (theme.mode === 'light' ? '#ecf0f3' : '#2b2e37');
  const dividerColor = 'transparent'; // borderless style

  const metricsCols =
    Array.isArray(metricsRatio) && metricsRatio.length >= 3 ? metricsRatio : [2, 1, 1, 1];
  const isThreeColMetrics = metricsCols.length === 3;
  const hasRewardsValue = rewardsValue !== null;
  const effectiveRewardsValue = metricsCols.length === 3 ? null : rewardsValue;

  const renderMetricsTable = (descriptor) => {
    if (!descriptor || !Array.isArray(descriptor.ratio) || !Array.isArray(descriptor.cells))
      return null;
    const ratio = descriptor.ratio;
    const cells = descriptor.cells;
    return (
      <table style={createTableStyle()}>
        {ratioToColGroup(ratio)}
        <tbody>
          <tr>
            {cells.map((cell, i) => (
              <td key={i} style={{ padding: '0px' }}>
                {cell}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    );
  };

  const colGroupFromColumns = (cols = []) => {
    if (!Array.isArray(cols) || cols.length === 0) return null;
    return (
      <colgroup>
        {cols.map((c, i) => (
          <col key={i} style={c && c.width ? { width: c.width } : undefined} />
        ))}
      </colgroup>
    );
  };

  return (
    <div className="mt-12 mb-12">
      <div
        style={{
          background: isCard ? cardBg : 'transparent',
          border: isCard ? `1px solid ${theme.border}` : 'none',
          borderRadius: isCard ? 14 : 0,
          boxShadow: isCard ? theme.shadowCard || '0 2px 6px rgba(0,0,0,0.08)' : 'none',
          overflow: 'hidden',
          transition: 'background-color .25s,border-color .25s,box-shadow .25s',
        }}
      >
        <div
          style={{
            ...createFlexRow(0, { justifyContent: 'space-between' }),
            background: headerBg,
            padding: '10px 16px',
            cursor: onToggle ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          onClick={onToggle ? handleToggle : undefined}
        >
          <div className="flex items-center gap-8 flex-auto">
            {icon}
            <span style={fontStyles.menuHeader}>{title}</span>
          </div>
          <div className="flex items-center gap-12" onClick={(e) => e.stopPropagation()}>
            {/* Header metrics: prefer renderHeaderMetrics if provided; fallback to legacy props */}
            {subtitle &&
              (renderHeaderMetrics ||
                infoBadges ||
                rightPercent !== null ||
                rightValue !== null) && (
                <div className="flex-none" style={{ minWidth: isThreeColMetrics ? 360 : 420 }}>
                  {renderHeaderMetrics ? (
                    renderMetricsTable(
                      renderHeaderMetrics({
                        theme,
                        fontStyles,
                        helpers: {
                          createFlexRow,
                          createFlexCenter,
                          createBadgeStyle,
                          createCondensedBadgeStyle,
                          createCellStyle,
                          createTableStyle,
                          ratioToColGroup,
                        },
                      })
                    )
                  ) : (
                    <table style={createTableStyle()}>
                      {ratioToColGroup(metricsCols)}
                      <tbody>
                        <tr>
                          {isThreeColMetrics ? (
                            <>
                              {/* 3-col: badges + options (col1) */}
                              <td style={{ padding: '0px' }}>
                                <div style={createFlexRow(6)}>
                                  {infoBadges && (
                                    <div className="mini-metric-pill">{infoBadges}</div>
                                  )}
                                </div>
                              </td>
                              {/* 3-col: percent + actions (col2) */}
                              <td style={{ padding: '0px', textAlign: 'center' }}>
                                <div style={createFlexCenter(6)}>
                                  {rightPercent !== null && <MiniMetric value={rightPercent} />}
                                  {actions}
                                </div>
                              </td>
                              {/* 3-col: value */}
                              <td style={createCellStyle(fontStyles.normal)}>
                                {rightValue !== null ? rightValue : ''}
                              </td>
                            </>
                          ) : (
                            <>
                              {/* 4-col: badges */}
                              <td style={{ padding: '0px' }}>
                                {infoBadges && <div className="mini-metric-pill">{infoBadges}</div>}
                              </td>
                              {/* 4-col: percent */}
                              <td style={{ padding: '0px', textAlign: 'center' }}>
                                {rightPercent !== null && <MiniMetric value={rightPercent} />}
                              </td>
                              {/* 4-col: actions/options */}
                              <td style={{ padding: '0px', textAlign: 'right' }}>
                                <div style={createFlexRow(6, { justifyContent: 'flex-end' })}>
                                  {actions}
                                </div>
                              </td>
                              {/* 4-col: rewards */}
                              <td style={createCellStyle(fontStyles.monospace)}>
                                {effectiveRewardsValue !== null ? effectiveRewardsValue : ''}
                              </td>
                              {/* 4-col: value */}
                              <td style={createCellStyle(fontStyles.monospace)}>
                                {rightValue !== null ? rightValue : ''}
                              </td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            <div style={createFlexRow(8)}>
              {/* Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle();
                }}
                style={createButtonStyle(theme, fontStyles)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = 0.7;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = 1;
                }}
              >
                {expanded ? '-' : '+'}
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div
            style={{
              background: bodyBg,
              borderRadius: isCard ? '0 0 14px 14px' : 0,
            }}
          >
            <div style={{ padding: '0px 0px' }}>
              {subtitle ? (
                <div
                  style={{
                    ...fontStyles.secondary,
                    margin: '0 16px 6px 16px',
                    textTransform: 'uppercase',
                  }}
                >
                  {subtitle}
                </div>
              ) : null}
              {/* Body summary/metrics strip */}
              {!subtitle && summaryColumns && renderSummaryCell ? (
                <div style={{ padding: '6px 14px 4px 14px' }}>
                  <table style={createTableStyle()}>
                    {colGroupFromColumns(summaryColumns)}
                    <tbody>
                      <tr>
                        {summaryColumns.map((col, i) => (
                          <td
                            key={col?.key || i}
                            style={{ padding: '0px', textAlign: col?.align || 'left' }}
                          >
                            {renderSummaryCell(col, i)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                !subtitle &&
                (renderMetricsRow ||
                  rightPercent !== null ||
                  infoBadges ||
                  rightValue !== null) && (
                  <div style={{ padding: '6px 14px 4px 14px' }}>
                    {renderMetricsRow ? (
                      renderMetricsTable(
                        renderMetricsRow({
                          theme,
                          fontStyles,
                          context: { subtitle, columns, rows },
                          helpers: {
                            createFlexRow,
                            createFlexCenter,
                            createBadgeStyle,
                            createCondensedBadgeStyle,
                            createCellStyle,
                            createTableStyle,
                            ratioToColGroup,
                          },
                        })
                      )
                    ) : (
                      <table style={createTableStyle()}>
                        {ratioToColGroup(metricsCols)}
                        <tbody>
                          <tr>
                            {isThreeColMetrics ? (
                              <>
                                {/* 3-col condensed metrics row with total forced to last column */}
                                <td style={{ padding: '0 0px' }}>
                                  <div style={createFlexRow(8)}>
                                    {rightPercent !== null && <MiniMetric value={rightPercent} />}
                                    {infoBadges && (
                                      <div className="mini-metric-pill">{infoBadges}</div>
                                    )}
                                    {optionsExpanded && optionsMenu && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          background: bodyBg,
                                          border: `1px solid ${theme.border}`,
                                          borderRadius: 8,
                                          padding: '0 8px',
                                          minWidth: 200,
                                          zIndex: 1000,
                                          marginTop: 30,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {optionsMenu}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '0px' }} />
                                <td style={createCellStyle(fontStyles.monospace, { fontSize: 14 })}>
                                  {rightValue !== null ? rightValue : ''}
                                </td>
                              </>
                            ) : (
                              <>
                                {/* 4-col metrics row with total forced last */}
                                <td style={{ padding: '0px' }}>
                                  <div style={createFlexRow(8)}>
                                    {rightPercent !== null && <MiniMetric value={rightPercent} />}
                                    {infoBadges && (
                                      <div className="mini-metric-pill">{infoBadges}</div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '0 6px' }} />
                                <td
                                  style={createCellStyle(fontStyles.monospace, {
                                    fontSize: 14,
                                    paddingRight: 6,
                                  })}
                                >
                                  {rewardsValue !== null ? rewardsValue : ''}
                                </td>
                                <td style={createCellStyle(fontStyles.monospace, { fontSize: 14 })}>
                                  {rightValue !== null ? rightValue : ''}
                                </td>
                              </>
                            )}
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              )}
              {customContent ? (
                customContent
              ) : (
                <table style={createTableStyle()}>
                  <thead>
                    <tr style={{ backgroundColor: headerBg }}>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          style={{
                            padding: '10px 16px',
                            textAlign: col.align || 'left',
                            ...fontStyles.tableHeader,
                            width: col.width,
                            borderBottom: `1px solid ${dividerColor}`,
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.length}
                          style={{
                            padding: '14px 16px',
                            textAlign: 'center',
                            ...fontStyles.secondary,
                          }}
                        >
                          No data
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => {
                        const isStriped = idx % 2 === 1;
                        return (
                          <tr
                            key={getKey ? getKey(row, idx) : idx}
                            style={{
                              backgroundColor: isStriped ? stripeBg : 'transparent',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = isStriped
                                ? stripeBg
                                : 'transparent')
                            }
                          >
                            {columns.map((col) => (
                              <td
                                key={col.key}
                                style={{
                                  padding: '12px 16px',
                                  textAlign: col.align || 'left',
                                  ...fontStyles.normal,
                                  borderBottom: 'none',
                                }}
                              >
                                {row[col.key]}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
