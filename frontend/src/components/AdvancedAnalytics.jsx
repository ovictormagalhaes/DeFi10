import React from 'react';

import { getFontStyles } from '../styles/fontStyles';

import DataTable from './DataTable';

const AdvancedAnalytics = ({
  walletTokens,
  getLiquidityPoolsData,
  getLendingAndBorrowingData,
  getStakingData,
  getTotalPortfolioValue,
  maskValue,
  formatPrice,
  theme,
  groupDefiByProtocol,
  filterLendingDefiTokens,
  showLendingDefiTokens,
}) => {
  const fontStyles = getFontStyles(theme);

  // Usar a mesma lógica de cálculo do App.jsx
  const signedTokenValue = (t, pos) => {
    const ty = (t.type || '').toLowerCase();
    const val = Math.abs(parseFloat(t.totalPrice) || 0);
    if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return -val;
    if (!ty) {
      const lbl = (pos?.position?.label || pos?.label || '').toLowerCase();
      if (lbl.includes('borrow') || lbl.includes('debt')) return -val;
    }
    return val;
  };

  // Calcular dados para os gráficos usando a mesma lógica do App.jsx
  const walletValue = walletTokens.reduce((sum, tokenData) => {
    const token = tokenData.token || tokenData;
    return sum + (parseFloat(token.totalPrice) || 0);
  }, 0);

  const liquidityData = getLiquidityPoolsData();
  const lendingData = getLendingAndBorrowingData();
  const stakingData = getStakingData();

  // Usar groupDefiByProtocol como no App.jsx
  const liquidityValue = groupDefiByProtocol(liquidityData).reduce(
    (total, group) =>
      total +
      group.positions.reduce(
        (sum, pos) =>
          sum +
          (pos.tokens?.reduce(
            (tokenSum, token) => tokenSum + (parseFloat(token.totalPrice) || 0),
            0
          ) || 0),
        0
      ),
    0
  );

  const lendingValue = groupDefiByProtocol(lendingData).reduce((grand, group) => {
    const groupSum = group.positions.reduce((sum, pos) => {
      const tokens = Array.isArray(pos.tokens)
        ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
        : [];
      const net = tokens.reduce((s, t) => s + signedTokenValue(t, pos), 0);
      return sum + net;
    }, 0);
    return grand + groupSum;
  }, 0);

  const stakingValue = stakingData.reduce((total, position) => {
    const balance = parseFloat(position.balance) || 0;
    return total + (isNaN(balance) ? 0 : balance);
  }, 0);

  const totalValue = getTotalPortfolioValue();

  const distributionItems = [
    { label: 'Wallet Assets', value: walletValue, color: '#3b82f6' },
    { label: 'Liquidity Pools', value: liquidityValue, color: '#10b981' },
    { label: 'Lending/Borrowing', value: lendingValue, color: '#8b5cf6' },
    { label: 'Staking', value: stakingValue, color: '#f59e0b' },
  ].filter((item) => item.value > 0);

  const distributionTotal = distributionItems.reduce((sum, i) => sum + i.value, 0) || 1;

  const distributionData = distributionItems.map((item) => ({
    ...item,
    percentage: ((item.value / distributionTotal) * 100).toFixed(1),
  }));

  // Top tokens por valor (agregando todos os protocolos)
  const getAllTokensAggregated = () => {
    const tokenMap = new Map();

    // Adicionar tokens da wallet
    walletTokens.forEach((tokenData) => {
      const token = tokenData.token || tokenData;
      const symbol = token.symbol;
      const value = parseFloat(token.totalPrice) || 0;

      if (tokenMap.has(symbol)) {
        const existing = tokenMap.get(symbol);
        existing.value += value;
      } else {
        tokenMap.set(symbol, {
          symbol: token.symbol,
          name: token.name,
          value: value,
          logo: token.logo,
        });
      }
    });

    // Adicionar tokens de liquidity pools
    groupDefiByProtocol(liquidityData).forEach((group) => {
      group.positions.forEach((pos) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token) => {
            const symbol = token.symbol;
            const value = parseFloat(token.totalPrice) || 0;

            if (tokenMap.has(symbol)) {
              const existing = tokenMap.get(symbol);
              existing.value += value;
            } else {
              tokenMap.set(symbol, {
                symbol: token.symbol,
                name: token.name,
                value: value,
                logo: token.logo,
              });
            }
          });
        }
      });
    });

    // Adicionar tokens de lending/borrowing
    groupDefiByProtocol(lendingData).forEach((group) => {
      group.positions.forEach((pos) => {
        const tokens = Array.isArray(pos.tokens)
          ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
          : [];
        tokens.forEach((token) => {
          const symbol = token.symbol;
          const signedValue = signedTokenValue(token, pos);

          if (tokenMap.has(symbol)) {
            const existing = tokenMap.get(symbol);
            existing.value += signedValue;
          } else {
            tokenMap.set(symbol, {
              symbol: token.symbol,
              name: token.name,
              value: signedValue,
              logo: token.logo,
            });
          }
        });
      });
    });

    // Adicionar tokens de staking (se tiverem estrutura de tokens)
    stakingData.forEach((position) => {
      if (position.tokens && Array.isArray(position.tokens)) {
        const tokens = filterLendingDefiTokens
          ? filterLendingDefiTokens(position.tokens, showLendingDefiTokens)
          : position.tokens;
        tokens.forEach((token) => {
          const symbol = token.symbol;
          const value = parseFloat(token.totalPrice) || 0;

          if (tokenMap.has(symbol)) {
            const existing = tokenMap.get(symbol);
            existing.value += value;
          } else {
            tokenMap.set(symbol, {
              symbol: token.symbol,
              name: token.name,
              value: value,
              logo: token.logo,
            });
          }
        });
      }
    });

    return Array.from(tokenMap.values())
      .filter((token) => token.value > 0) // Só tokens com valor positivo
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const topTokens = getAllTokensAggregated();

  // Dados para distribuição de protocolos DeFi
  const getProtocolDistribution = () => {
    const protocolMap = new Map();

    // Usar a mesma paleta do Portfolio Distribution
    const protocolColors = [
      '#3b82f6', // Wallet Assets (azul)
      '#10b981', // Liquidity Pools (verde)
      '#8b5cf6', // Lending/Borrowing (roxo)
      '#f59e0b', // Staking (laranja)
    ];

    // Processar liquidity pools
    groupDefiByProtocol(liquidityData).forEach((group) => {
      const protocolName = group.protocol.name;
      let protocolValue = 0;

      group.positions.forEach((pos) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token) => {
            protocolValue += parseFloat(token.totalPrice) || 0;
          });
        }
      });

      if (protocolValue > 0) {
        protocolMap.set(protocolName, {
          name: protocolName,
          value: protocolValue,
          logo: group.protocol.logoURI || group.protocol.logo,
          color: protocolColors[protocolMap.size % protocolColors.length],
        });
      }
    });

    // Processar lending/borrowing
    groupDefiByProtocol(lendingData).forEach((group) => {
      const protocolName = group.protocol.name;
      let protocolValue = 0;

      group.positions.forEach((pos) => {
        const tokens = Array.isArray(pos.tokens)
          ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
          : [];
        tokens.forEach((token) => {
          protocolValue += signedTokenValue(token, pos);
        });
      });

      if (protocolValue > 0) {
        if (protocolMap.has(protocolName)) {
          protocolMap.get(protocolName).value += protocolValue;
        } else {
          protocolMap.set(protocolName, {
            name: protocolName,
            value: protocolValue,
            logo: group.protocol.logoURI || group.protocol.logo,
            color: protocolColors[protocolMap.size % protocolColors.length],
          });
        }
      }
    });

    // Processar staking (se tiver protocolos identificados)
    stakingData.forEach((position) => {
      const protocolName =
        position.protocol?.name || position.position?.protocol?.name || 'Staking';
      let protocolValue = parseFloat(position.balance) || 0;

      if (protocolValue > 0) {
        if (protocolMap.has(protocolName)) {
          protocolMap.get(protocolName).value += protocolValue;
        } else {
          protocolMap.set(protocolName, {
            name: protocolName,
            value: protocolValue,
            logo: position.protocol?.logoURI || position.protocol?.logo,
            color: protocolColors[protocolMap.size % protocolColors.length],
          });
        }
      }
    });

    return Array.from(protocolMap.values())
      .filter((protocol) => protocol.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((protocol) => ({
        ...protocol,
        percentage: (
          (protocol.value / (liquidityValue + lendingValue + stakingValue)) *
          100
        ).toFixed(1),
      }));
  };

  const protocolDistribution = getProtocolDistribution();
  const totalDefiValue = liquidityValue + lendingValue + stakingValue;

  // Componente de gráfico de pizza simples
  const PieChart = ({ data, size = 120, totalValue = null }) => {
    const radius = size / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2;

    // Usar totalValue fornecido ou calcular da data
    const total = totalValue || data.reduce((sum, item) => sum + item.value, 0);

    let cumulativePercentage = 0;

    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const startAngle = (cumulativePercentage / 100) * 360;
          const endAngle = ((cumulativePercentage + percentage) / 100) * 360;

          const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
          const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
          const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
          const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);

          const largeArcFlag = percentage > 50 ? 1 : 0;

          const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z',
          ].join(' ');

          cumulativePercentage += percentage;

          return (
            <path
              key={index}
              d={pathData}
              fill={item.color}
              stroke={theme.bgPanel}
              strokeWidth="2"
            />
          );
        })}
      </svg>
    );
  };

  // Componente de barra de progresso
  const ProgressBar = ({ percentage, color, height = 8 }) => (
    <div
      style={{
        width: '100%',
        height,
        background: theme.bgInteractive,
        borderRadius: height / 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          borderRadius: height / 2,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );

  return (
    <div className="panel" style={{ padding: 24, marginTop: 16 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
          </svg>
        </div>
        <div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.textPrimary,
              margin: 0,
              marginBottom: 4,
            }}
          >
            Advanced Analytics
          </h3>
          <p
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              margin: 0,
            }}
          >
            Deep insights into your portfolio composition
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            protocolDistribution.length > 0
              ? 'repeat(auto-fit, minmax(300px, 1fr))'
              : 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: 24,
          marginBottom: 24,
        }}
      >
        {/* Portfolio Distribution Chart */}
        <div className="panel-alt panel" style={{ padding: 20, minWidth: 0, overflow: 'visible' }}>
          <h4
            style={{
              ...fontStyles.menuHeader,
              margin: 0,
              marginBottom: 16,
            }}
          >
            Portfolio Distribution
          </h4>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              minHeight: 160, // Garante altura mínima adequada
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <PieChart data={distributionData} size={120} />
            </div>

            <div style={{ width: '100%' }}>
              <DataTable
                columns={[
                  {
                    id: 'marker',
                    width: 20,
                    render: (row) => (
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: row.color,
                        }}
                      />
                    ),
                  },
                  {
                    id: 'asset',
                    label: 'ASSET',
                    render: (row) => (
                      <div style={{ ...fontStyles.normal, wordBreak: 'break-word', maxWidth: 120 }}>
                        {row.label}
                      </div>
                    ),
                  },
                  {
                    id: 'pct',
                    label: '%',
                    width: 70,
                    align: 'center',
                    render: (row) => (
                      <div
                        style={{
                          ...fontStyles.normal,
                          color: theme.textSecondary,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.percentage}%
                      </div>
                    ),
                  },
                  {
                    id: 'value',
                    label: 'VALUE',
                    width: 100,
                    align: 'right',
                    render: (row) => (
                      <div style={{ ...fontStyles.normal, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {maskValue(formatPrice(row.value))}
                      </div>
                    ),
                  },
                ]}
                rows={distributionData}
                rowKey={(r, i) => `${r.label}-${i}`}
                zebra={true}
                hover={false}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        {/* Top Assets */}
        <div className="panel-alt panel" style={{ padding: 20 }}>
          <h4
            style={{
              ...fontStyles.menuHeader,
              margin: 0,
              marginBottom: 16,
            }}
          >
            Top Assets by Total Value
          </h4>

          {topTokens.map((token, index) => {
            const percentage = totalValue > 0 ? (token.value / totalValue) * 100 : 0;
            return (
              <div
                key={index}
                style={{
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: index < topTokens.length - 1 ? `1px solid ${theme.border}` : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {token.logo && (
                      <img
                        src={token.logo}
                        alt={token.symbol}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: `1px solid ${theme.border}`,
                        }}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <div>
                      <div
                        style={{
                          ...fontStyles.normal,
                          fontWeight: 600,
                        }}
                      >
                        {token.symbol}
                      </div>
                      <div
                        style={{
                          ...fontStyles.small,
                        }}
                      >
                        {token.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        ...fontStyles.normal,
                        fontWeight: 600,
                      }}
                    >
                      {maskValue(formatPrice(token.value))}
                    </div>
                    <div
                      style={{
                        ...fontStyles.small,
                      }}
                    >
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <ProgressBar percentage={percentage} color={`hsl(${210 + index * 30}, 70%, 60%)`} />
              </div>
            );
          })}
        </div>

        {/* Protocol Distribution Chart */}
        {protocolDistribution.length > 0 && (
          <div className="panel-alt panel" style={{ padding: 20 }}>
            <h4
              style={{
                ...fontStyles.menuHeader,
                margin: 0,
                marginBottom: 16,
              }}
            >
              DeFi Protocol Distribution
            </h4>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <PieChart data={protocolDistribution} size={120} totalValue={totalDefiValue} />

              <div style={{ width: '100%' }}>
                <DataTable
                  columns={[
                    {
                      id: 'marker',
                      width: 20,
                      render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {row.logo ? (
                            <img
                              src={row.logo}
                              alt={row.name}
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: `1px solid ${theme.border}`,
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const sib = e.currentTarget.nextElementSibling;
                                if (sib) sib.style.display = 'block';
                              }}
                            />
                          ) : null}
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: row.color,
                              display: row.logo ? 'none' : 'block',
                            }}
                          />
                        </div>
                      ),
                    },
                    {
                      id: 'protocol',
                      label: 'PROTOCOL',
                      render: (row) => (
                        <div
                          style={{ ...fontStyles.normal, wordBreak: 'break-word', maxWidth: 120 }}
                        >
                          {row.name}
                        </div>
                      ),
                    },
                    {
                      id: 'pct',
                      label: '%',
                      width: 70,
                      align: 'center',
                      render: (row) => (
                        <div
                          style={{
                            ...fontStyles.normal,
                            color: theme.textSecondary,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.percentage}%
                        </div>
                      ),
                    },
                    {
                      id: 'value',
                      label: 'VALUE',
                      width: 100,
                      align: 'right',
                      render: (row) => (
                        <div
                          style={{ ...fontStyles.normal, fontWeight: 500, whiteSpace: 'nowrap' }}
                        >
                          {maskValue(formatPrice(row.value))}
                        </div>
                      ),
                    },
                  ]}
                  rows={protocolDistribution}
                  rowKey={(r, i) => `${r.name}-${i}`}
                  zebra={true}
                  hover={false}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className="panel-alt panel" style={{ padding: 20 }}>
        <h4
          style={{
            ...fontStyles.menuHeader,
            margin: 0,
            marginBottom: 16,
          }}
        >
          Portfolio Metrics
        </h4>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16,
          }}
        >
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: theme.textPrimary,
                marginBottom: 4,
              }}
            >
              {distributionData.length}
            </div>
            <div
              style={{
                ...fontStyles.small,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Active Categories
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: 16 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: theme.textPrimary,
                marginBottom: 4,
              }}
            >
              {walletTokens.length}
            </div>
            <div
              style={{
                ...fontStyles.small,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Total Assets
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: 16 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: theme.textPrimary,
                marginBottom: 4,
              }}
            >
              {liquidityData.length + lendingData.length + stakingData.length}
            </div>
            <div
              style={{
                ...fontStyles.small,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              DeFi Positions
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: 16 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#10b981',
                marginBottom: 4,
              }}
            >
              {distributionData.find((d) => d.label === 'Wallet Assets')?.percentage || '0'}%
            </div>
            <div
              style={{
                ...fontStyles.small,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Liquid Assets
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
