import React from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import ProtocolGroupCard from './ProtocolGroupCard.jsx';

/**
 * LendingGroupedView - Visualização agrupada de lending positions por Protocol + Chain
 * Agrupa positions que compartilham o mesmo Health Factor
 */
const LendingGroupedView = ({ data = [] }) => {
  const { theme } = useTheme();

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        color: theme.textSecondary,
        fontSize: 14,
      }}>
        No lending positions found
      </div>
    );
  }

  // Group positions by Protocol + Chain
  // Health Factor é compartilhado entre positions do mesmo protocolo e chain
  const groupedPositions = {};

  data.forEach(item => {
    const position = item.position || item;
    const protocol = position.protocol || item.protocol || {};
    const tokens = position.tokens || [];
    
    // Get chain from first token
    const chain = tokens[0]?.chain || 'unknown';
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
      const hf = item.additionalData?.healthFactor || 
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
  const groups = Object.values(groupedPositions).sort((a, b) => 
    a.protocolName.localeCompare(b.protocolName)
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      padding: '8px 0',
    }}>
      {groups.map((group, index) => (
        <ProtocolGroupCard
          key={index}
          protocolName={group.protocolName}
          chainName={group.chainName}
          positions={group.positions}
          healthFactor={group.healthFactor}
        />
      ))}
    </div>
  );
};

export default LendingGroupedView;
