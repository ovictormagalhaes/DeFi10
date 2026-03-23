import LendingCards from './cards/LendingCards';

interface LendingGroup {
  protocolName?: string;
  chainName?: string;
  positions?: unknown[];
  healthFactor?: number | null;
  protocolLogo?: string;
  totals?: Record<string, number>;
}

interface LendingDetailViewProps {
  group: LendingGroup | null;
  onBack: () => void;
}

const LendingDetailView = ({ group, onBack }: LendingDetailViewProps): React.ReactElement => {
  const {
    protocolName,
    chainName,
    positions = [],
    healthFactor,
    protocolLogo,
    totals,
  } = group || {};

  return (
    <LendingCards
      data={positions}
      mode="expanded"
      expandedProps={{
        protocolName,
        chainName,
        healthFactor,
        protocolLogo,
        totals,
        onBack,
      }}
    />
  );
};

export default LendingDetailView;
