import React, { useEffect, useState } from 'react'
import CollapsibleMenu from './components/CollapsibleMenu'
import { useWalletConnection, useWalletData, useTooltip } from './hooks/useWallet'
import { 
  formatBalance, 
  formatNativeBalance, 
  formatPrice, 
  groupDefiByProtocol, 
  groupByProtocolName, 
  separateDefiByType, 
  getFilteredTokens,
  groupTokensByPool 
} from './utils/walletUtils'
import { 
  DEFAULT_COLUMN_VISIBILITY, 
  DEFAULT_EXPANSION_STATES, 
  DEFAULT_FILTER_SETTINGS 
} from './constants/config'

export default function App() {
  // Wallet connection hook
  const { account, loading, setLoading, connectWallet, copyAddress, disconnect } = useWalletConnection()
  
  // Wallet data hook
  const { walletData, callAccountAPI, refreshWalletData } = useWalletData()
  
  // Tooltip hook
  const { tooltipVisible, tooltipPosition, showTooltip, hideTooltip, setTooltipPosition } = useTooltip()
  
  // UI state from constants
  const [showOnlyPositiveBalance, setShowOnlyPositiveBalance] = useState(DEFAULT_FILTER_SETTINGS.showOnlyPositiveBalance)
  const [showDefiTokens, setShowDefiTokens] = useState(false) // Hide defi-tokens by default
  const [liquidityPoolsExpanded, setLiquidityPoolsExpanded] = useState(DEFAULT_EXPANSION_STATES.liquidityPoolsExpanded)
  const [tokensExpanded, setTokensExpanded] = useState(DEFAULT_EXPANSION_STATES.tokensExpanded)
  const [defiPositionsExpanded, setDefiPositionsExpanded] = useState(DEFAULT_EXPANSION_STATES.defiPositionsExpanded)
  
  // Column visibility states
  const [showBalanceColumn, setShowBalanceColumn] = useState(DEFAULT_COLUMN_VISIBILITY.showBalanceColumn)
  const [showUnitPriceColumn, setShowUnitPriceColumn] = useState(DEFAULT_COLUMN_VISIBILITY.showUnitPriceColumn)
  
  // Protocol expansion states for nested menus
  const [protocolExpansions, setProtocolExpansions] = useState({})

  // Pool expansion states for individual pools within protocols
  const [defaultStates, setDefaultStates] = useState({})

  // Function to toggle protocol expansion
  const toggleProtocolExpansion = (protocolName) => {
    setProtocolExpansions(prev => ({
      ...prev,
      [protocolName]: !prev[protocolName]
    }))
  }

  // Refresh wallet data wrapper
  const handleRefreshWalletData = () => {
    refreshWalletData(account, setLoading)
  }

  // Filter function for DeFi tokens
  const getFilteredDefiTokens = (tokens) => {
    if (!tokens) return []
    return showDefiTokens ? tokens : tokens.filter(token => token.type !== 'defi-token')
  }

  // Call API when account changes
  useEffect(() => {
    if (account) {
      callAccountAPI(account, setLoading)
    }
  }, [account, callAccountAPI])

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      padding: 20, 
      backgroundColor: '#f5f5f5', 
      minHeight: '100vh' 
    }}>
      {/* Modern Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '24px 32px',
        marginBottom: '32px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Logo and Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)'
            }}>
              <span style={{ fontSize: '24px' }}>🌐</span>
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: '700',
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                letterSpacing: '-0.5px'
              }}>
                Defi10
              </h1>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: 'rgba(255,255,255,0.8)',
                fontWeight: '400'
              }}>
                Web3 Portfolio Explorer
              </p>
            </div>
          </div>

          {/* Account Info and Actions */}
          {!account ? (
            <button 
              onClick={connectWallet} 
              style={{ 
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.3)'
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.2)'
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
              }}
            >
              Connect Wallet
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Account Badge */}
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#4ade80',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px rgba(74, 222, 128, 0.5)'
                }}></div>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: '500',
                    marginBottom: '2px'
                  }}>
                    Connected Account
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'white',
                    fontFamily: 'monospace',
                    fontWeight: '600'
                  }}>
                    {`${account.slice(0, 6)}...${account.slice(-4)}`}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={copyAddress}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.25)'
                    e.target.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.15)'
                    e.target.style.transform = 'translateY(0)'
                  }}
                  title="Copy address to clipboard"
                >
                  📋 Copy
                </button>
                
                <button 
                  onClick={handleRefreshWalletData}
                  disabled={loading}
                  style={{
                    background: loading ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: loading ? 'rgba(255,255,255,0.5)' : 'white',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.target.style.background = 'rgba(255,255,255,0.25)'
                      e.target.style.transform = 'translateY(-1px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.target.style.background = 'rgba(255,255,255,0.15)'
                      e.target.style.transform = 'translateY(0)'
                    }
                  }}
                  title="Refresh wallet data"
                >
                  {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>
                
                <button 
                  onClick={disconnect}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fecaca',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(239, 68, 68, 0.3)'
                    e.target.style.color = 'white'
                    e.target.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(239, 68, 68, 0.2)'
                    e.target.style.color = '#fecaca'
                    e.target.style.transform = 'translateY(0)'
                  }}
                  title="Disconnect wallet"
                >
                  🚪 Disconnect
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%'
            }}></div>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500' }}>
              Loading wallet data...
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      {account && (
        <div>
          {/* Tokens Table */}
          {walletData && walletData.tokens && walletData.tokens.length > 0 && (
            <CollapsibleMenu
              title="Wallet"
              isExpanded={tokensExpanded}
              onToggle={() => setTokensExpanded(!tokensExpanded)}
              leftValue={getFilteredTokens(walletData.tokens, showOnlyPositiveBalance).length}
              leftLabel="Tokens"
              middleValue=""
              middleLabel=""
              rightValue={formatPrice(getFilteredTokens(walletData.tokens, showOnlyPositiveBalance).reduce((sum, token) => sum + parseFloat(token.totalPrice || 0), 0))}
              rightLabel="Balance"
              level={0}
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
                  {getFilteredTokens(walletData.tokens, showOnlyPositiveBalance).map((token, index) => (
                    <tr key={token.tokenAddress} style={{ 
                      borderBottom: index < getFilteredTokens(walletData.tokens, showOnlyPositiveBalance).length - 1 ? '1px solid #f1f3f4' : 'none',
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
                          {formatPrice(token.price)}
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
                  level={0}
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
                      <div key={protocol} style={{ 
                        borderBottom: protocolIndex < Object.entries(groupByProtocolName(separateDefiByType(walletData.deFi).liquidity.map(defi => ({
                          protocol: defi.protocol?.name || 'Unknown Protocol',
                          label: defi.position?.name || 'Pool',
                          tokens: defi.position?.tokens?.filter(token => token.type === 'supplied') || [],
                          rewards: defi.position?.tokens?.filter(token => token.type === 'reward') || [],
                          totalValue: defi.position?.balance || 0,
                          protocol_id: defi.protocol?.id || '',
                          protocol_logo: defi.protocol?.logo || null
                        })))).length - 1 ? '1px solid #e9ecef' : 'none'
                      }}>
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
                          isNested={true} // Indica que é um menu aninhado
                          level={1}
                        >
                            {/* Pool submenus within this protocol */}
                            {Object.entries(groupTokensByPool(positions)).map(([poolName, poolData], poolIndex) => {
                              const poolRewardsTotal = poolData.rewards ? poolData.rewards.reduce((sum, reward) => sum + (reward?.totalPrice || 0), 0) : 0;
                              const poolKey = `pool-${protocol}-${poolIndex}`;
                              
                              // Cria o título do pool com logos dos tokens
                              const poolTitle = (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {poolData.tokens.map((token, tokenIndex) => (
                                    <React.Fragment key={`${poolKey}-logo-${tokenIndex}`}>
                                      {token.logo && (
                                        <img 
                                          src={token.logo} 
                                          alt={token.symbol}
                                          style={{ 
                                            width: 18, 
                                            height: 18, 
                                            marginRight: 4,
                                            borderRadius: '50%',
                                            border: '1px solid #e0e0e0'
                                          }}
                                          onError={(e) => e.target.style.display = 'none'}
                                        />
                                      )}
                                      <span style={{ marginRight: tokenIndex < poolData.tokens.length - 1 ? 4 : 0 }}>
                                        {token.symbol}
                                      </span>
                                      {tokenIndex < poolData.tokens.length - 1 && (
                                        <span style={{ margin: '0 4px', color: '#666' }}>/</span>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              );
                              
                              return (
                                <CollapsibleMenu 
                                  key={poolKey}
                                  title={poolTitle}
                                  isExpanded={defaultStates[poolKey] || false}
                                  onToggle={() => setDefaultStates(prev => ({ ...prev, [poolKey]: !prev[poolKey] }))}
                                  leftValue={formatPrice(poolRewardsTotal)}
                                  leftLabel="Rewards"
                                  rightValue={formatPrice(poolData.totalValue)}
                                  rightLabel="Balance"
                                  isNested={true}
                                  level={2}
                                >
                                  {/* Individual token cells within this pool */}
                                  <div style={{ 
                                    backgroundColor: '#f8f9fa', 
                                    padding: '16px 24px',
                                    margin: '8px 0',
                                    borderRadius: '8px',
                                    border: '1px solid #e0e0e0'
                                  }}>
                                    {poolData.tokens.map((token, tokenIndex) => {
                                      const tokenReward = poolData.rewards && poolData.rewards.length > tokenIndex && poolData.rewards[tokenIndex] 
                                        ? poolData.rewards[tokenIndex].totalPrice || 0 
                                        : 0;
                                      
                                      return (
                                        <div key={`${protocol}-pool-${poolIndex}-token-${tokenIndex}`} 
                                             style={{ 
                                               display: 'flex', 
                                               justifyContent: 'space-between', 
                                               alignItems: 'center',
                                               padding: '12px 16px',
                                               backgroundColor: 'white',
                                               borderRadius: '8px',
                                               marginBottom: tokenIndex < poolData.tokens.length - 1 ? '6px' : '0',
                                               border: '1px solid #e9ecef',
                                               boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                               transition: 'all 0.2s ease'
                                             }}
                                             onMouseEnter={(e) => {
                                               e.currentTarget.style.backgroundColor = '#f8f9fa'
                                               e.currentTarget.style.transform = 'translateY(-1px)'
                                               e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)'
                                             }}
                                             onMouseLeave={(e) => {
                                               e.currentTarget.style.backgroundColor = 'white'
                                               e.currentTarget.style.transform = 'translateY(0)'
                                               e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                                             }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {token.logo && (
                                              <img 
                                                src={token.logo} 
                                                alt={token.symbol}
                                                style={{ 
                                                  width: 20,
                                                  height: 20, 
                                                  marginRight: 10,
                                                  borderRadius: '50%',
                                                  border: '1px solid #e0e0e0'
                                                }}
                                                onError={(e) => e.target.style.display = 'none'}
                                              />
                                            )}
                                            <span style={{ 
                                              fontWeight: '600', 
                                              fontSize: '14px',
                                              color: '#212529'
                                            }}>{token.symbol}</span>
                                          </div>
                                          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                            <div style={{ textAlign: 'right' }}>
                                              <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '2px' }}>Rewards</div>
                                              <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '500' }}>
                                                {formatPrice(tokenReward)}
                                              </span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                              <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '2px' }}>Balance</div>
                                              <span style={{ 
                                                fontFamily: 'monospace', 
                                                fontSize: '14px', 
                                                fontWeight: '600',
                                                color: '#212529'
                                              }}>
                                                {formatPrice(token.totalPrice || 0)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CollapsibleMenu>
                              );
                            })}
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
                  level={0}
                  leftValue={groupDefiByProtocol(separateDefiByType(walletData.deFi).other).length}
                  leftLabel="Protocols"
                  rightValue={formatPrice(separateDefiByType(walletData.deFi).other.reduce((total, position) => 
                    total + position.balance, 0))}
                  rightLabel="Balance"
                  optionsMenu={
                    <div style={{ padding: '8px 16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={showDefiTokens}
                          onChange={(e) => setShowDefiTokens(e.target.checked)}
                          style={{ marginRight: 8 }}
                        />
                        Show internal DeFi tokens
                      </label>
                      
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '4px', fontStyle: 'italic' }}>
                        Internal tokens (like debt tokens) are hidden by default
                      </div>
                    </div>
                  }
                >
                  {/* Hierarchical nested structure for DeFi */}
                  <div style={{ backgroundColor: 'white', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                    {groupDefiByProtocol(separateDefiByType(walletData.deFi).other).map((protocolGroup, protocolIndex) => (
                      <div key={protocolGroup.protocol.id} style={{ 
                        borderBottom: protocolIndex < groupDefiByProtocol(separateDefiByType(walletData.deFi).other).length - 1 ? '1px solid #e9ecef' : 'none'
                      }}>
                        <CollapsibleMenu
                          title={
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
                              {protocolGroup.protocol.name}
                            </div>
                          }
                          isExpanded={protocolExpansions[protocolGroup.protocol.name] || false}
                          onToggle={() => toggleProtocolExpansion(protocolGroup.protocol.name)}
                          leftValue={protocolGroup.positions.length}
                          leftLabel="Positions"
                          rightValue={formatPrice(protocolGroup.positions.reduce((sum, pos) => 
                            sum + pos.balance, 0))}
                          rightLabel="Balance"
                          isNested={true}
                          level={1}
                        >
                          {/* Individual positions within this protocol */}
                          {protocolGroup.positions.map((position, positionIndex) => {
                            const positionKey = `defi-${protocolGroup.protocol.id}-${positionIndex}`;
                            
                            return (
                              <CollapsibleMenu 
                                key={positionKey}
                                title={
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span>{position.label}</span>
                                    {position.additionalData?.healthFactor && (
                                      <span 
                                        style={{ 
                                          marginLeft: 12,
                                          padding: '2px 8px',
                                          backgroundColor: position.additionalData.healthFactor > 1.5 ? '#d4edda' : 
                                                           position.additionalData.healthFactor > 1.2 ? '#fff3cd' : '#f8d7da',
                                          color: position.additionalData.healthFactor > 1.5 ? '#155724' : 
                                                 position.additionalData.healthFactor > 1.2 ? '#856404' : '#721c24',
                                          borderRadius: '12px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          cursor: 'help'
                                        }}
                                        title={`Health Factor: ${parseFloat(position.additionalData.healthFactor).toFixed(2)}`}
                                      >
                                        {parseFloat(position.additionalData.healthFactor).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                }
                                isExpanded={defaultStates[positionKey] || false}
                                onToggle={() => setDefaultStates(prev => ({ ...prev, [positionKey]: !prev[positionKey] }))}
                                rightValue={formatPrice(position.balance)}
                                rightLabel="Balance"
                                isNested={true}
                                level={2}
                              >
                                {/* Individual tokens within this position */}
                                <div style={{ 
                                  backgroundColor: '#f8f9fa', 
                                  padding: '16px 24px',
                                  margin: '8px 0',
                                  borderRadius: '8px',
                                  border: '1px solid #e0e0e0'
                                }}>
                                  {getFilteredDefiTokens(position.tokens).length === 0 ? (
                                    <div style={{ 
                                      textAlign: 'center', 
                                      color: '#6c757d', 
                                      fontSize: '14px',
                                      fontStyle: 'italic',
                                      padding: '20px'
                                    }}>
                                      All tokens are hidden by current filter settings
                                    </div>
                                  ) : (
                                    getFilteredDefiTokens(position.tokens).map((token, tokenIndex) => (
                                    <div key={`${positionKey}-token-${tokenIndex}`} 
                                         style={{ 
                                           display: 'flex', 
                                           justifyContent: 'space-between', 
                                           alignItems: 'center',
                                           padding: '12px 16px',
                                           backgroundColor: 'white',
                                           borderRadius: '8px',
                                           marginBottom: tokenIndex < getFilteredDefiTokens(position.tokens).length - 1 ? '6px' : '0',
                                           border: '1px solid #e9ecef',
                                           boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                           transition: 'all 0.2s ease'
                                         }}
                                         onMouseEnter={(e) => {
                                           e.currentTarget.style.backgroundColor = '#f8f9fa'
                                           e.currentTarget.style.transform = 'translateY(-1px)'
                                           e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)'
                                         }}
                                         onMouseLeave={(e) => {
                                           e.currentTarget.style.backgroundColor = 'white'
                                           e.currentTarget.style.transform = 'translateY(0)'
                                           e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                                         }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {token.logo && (
                                          <img 
                                            src={token.logo} 
                                            alt={token.symbol}
                                            style={{ 
                                              width: 20,
                                              height: 20, 
                                              marginRight: 10,
                                              borderRadius: '50%',
                                              border: '1px solid #e0e0e0'
                                            }}
                                            onError={(e) => e.target.style.display = 'none'}
                                          />
                                        )}
                                        <div>
                                          <span style={{ 
                                            fontWeight: '600', 
                                            fontSize: '14px',
                                            color: '#212529',
                                            marginRight: 8
                                          }}>{token.symbol}</span>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        {token.type !== 'defi-token' && (
                                          <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '2px' }}>Value</div>
                                            <span style={{ 
                                              fontFamily: 'monospace', 
                                              fontSize: '14px', 
                                              fontWeight: '600',
                                              color: '#212529'
                                            }}>
                                              {formatPrice(token.totalPrice || 0)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                  )}
                                </div>
                              </CollapsibleMenu>
                            );
                          })}
                        </CollapsibleMenu>
                      </div>
                    ))}
                  </div>
                </CollapsibleMenu>
              )}
            </>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltipVisible && (
          <div
            style={{
              position: 'fixed',
              left: tooltipPosition.x - tooltipVisible.length * 3,
              top: tooltipPosition.y - 40,
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
            {tooltipVisible}
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
  )
}