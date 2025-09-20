import React from 'react';
import SectionTable from './SectionTable';

export default function SummaryProtocolsCard({ protocolGroups, theme, maskValue, formatPrice, calculatePercentage, getTotalPortfolioValue }) {
  return (
    <div>
      {protocolGroups.map((protocolGroup, idx) => {
        // Aggregate all tokens for summary
        const tokens = protocolGroup.positions.flatMap(pos => Array.isArray(pos.tokens) ? pos.tokens : []);
        const totalValue = tokens.reduce((sum, t) => sum + (parseFloat(t.totalPrice) || 0), 0);
        const percent = calculatePercentage(totalValue, getTotalPortfolioValue());
        return (
          <SectionTable
            key={protocolGroup.protocol.name}
            title={protocolGroup.protocol.name}
            icon={protocolGroup.protocol.logoURI || protocolGroup.protocol.logo ? (
              <img
                src={protocolGroup.protocol.logoURI || protocolGroup.protocol.logo}
                alt={protocolGroup.protocol.name}
                style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${theme.border}` }}
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            ) : null}
            rightPercent={percent}
            rightValue={maskValue(formatPrice(totalValue))}
            isExpanded={true}
            transparentBody={true}
            customContent={
              <div style={{ background: 'transparent', border: 'none', borderRadius: 8 }}>
                <table style={{ width: '100%', fontSize: 13, color: theme.textPrimary }}>
                  <thead>
                    <tr style={{ background: theme.bgPanel }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Asset</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Amount</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Price</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Value</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Percent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token, i) => (
                      <tr key={token.contractAddress || token.tokenAddress || `${token.symbol}-${i}`}> 
                        <td style={{ textAlign: 'left', padding: '8px 10px' }}>{token.symbol}</td>
                        <td style={{ textAlign: 'right', padding: '8px 10px' }}>{maskValue(token.amount)}</td>
                        <td style={{ textAlign: 'right', padding: '8px 10px' }}>{maskValue(formatPrice(token.price), { short: true })}</td>
                        <td style={{ textAlign: 'right', padding: '8px 10px' }}>{maskValue(formatPrice(token.totalPrice))}</td>
                        <td style={{ textAlign: 'right', padding: '8px 10px' }}>{calculatePercentage(token.totalPrice, getTotalPortfolioValue())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        );
      })}
    </div>
  );
}
