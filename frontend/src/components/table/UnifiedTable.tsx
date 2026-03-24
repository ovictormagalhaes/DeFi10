import StandardHeader from './StandardHeader';

interface UnifiedTableProps {
  children: React.ReactNode;
  withHeader?: boolean;
  headerClassName?: string;
  tableClassName?: string;
}

export default function UnifiedTable({
  children,
  withHeader = true,
  headerClassName = '',
  tableClassName = '',
}: UnifiedTableProps): React.ReactElement {
  return (
    <table className={`table-unified text-primary ${tableClassName}`.trim()}>
      {withHeader && <StandardHeader className={headerClassName} />}
      {children}
    </table>
  );
}
