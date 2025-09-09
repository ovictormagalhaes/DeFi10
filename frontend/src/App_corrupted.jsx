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
  const toggleProtocolExpansion = (protocolName) => {
    setProtocolExpansions(prev => ({
      ...prev,
      [protocolName]: !prev[protocolName]
    }))
  }

  // Call API when account is available
  async function callAccountAPI(accountAddress) {
    if (!accountAddress) return
    
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/wallets/accounts/${accountAddress}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Account data:', data)
        setWalletData(data)
      } else {
        console.error('API error:', response.status, response.statusText)
        setWalletData(null)
      }
    } catch (error) {
      console.error('Failed to call API:', error)
      setWalletData(null)
    } finally {
      setLoading(false)
    }
  }

  // Refresh wallet data - calls API again
  async function refreshWalletData() {
    if (account) {
      await callAccountAPI(account)
    }
  }

  // Format balance (use default decimals since not provided in response)
  function formatBalance(balance, isNative = false) {
    const balanceNum = parseFloat(balance)
    // Use 18 decimals for native tokens (ETH), 6-8 for others
    const decimals = isNative ? 18 : 6
    const divisor = Math.pow(10, decimals)
    const formatted = (balanceNum / divisor).toFixed(6)
    return parseFloat(formatted).toString() // Remove trailing zeros
  }

  // Format native balance for tooltip
  function formatNativeBalance(token) {
    if (!token.balance || !token.totalPrice) return 'N/A'
    
    const balanceNum = parseFloat(token.balance)
    const totalPriceNum = parseFloat(token.totalPrice)
    
    // Use decimalPlaces from API if available
    if (token.decimalPlaces !== null && token.decimalPlaces !== undefined) {
      const decimals = parseInt(token.decimalPlaces)
      const divisor = Math.pow(10, decimals)
      const formatted = (balanceNum / divisor).toFixed(6)
      const cleanFormatted = parseFloat(formatted).toString()
      return `${cleanFormatted} ${token.symbol}`
    }
    
    // Calculate the actual balance by dividing totalPrice by unitPrice
    // This gives us the real token amount without needing to guess decimals
    if (token.unitPrice && token.unitPrice > 0) {
      const actualBalance = totalPriceNum / parseFloat(token.unitPrice)
      return `${actualBalance.toFixed(6)} ${token.symbol}`
    }
    
    // Fallback: try to determine decimals by comparing balance and totalPrice
    // If balance is much larger than totalPrice, it's likely a high-decimal token
    const ratio = balanceNum / totalPriceNum
    let decimals = 18 // default
    
    if (ratio > 1000000 && ratio < 10000000) {
      decimals = 6 // USDC-like (6 decimals)
    } else if (ratio > 10000000 && ratio < 1000000000) {
      decimals = 8 // cbBTC-like (8 decimals)
    }
    
    const divisor = Math.pow(10, decimals)
    const formatted = (balanceNum / divisor).toFixed(6)
    const cleanFormatted = parseFloat(formatted).toString()
    return `${cleanFormatted} ${token.symbol}`
  }

  // Tooltip handlers
  function showTooltip(event, content, tokenIndex) {
    const rect = event.target.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
    setTooltipVisible(`${content}-${tokenIndex}`)
  }

  function hideTooltip() {
    setTooltipVisible(null)
  }

  // Filter tokens based on positive balance setting
  function getFilteredTokens(tokens) {
    if (showOnlyPositiveBalance) {
      return tokens.filter(token => {
        const totalPrice = parseFloat(token.totalPrice)
        return totalPrice > 0
      })
    }
    return tokens
  }

  // Format price with currency symbol
  function formatPrice(price) {
    if (price === 0 || price === null || price === undefined) return '$0.00'
    const priceNum = parseFloat(price)
    if (priceNum < 0.01) {
      return `$${priceNum.toFixed(6)}`
    } else if (priceNum < 1) {
      return `$${priceNum.toFixed(4)}`
    } else {
      return `$${priceNum.toFixed(2)}`
    }
  }

  // Group DeFi positions by protocol
  function groupDefiByProtocol(defiData) {
    if (!defiData || !Array.isArray(defiData)) return []
    
    const grouped = {}
    
    defiData.forEach(defi => {
      const protocolId = defi.protocol.id
      if (!grouped[protocolId]) {
        grouped[protocolId] = {
          protocol: defi.protocol,
          positions: []
        }
      }
      grouped[protocolId].positions.push({
        ...defi.position,
        additionalData: defi.additionalData
      })
    })
    
    return Object.values(grouped)
  }

  // Group data by protocol name for table display
  function groupByProtocolName(data) {
    if (!data || !Array.isArray(data)) return {}
    
    const grouped = {}
    
    data.forEach(item => {
      const protocolName = item.protocol
      if (!grouped[protocolName]) {
        grouped[protocolName] = []
      }
      grouped[protocolName].push(item)
    })
    
    return grouped
  }

  // Separate DeFi into Liquidity and Other types
  function separateDefiByType(defiData) {
    if (!defiData || !Array.isArray(defiData)) return { liquidity: [], other: [] }
    
    const liquidity = []
    const other = []
    
    defiData.forEach(defi => {
      if (defi.position.label === 'Liquidity') {
        liquidity.push(defi)
      } else {
        other.push(defi)
      }
    })
    
    return { liquidity, other }
  }

  // Save account with expiry
  function saveAccount(addr) {
    const data = {
      account: addr,
      timestamp: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setAccount(addr)
    // Removed callAccountAPI(addr) to prevent duplicate calls
  }

  // Load account from storage
  function loadAccount() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    try {
      const data = JSON.parse(stored)
      const elapsed = Date.now() - data.timestamp
      const maxAge = EXPIRY_HOURS * 60 * 60 * 1000

      if (elapsed > maxAge) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }

      return data.account
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
  }

  // Connect to wallet
  async function connectWallet() {
    if (!window.ethereum) {
      alert('MetaMask not found. Please install MetaMask.')
      return
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const acc = accounts[0]
      saveAccount(acc)
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  // Copy address to clipboard
  async function copyAddress() {
    if (!account) return
    try {
      await navigator.clipboard.writeText(account)
      alert('Address copied!')
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  // Disconnect wallet
  function disconnect() {
    localStorage.removeItem(STORAGE_KEY)
    setAccount(null)
  }

  // Load account on mount
  useEffect(() => {
    const savedAccount = loadAccount()
    if (savedAccount) {
      setAccount(savedAccount)
    }
  }, [])

  // Call API whenever account changes (including on load)
  useEffect(() => {
    if (account) {
      callAccountAPI(account)
    }
  }, [account])

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        saveAccount(accounts[0])
      }
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)

    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [])

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      padding: 20, 
      backgroundColor: '#f5f5f5', 
      minHeight: '100vh' 
    }}>
      <h1>MyWebWallet</h1>

      {loading && <p>Loading...</p>}

      {!account ? (
        <button onClick={connectWallet} style={{ padding: '10px 16px', cursor: 'pointer' }}>
          Connect Wallet
        </button>
      ) : (
        <div>
          <div><strong>Account:</strong> {account}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={copyAddress} style={{ padding: '6px 10px', marginRight: 8 }}>
              Copy
            </button>
            <button 
              onClick={refreshWalletData} 
              disabled={loading}
              style={{ 
                padding: '6px 10px', 
                marginRight: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button onClick={disconnect} style={{ padding: '6px 10px' }}>
              Disconnect
            </button>
          </div>

          {/* Tokens Table */}
          {walletData && walletData.tokens && walletData.tokens.length > 0 && (
            <CollapsibleMenu
              title="Wallet"
              isExpanded={tokensExpanded}
              onToggle={() => setTokensExpanded(!tokensExpanded)}
              leftValue={getFilteredTokens(walletData.tokens).length}
              leftLabel="Tokens"
              middleValue=""
              middleLabel=""
              rightValue={formatPrice(getFilteredTokens(walletData.tokens).reduce((sum, token) => sum + parseFloat(token.totalPrice || 0), 0))}
              rightLabel="Balance"
              optionsMenu={
                <div style={{ padding: '8px 16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={!showOnlyPositiveBalance}
                      onChange={(e) => setShowOnlyPositiveBalance(!e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    Show assets with no balance
                  </label>
                  
                  <div style={{ borderTop: '1px solid #dee2e6', paddingTop: '8px', marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>
                      Visible Columns:
                    </div>
                    
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer', marginBottom: '6px' }}>
                      <input
                        type="checkbox"
                        checked={showBalanceColumn}
                        onChange={(e) => setShowBalanceColumn(e.target.checked)}
                        style={{ marginRight: 8 }}
                      />
                      Amount
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showUnitPriceColumn}
                        onChange={(e) => setShowUnitPriceColumn(e.target.checked)}
                        style={{ marginRight: 8 }}
                      />
                      Price
                    </label>
                    
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '8px', fontStyle: 'italic' }}>
                      Token and Total Value are always visible
                    </div>
                  </div>
                </div>
              }
            >
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                backgroundColor: 'white',
                borderRadius: '0 0 12px 12px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '1px solid #e9ecef',
                borderTop: 'none'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '16px 20px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600', fontSize: '14px', color: '#495057' }}>Token</th>
                    {showBalanceColumn && (
                      <th style={{ padding: '16px 20px', textAlign: 'right', borderBottom: '1px solid #dee2e6', fontWeight: '600', fontSize: '14px', color: '#495057' }}>Amount</th>
                    )}
                    {showUnitPriceColumn && (
                      <th style={{ padding: '16px 20px', textAlign: 'right', borderBottom: '1px solid #dee2e6', fontWeight: '600', fontSize: '14px', color: '#495057' }}>Price</th>
                    )}
                    <th style={{ padding: '16px 20px', textAlign: 'right', borderBottom: '1px solid #dee2e6', fontWeight: '600', fontSize: '14px', color: '#495057' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredTokens(walletData.tokens).map((token, index) => (
                    <tr key={token.tokenAddress} style={{ 
                      borderBottom: index < getFilteredTokens(walletData.tokens).length - 1 ? '1px solid #f1f3f4' : 'none',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
                        {token.logo && (
                          <img 
                            src={token.logo} 
                            alt={token.symbol}
                            style={{ 
                              width: 28, 
                              height: 28, 
                              marginRight: 12,
                              borderRadius: '50%',
                              border: '1px solid #e0e0e0'
                            }}
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '15px', color: '#212529', marginBottom: '2px' }}>{token.symbol}</div>
                          <div style={{ fontSize: '13px', color: '#6c757d' }}>{token.name}</div>
                        </div>
                      </td>
                      {showBalanceColumn && (
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'monospace', fontSize: '14px', color: '#495057' }}>
                          {formatBalance(token.balance, token.native)}
                        </td>
                      )}
                      {showUnitPriceColumn && (
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'monospace', fontSize: '14px', color: '#495057' }}>
                          {formatPrice(token.unitPrice)}
                        </td>
                      )}
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'monospace', fontSize: '14px', fontWeight: '600', color: '#212529' }}>
                        {formatPrice(token.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CollapsibleMenu>
          )}

          {/* DeFi Tables */}
          {walletData && walletData.deFi && walletData.deFi.length > 0 && (
            <>
              {/* Liquidity Pools Table */}
              {separateDefiByType(walletData.deFi).liquidity.length > 0 && (
                <CollapsibleMenu
                  title="Liquidity Pools"
                  isExpanded={liquidityPoolsExpanded}
                  onToggle={() => setLiquidityPoolsExpanded(!liquidityPoolsExpanded)}
                  leftValue={Object.values(groupByProtocolName(separateDefiByType(walletData.deFi).liquidity.map(defi => ({
                    protocol: defi.protocol?.name || 'Unknown Protocol',
                    label: defi.position?.name || 'Pool',
                    tokens: defi.position?.tokens?.filter(token => token.type === 'supplied') || [],
                    rewards: defi.position?.tokens?.filter(token => token.type === 'reward') || [],
                    totalValue: defi.position?.balance || 0,
                    protocol_id: defi.protocol?.id || '',
                    protocol_logo: defi.protocol?.logo || null
                  })))).flat().length}
                  leftLabel="Pools"
                  middleValue={formatPrice(Object.values(groupByProtocolName(separateDefiByType(walletData.deFi).liquidity.map(defi => ({
                    protocol: defi.protocol?.name || 'Unknown Protocol',
                    label: defi.position?.name || 'Pool',
                    tokens: defi.position?.tokens?.filter(token => token.type === 'supplied') || [],
                    rewards: defi.position?.tokens?.filter(token => token.type === 'reward') || [],
                    totalValue: defi.position?.balance || 0,
                    protocol_id: defi.protocol?.id || '',
                    protocol_logo: defi.protocol?.logo || null
                  })))).flat().reduce((sum, pos) => 
                    sum + (pos.rewards?.reduce((rewardSum, reward) => rewardSum + (reward.totalPrice || 0), 0) || 0), 0
                  ))}
                  middleLabel="Rewards"
                  rightValue={formatPrice(Object.values(groupByProtocolName(separateDefiByType(walletData.deFi).liquidity.map(defi => ({
                    protocol: defi.protocol?.name || 'Unknown Protocol',
                    label: defi.position?.name || 'Pool',
                    tokens: defi.position?.tokens?.filter(token => token.type === 'supplied') || [],
                    rewards: defi.position?.tokens?.filter(token => token.type === 'reward') || [],
                    totalValue: defi.position?.balance || 0,
                    protocol_id: defi.protocol?.id || '',
                    protocol_logo: defi.protocol?.logo || null
                  })))).flat().reduce((sum, pos) => 
                    sum + (pos.tokens?.reduce((tokenSum, token) => tokenSum + (token.totalPrice || 0), 0) || 0), 0
                  ))}
                  rightLabel="Balance"
                  optionsMenu={
                    <div style={{ padding: '8px 16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>
                        Display Options:
                      </div>
                      
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showPoolSubtotals}
                          onChange={(e) => setShowPoolSubtotals(e.target.checked)}
                          style={{ marginRight: 8 }}
                        />
                        Show pool subtotals
                      </label>
                    </div>
                  }
                >
                  {/* Hierarchical nested structure */}
                  <div style={{ backgroundColor: 'white', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                    {Object.entries(groupByProtocolName(separateDefiByType(walletData.deFi).liquidity.map(defi => ({
                      protocol: defi.protocol?.name || 'Unknown Protocol',
                      label: defi.position?.name || 'Pool',
                      tokens: defi.position?.tokens?.filter(token => token.type === 'supplied') || [],
                      rewards: defi.position?.tokens?.filter(token => token.type === 'reward') || [],
                      totalValue: defi.position?.balance || 0,
                      protocol_id: defi.protocol?.id || '',
                      protocol_logo: defi.protocol?.logo || null
                    })))).map(([protocol, positions], protocolIndex) => (
                      <div key={protocol} style={{ borderBottom: protocolIndex < Object.entries(groupByProtocolName(separateDefiByType(walletData.deFi).liquidity.map(defi => ({
                        protocol: defi.protocol?.name || 'Unknown Protocol',
                        label: defi.position?.name || 'Pool',
                        tokens: defi.position?.tokens?.filter(token => token.type === 'supplied') || [],
                        rewards: defi.position?.tokens?.filter(token => token.type === 'reward') || [],
                        totalValue: defi.position?.balance || 0,
                        protocol_id: defi.protocol?.id || '',
                        protocol_logo: defi.protocol?.logo || null
                      })))).length - 1 ? '1px solid #e9ecef' : 'none' }}>
                        <CollapsibleMenu
                          title={
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {positions[0] && positions[0].protocol_logo && (
                                <img 
                                  src={positions[0].protocol_logo} 
                                  alt={protocol}
                                  style={{ 
                                    width: 20, 
                                    height: 20, 
                                    marginRight: 8,
                                    borderRadius: '50%'
                                  }}
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                              )}
                              {protocol}
                            </div>
                          }
                          isExpanded={protocolExpansions[protocol] || false}
                          onToggle={() => toggleProtocolExpansion(protocol)}
                          leftValue={positions.length}
                          leftLabel="Pools"
                          middleValue={formatPrice(positions.reduce((sum, pos) => 
                            sum + (pos.rewards?.reduce((rewardSum, reward) => rewardSum + (reward.totalPrice || 0), 0) || 0), 0
                          ))}
                          middleLabel="Rewards"
                          rightValue={formatPrice(positions.reduce((sum, pos) => 
                            sum + (pos.tokens?.reduce((tokenSum, token) => tokenSum + (token.totalPrice || 0), 0) || 0), 0
                          ))}
                          rightLabel="Balance"
                        >
                          {/* Individual tokens within this protocol */}
                          <div style={{ backgroundColor: '#f8f9fa', padding: '12px 20px' }}>
                            {positions.map((position, positionIndex) => (
                              <div key={`${protocol}-${positionIndex}`} style={{ marginBottom: positionIndex < positions.length - 1 ? '12px' : '0' }}>
                                {position.tokens.map((token, tokenIndex) => (
                                  <div key={`${protocol}-${positionIndex}-token-${tokenIndex}`} 
                                       style={{ 
                                         display: 'flex', 
                                         justifyContent: 'space-between', 
                                         alignItems: 'center',
                                         padding: '8px 12px',
                                         backgroundColor: 'white',
                                         borderRadius: '6px',
                                         marginBottom: tokenIndex < position.tokens.length - 1 ? '4px' : '0',
                                         border: '1px solid #e9ecef'
                                       }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      {token.logo && (
                                        <img 
                                          src={token.logo} 
                                          alt={token.symbol}
                                          style={{ 
                                            width: 18, 
                                            height: 18, 
                                            marginRight: 8,
                                            borderRadius: '50%'
                                          }}
                                          onError={(e) => e.target.style.display = 'none'}
                                        />
                                      )}
                                      <span style={{ fontWeight: '600', fontSize: '14px' }}>{token.symbol}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#666' }}>
                                        {position.rewards && position.rewards.length > tokenIndex && position.rewards[tokenIndex] 
                                          ? formatPrice(position.rewards[tokenIndex].totalPrice || 0) 
                                          : '$0.00'}
                                      </span>
                                      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                                        {formatPrice(token.totalPrice || 0)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </CollapsibleMenu>
                      </div>
                    ))}
                  </div>
                </CollapsibleMenu>
              )}

              {/* Other DeFi Positions Table */}
              {separateDefiByType(walletData.deFi).other.length > 0 && (
                <CollapsibleMenu
                  title="DeFi Positions"
                  isExpanded={defiPositionsExpanded}
                  onToggle={() => setDefiPositionsExpanded(!defiPositionsExpanded)}
                  leftValue={groupDefiByProtocol(separateDefiByType(walletData.deFi).other).length}
                  leftLabel="Protocols"
                  middleValue={formatPrice(separateDefiByType(walletData.deFi).other.reduce((total, position) => 
                    total + (position.totalUnclaimed || 0), 0))}
                  middleLabel="Unclaimed"
                  rightValue={formatPrice(separateDefiByType(walletData.deFi).other.reduce((total, position) => 
                    total + position.balance, 0))}
                  rightLabel="Balance"
                >
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    backgroundColor: 'white',
                    borderRadius: '0 0 8px 8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: '1px solid #dee2e6',
                    borderTop: 'none'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Protocol</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Position</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Balance</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Unclaimed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupDefiByProtocol(separateDefiByType(walletData.deFi).other).map((protocolGroup, protocolIndex) => (
                        <React.Fragment key={protocolGroup.protocol.id}>
                          {protocolGroup.positions.map((position, positionIndex) => (
                            <tr key={`${protocolGroup.protocol.id}-position-${positionIndex}`} style={{ 
                              borderBottom: '1px solid #f1f3f4',
                              backgroundColor: '#fafbfc'
                            }}>
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {protocolGroup.protocol.logo && (
                                    <img 
                                      src={protocolGroup.protocol.logo} 
                                      alt={protocolGroup.protocol.name}
                                      style={{ 
                                        width: 20, 
                                        height: 20, 
                                        marginRight: 8,
                                        borderRadius: '50%'
                                      }}
                                      onError={(e) => e.target.style.display = 'none'}
                                    />
                                  )}
                                  <span style={{ fontWeight: 'bold' }}>{protocolGroup.protocol.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ fontWeight: '500' }}>{position.label}</span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {formatPrice(position.balance)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {formatPrice(position.totalUnclaimed || 0)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                            <td style={{ 
                              padding: '12px 15px', 
                              fontWeight: 'bold', 
                              fontSize: '14px', 
                              color: '#495057'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {positions[0] && positions[0].protocol_logo && (
                                  <img 
                                    src={positions[0].protocol_logo} 
                                    alt={protocol}
                                    style={{ 
                                      width: 20, 
                                      height: 20, 
                                      marginRight: 8,
                                      borderRadius: '50%'
                                    }}
                                    onError={(e) => e.target.style.display = 'none'}
                                  />
                                )}
                                {protocol}
                              </div>
                            </td>
                            <td style={{ 
                              padding: '12px 15px', 
                              textAlign: 'right', 
                              fontFamily: 'monospace', 
                              fontWeight: 'bold', 
                              fontSize: '14px', 
                            }}>
                              {formatPrice(positions.reduce((sum, pos) => 
                                sum + (pos.rewards?.reduce((rewardSum, reward) => rewardSum + (reward.totalPrice || 0), 0) || 0), 0
                              ))}
                            </td>
                          </tr>
                    </tbody>
                  </table>
                </CollapsibleMenu>
              )}
            </div>
          )}
        </div>

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.position.x - tooltip.text.length * 3,
              top: tooltip.position.y - 40,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              whiteSpace: 'pre-line',
              zIndex: 1000,
              maxWidth: '300px',
              wordWrap: 'break-word'
            }}
          >
            {tooltip.text}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            >
              Loading wallet data...
            </div>
          </div>
        )}
      </div>

      {/* Tooltip pointer */}
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.position.x - 6,
            top: tooltip.position.y - 40 + 32,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid rgba(0, 0, 0, 0.9)'
          }}
        />
      )}
    </div>
  )
}
                                <tr key={`${protocol}-${positionIndex}-token-${tokenIndex}`} style={{ borderBottom: '1px solid #f8f9fa' }}>
                                  <td style={{ padding: '8px 12px 8px 50px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      {token.logo && (
                                        <img 
                                          src={token.logo} 
                                          alt={token.symbol}
                                          style={{ 
                                            width: 16, 
                                            height: 16, 
                                            marginRight: 6,
                                            borderRadius: '50%'
                                          }}
                                          onError={(e) => e.target.style.display = 'none'}
                                        />
                                      )}
                                      <span style={{ fontSize: '14px', fontWeight: '500' }}>{token.symbol}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                    {position.rewards && position.rewards.length > tokenIndex && position.rewards[tokenIndex] ? (
                                      <div style={{ 
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: '3px'
                                      }}>
                                        <span>{formatPrice(position.rewards[tokenIndex].totalPrice || 0)}</span>
                                        <span
                                          style={{
                                            fontSize: '9px',
                                            color: '#6c757d',
                                            cursor: 'help',
                                            backgroundColor: '#f8f9fa',
                                            borderRadius: '50%',
                                            width: '14px',
                                            height: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'normal',
                                            border: '1px solid #dee2e6',
                                            opacity: 0.7,
                                            transition: 'opacity 0.2s',
                                            flexShrink: 0
                                          }}
                                          onMouseEnter={(e) => {
                                            e.target.style.opacity = '1'
                                            showTooltip(e, formatNativeBalance(position.rewards[tokenIndex]), `reward-${protocolIndex}-${positionIndex}-${tokenIndex}`)
                                          }}
                                          onMouseLeave={(e) => {
                                            e.target.style.opacity = '0.7'
                                            hideTooltip()
                                          }}
                                          onMouseMove={(e) => {
                                            const rect = e.target.getBoundingClientRect()
                                            setTooltipPosition({
                                              x: rect.left + rect.width / 2,
                                              y: rect.top - 10
                                            })
                                          }}
                                        >
                                          i
                                        </span>
                                      </div>
                                    ) : (
                                      <span style={{ color: '#6c757d' }}>-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                    <div style={{ 
                                      fontSize: '13px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'flex-end',
                                      gap: '3px'
                                    }}>
                                      <span>{formatPrice(token.totalPrice || 0)}</span>
                                      <span
                                        style={{
                                          fontSize: '9px',
                                          color: '#6c757d',
                                          cursor: 'help',
                                          backgroundColor: '#f8f9fa',
                                          borderRadius: '50%',
                                          width: '14px',
                                          height: '14px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 'normal',
                                          border: '1px solid #dee2e6',
                                          opacity: 0.7,
                                          transition: 'opacity 0.2s',
                                          flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.opacity = '1'
                                          showTooltip(e, formatNativeBalance(token), `balance-${protocolIndex}-${positionIndex}-${tokenIndex}`)
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.opacity = '0.7'
                                          hideTooltip()
                                        }}
                                        onMouseMove={(e) => {
                                          const rect = e.target.getBoundingClientRect()
                                          setTooltipPosition({
                                            x: rect.left + rect.width / 2,
                                            y: rect.top - 10
                                          })
                                        }}
                                      >
                                        i
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {/* Pool total line - conditionally rendered */}
                              {showPoolSubtotals && (
                                <tr style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#fafafa' }}>
                                  <td style={{ padding: '6px 12px 6px 40px', fontStyle: 'italic', fontSize: '11px', color: '#999' }}>
                                    {position.label} - {position.tokens.length} tokens
                                  </td>
                                  <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '11px', color: '#888' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                                      <span>{formatPrice(position.rewards?.reduce((sum, reward) => sum + (reward.totalPrice || 0), 0) || 0)}</span>
                                      <span
                                        style={{
                                          fontSize: '8px',
                                          color: '#6c757d',
                                          cursor: 'help',
                                          backgroundColor: '#f8f9fa',
                                          borderRadius: '50%',
                                          width: '12px',
                                          height: '12px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 'normal',
                                          border: '1px solid #dee2e6',
                                          opacity: 0.7,
                                          transition: 'opacity 0.2s',
                                          flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.opacity = '1'
                                          const nativeBalances = position.rewards?.map(reward => formatNativeBalance(reward)).join('\n') || 'No rewards'
                                          showTooltip(e, `${nativeBalances}`, `pool-rewards-${protocolIndex}-${positionIndex}`)
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.opacity = '0.7'
                                          hideTooltip()
                                        }}
                                        onMouseMove={(e) => {
                                          const rect = e.target.getBoundingClientRect()
                                          setTooltipPosition({
                                            x: rect.left + rect.width / 2,
                                            y: rect.top - 10
                                          })
                                        }}
                                      >
                                        i
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '11px', color: '#888' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                                      <span>{formatPrice(position.tokens?.reduce((sum, token) => sum + (token.totalPrice || 0), 0) || 0)}</span>
                                      <span
                                        style={{
                                          fontSize: '8px',
                                          color: '#6c757d',
                                          cursor: 'help',
                                          backgroundColor: '#f8f9fa',
                                          borderRadius: '50%',
                                          width: '12px',
                                          height: '12px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 'normal',
                                          border: '1px solid #dee2e6',
                                          opacity: 0.7,
                                          transition: 'opacity 0.2s',
                                          flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.opacity = '1'
                                          const nativeBalances = position.tokens?.map(token => formatNativeBalance(token)).join('\n') || 'No tokens'
                                          showTooltip(e, `${nativeBalances}`, `pool-balance-${protocolIndex}-${positionIndex}`)
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.opacity = '0.7'
                                          hideTooltip()
                                        }}
                                        onMouseMove={(e) => {
                                          const rect = e.target.getBoundingClientRect()
                                          setTooltipPosition({
                                            x: rect.left + rect.width / 2,
                                            y: rect.top - 10
                                          })
                                        }}
                                      >
                                        i
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                </CollapsibleMenu>
              )}

              {/* Other DeFi Positions Table */
              {separateDefiByType(walletData.deFi).other.length > 0 && (
                <CollapsibleMenu
                  title="DeFi Positions"
                  isExpanded={defiPositionsExpanded}
                  onToggle={() => setDefiPositionsExpanded(!defiPositionsExpanded)}
                  leftValue={groupDefiByProtocol(separateDefiByType(walletData.deFi).other).length}
                  leftLabel="Protocols"
                  middleValue={formatPrice(separateDefiByType(walletData.deFi).other.reduce((total, position) => 
                    total + (position.totalUnclaimed || 0), 0))}
                  middleLabel="Unclaimed"
                  rightValue={formatPrice(separateDefiByType(walletData.deFi).other.reduce((total, position) => 
                    total + position.balance, 0))}
                  rightLabel="Balance"
                >
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    backgroundColor: 'white',
                    borderRadius: '0 0 8px 8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: '1px solid #dee2e6',
                    borderTop: 'none'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Protocol</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Position</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Balance</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Unclaimed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupDefiByProtocol(separateDefiByType(walletData.deFi).other).map((protocolGroup, protocolIndex) => (
                        <React.Fragment key={protocolGroup.protocol.id}>
                          {/* Protocol Header Row */}
                          <tr style={{ 
                            backgroundColor: '#e9ecef',
                            borderBottom: '2px solid #dee2e6'
                          }}>
                            <td colSpan={4} style={{ padding: '12px', display: 'flex', alignItems: 'center' }}>
                              {protocolGroup.protocol.logo && (
                                <img 
                                  src={protocolGroup.protocol.logo} 
                                  alt={protocolGroup.protocol.name}
                                  style={{ 
                                    width: 28, 
                                    height: 28, 
                                    marginRight: 12,
                                    borderRadius: '50%'
                                  }}
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                              )}
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{protocolGroup.protocol.name}</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>{protocolGroup.positions.length} positions</div>
                              </div>
                            </td>
                          </tr>

                          {/* Positions for this Protocol */}
                          {protocolGroup.positions.map((position, positionIndex) => (
                            <React.Fragment key={`${protocolGroup.protocol.id}-position-${positionIndex}`}>
                              {/* Position Row */}
                              <tr style={{ 
                                borderBottom: '1px solid #f1f3f4',
                                backgroundColor: '#fafbfc'
                              }}>
                                <td style={{ padding: '12px 12px 12px 40px' }}>
                                  <div>
                                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {position.label}
                                      {position.additionalData && position.additionalData.healthFactor && (
                                        <span
                                          style={{
                                            fontSize: '10px',
                                            color: position.additionalData.healthFactor >= 1.5 ? '#28a745' : position.additionalData.healthFactor >= 1.2 ? '#ffc107' : '#dc3545',
                                            cursor: 'help',
                                            backgroundColor: position.additionalData.healthFactor >= 1.5 ? '#d4edda' : position.additionalData.healthFactor >= 1.2 ? '#fff3cd' : '#f8d7da',
                                            borderRadius: '8px',
                                            padding: '2px 6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            border: `1px solid ${position.additionalData.healthFactor >= 1.5 ? '#28a745' : position.additionalData.healthFactor >= 1.2 ? '#ffc107' : '#dc3545'}`,
                                            opacity: 0.9,
                                            transition: 'opacity 0.2s',
                                            flexShrink: 0,
                                            minWidth: '35px'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.target.style.opacity = '1'
                                            const healthFactor = position.additionalData.healthFactor
                                            let explanation = ''
                                            if (healthFactor >= 1.5) {
                                              explanation = 'Verde: Health Factor saudável (≥1.5) - Risco baixo de liquidação'
                                            } else if (healthFactor >= 1.2) {
                                              explanation = 'Amarelo: Health Factor moderado (1.2-1.5) - Risco médio de liquidação'
                                            } else {
                                              explanation = 'Vermelho: Health Factor baixo (<1.2) - Alto risco de liquidação'
                                            }
                                            showTooltip(e, `Health Factor: ${healthFactor.toFixed(2)} - ${explanation}`, `health-${positionIndex}`)
                                          }}
                                          onMouseLeave={(e) => {
                                            e.target.style.opacity = '0.9'
                                            hideTooltip()
                                          }}
                                          onMouseMove={(e) => {
                                            const rect = e.target.getBoundingClientRect()
                                            setTooltipPosition({
                                              x: rect.left + rect.width / 2,
                                              y: rect.top - 10
                                            })
                                          }}
                                        >
                                          {position.additionalData.healthFactor.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>{position.tokens.length} tokens</div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  {/* Empty for better visual separation */}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                  {formatPrice(position.balance)}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                  {position.totalUnclaimed ? formatPrice(position.totalUnclaimed) : '-'}
                                </td>
                              </tr>
                              
                              {/* Individual Tokens Rows */}
                              {position.tokens.map((token, tokenIndex) => (
                                <tr key={`${protocolGroup.protocol.id}-${positionIndex}-${token.contractAddress}-${tokenIndex}`} style={{ 
                                  borderBottom: tokenIndex === position.tokens.length - 1 && 
                                               positionIndex === protocolGroup.positions.length - 1 && 
                                               protocolIndex === groupDefiByProtocol(separateDefiByType(walletData.deFi).other).length - 1 ? 'none' : '1px solid #f8f9fa',
                                  backgroundColor: 'white'
                                }}>
                                  <td style={{ padding: '8px 12px 8px 60px', display: 'flex', alignItems: 'center' }}>
                                    {token.logo && (
                                      <img 
                                        src={token.logo} 
                                        alt={token.symbol}
                                        style={{ 
                                          width: 18, 
                                          height: 18, 
                                          marginRight: 8,
                                          borderRadius: '50%'
                                        }}
                                        onError={(e) => e.target.style.display = 'none'}
                                      />
                                    )}
                                    <div>
                                      <div style={{ fontWeight: '500', fontSize: '13px' }}>{token.symbol}</div>
                                      <div style={{ fontSize: '10px', color: '#888' }}>{token.type}</div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#666' }}>
                                    {token.name}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px' }}>
                                    {formatPrice(token.totalPrice)}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: '#666' }}>
                                    {formatPrice(token.unitPrice)}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </CollapsibleMenu>
              )}
            </>
          )}
        </div>
      )}

      {!window.ethereum && <p style={{ color: 'red' }}>MetaMask not detected in browser.</p>}

      {/* Custom Tooltip */}
      {tooltipVisible && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translateX(-50%) translateY(-100%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-line',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          {tooltipVisible.split('-')[0]}
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(0, 0, 0, 0.9)'
            }}
          />
        </div>
      )}
    </div>
  )
}
