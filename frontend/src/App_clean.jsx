import React, { useEffect, useState } from 'react'

const STORAGE_KEY = 'wallet_account'
const EXPIRY_HOURS = 48
const API_BASE = 'https://localhost:10001/api/v1'

// Componente reutilizável de menu colapsível
function CollapsibleMenu({ 
  title, 
  isExpanded, 
  onToggle, 
  leftValue, 
  leftLabel,
  middleValue = '', 
  middleLabel = '',
  rightValue, 
  rightLabel,
  children,
  headerActions = null,
  optionsMenu = null
}) {
  const [optionsExpanded, setOptionsExpanded] = useState(false)

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsExpanded) {
        setOptionsExpanded(false)
      }
    }

    if (optionsExpanded) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [optionsExpanded])

  return (
    <div style={{ marginTop: 20 }}>
      {/* Collapsible Header */}
      <div 
        style={{ 
          backgroundColor: 'white', 
          padding: '12px 20px', 
          borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
          border: '1px solid #dee2e6',
          borderBottom: isExpanded ? 'none' : '1px solid #dee2e6',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Título com ícone (lado esquerdo - cresce conforme necessário) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
            <svg 
              style={{ 
                width: '16px', 
                height: '16px', 
                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s ease'
              }} 
              viewBox="0 0 16 16" 
              fill="none"
            >
              <path d="M4 6L8 10L12 6" stroke="#333333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#333333' }}>{title}</span>
          </div>

          {/* Container dos valores - dividido em 3 seções iguais aproveitando espaço máximo */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {/* Seção Left - 1/3 do espaço disponível */}
            <div style={{ 
              flex: '1 1 33.333%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              padding: '0 8px',
              overflow: 'hidden',
              minWidth: 0
            }}>
              {leftLabel && (
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#555555', 
                  fontSize: '14px', 
                  marginBottom: '4px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {leftLabel}
                </div>
              )}
              {leftValue !== undefined && leftValue !== null && leftValue !== '' && (
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  color: '#333333',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {leftValue}
                </div>
              )}
            </div>

            {/* Seção Middle - 1/3 do espaço disponível */}
            <div style={{ 
              flex: '1 1 33.333%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              padding: '0 8px',
              overflow: 'hidden',
              minWidth: 0
            }}>
              {middleLabel && (
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#555555', 
                  fontSize: '14px', 
                  marginBottom: '4px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {middleLabel}
                </div>
              )}
              {middleValue !== undefined && middleValue !== null && middleValue !== '' && (
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  color: '#333333',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {middleValue}
                </div>
              )}
            </div>

            {/* Seção Right - 1/3 do espaço disponível */}
            <div style={{ 
              flex: '1 1 33.333%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              padding: '0 8px',
              overflow: 'hidden',
              minWidth: 0
            }}>
              {rightLabel && (
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#555555', 
                  fontSize: '14px', 
                  marginBottom: '4px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {rightLabel}
                </div>
              )}
              {rightValue !== undefined && rightValue !== null && rightValue !== '' && (
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  color: '#333333',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {rightValue}
                </div>
              )}
            </div>
          </div>

          {/* Coluna de Opções - largura fixa, sempre presente */}
          <div style={{ width: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            {optionsMenu ? (
              <>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOptionsExpanded(!optionsExpanded)
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="5" r="2" fill="#333333"/>
                    <circle cx="12" cy="12" r="2" fill="#333333"/>
                    <circle cx="12" cy="19" r="2" fill="#333333"/>
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {optionsExpanded && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      padding: '8px 0',
                      minWidth: '200px',
                      zIndex: 1000
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {optionsMenu}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
      
      {/* Header Actions (como configurações) */}
      {isExpanded && headerActions && (
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '8px 20px', 
          borderLeft: '1px solid #dee2e6',
          borderRight: '1px solid #dee2e6',
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center' 
        }}>
          {headerActions}
        </div>
      )}
      
      {/* Collapsible Content */}
      {isExpanded && children}
    </div>
  )
}

export default function App() {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [walletData, setWalletData] = useState(null)
  const [tooltipVisible, setTooltipVisible] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [showOnlyPositiveBalance, setShowOnlyPositiveBalance] = useState(true)
  const [liquidityPoolsExpanded, setLiquidityPoolsExpanded] = useState(true)
  const [tokensExpanded, setTokensExpanded] = useState(true)
  const [defiPositionsExpanded, setDefiPositionsExpanded] = useState(true)
  
  // Column visibility states
  const [showBalanceColumn, setShowBalanceColumn] = useState(true)
  const [showUnitPriceColumn, setShowUnitPriceColumn] = useState(true)
  const [showPoolSubtotals, setShowPoolSubtotals] = useState(true)
  
  // Protocol expansion states for nested menus
  const [protocolExpansions, setProtocolExpansions] = useState({})

  // Function to toggle protocol expansion
  const toggleProtocolExpansion = (protocol) => {
    setProtocolExpansions(prev => ({
      ...prev,
      [protocol]: !prev[protocol]
    }))
  }

  // Load account from localStorage on component mount
  useEffect(() => {
    const storedData = localStorage.getItem(STORAGE_KEY)
    if (storedData) {
      try {
        const { account, timestamp } = JSON.parse(storedData)
        const isExpired = Date.now() - timestamp > EXPIRY_HOURS * 60 * 60 * 1000

        if (!isExpired) {
          setAccount(account)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (error) {
        console.error('Error loading account from localStorage:', error)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Save account to localStorage whenever it changes
  useEffect(() => {
    if (account) {
      const dataToStore = {
        account,
        timestamp: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [account])

  const handleAccountSubmit = (e) => {
    e.preventDefault()
    const accountInput = e.target.querySelector('input[type="text"]')
    const accountValue = accountInput.value.trim()
    
    if (accountValue) {
      setAccount(accountValue)
      fetchWalletData(accountValue)
    }
  }

  const fetchWalletData = async (accountAddress) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/wallet/${accountAddress}`)
      if (response.ok) {
        const data = await response.json()
        setWalletData(data)
      } else {
        console.error('Error fetching wallet data:', response.statusText)
        setWalletData(null)
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error)
      setWalletData(null)
    } finally {
      setLoading(false)
    }
  }

  const clearAccount = () => {
    setAccount(null)
    setWalletData(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const handleMouseEnter = (event, content) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
    setTooltipVisible(content)
  }

  const handleMouseLeave = () => {
    setTooltipVisible(null)
  }

  // Data preparation functions
  const getFilteredTokens = () => {
    if (!walletData?.tokens) return []
    return walletData.tokens.filter(token => 
      !showOnlyPositiveBalance || (token.balance > 0)
    )
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0)
  }

  const formatTokenAmount = (amount, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(amount || 0)
  }

  // Calculate totals
  const totalTokenValue = walletData?.tokens?.reduce((sum, token) => 
    sum + (token.totalPrice || 0), 0) || 0

  const totalLiquidityValue = walletData?.liquidityPools?.reduce((sum, pool) => 
    sum + (pool.totalPrice || 0), 0) || 0

  const totalDefiValue = walletData?.defiPositions?.reduce((sum, position) => 
    sum + (position.totalPrice || 0), 0) || 0

  const totalWalletValue = totalTokenValue + totalLiquidityValue + totalDefiValue

  // Group liquidity pools by protocol for hierarchical structure
  const groupedLiquidityPools = walletData?.liquidityPools?.reduce((groups, pool) => {
    const protocol = pool.protocol || 'Unknown'
    if (!groups[protocol]) {
      groups[protocol] = []
    }
    groups[protocol].push(pool)
    return groups
  }, {}) || {}

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f0f0f0', 
      fontFamily: 'Arial, sans-serif',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ textAlign: 'center', color: '#333333', marginBottom: '40px' }}>
          Web3 Wallet Explorer
        </h1>

        {!account ? (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '40px', 
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333333' }}>
              Enter Wallet Address
            </h2>
            <form onSubmit={handleAccountSubmit}>
              <input
                type="text"
                placeholder="0x1234...abcd"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '20px',
                  fontFamily: 'monospace'
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  fontSize: '16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Load Wallet
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Header with account info */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', color: '#333333' }}>
                  Wallet: {account.slice(0, 6)}...{account.slice(-4)}
                </h2>
                <p style={{ margin: 0, color: '#666666' }}>
                  Total Value: {formatCurrency(totalWalletValue)}
                </p>
              </div>
              <button
                onClick={clearAccount}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>

            {loading ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}>
                Loading wallet data...
              </div>
            ) : walletData ? (
              <>
                {/* Filter Controls */}
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '15px', 
                  borderRadius: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  marginBottom: '20px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showOnlyPositiveBalance}
                      onChange={(e) => setShowOnlyPositiveBalance(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Show only tokens with positive balance
                  </label>
                </div>

                {/* Tokens Section */}
                <CollapsibleMenu
                  title="Tokens"
                  isExpanded={tokensExpanded}
                  onToggle={() => setTokensExpanded(!tokensExpanded)}
                  leftValue={getFilteredTokens().length}
                  leftLabel="Assets"
                  rightValue={formatCurrency(totalTokenValue)}
                  rightLabel="Total Value"
                  optionsMenu={
                    <div>
                      <div 
                        style={{ 
                          padding: '8px 16px', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onClick={() => setShowBalanceColumn(!showBalanceColumn)}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <input 
                          type="checkbox" 
                          checked={showBalanceColumn} 
                          onChange={() => {}}
                          style={{ pointerEvents: 'none' }}
                        />
                        <span>Show Balance</span>
                      </div>
                      <div 
                        style={{ 
                          padding: '8px 16px', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onClick={() => setShowUnitPriceColumn(!showUnitPriceColumn)}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <input 
                          type="checkbox" 
                          checked={showUnitPriceColumn} 
                          onChange={() => {}}
                          style={{ pointerEvents: 'none' }}
                        />
                        <span>Show Unit Price</span>
                      </div>
                    </div>
                  }
                >
                  <div style={{ 
                    backgroundColor: 'white',
                    borderRadius: '0 0 8px 8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: '1px solid #dee2e6',
                    borderTop: 'none'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Token</th>
                          {showBalanceColumn && (
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Balance</th>
                          )}
                          {showUnitPriceColumn && (
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Unit Price</th>
                          )}
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredTokens().map((token, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {token.logoURI && (
                                  <img 
                                    src={token.logoURI} 
                                    alt={token.symbol}
                                    style={{
                                      width: 16,
                                      height: 16,
                                      marginRight: 6,
                                      borderRadius: '50%'
                                    }}
                                  />
                                )}
                                <span style={{ fontWeight: 'bold' }}>{token.symbol}</span>
                                <span style={{ marginLeft: 8, color: '#666666', fontSize: '14px' }}>{token.name}</span>
                              </div>
                            </td>
                            {showBalanceColumn && (
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {formatTokenAmount(token.balance, 4)}
                              </td>
                            )}
                            {showUnitPriceColumn && (
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {formatCurrency(token.price)}
                              </td>
                            )}
                            <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {formatCurrency(token.totalPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleMenu>

                {/* Liquidity Pools Section with Hierarchical Structure */}
                <CollapsibleMenu
                  title="Liquidity Pools"
                  isExpanded={liquidityPoolsExpanded}
                  onToggle={() => setLiquidityPoolsExpanded(!liquidityPoolsExpanded)}
                  leftValue={Object.keys(groupedLiquidityPools).length}
                  leftLabel="Protocols"
                  middleValue={walletData?.liquidityPools?.length || 0}
                  middleLabel="Pools"
                  rightValue={formatCurrency(totalLiquidityValue)}
                  rightLabel="Total Value"
                  optionsMenu={
                    <div>
                      <div 
                        style={{ 
                          padding: '8px 16px', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onClick={() => setShowPoolSubtotals(!showPoolSubtotals)}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <input 
                          type="checkbox" 
                          checked={showPoolSubtotals} 
                          onChange={() => {}}
                          style={{ pointerEvents: 'none' }}
                        />
                        <span>Show Protocol Subtotals</span>
                      </div>
                    </div>
                  }
                >
                  <div style={{ 
                    backgroundColor: 'white',
                    borderRadius: '0 0 8px 8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: '1px solid #dee2e6',
                    borderTop: 'none'
                  }}>
                    {Object.entries(groupedLiquidityPools).map(([protocol, pools]) => {
                      const protocolTotal = pools.reduce((sum, pool) => sum + (pool.totalPrice || 0), 0)
                      const isProtocolExpanded = protocolExpansions[protocol] || false

                      return (
                        <div key={protocol} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          {/* Protocol Header - Nested CollapsibleMenu */}
                          <CollapsibleMenu
                            title={protocol}
                            isExpanded={isProtocolExpanded}
                            onToggle={() => toggleProtocolExpansion(protocol)}
                            leftValue={pools.length}
                            leftLabel="Pools"
                            rightValue={showPoolSubtotals ? formatCurrency(protocolTotal) : ''}
                            rightLabel={showPoolSubtotals ? "Subtotal" : ''}
                          >
                            <div style={{ 
                              backgroundColor: 'white',
                              borderRadius: '0 0 8px 8px',
                              overflow: 'hidden'
                            }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Pool</th>
                                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Liquidity</th>
                                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Total Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pools.map((pool, poolIndex) => (
                                    <tr key={poolIndex} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                      <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          <span style={{ fontWeight: 'bold' }}>{pool.name || `${pool.token0?.symbol}-${pool.token1?.symbol}`}</span>
                                        </div>
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                        {formatTokenAmount(pool.liquidity, 6)}
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                        {formatCurrency(pool.totalPrice)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </CollapsibleMenu>
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleMenu>

                {/* DeFi Positions Section */}
                {walletData?.defiPositions && walletData.defiPositions.length > 0 && (
                  <CollapsibleMenu
                    title="DeFi Positions"
                    isExpanded={defiPositionsExpanded}
                    onToggle={() => setDefiPositionsExpanded(!defiPositionsExpanded)}
                    leftValue={walletData.defiPositions.length}
                    leftLabel="Positions"
                    rightValue={formatCurrency(totalDefiValue)}
                    rightLabel="Total Value"
                  >
                    <div style={{ 
                      backgroundColor: 'white',
                      borderRadius: '0 0 8px 8px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                      border: '1px solid #dee2e6',
                      borderTop: 'none'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Position</th>
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Amount</th>
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Total Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {walletData.defiPositions.map((position, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 'bold' }}>{position.protocol}</span>
                                  <span style={{ marginLeft: 8, color: '#666666', fontSize: '14px' }}>{position.type}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {formatTokenAmount(position.amount, 4)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {formatCurrency(position.totalPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleMenu>
                )}
              </>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}>
                <p>No wallet data found. Please try a different address.</p>
                <button
                  onClick={() => fetchWalletData(account)}
                  style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tooltip */}
      {tooltipVisible && (
        <div 
          style={{
            position: 'fixed',
            top: tooltipPosition.y,
            left: tooltipPosition.x,
            transform: 'translateX(-50%) translateY(-100%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          {tooltipVisible}
        </div>
      )}
    </div>
  )
}
