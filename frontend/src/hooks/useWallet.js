import { useState, useEffect, useCallback, useRef } from 'react'
import { STORAGE_KEY, EXPIRY_HOURS, API_BASE } from '../constants/config'

// Custom hook for wallet connection and account management
export function useWalletConnection() {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [supportedChains, setSupportedChains] = useState([])
  const [chainsLoading, setChainsLoading] = useState(false)
  const chainsFetchedRef = useRef(false)

  const fetchSupportedChains = useCallback(async ({ force } = {}) => {
    if (chainsFetchedRef.current && !force) return
    if (!chainsFetchedRef.current) chainsFetchedRef.current = true
    try {
      setChainsLoading(true)
      const res = await fetch(`${API_BASE}/wallets/supported-chains`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setSupportedChains(data)
        } else if (data) {
          if (Array.isArray(data.supportedChains)) setSupportedChains(data.supportedChains)
          else if (Array.isArray(data.chains)) setSupportedChains(data.chains)
          else if (Array.isArray(data.data)) setSupportedChains(data.data)
        }
      } else {
        console.error('Failed to fetch supported chains', res.status)
      }
    } catch (err) {
      console.error('Error fetching supported chains', err)
    } finally {
      setChainsLoading(false)
    }
  }, [])

  // Stable wrapper so components can depend on a memoized function (prevents effect loops)
  const refreshSupportedChains = useCallback((force = false) => fetchSupportedChains({ force }), [fetchSupportedChains])

  // Save account with expiry
  function saveAccount(addr) {
    const data = {
      account: addr,
      timestamp: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setAccount(addr)
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
    fetchSupportedChains()
  }, [fetchSupportedChains])

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

  return {
    account,
    loading,
    setLoading,
    supportedChains,
    chainsLoading,
    refreshSupportedChains,
    connectWallet,
    copyAddress,
    disconnect
  }
}

// Custom hook for wallet data API calls
export function useWalletData() {
  const [walletData, setWalletData] = useState(null)

  // Call API when account is available
  const callAccountAPI = useCallback(async (accountAddress, setLoading) => {
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
  }, [])

  // Refresh wallet data - calls API again
  const refreshWalletData = useCallback(async (account, setLoading) => {
    if (account) {
      await callAccountAPI(account, setLoading)
    }
  }, [callAccountAPI])

  const clearWalletData = useCallback(() => {
    setWalletData(null)
  }, [])

  return {
    walletData,
    callAccountAPI,
    refreshWalletData,
    clearWalletData
  }
}

// Custom hook for tooltip management
export function useTooltip() {
  const [tooltipVisible, setTooltipVisible] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

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

  return {
    tooltipVisible,
    tooltipPosition,
    showTooltip,
    hideTooltip,
    setTooltipPosition
  }
}
