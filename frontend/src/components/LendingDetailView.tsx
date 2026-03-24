import LendingCards from './cards/LendingCards';

interface LendingGroup {
  protocolName?: string;
  chainName?: string;
  positions?: any[];
  healthFactor?: number | null;
  protocolLogo?: string;
  totals?: Record<string, any>;
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
      data={positions as any}
      mode="expanded"
      expandedProps={{
        protocolName,
        chainName,
        healthFactor,
        protocolLogo,
        totals: totals as any,
        onBack,
      }}
    />
  );
};

export default LendingDetailView;
