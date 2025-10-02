import React from 'react';
import { useMaskValues } from '../../context/MaskValuesContext';
import { useTheme } from '../../context/ThemeProvider';
import { formatPrice, formatTokenAmount } from '../../utils/walletUtils';
import TokenDisplay from '../TokenDisplay';
import StandardHeader from '../table/StandardHeader';

// Styled staking tables (Staked / Rewards) similar to PoolTables / LendingTables
export default function StakingTables({ staked = [], rewards = [] }) {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  if ((staked?.length || 0) === 0 && (rewards?.length || 0) === 0) return null;

  const Section = ({ title, tokens }) => {
    if (!tokens || tokens.length === 0) return null;
    return (
      <div className="table-wrapper">
        <table className="table-unified text-primary staking-responsive">
          <StandardHeader
            columnDefs={[
              { key: 'amount', label: 'Amount', align: 'right', className: 'col-amount' },
              { key: 'balance', label: 'Balance', align: 'right', className: 'col-value' },
            ]}
            labels={{ token: title }}
          />
          <tbody>
            {tokens.map((t, idx) => (
              <tr
                key={idx}
                className={`table-row table-row-hover ${idx === tokens.length - 1 ? '' : 'tbody-divider'}`}
              >
                <td className="td text-primary col-name">
                  <TokenDisplay tokens={[t]} size={22} showChain={false} />
                </td>
                <td className="td td-right td-mono text-primary col-amount">
                  {maskValue(formatTokenAmount(t), { short: true })}
                </td>
                <td className="td td-right td-mono td-mono-strong text-primary col-value">
                  {maskValue(formatPrice(parseFloat(t.totalPrice) || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <Section title="Staked" tokens={staked} />
      <Section title="Rewards" tokens={rewards} />
    </div>
  );
}
