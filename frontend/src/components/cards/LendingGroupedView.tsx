import { useTheme } from '../../context/ThemeProvider';
import type { WalletItem } from '../../types/wallet';

import ProtocolGroupCard from './ProtocolGroupCard';

interface LendingGroupDetail {
  protocolName: string;
  chainName: string;
  positions: WalletItem[];
  healthFactor: number | null;
  protocolLogo?: string;
  totals?: {
    totalSupplied: number;
    totalBorrowed: number;
    netPosition: number;
    avgSupplyRate: number;
    avgBorrowRate: number;
    avgApy: number;
  };
}

interface LendingGroupedViewProps {
  data: WalletItem[];
  onOpenDetail?: (detail: LendingGroupDetail) => void;
}

/**
 * LendingGroupedView - Visualização agrupada de lending positions por Protocol + Chain
 * Agrupa positions que compartilham o mesmo Health Factor
 */
const LendingGroupedView: React.FC<LendingGroupedViewProps> = ({ data = [], onOpenDetail }) => {
  const { theme } = useTheme();

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: theme.textSecondary,
          fontSize: 14,
        }}
      >
        No lending positions found
      </div>
    );
  }

  // Group positions by Protocol + Chain
  // Health Factor é compartilhado entre positions do mesmo protocolo e chain
  const groupedPositions: Record<
    string,
    {
      protocolName: string;
      chainName: string;
      positions: WalletItem[];
      healthFactor: number | null;
    }
  > = {};

  data.forEach((item) => {
    const position = item.position || item;
    const protocol = (position.protocol || item.protocol || {}) as {
      chain?: string;
      name?: string;
      [key: string]: unknown;
    };
    const tokens = position.tokens || [];

    // Get chain from protocol first, fallback to first token chain
    const chain = protocol.chain || tokens[0]?.chain || 'unknown';
    const protocolName = protocol.name || 'Unknown Protocol';

    // Create unique key for protocol + chain
    const groupKey = `${protocolName.toLowerCase()}-${chain.toLowerCase()}`;

    if (!groupedPositions[groupKey]) {
      groupedPositions[groupKey] = {
        protocolName,
        chainName: chain,
        positions: [],
        healthFactor: null,
      };
    }

    groupedPositions[groupKey].positions.push(item);

    // Health Factor é o mesmo para todas as positions do mesmo protocol + chain
    // Pegamos do primeiro item que tiver
    if (groupedPositions[groupKey].healthFactor === null) {
      const hf =
        item.additionalData?.healthFactor ||
        item.additionalInfo?.healthFactor ||
        position.additionalData?.healthFactor ||
        position.healthFactor ||
        null;

      if (hf !== null && hf !== undefined && isFinite(parseFloat(hf))) {
        groupedPositions[groupKey].healthFactor = parseFloat(hf);
      }
    }
  });

  // Convert to array and sort by protocol name
  const groups = Object.values(groupedPositions).sort(
    (a: { protocolName: string }, b: { protocolName: string }) =>
      a.protocolName.localeCompare(b.protocolName)
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: '8px 0',
      }}
    >
      {groups.map((group, index) => (
        <ProtocolGroupCard
          key={index}
          protocolName={group.protocolName}
          chainName={group.chainName}
          positions={group.positions}
          healthFactor={group.healthFactor}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
};

export default LendingGroupedView;
