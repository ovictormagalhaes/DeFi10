import colors from '../styles/colors';

interface CellsContainerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export default function CellsContainer({ children, style }: CellsContainerProps): React.ReactElement {
  const baseStyle: React.CSSProperties = {
    backgroundColor: colors.bgPanelAlt,
    padding: '8px 12px',
    margin: '8px 0',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
  };
  return <div style={{ ...baseStyle, ...(style || {}) }}>{children}</div>;
}
