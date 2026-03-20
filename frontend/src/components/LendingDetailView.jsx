import React from 'react';
import LendingCards from './cards/LendingCards.jsx';

/**
 * LendingDetailView - Wrapper component for expanded lending view
 * Now delegates to LendingCards with mode='expanded'
 */
const LendingDetailView = ({ group, onBack }) => {
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
