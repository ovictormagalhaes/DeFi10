import React from 'react';

import { useChainIcons } from '../context/ChainIconsProvider';
import { useMaskValues } from '../context/MaskValuesContext.tsx';
import { formatPrice, groupDefiByProtocol, groupTokensByPool } from '../utils/walletUtils';

import Chip from './Chip';
import CollapsibleMenu from './CollapsibleMenu';

const DeFiMenu = ({
  title,
  data,
  isExpanded,
  onToggle,
  protocolExpansions,
  toggleProtocolExpansion,
  getTotalPortfolioValue,
  calculatePercentage,
  menuType = 'default', // 'liquidity', 'lending', 'staking'
}) => {
  // Hooks must run before any conditional return
  const { maskValue } = useMaskValues();
  // Early return AFTER hooks to keep order stable
  if (!data || data.length === 0) return null;

  const getMenuColumns = () => {
    switch (menuType) {
      case 'liquidity':
        return {
          pools: {
            label: 'Pools',
            value: groupDefiByProtocol(data).reduce(
              (total, group) => total + group.positions.length,
              0
            ),
            flex: 1,
          },
          rewards: {
            label: 'Rewards',
            value: maskValue(
              formatPrice(
                groupDefiByProtocol(data).reduce(
                  (total, group) =>
                    total +
                    group.positions.reduce(
                      (sum, pos) =>
                        sum +
                        (pos.rewards?.reduce(
                          (rewardSum, reward) => rewardSum + (reward.totalPrice || 0),
                          0
                        ) || 0),
                      0
                    ),
                  0
                )
              )
            ),
            flex: 1,
          },
          balance: {
            label: 'Balance',
            value: maskValue(
              formatPrice(
                groupDefiByProtocol(data).reduce(
                  (total, group) =>
                    total +
                    group.positions.reduce(
                      (sum, pos) =>
                        sum +
                        (pos.tokens?.reduce(
                          (tokenSum, token) => tokenSum + (token.totalPrice || 0),
                          0
                        ) || 0),
                      0
                    ),
                  0
                )
              )
            ),
            flex: 1,
            highlight: true,
          },
          percentage: {
            label: '%',
            value: (() => {
              const totalValue = groupDefiByProtocol(data).reduce(
                (total, group) =>
                  total +
                  group.positions.reduce(
                    (sum, pos) =>
                      sum +
                      (pos.tokens?.reduce(
                        (tokenSum, token) => tokenSum + (token.totalPrice || 0),
                        0
                      ) || 0),
                    0
                  ),
                0
              );
              return calculatePercentage(totalValue, getTotalPortfolioValue());
            })(),
            flex: 0.8,
          },
        };

      case 'lending':
        return {
          positions: {
            label: 'Positions',
            value: groupDefiByProtocol(data).length,
            flex: 1,
          },
          supplied: {
            label: 'Supplied',
            value: maskValue(
              formatPrice(
                groupDefiByProtocol(data).reduce(
                  (total, group) =>
                    total +
                    group.positions.reduce(
                      (sum, pos) =>
                        sum +
                        (pos.tokens
                          ?.filter((token) => token.type === 'supplied')
                          .reduce((tokenSum, token) => tokenSum + (token.totalPrice || 0), 0) || 0),
                      0
                    ),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          borrowed: {
            label: 'Borrowed',
            value: maskValue(
              formatPrice(
                groupDefiByProtocol(data).reduce(
                  (total, group) =>
                    total +
                    group.positions.reduce(
                      (sum, pos) =>
                        sum +
                        (pos.tokens
                          ?.filter((token) => token.type === 'borrowed')
                          .reduce((tokenSum, token) => tokenSum + (token.totalPrice || 0), 0) || 0),
                      0
                    ),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          balance: {
            label: 'Net Balance',
            value: maskValue(
              formatPrice(
                groupDefiByProtocol(data).reduce(
                  (total, group) =>
                    total +
                    group.positions.reduce((sum, pos) => sum + (parseFloat(pos.balance) || 0), 0),
                  0
                )
              )
            ),
            flex: 2,
            highlight: true,
          },
        };

      case 'staking':
        return {
          positions: {
            label: 'Positions',
            value: groupDefiByProtocol(data).length,
            flex: 1,
          },
          staked: {
            label: 'Staked',
            value: maskValue(
              formatPrice(
                groupDefiByProtocol(data).reduce(
                  (total, group) =>
                    total +
                    group.positions.reduce(
                      (sum, pos) =>
                        sum +
                        (pos.tokens?.reduce(
                          (tokenSum, token) => tokenSum + (token.totalPrice || 0),
                          0
                        ) || 0),
                      0
                    ),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          unclaimed: {
            label: 'Unclaimed',
            value: maskValue(
              formatPrice(
                groupDefiByProtocol(data).reduce(
                  (total, group) =>
                    total +
                    group.positions.reduce(
                      (sum, pos) => sum + (parseFloat(pos.totalUnclaimed) || 0),
                      0
                    ),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          balance: {
            label: 'Total Value',
            value: maskValue(
              formatPrice(
                groupDefiByProtocol(data).reduce(
                  (total, group) =>
                    total +
                    group.positions.reduce((sum, pos) => sum + (parseFloat(pos.balance) || 0), 0),
                  0
                )
              )
            ),
            flex: 2,
            highlight: true,
          },
        };

      default:
        return {};
    }
  };

  return (
    <CollapsibleMenu
      title={title}
      isExpanded={isExpanded}
      onToggle={onToggle}
      columns={getMenuColumns()}
    >
      <div className="defi-container">
        {groupDefiByProtocol(data).map((protocolGroup, protocolIndex) => (
          <ProtocolGroup
            key={protocolGroup.protocol.name}
            protocolGroup={protocolGroup}
            protocolIndex={protocolIndex}
            totalProtocols={groupDefiByProtocol(data).length}
            protocolExpansions={protocolExpansions}
            toggleProtocolExpansion={toggleProtocolExpansion}
            menuType={menuType}
          />
        ))}
      </div>
    </CollapsibleMenu>
  );
};

const ProtocolGroup = ({
  protocolGroup,
  protocolIndex,
  totalProtocols,
  protocolExpansions,
  toggleProtocolExpansion,
  menuType,
}) => {
  const { getIcon } = useChainIcons();
  const { maskValue } = useMaskValues();

  // Resolve possible chain identifier from protocol/position/tokens
  const resolveChainRaw = (obj) => {
    if (!obj || typeof obj !== 'object') return undefined;
    const direct =
      obj.chainId ||
      obj.chainID ||
      obj.chain_id ||
      obj.chain ||
      obj.networkId ||
      obj.network ||
      obj.chainName;
    if (direct) return direct;
    const p = obj.protocol;
    if (p && typeof p === 'object') {
      return p.chainId || p.chainID || p.chain || p.networkId || p.network || p.chainName;
    }
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (/(chain|network)/i.test(k)) {
        const v = obj[k];
        if (v && (typeof v === 'string' || typeof v === 'number')) return v;
      }
    }
    return undefined;
  };

  const firstPos = protocolGroup?.positions?.[0] || null;
  const basePos = firstPos && (firstPos.position || firstPos);
  let chainRaw = resolveChainRaw(protocolGroup?.protocol) || resolveChainRaw(basePos);
  if (!chainRaw && basePos && Array.isArray(basePos.tokens)) {
    for (let i = 0; i < basePos.tokens.length; i++) {
      const c = resolveChainRaw(basePos.tokens[i]);
      if (c) {
        chainRaw = c;
        break;
      }
    }
  }
  const chainIcon = chainRaw ? getIcon(chainRaw) : undefined;
  const getProtocolColumns = () => {
    switch (menuType) {
      case 'liquidity':
        return {
          pools: {
            label: 'Pools',
            value: protocolGroup.positions.length,
            flex: 1,
          },
          rewards: {
            label: 'Rewards',
            value: maskValue(
              formatPrice(
                protocolGroup.positions.reduce(
                  (sum, pos) =>
                    sum +
                    (pos.rewards?.reduce(
                      (rewardSum, reward) => rewardSum + (reward.totalPrice || 0),
                      0
                    ) || 0),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          balance: {
            label: 'Balance',
            value: maskValue(
              formatPrice(
                protocolGroup.positions.reduce(
                  (sum, pos) =>
                    sum +
                    (pos.tokens?.reduce(
                      (tokenSum, token) => tokenSum + (token.totalPrice || 0),
                      0
                    ) || 0),
                  0
                )
              )
            ),
            flex: 2,
            highlight: true,
          },
        };

      case 'lending':
        return {
          positions: {
            label: 'Positions',
            value: protocolGroup.positions.length,
            flex: 1,
          },
          supplied: {
            label: 'Supplied',
            value: maskValue(
              formatPrice(
                protocolGroup.positions.reduce(
                  (sum, pos) =>
                    sum +
                    (pos.tokens
                      ?.filter((token) => token.type === 'supplied')
                      .reduce((tokenSum, token) => tokenSum + (token.totalPrice || 0), 0) || 0),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          borrowed: {
            label: 'Borrowed',
            value: maskValue(
              formatPrice(
                protocolGroup.positions.reduce(
                  (sum, pos) =>
                    sum +
                    (pos.tokens
                      ?.filter((token) => token.type === 'borrowed')
                      .reduce((tokenSum, token) => tokenSum + (token.totalPrice || 0), 0) || 0),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          balance: {
            label: 'Net Balance',
            value: maskValue(
              formatPrice(
                protocolGroup.positions.reduce(
                  (sum, pos) => sum + (parseFloat(pos.balance) || 0),
                  0
                )
              )
            ),
            flex: 2,
            highlight: true,
          },
        };

      case 'staking':
        return {
          positions: {
            label: 'Positions',
            value: protocolGroup.positions.length,
            flex: 1,
          },
          staked: {
            label: 'Staked',
            value: maskValue(
              formatPrice(
                protocolGroup.positions.reduce(
                  (sum, pos) =>
                    sum +
                    (pos.tokens?.reduce(
                      (tokenSum, token) => tokenSum + (token.totalPrice || 0),
                      0
                    ) || 0),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          unclaimed: {
            label: 'Unclaimed',
            value: maskValue(
              formatPrice(
                protocolGroup.positions.reduce(
                  (sum, pos) => sum + (parseFloat(pos.totalUnclaimed) || 0),
                  0
                )
              )
            ),
            flex: 1.5,
          },
          balance: {
            label: 'Total Value',
            value: maskValue(
              formatPrice(
                protocolGroup.positions.reduce(
                  (sum, pos) => sum + (parseFloat(pos.balance) || 0),
                  0
                )
              )
            ),
            flex: 2,
            highlight: true,
          },
        };

      default:
        return {};
    }
  };

  return (
    <div className={protocolIndex < totalProtocols - 1 ? 'defi-group-separator' : undefined}>
      <CollapsibleMenu
        title={
          <div className="defi-protocol-header flex items-center">
            {protocolGroup.protocol.logoURI || protocolGroup.protocol.logo ? (
              <div className="logo-stack">
                <img
                  src={protocolGroup.protocol.logoURI || protocolGroup.protocol.logo}
                  alt={protocolGroup.protocol.name}
                  className="token-logo block"
                  onError={(e) => (e.target.style.display = 'none')}
                />
                {chainIcon && (
                  <img
                    src={chainIcon}
                    alt="chain"
                    className="chain-overlay"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
              </div>
            ) : null}
            {/^Uniswap V3 \(/i.test(protocolGroup.protocol.name)
              ? 'Uniswap V3'
              : protocolGroup.protocol.name}
          </div>
        }
        isExpanded={protocolExpansions[protocolGroup.protocol.name] || false}
        onToggle={() => toggleProtocolExpansion(protocolGroup.protocol.name)}
        columns={getProtocolColumns()}
        isNested={true}
      >
        {menuType === 'liquidity' ? (
          <LiquidityPositions protocolGroup={protocolGroup} />
        ) : (
          <StandardPositions protocolGroup={protocolGroup} menuType={menuType} />
        )}
      </CollapsibleMenu>
    </div>
  );
};

const LiquidityPositions = ({ protocolGroup }) => {
  return (
    <div className="defi-protocol-wrapper">
      {Object.entries(groupTokensByPool(protocolGroup.positions)).map(
        ([poolName, poolData], poolIndex) => {
          const poolKey = `pool-${protocolGroup.protocol.name}-${poolIndex}`;

          const poolTitle = (
            <div className="flex items-center">
              {poolData.tokens.map((token, tokenIndex) => (
                <React.Fragment key={`${poolKey}-logo-${tokenIndex}`}>
                  {token.logo && (
                    <img
                      src={token.logo}
                      alt={token.symbol}
                      className="pool-token-logo"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  )}
                  <span className={tokenIndex < poolData.tokens.length - 1 ? 'mr-4' : undefined}>
                    {token.symbol}
                  </span>
                  {tokenIndex < poolData.tokens.length - 1 && (
                    <span className="token-separator">/</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          );

          return (
            <div key={poolKey} className="defi-pool-wrapper">
              <div className="defi-pool-title">{poolTitle}</div>
              <div className="defi-pool-tokens">
                {poolData.tokens.map((token, tokenIndex) => {
                  const correspondingReward = poolData.rewards?.find(
                    (reward) => reward.symbol === token.symbol
                  );
                  const tokenReward = correspondingReward ? correspondingReward.totalPrice || 0 : 0;

                  return (
                    <TokenRow
                      key={`${protocolGroup.protocol.name}-pool-${poolIndex}-token-${tokenIndex}`}
                      token={token}
                      tokenReward={tokenReward}
                      isLast={tokenIndex === poolData.tokens.length - 1}
                    />
                  );
                })}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
};

const StandardPositions = ({ protocolGroup, menuType }) => {
  return (
    <div className="defi-position-list">
      {protocolGroup.positions.map((position, positionIndex) => {
        const positionKey = `defi-${protocolGroup.protocol.id}-${positionIndex}`;

        return (
          <div key={positionKey} className="defi-position">
            <div className="defi-position-title">
              {position.name || `Position ${positionIndex + 1}`}
              {menuType === 'staking' && position.apr && (
                <span className="ml-8">
                  <Chip variant="accent" size="sm">
                    APR: {position.apr}%
                  </Chip>
                </span>
              )}
            </div>
            <div className="defi-pool-tokens">
              {position.tokens?.map((token, tokenIndex) => (
                <TokenRow
                  key={`${positionKey}-token-${tokenIndex}`}
                  token={token}
                  isLast={tokenIndex === position.tokens.length - 1}
                  showType={menuType === 'lending'}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TokenRow = ({ token, tokenReward, isLast, showType }) => {
  const { maskValue } = useMaskValues();
  return (
    <div className={`defi-token-row${isLast ? ' last' : ''}`}>
      <div className="defi-token-main">
        {token.logo && (
          <img
            src={token.logo}
            alt={token.symbol}
            className="token-logo mr-10"
            onError={(e) => (e.target.style.display = 'none')}
          />
        )}
        <span className="token-symbol">{token.symbol}</span>
        {showType && token.type && (
          <span className="ml-8">
            <Chip variant={token.type === 'supplied' ? 'success' : 'danger'} minimal size="xs">
              {token.type}
            </Chip>
          </span>
        )}
      </div>
      <div className="defi-row-values">
        {tokenReward !== undefined && (
          <div className="defi-value-block">
            <div className="defi-value-label">Rewards</div>
            <span className="defi-value-mono">{maskValue(formatPrice(tokenReward))}</span>
          </div>
        )}
        <div className="defi-value-block">
          <div className="defi-value-label">Balance</div>
          <span className="defi-value-mono-strong">
            {maskValue(formatPrice(token.totalPrice || 0))}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DeFiMenu;
