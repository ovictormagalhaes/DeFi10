import React, { useEffect, useState, useRef } from 'react';

import ErrorBoundary from './components/ErrorBoundary';
import HeaderBar from './components/HeaderBar';
import ProtocolsSection from './components/ProtocolsSection';
import SectionTable from './components/SectionTable';
import { ChainIconsProvider } from './context/ChainIconsProvider';
import { MaskValuesProvider } from './context/MaskValuesContext';
import { useTheme } from './context/ThemeProvider.tsx';
import { useWalletConnection, useTooltip } from './hooks/useWallet';
import { WalletTokensTable } from './components/tables';
import SummaryView from './components/SummaryView';
import RebalancingView from './components/RebalancingView'; // will render under 'strategies'
import PoolsView from './components/PoolsView.tsx';
import SegmentedNav from './components/SegmentedNav';
import { useAggregationJob } from './hooks/useAggregationJob';
import { api } from './config/api';
import {
  formatBalance,
  formatNativeBalance,
  formatPrice,
  formatTokenAmount,
  groupDefiByProtocol,
  getFilteredTokens,
  ITEM_TYPES,
  filterItemsByType,
  getWalletTokens,
  getLiquidityPools,
  computePortfolioBreakdown,
  setTotalPortfolioValue,
  calculatePercentage,
} from './utils/walletUtils';
import { 
  getLiquidityPoolItems,
  getLendingItems, 
  getStakingItems
} from './types/filters';
import {
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_EXPANSION_STATES,
  DEFAULT_FILTER_SETTINGS,
} from './constants/config';

function App() {
  const { theme, mode, toggleTheme } = useTheme();
  const [maskValues, setMaskValues] = useState(false);
  const toggleMaskValues = () => setMaskValues((m) => !m);

  // Persist maskValues in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('defi10_mask_values');
      if (stored === 'true') setMaskValues(true);
      if (stored === 'false') setMaskValues(false);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('defi10_mask_values', String(maskValues));
    } catch {}
  }, [maskValues]);
  // Responsive horizontal padding logic: 15% on large notebook/desktop screens
  const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const [viewportWidth, setViewportWidth] = useState(initialWidth);
  useEffect(() => {
    const handleResize = () =>
      setViewportWidth(typeof window !== 'undefined' ? window.innerWidth : initialWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // Breakpoints: >=1100px => 15% side padding, >=800px => 8%, 480-799px => 20px, <480px => 0
  const sidePadding =
    viewportWidth >= 1100
      ? '4%'
      : viewportWidth >= 800
        ? '2%'
        : viewportWidth >= 480
          ? '20px'
          : '0';
  // Mobile breakpoint for header/menu responsiveness
  const isMobile = viewportWidth < 700;
  // Responsive column visibility breakpoints for tables
  // >= 900px: Token | Amount | Price | Value
  // 600px–899px: Token | Amount | Value (hide Price)
  // < 600px: Token | Value (hide Amount & Price)
  const tableHidePrice = viewportWidth < 900;
  const tableHideAmount = viewportWidth < 600;
  // Wallet connection
  const {
    account,
    loading,
    setLoading,
    connectWallet,
    copyAddress,
    disconnect,
    supportedChains,
    chainsLoading,
    refreshSupportedChains,
    getRebalances,
  } = useWalletConnection();
  // Track first connect for pulse animation
  const hasPulsedRef = useRef(false);
  const [showPulse, setShowPulse] = useState(false);
  // Hover state for account badge (to reveal disconnect inside badge)
  const [showAccountHover, setShowAccountHover] = useState(false);
  useEffect(() => {
    if (account && !hasPulsedRef.current) {
      setShowPulse(true);
      hasPulsedRef.current = true;
      const t = setTimeout(() => setShowPulse(false), 1600);
      return () => clearTimeout(t);
    }
  }, [account]);
  // Wallet data derivado da agregação (substitui fluxo legacy /wallets/accounts)
  const [walletData, setWalletData] = useState(null);
  const callAccountAPI = () => {};
  const refreshWalletData = () => {};
  const clearWalletData = () => {};
  const [rebalanceInfo, setRebalanceInfo] = useState(null);
  const fetchRebalancesFor = async (addr) => {
    if (!addr) {
      setRebalanceInfo(null);
      return;
    }
    try {
      const res = await fetch(api.getRebalances(addr));
      if (!res.ok) {
        setRebalanceInfo(null);
        return;
      }
      const data = await res.json();
      setRebalanceInfo(data);
    } catch {
      setRebalanceInfo(null);
    }
  };
  // Tooltip
  const { tooltipVisible, tooltipPosition } = useTooltip();

  // Filters and UI states
  const [showOnlyPositiveBalance, setShowOnlyPositiveBalance] = useState(
    DEFAULT_FILTER_SETTINGS?.showOnlyPositiveBalance ?? true
  );
  const [tokensExpanded, setTokensExpanded] = useState(
    DEFAULT_EXPANSION_STATES?.tokensExpanded ?? true
  );
  // Top-level sections now are protocols; legacy section flags kept (not used)
  const [liquidityPoolsExpanded, setLiquidityPoolsExpanded] = useState(
    DEFAULT_EXPANSION_STATES?.liquidityPoolsExpanded ?? true
  );
  const [lendingAndBorrowingExpanded, setLendingAndBorrowingExpanded] = useState(true);
  const [stakingExpanded, setStakingExpanded] = useState(true);

  const [showBalanceColumn, setShowBalanceColumn] = useState(
    DEFAULT_COLUMN_VISIBILITY?.showBalanceColumn ?? true
  );
  const [showUnitPriceColumn, setShowUnitPriceColumn] = useState(
    DEFAULT_COLUMN_VISIBILITY?.showUnitPriceColumn ?? true
  );

  const [showLendingDefiTokens, setShowLendingDefiTokens] = useState(false);
  const [showStakingDefiTokens, setShowStakingDefiTokens] = useState(false);
  // Chain selection (null or Set of canonical keys). Default: all selected
  const [selectedChains, setSelectedChains] = useState(null);
  // View mode toggle state
  // (legacy viewMode state removed; sidebar navigation provides viewMode further below)

  const [defaultStates, setDefaultStates] = useState({});
  const [protocolExpansions, setProtocolExpansions] = useState({});
  // Ensure any new protocol defaults to expanded=true (so Uniswap/Aave open automatically)
  useEffect(() => {
    // After walletData loaded, infer protocol names and set default true if not set
    const allDefi = [
      ...(getLiquidityPoolsData() || []),
      ...(getLendingAndBorrowingData() || []),
      ...(getStakingData() || []),
    ];
    if (!allDefi.length) return;
    const protocolNames = new Set();
    allDefi.forEach((p) => {
      const name =
        p.protocol?.name ||
        p.position?.protocol?.name ||
        p.position?.name ||
        p.protocolName ||
        p.name;
      if (name) protocolNames.add(name);
    });
    setProtocolExpansions((prev) => {
      let changed = false;
      const next = { ...prev };
      protocolNames.forEach((n) => {
        if (next[n] === undefined) {
          next[n] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletData]);
  const toggleProtocolExpansion = (protocolName) =>
    setProtocolExpansions((prev) => ({ ...prev, [protocolName]: !prev[protocolName] }));

  // Search any address
  const [searchAddress, setSearchAddress] = useState('');
  const resetSelectionAndSnapshot = () => {
    setSelectedChains(null);
    walletDataSnapshotRef.current = null;
  };
  const handleSearch = () => {
    const addr = (searchAddress || '').trim();
    if (!addr) {
      alert('Please enter a wallet address');
      return;
    }
    // Apenas rebalances; supported-chains já está em cache (evitar spam)
    fetchRebalancesFor(addr);
    // Auto start aggregation para endereço pesquisado
    setActiveAggregationAddress(addr);
  };

  // Refresh current account
  const handleRefreshWalletData = () => {
    if (account) fetchRebalancesFor(account);
    // Reinicia agregação para conta conectada
    if (account) setRefreshNonce(n => n + 1);
  };

  // Load data when account changes
  useEffect(() => {
    if (!account) {
      walletDataSnapshotRef.current = null;
      setSelectedChains(null);
    }
    // Não forçamos refreshSupportedChains aqui para evitar requisições repetidas.
  }, [account]);

  // ----------------------
  // Aggregation Integration (declarar antes de efeitos que dependem de aggSnapshot)
  // ----------------------
  const {
    ensure: ensureAggregation,
    jobId: aggJobId,
    snapshot: aggSnapshot,
    summary: aggSummary,
    loading: aggLoading,
    isCompleted: aggCompleted,
    expired: aggExpired,
    reset: resetAgg,
    progress: aggProgress,
    expected: aggExpected,
    succeeded: aggSucceeded,
    failed: aggFailed,
    timedOut: aggTimedOut,
    status: aggStatus,
  } = useAggregationJob();
  // Após agregação finalizada, buscar supported chains (adiado para evitar requisição inicial extra)
  useEffect(() => {
    if (aggCompleted) {
      // force para garantir primeira carga mesmo se hook marcar fetch já feito
      try { refreshSupportedChains(true); } catch {}
    }
  }, [aggCompleted, refreshSupportedChains]);
  // Gated rebalances: só buscar após agregação completa para evitar dados inconsistentes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!account || !aggCompleted) {
        if (!account) setRebalanceInfo(null);
        return;
      }
      try {
        const res = await fetch(api.getRebalances(account));
        if (!res.ok) {
          if (!cancelled) setRebalanceInfo(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setRebalanceInfo(data);
      } catch (e) {
        if (!cancelled) setRebalanceInfo(null);
      }
    })();
    return () => { cancelled = true; };
  }, [account, aggCompleted]);
  // (Removed legacy effect that forced 'Default' view before aggregation completion.)
  // TEMP: Force aggregation overlay always visible for visual review.
  // Debug/QA: ativar overlay forçado via variável de ambiente VITE_FORCE_AGG_OVERLAY=1
  const DEV_FORCE_AGG_OVERLAY = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_FORCE_AGG_OVERLAY === '1' || import.meta.env?.VITE_FORCE_AGG_OVERLAY === 'true'));
  // Ajuste: se overlay forçado não bloquear menu depois de pronto? Mantemos comportamento original (não mostra menus até ready) para consistência.
  // Ready flag: only true when aggregation finished and walletData mapped
  const isAggregationReady = aggCompleted && !!walletData;

  // Immutable snapshot of the last full walletData to ensure global aggregates (chainTotals) are independent from any UI filtering mutations.
  const walletDataSnapshotRef = React.useRef(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  // Mapear items da agregação (strings) -> tipos numéricos esperados pelos utilitários
  useEffect(() => {
    if (!aggSnapshot || !Array.isArray(aggSnapshot.items)) {
      setWalletData(null);
      return;
    }
    const TYPE_MAP = {
      Wallet: ITEM_TYPES.WALLET,
      LiquidityPool: ITEM_TYPES.LIQUIDITY_POOL,
      LendingAndBorrowing: ITEM_TYPES.LENDING_AND_BORROWING,
      Staking: ITEM_TYPES.STAKING,
    };
    const mapped = aggSnapshot.items.map(it => {
      const numericType = TYPE_MAP[it.type] ?? it.type;
      return { ...it, type: numericType };
    });
    setWalletData({
      items: mapped,
      aggregationJobId: aggJobId,
      aggregationSummary: aggSummary,
      rawAggregation: aggSnapshot,
    });
  }, [aggSnapshot, aggJobId, aggSummary]);

  // Endereço alvo para agregação pode ser conta conectada ou endereço buscado manualmente
  const [activeAggregationAddress, setActiveAggregationAddress] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0); // força restart

  // Sempre que conectar wallet e não houver endereço buscado manualmente, usar a conta conectada
  useEffect(() => {
    if (account && !searchAddress) {
      setActiveAggregationAddress(account);
    }
  }, [account, searchAddress]);

  // Se usuário digita novo searchAddress mas ainda não clicou buscar, não alterar; somente quando busca (handleSearch)

  // Auto ensure: em conectar, buscar ou refresh (via refreshNonce)
  useEffect(() => {
    if (!activeAggregationAddress) return;
    ensureAggregation(activeAggregationAddress, 'Base');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAggregationAddress, refreshNonce]);

  // Expor função manual de restart (pode ser ligada a botão futuro)
  const restartAggregation = () => {
    if (!activeAggregationAddress) return;
    resetAgg();
    ensureAggregation(activeAggregationAddress, 'Base', { force: true });
  };
  useEffect(() => {
    if (!walletData) {
      walletDataSnapshotRef.current = null;
      setSnapshotVersion((v) => v + 1);
      try {
        console.log('[Chains] Snapshot cleared (no walletData). Version bumped.');
      } catch {}
      return;
    }
    // Deep clone to avoid downstream mutations affecting aggregates
    let cloned = null;
    try {
      if (typeof structuredClone === 'function') {
        cloned = structuredClone(walletData);
      } else {
        cloned = JSON.parse(JSON.stringify(walletData));
      }
    } catch (e) {
      // As a last resort, shallow copy top-level fields to reduce shared references
      try {
        cloned = { ...walletData };
      } catch {}
    }
    walletDataSnapshotRef.current = cloned;
    setSnapshotVersion((v) => v + 1);
  }, [walletData]);

  // Data getters supporting multiple shapes
  const getWalletTokensData = () => {
    if (!walletData) return [];
    if (walletData.items && Array.isArray(walletData.items))
      return getWalletTokens(walletData.items);
    if (walletData.data && Array.isArray(walletData.data)) return getWalletTokens(walletData.data);
    return walletData.tokens || [];
  };

  const getLiquidityPoolsData = () => {
    if (!walletData) return [];
    if (walletData.items && Array.isArray(walletData.items))
      return getLiquidityPoolItems(walletData.items);
    if (walletData.data && Array.isArray(walletData.data))
      return getLiquidityPoolItems(walletData.data);
    if (Array.isArray(walletData.deFi))
      return walletData.deFi.filter((d) => (d.position?.label || d.position?.name) === 'Liquidity');
    return walletData.liquidityPools || [];
  };

  const filterLendingDefiTokens = (tokens, showInternal) => {
    if (!Array.isArray(tokens)) return [];
    if (showInternal) return tokens;
    return tokens.filter((t) => {
      const ty = (t.type || '').toString().toLowerCase();
      const isInternal =
        ty === 'defi-token' ||
        ty === 'internal' ||
        t.isInternal ||
        t.internal ||
        t.category === 'internal';
      if (isInternal) return false;
      // Keep tokens with null/empty type (some protocols don't tag them)
      if (!ty) return true;
      return [
        'supplied',
        'supply',
        'deposit',
        'borrowed',
        'borrow',
        'debt',
        'reward',
        'rewards',
      ].includes(ty);
    });
  };

  const filterStakingDefiTokens = (tokens, showInternal) => {
    if (!Array.isArray(tokens)) return [];
    if (showInternal) return tokens;
    return tokens.filter((t) => {
      const ty = (t.type || '').toString().toLowerCase();
      const isInternal =
        ty === 'defi-token' ||
        ty === 'internal' ||
        t.isInternal ||
        t.internal ||
        t.category === 'internal';
      if (isInternal) return false;
      return ty === 'reward' || ty === 'rewards' || ty === 'staked';
    });
  };

  const getLendingAndBorrowingData = () => {
    if (!walletData) return [];
    if (walletData.items && Array.isArray(walletData.items))
      return getLendingItems(walletData.items);
    if (walletData.data && Array.isArray(walletData.data))
      return getLendingItems(walletData.data);
    if (Array.isArray(walletData.deFi))
      return walletData.deFi.filter((d) => (d.position?.label || d.position?.name) !== 'Liquidity');
    return walletData.lendingAndBorrowing || [];
  };

  const getStakingData = () => {
    if (!walletData) return [];
    if (walletData.items && Array.isArray(walletData.items))
      return getStakingItems(walletData.items);
    if (walletData.data && Array.isArray(walletData.data))
      return getStakingItems(walletData.data);
    return walletData.staking || [];
  };

  // Unified portfolio breakdown (memoized by snapshot + toggles)
  const getPortfolioBreakdown = () => {
    const walletTokens = getFilteredTokens(getWalletTokensData(), showOnlyPositiveBalance);
    const liquidityGroups = groupDefiByProtocol(getLiquidityPoolsData());
    const lendingGroups = groupDefiByProtocol(getLendingAndBorrowingData());
    const stakingPositions = getStakingData();
    const breakdown = computePortfolioBreakdown({
      walletTokens,
      liquidityGroups,
      lendingGroups,
      stakingPositions,
      filterLendingDefiTokens,
      filterStakingDefiTokens,
      showLendingDefiTokens,
      showStakingDefiTokens,
    });
    try { setTotalPortfolioValue(breakdown.totalNet); } catch {}
    return breakdown;
  };
  const getTotalPortfolioValue = () => getPortfolioBreakdown().totalNet;

  // Using shared calculatePercentage from utils (imported above)

  // Mascara para valores financeiros quando maskValues ativo
  const maskValue = (formatted, opts = {}) => {
    if (!maskValues) return formatted;
    const { short = false } = opts;
    return short ? '•••' : '••••••';
  };

  // (Will redefine walletTokens after adding chain filtering helpers below)
  let walletTokens = [];
  let walletValue = 0;
  let walletPercent = '0%';

  // Initialize selected chains when they load the first time
  useEffect(() => {
    if (supportedChains && supportedChains.length > 0 && selectedChains === null) {
      const initial = new Set(
        supportedChains.map((sc) =>
          normalizeChainKey(
            sc.displayName ||
              sc.name ||
              sc.shortName ||
              sc.id ||
              sc.chainId ||
              sc.chain ||
              sc.network ||
              sc.networkId
          )
        )
      );
      setSelectedChains(initial);
      try {
        console.log('[Chains] Initialized selection with all chains:', Array.from(initial));
      } catch {}
    }
  }, [supportedChains, selectedChains]);

  const isAllChainsSelected =
    selectedChains && supportedChains && selectedChains.size === supportedChains.length;
  const toggleChainSelection = (chainCanonicalKey) => {
    try {
      console.log('[Chains] Toggle click:', chainCanonicalKey);
    } catch {}
    setSelectedChains((prev) => {
      if (!prev) return new Set([chainCanonicalKey]);
      const next = new Set(prev);
      if (next.has(chainCanonicalKey)) {
        // Avoid empty selection: keep at least one
        if (next.size === 1) return next;
        next.delete(chainCanonicalKey);
      } else {
        next.add(chainCanonicalKey);
      }
      try {
        console.log('[Chains] Selected after toggle:', Array.from(next));
      } catch {}
      return next;
    });
  };

  // --- Chain alias & filtering utilities ---
  // Normalize helper (lowercase + trimmed string)
  const normalizeChainKey = (v) => {
    if (v === undefined || v === null) return undefined;
    return String(v).trim().toLowerCase();
  };

  const chainAliasToCanonical = React.useMemo(() => {
    const map = {};
    if (Array.isArray(supportedChains)) {
      supportedChains.forEach((sc) => {
        const canonicalRaw =
          sc.displayName ||
          sc.name ||
          sc.shortName ||
          sc.id ||
          sc.chainId ||
          sc.chain ||
          sc.network ||
          sc.networkId;
        const canonical = normalizeChainKey(canonicalRaw);
        const aliases = [
          sc.id,
          sc.chainId,
          sc.chainID,
          sc.chain,
          sc.networkId,
          sc.network,
          sc.displayName,
          sc.name,
          sc.shortName,
          canonicalRaw,
        ].filter((a) => a !== undefined && a !== null && a !== '');
        aliases.forEach((a) => {
          map[normalizeChainKey(a)] = canonical;
        });
      });
    }
    return map;
  }, [supportedChains]);

  const resolveAnyChain = (obj) => {
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
    // Generic scan for properties containing 'chain' or 'network'
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (/(chain|network)/i.test(k)) {
        const v = obj[k];
        if (v && (typeof v === 'string' || typeof v === 'number')) return v;
      }
    }
    return undefined;
  };

  const getCanonicalFromObj = (obj) => {
    const raw = resolveAnyChain(obj);
    if (raw === undefined || raw === null) return undefined;
    const norm = normalizeChainKey(raw);
    return chainAliasToCanonical[norm] || norm;
  };

  const defiItemMatchesSelection = (item) => {
    if (!selectedChains || isAllChainsSelected) return true;
    const base = item && item.position ? item.position : item;
    const direct = getCanonicalFromObj(base);
    if (direct && selectedChains.has(direct)) return true;
    const toks = Array.isArray(base?.tokens) ? base.tokens : [];
    for (let i = 0; i < toks.length; i++) {
      const cc = getCanonicalFromObj(toks[i]);
      if (cc && selectedChains.has(cc)) return true;
    }
    return false;
  };

  // Recompute wallet tokens with filtering
  walletTokens = React.useMemo(() => {
    const raw = getFilteredTokens(getWalletTokensData(), showOnlyPositiveBalance);
    if (!selectedChains || isAllChainsSelected) return raw;
    return raw.filter((tokenData) => {
      const token = tokenData.token || tokenData;
      const canonical = getCanonicalFromObj(token) || getCanonicalFromObj(tokenData);
      if (!canonical) return false;
      return selectedChains.has(canonical);
    });
  }, [
    walletData,
    showOnlyPositiveBalance,
    selectedChains,
    isAllChainsSelected,
    chainAliasToCanonical,
  ]);
  walletValue = walletTokens.reduce((sum, tokenData) => {
    const token = tokenData.token || tokenData;
    return sum + (parseFloat(token.totalPrice) || 0);
  }, 0);
  walletPercent = calculatePercentage(walletValue, getTotalPortfolioValue());

  // Compute per-chain totals (net of borrowed like overall calculation) once per render dependencies
  const { mergedTotals: chainTotals, rawTotals: rawChainTotals } = React.useMemo(() => {
    const sourceData = walletDataSnapshotRef.current || {};
    const totals = {}; // raw keyed by any discovered chain id/name
    const addVal = (rawKey, v) => {
      if (rawKey === undefined || rawKey === null) return;
      const key = String(rawKey);
      if (!totals[key]) totals[key] = 0;
      totals[key] += parseFloat(v) || 0;
    };

    // Helper to resolve chain key from an object (token or position)
    const resolveChainKey = (obj) => {
      if (!obj || typeof obj !== 'object') return undefined;
      // Prefer explicit numeric/string chain identifiers
      const direct =
        obj.chainId ||
        obj.chainID ||
        obj.chain_id ||
        obj.chain ||
        obj.networkId ||
        obj.network ||
        obj.chainName;
      if (direct) return direct;
      // Look into protocol nested object (but avoid using protocol.id or name as chain accidentally)
      const p = obj.protocol;
      if (p && typeof p === 'object') {
        return p.chainId || p.chainID || p.chain || p.networkId || p.network || p.chainName;
      }
      // Generic scan for any key containing chain or network
      for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        if (/(chain|network)/i.test(k)) {
          const v = obj[k];
          if (v && (typeof v === 'string' || typeof v === 'number')) return v;
        }
      }
      return undefined;
    };

    // Signed value logic (borrowed negative)
    const signedTokenValue = (token, position) => {
      const ty = (token?.type || '').toLowerCase();
      const val = Math.abs(parseFloat(token?.totalPrice) || 0);
      if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return -val;
      if (!ty) {
        const lbl = (position?.position?.label || position?.label || '').toLowerCase();
        if (lbl.includes('borrow') || lbl.includes('debt')) return -val;
      }
      return val;
    };

    // Wallet tokens (raw, not dust-filtered) -> always count full wallet contribution
    try {
      // Use snapshot-based accessor (do not rely on potentially filtered structures later in render)
      const snap = sourceData;
      let rawWalletTokens = [];
      if (snap) {
        if (snap.items && Array.isArray(snap.items)) rawWalletTokens = getWalletTokens(snap.items);
        else if (snap.data && Array.isArray(snap.data))
          rawWalletTokens = getWalletTokens(snap.data);
        else rawWalletTokens = snap.tokens || [];
      }
      rawWalletTokens.forEach((tkData) => {
        const token = tkData.token || tkData;
        const chainKey = resolveChainKey(token) || resolveChainKey(tkData);
        if (chainKey === undefined) return;
        let v = token.totalPrice;
        if (v === undefined && token.financials) v = token.financials.totalPrice;
        if (v === undefined && token.financials && token.financials.price != null && token.financials.amount != null) {
          v = parseFloat(token.financials.price) * parseFloat(token.financials.amount);
        }
        if (v === undefined && token.price != null && token.amount != null) {
          v = parseFloat(token.price) * parseFloat(token.amount);
        }
        addVal(chainKey, v);
      });
    } catch {
      /* silent */
    }

    // Helper to extract underlying position object (some data comes as { position: {...} })
    const extractPosition = (item) => (item && item.position ? item.position : item);

    const unmatchedDebug = { liquidity: 0, lending: 0, staking: 0 };

    // Liquidity pools
    try {
      let liqItems = [];
      const snap = sourceData;
      if (snap) {
        if (snap.items && Array.isArray(snap.items)) liqItems = getLiquidityPoolItems(snap.items);
        else if (snap.data && Array.isArray(snap.data)) liqItems = getLiquidityPoolItems(snap.data);
        else if (Array.isArray(snap.deFi))
          liqItems = snap.deFi.filter(
            (d) => (d.position?.label || d.position?.name) === 'Liquidity'
          );
        else liqItems = snap.liquidityPools || [];
      }
      liqItems.forEach((item) => {
        const base = extractPosition(item);
        const posChain = resolveChainKey(base) || resolveChainKey(item);
        const tokensArr = Array.isArray(base?.tokens) ? base.tokens : [];
        tokensArr.forEach((tok) => {
          const chainKey = resolveChainKey(tok) || posChain;
          let v = tok.totalPrice;
          if (v === undefined && tok.financials) v = tok.financials.totalPrice;
          if (v === undefined && tok.financials && tok.financials.price != null && tok.financials.amount != null) {
            v = parseFloat(tok.financials.price) * parseFloat(tok.financials.amount);
          }
            if (v === undefined && tok.price != null && tok.amount != null) {
            v = parseFloat(tok.price) * parseFloat(tok.amount);
          }
          const val = parseFloat(v) || 0;
          if (chainKey === undefined) unmatchedDebug.liquidity += val; else addVal(chainKey, val);
        });
        // rewards may be inside base.rewards
        if (Array.isArray(base?.rewards)) {
          base.rewards.forEach((rw) => {
            const chainKey = resolveChainKey(rw) || posChain;
            let v = rw.totalPrice;
            if (v === undefined && rw.financials) v = rw.financials.totalPrice;
            if (v === undefined && rw.financials && rw.financials.price != null && rw.financials.amount != null) {
              v = parseFloat(rw.financials.price) * parseFloat(rw.financials.amount);
            }
            if (v === undefined && rw.price != null && rw.amount != null) {
              v = parseFloat(rw.price) * parseFloat(rw.amount);
            }
            const val = parseFloat(v) || 0;
            if (chainKey === undefined) unmatchedDebug.liquidity += val; else addVal(chainKey, val);
          });
        }
      });
    } catch {
      /* silent */
    }

    // Lending & Borrowing
    try {
      let lendingItems = [];
      const snap = sourceData;
      if (snap) {
        if (snap.items && Array.isArray(snap.items))
          lendingItems = getLendingItems(snap.items);
        else if (snap.data && Array.isArray(snap.data))
          lendingItems = getLendingItems(snap.data);
        else if (Array.isArray(snap.deFi))
          lendingItems = snap.deFi.filter(
            (d) => (d.position?.label || d.position?.name) !== 'Liquidity'
          );
        else lendingItems = snap.lendingAndBorrowing || [];
      }
      lendingItems.forEach((item) => {
        const base = extractPosition(item);
        const posChain = resolveChainKey(base) || resolveChainKey(item);
        const rawTokens = Array.isArray(base?.tokens) ? base.tokens : [];
        const tokens = showLendingDefiTokens
          ? rawTokens
          : rawTokens.filter((t) => {
              const ty = (t.type || '').toLowerCase();
              const isInternal =
                ty === 'defi-token' ||
                ty === 'internal' ||
                t.isInternal ||
                t.internal ||
                t.category === 'internal';
              if (isInternal) return false;
              if (!ty) return true;
              return [
                'supplied',
                'supply',
                'deposit',
                'borrowed',
                'borrow',
                'debt',
                'reward',
                'rewards',
              ].includes(ty);
            });
        tokens.forEach((tok) => {
          const chainKey = resolveChainKey(tok) || posChain;
          let v = tok.totalPrice;
          if (v === undefined && tok.financials) v = tok.financials.totalPrice;
          if (v === undefined && tok.financials && tok.financials.price != null && tok.financials.amount != null) {
            v = parseFloat(tok.financials.price) * parseFloat(tok.financials.amount);
          }
          if (v === undefined && tok.price != null && tok.amount != null) {
            v = parseFloat(tok.price) * parseFloat(tok.amount);
          }
          // Signed after computing absolute underlying value
          const signed = signedTokenValue({ ...tok, totalPrice: v }, base);
          if (chainKey === undefined) unmatchedDebug.lending += signed; else addVal(chainKey, signed);
        });
      });
    } catch {
      /* silent */
    }

    // Staking
    try {
      let stakingItems = [];
      const snap = sourceData;
      if (snap) {
        if (snap.items && Array.isArray(snap.items))
          stakingItems = getStakingItems(snap.items);
        else if (snap.data && Array.isArray(snap.data))
          stakingItems = getStakingItems(snap.data);
        else stakingItems = snap.staking || [];
      }
      stakingItems.forEach((item) => {
        const base = extractPosition(item);
        const posChain = resolveChainKey(base) || resolveChainKey(item);
        let any = false;
        const rawTokens = Array.isArray(base?.tokens) ? base.tokens : [];
        const tokens = showStakingDefiTokens
          ? rawTokens
          : rawTokens.filter((t) => {
              const ty = (t.type || '').toLowerCase();
              const isInternal =
                ty === 'defi-token' ||
                ty === 'internal' ||
                t.isInternal ||
                t.internal ||
                t.category === 'internal';
              if (isInternal) return false;
              return ty === 'reward' || ty === 'rewards' || ty === 'staked';
            });
        tokens.forEach((tok) => {
          any = true;
          const chainKey = resolveChainKey(tok) || posChain;
          let v = tok.totalPrice;
          if (v === undefined && tok.financials) v = tok.financials.totalPrice;
          if (v === undefined && tok.financials && tok.financials.price != null && tok.financials.amount != null) {
            v = parseFloat(tok.financials.price) * parseFloat(tok.financials.amount);
          }
          if (v === undefined && tok.price != null && tok.amount != null) {
            v = parseFloat(tok.price) * parseFloat(tok.amount);
          }
          const val = parseFloat(v) || 0;
          if (chainKey === undefined) unmatchedDebug.staking += val; else addVal(chainKey, val);
        });
        if (!any) {
          const bal = parseFloat(base?.balance);
          if (!isNaN(bal)) {
            if (posChain === undefined) unmatchedDebug.staking += bal;
            else addVal(posChain, bal);
          }
        }
      });
    } catch {
      /* silent */
    }

    // Optional: could normalize numeric-only keys to align with supportedChains numeric ids
    // (Already using String() so matching done by same string form when rendering.)

    // Option 3 (simplified): aggregate per canonical key only (no alias duplication assignment)
    const merged = {};
    if (Array.isArray(supportedChains) && supportedChains.length > 0) {
      supportedChains.forEach((sc) => {
        const canonical = String(
          sc.displayName || sc.name || sc.shortName || sc.id || sc.chainId || sc.chain
        );
        const aliases = [
          sc.id,
          sc.chainId,
          sc.chainID,
          sc.chain,
          sc.networkId,
          sc.network,
          sc.displayName,
          sc.name,
          sc.shortName,
          canonical,
        ]
          .filter((a) => a !== undefined && a !== null && a !== '')
          .map((a) => String(a));
        const uniqueAliases = Array.from(new Set(aliases));
        const sum = uniqueAliases.reduce((acc, key) => acc + (totals[key] || 0), 0);
        merged[canonical] = sum;
      });
    } else {
      // Fallback: if supportedChains not loaded, expose raw totals
      Object.assign(merged, totals);
    }

    if (unmatchedDebug.liquidity + unmatchedDebug.lending + unmatchedDebug.staking > 0) {
      try {
        console.log('[DEBUG] Unmatched chain value by category (USD):', unmatchedDebug);
      } catch {}
    }

    return { mergedTotals: merged, rawTotals: totals };
  }, [snapshotVersion, showLendingDefiTokens, showStakingDefiTokens, supportedChains]);

  // Global total for percentages: sum only canonical keys (avoid alias duplication)
  const totalAllChains = React.useMemo(() => {
    if (!supportedChains || supportedChains.length === 0) return 0;
    const seen = new Set();
    let sum = 0;
    supportedChains.forEach((c) => {
      const canonicalKey = String(
        c.displayName ||
          c.name ||
          c.shortName ||
          c.id ||
          c.chainId ||
          c.chain ||
          c.network ||
          c.networkId
      );
      if (seen.has(canonicalKey)) return;
      seen.add(canonicalKey);
      const v = chainTotals[canonicalKey];
      if (typeof v === 'number' && !isNaN(v)) sum += v;
    });
    return sum;
  }, [supportedChains, chainTotals]);

  // Navigation view mode (segmented)
  const [viewMode, setViewMode] = useState('overview');

  // UI
  return (
    <MaskValuesProvider value={{ maskValues, toggleMaskValues, setMaskValues, maskValue }}>
      <ChainIconsProvider supportedChains={supportedChains}>
        <style>{`@keyframes defiPulse{0%{transform:scale(.55);opacity:.65}60%{transform:scale(1.9);opacity:0}100%{transform:scale(1.9);opacity:0}}@keyframes defiSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
        <HeaderBar
          account={account}
          onSearch={() => handleSearch()}
          onRefresh={() => account && callAccountAPI(account, setLoading)}
          onDisconnect={disconnect}
          onConnect={connectWallet}
          copyToClipboard={(val) => {
            try {
              navigator.clipboard.writeText(val);
            } catch {}
          }}
          searchAddress={searchAddress}
          setSearchAddress={setSearchAddress}
        />
        <div className="w-full flex flex-column" style={{ minHeight: '100vh' }}>
          <div className="w-full" style={{ padding: `8px ${sidePadding} 0px ${sidePadding}`, boxSizing: 'border-box' }}>
            {/* Segmented Nav */}
            <div className="mt-12 mb-20 flex justify-center">
              <SegmentedNav value={viewMode} onChange={setViewMode} disabled={!isAggregationReady} />
            </div>
            {/* Supported Chains: only on Overview after aggregation ready */}
              {isAggregationReady && viewMode === 'overview' && (
                <div className="mt-18">
                  {chainsLoading && (!supportedChains || supportedChains.length === 0) && (
                    <div className="text-base" style={{ color: theme.textSecondary }}>Loading chains...</div>
                  )}
                  {supportedChains && supportedChains.length > 0 && (
                    <div className="panel-unified relative mt-18">
                      <div className="panel-heading">Supported Chains</div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 14,
                          overflowX: 'auto',
                          paddingBottom: 4,
                          scrollbarWidth: 'thin',
                        }}
                      >
                        {supportedChains.map((c, idx) => {
                          const name = c.displayName || c.name || c.shortName || `Chain ${idx + 1}`;
                          const canonicalKeyRaw =
                            c.displayName ||
                            c.name ||
                            c.shortName ||
                            c.id ||
                            c.chainId ||
                            c.chain ||
                            c.network ||
                            c.networkId;
                          const canonicalKey = String(canonicalKeyRaw);
                          const canonicalKeyNormalized = normalizeChainKey(canonicalKey);
                          const chainKeyFallback = String(
                            c.id ||
                              c.chainId ||
                              c.chainID ||
                              c.chain ||
                              c.networkId ||
                              c.network ||
                              name
                          );
                          const value =
                            chainTotals[canonicalKey] ??
                            chainTotals[chainKeyFallback] ??
                            chainTotals[canonicalKey.toLowerCase()] ??
                            0;
                          const selectedSet = selectedChains || new Set();
                          const isSelected = selectedSet.has(canonicalKeyNormalized);
                          const percent = calculatePercentage(value, totalAllChains);
                          return (
                            <div
                              key={canonicalKey}
                              onClick={() => toggleChainSelection(canonicalKeyNormalized)}
                              style={{
                                minWidth: 130,
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 14,
                                padding: '8px 10px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                gap: 4,
                                cursor: 'pointer',
                                userSelect: 'none',
                                opacity: isSelected ? 1 : 0.35,
                                transition: 'opacity .18s',
                              }}
                              title={isSelected ? 'Clique para desselecionar' : 'Clique para selecionar'}
                              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.opacity = 0.55; }}
                              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.opacity = 0.35; }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: c.iconUrl ? '32px 1fr' : '1fr',
                                  columnGap: 8,
                                  rowGap: 2,
                                  alignItems: 'center',
                                }}
                              >
                                {c.iconUrl && (
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      gridRow: '1 / span 2',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: 10,
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <img
                                      src={c.iconUrl}
                                      alt={name}
                                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  </div>
                                )}
                                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary, lineHeight: 1.2 }}>{name}</div>
                                <div style={{ fontSize: 11, color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontWeight: 600, color: theme.textPrimary, fontSize: 12 }}>
                                    {maskValue(formatPrice(value))}
                                  </span>
                                  <span style={{ fontSize: 10, color: theme.textMuted }}>{percent}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* (Removed legacy inline main content duplication and old horizontal view mode toggle) */}

          {/* Overlay de sincronização bloqueando interação até conclusão */}
          {(DEV_FORCE_AGG_OVERLAY || aggJobId) && (
            <div
              aria-busy={!aggCompleted}
              aria-live="polite"
              style={{
                position: 'fixed', // cobre viewport inteira
                inset: 0,
                background: 'linear-gradient(155deg, rgba(0,0,0,0.72), rgba(0,0,0,0.55))',
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '24px 16px 32px 16px' : '32px 32px 48px 32px',
                color: theme.textPrimary,
                overflowY: 'auto',
                pointerEvents: !aggCompleted ? 'auto' : 'none',
                opacity: aggCompleted ? 0 : 1,
                transition: 'opacity .55s ease',
              }}
            >
              {/* Centered card with circular loader */}
              <div style={{ width: '100%', maxWidth: isMobile ? 380 : 520, textAlign: 'center', padding: '0 12px' }}>
                <div
                  style={{
                    width: isMobile ? 52 : 72,
                    height: isMobile ? 52 : 72,
                    margin: isMobile ? '0 auto 22px auto' : '0 auto 32px auto',
                    border: isMobile ? '5px solid rgba(255,255,255,0.15)' : '6px solid rgba(255,255,255,0.15)',
                    borderTop: isMobile ? '5px solid #35f7a5' : '6px solid #35f7a5',
                    borderRight: isMobile ? '5px solid #2fbfd9' : '6px solid #2fbfd9',
                    borderRadius: '50%',
                    animation: !aggCompleted ? 'defiSpin 0.85s linear infinite' : 'none',
                  }}
                />
                <h2 style={{ margin: '0 0 12px 0', fontSize: isMobile ? 20 : 24, fontWeight: 600, letterSpacing: '.5px' }}>
                  {aggCompleted ? 'Synchronized' : 'Synchronizing your account'}
                </h2>
                <p style={{ fontSize: isMobile ? 13 : 14, lineHeight: 1.5, opacity: 0.9, margin: '0 0 18px 0' }}>
                  {aggCompleted ? 'Data ready – unlocking interface.' : 'Aggregating your DeFi positions across multiple providers.'}
                </p>
                <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 500, marginBottom: 6 }}>
                  {(() => {
                    const expected = aggExpected || aggSnapshot?.expected;
                    const succeeded = aggSucceeded || aggSnapshot?.succeeded || 0;
                    const failed = aggFailed || aggSnapshot?.failed || 0;
                    const timedOut = aggTimedOut || aggSnapshot?.timedOut || 0;
                    if (!expected || expected <= 0) return 'Initializing sources...';
                    const done = succeeded + failed + timedOut;
                    const pct = Math.min(100, Math.max(0, Math.round((done / expected) * 100)));
                    return aggCompleted ? 'Complete' : `Sources ${done}/${expected} • ${pct}%`;
                  })()}
                </div>
                <div style={{ fontSize: isMobile ? 11 : 12, opacity: 0.75, marginBottom: 4 }}>
                  Status: {aggCompleted ? 'Done' : (aggStatus || aggSnapshot?.status || 'Running')}
                </div>
                <div style={{ fontSize: isMobile ? 10 : 11, opacity: 0.5 }}>
                  {aggCompleted ? 'Closing...' : 'This may take a few seconds depending on the number of protocols.'}
                </div>
                <div style={{ marginTop: isMobile ? 16 : 22, fontSize: isMobile ? 10 : 11, opacity: 0.55 }}>
                  {(() => {
                    const failed = aggFailed || aggSnapshot?.failed || 0;
                    const timedOut = aggTimedOut || aggSnapshot?.timedOut || 0;
                    if (failed === 0 && timedOut === 0) return null;
                    return `Partial issues - failed: ${failed}${timedOut>0?`, timed out: ${timedOut}`:''}`;
                  })()}
                </div>
              </div>
            </div>
          )}
            {isAggregationReady && (
              <>
              {viewMode === 'summary' && (
                <SummaryView
                  walletTokens={walletTokens}
                  getLiquidityPoolsData={getLiquidityPoolsData}
                  getLendingAndBorrowingData={getLendingAndBorrowingData}
                  getStakingData={getStakingData}
                  getTotalPortfolioValue={getTotalPortfolioValue}
                  getPortfolioBreakdown={getPortfolioBreakdown}
                  maskValue={maskValue}
                  formatPrice={formatPrice}
                  theme={theme}
                  groupDefiByProtocol={groupDefiByProtocol}
                  filterLendingDefiTokens={filterLendingDefiTokens}
                  showLendingDefiTokens={showLendingDefiTokens}
                />
              )}
              {viewMode === 'strategies' && (
                <RebalancingView
                  walletTokens={walletTokens}
                  getLiquidityPoolsData={getLiquidityPoolsData}
                  getLendingAndBorrowingData={getLendingAndBorrowingData}
                  getStakingData={getStakingData}
                  account={account}
                  theme={theme}
                  initialSavedKey={rebalanceInfo?.key}
                  initialSavedCount={rebalanceInfo?.count}
                  initialSavedItems={rebalanceInfo?.items}
                />
              )}
              {viewMode === 'pools' && (
                <PoolsView
                  getLiquidityPoolsData={getLiquidityPoolsData}
                />
              )}
              {viewMode === 'overview' && (
                <>
                  {/* Liquidity placeholder when viewMode === 'liquidity' */}
                  {viewMode === 'liquidity' && (
                    <div style={{
                      background: theme.bgPanel,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 16,
                      padding: '32px 40px',
                      marginBottom: 32,
                      textAlign: 'center'
                    }}>
                      <h2 style={{margin:0, fontSize:20, fontWeight:600, letterSpacing:.5}}>Liquidity (beta)</h2>
                      <p style={{fontSize:13, opacity:.75, margin:'12px 0 0 0'}}>Upcoming view to consolidate pool positions and APY metrics.</p>
                    </div>
                  )}
                  {/* Default Overview (wallet + protocols) shown when not in summary/strategies */}
                  {walletTokens.length > 0 &&
                    (() => {
                      const columns = [
                        { key: 'token', label: 'Token', align: 'left' },
                        ...(showBalanceColumn
                          ? [{ key: 'amount', label: 'Amount', align: 'right', width: 140 }]
                          : []),
                        ...(showUnitPriceColumn
                          ? [{ key: 'price', label: 'Price', align: 'right', width: 120 }]
                          : []),
                        { key: 'value', label: 'Value', align: 'right', width: 160 },
                      ];
                      const rows = walletTokens.map((tokenData, index) => {
                        const token = tokenData.token || tokenData;
                        return {
                          key:
                            token.contractAddress ||
                            token.tokenAddress ||
                            `${token.symbol}-${index}`,
                          token: (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {token.logo && (
                                <img
                                  src={token.logo}
                                  alt={token.symbol}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    marginRight: 10,
                                    borderRadius: '50%',
                                    border: `1px solid ${theme.border}`,
                                  }}
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              )}
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 14,
                                    color: theme.textPrimary,
                                    marginBottom: 2,
                                  }}
                                >
                                  {token.symbol}
                                </div>
                                <div style={{ fontSize: 12, color: theme.textSecondary }}>
                                  {token.name}
                                </div>
                              </div>
                            </div>
                          ),
                          amount:
                            !tableHideAmount && showBalanceColumn
                              ? maskValue(formatBalance(token.balance, token.native), {
                                  short: true,
                                })
                              : undefined,
                          price:
                            !tableHidePrice && showUnitPriceColumn
                              ? maskValue(formatPrice(token.price), { short: true })
                              : undefined,
                          value: maskValue(formatPrice(token.totalPrice)),
                        };
                      });
                      const infoBadges = `Tokens: ${walletTokens.length}`;
                      const optionsMenu = (
                        <div style={{ padding: '6px 0' }}>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: 13,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!showOnlyPositiveBalance}
                              onChange={(e) => setShowOnlyPositiveBalance(!e.target.checked)}
                            />
                            Show assets with no balance
                          </label>
                          <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
                          <div
                            style={{
                              fontSize: 11,
                              color: '#6b7280',
                              fontWeight: 700,
                              padding: '6px 12px',
                            }}
                          >
                            Visible Columns
                          </div>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: 13,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={showBalanceColumn}
                              onChange={(e) => setShowBalanceColumn(e.target.checked)}
                            />
                            Amount
                          </label>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: 13,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={showUnitPriceColumn}
                              onChange={(e) => setShowUnitPriceColumn(e.target.checked)}
                            />
                            Price
                          </label>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#9ca3af',
                              padding: '6px 12px',
                              fontStyle: 'italic',
                            }}
                          >
                            Token and Total Value are always visible. On small screens some columns
                            may hide automatically.
                          </div>
                        </div>
                      );
                      return (
                        <SectionTable
                          title="Wallet"
                          icon={
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                // border removed as requested
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'transparent',
                                overflow: 'hidden',
                              }}
                            >
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lucide lucide-wallet-icon lucide-wallet"
                              >
                                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                              </svg>
                            </div>
                          }
                          isExpanded={tokensExpanded}
                          onToggle={() => setTokensExpanded(!tokensExpanded)}
                          transparentBody={true}
                          optionsMenu={optionsMenu}
                          customContent={
                            <div
                              style={{ background: 'transparent', border: 'none', borderRadius: 8 }}
                            >
                              {(() => {
                                const effShowBalanceColumn = !tableHideAmount && showBalanceColumn;
                                const effShowUnitPriceColumn =
                                  !tableHidePrice && showUnitPriceColumn;
                                return (
                                  <WalletTokensTable
                                    tokens={walletTokens}
                                    showBalanceColumn={effShowBalanceColumn}
                                    showUnitPriceColumn={effShowUnitPriceColumn}
                                  />
                                );
                              })()}
                            </div>
                          }
                        />
                      );
                    })()}
                  {/* Protocols only in Overview */}
                  <ErrorBoundary>
                    <ProtocolsSection
                      getLiquidityPoolsData={getLiquidityPoolsData}
                      getLendingAndBorrowingData={getLendingAndBorrowingData}
                      getStakingData={getStakingData}
                      selectedChains={selectedChains}
                      isAllChainsSelected={isAllChainsSelected}
                      getCanonicalFromObj={getCanonicalFromObj}
                      filterLendingDefiTokens={filterLendingDefiTokens}
                      filterStakingDefiTokens={filterStakingDefiTokens}
                      showLendingDefiTokens={showLendingDefiTokens}
                      showStakingDefiTokens={showStakingDefiTokens}
                      setShowLendingDefiTokens={setShowLendingDefiTokens}
                      setShowStakingDefiTokens={setShowStakingDefiTokens}
                      protocolExpansions={protocolExpansions}
                      toggleProtocolExpansion={toggleProtocolExpansion}
                      calculatePercentage={calculatePercentage}
                      getTotalPortfolioValue={getTotalPortfolioValue}
                      maskValue={maskValue}
                      theme={theme}
                    />
                  </ErrorBoundary>
                </>
              )}
              </>
            )}
          </div>{/* end inner padded content */}
        </div>{/* end main vertical layout */}

  {/* Tooltip */}
        {tooltipVisible && (
          <div
            style={{
              position: 'fixed',
              left: tooltipPosition.x - (tooltipVisible?.length || 0) * 3,
              top: tooltipPosition.y - 40,
              backgroundColor: mode === 'light' ? 'rgba(0,0,0,0.75)' : 'rgba(0, 0, 0, 0.9)',
              color: theme.textPrimary,
              padding: '8px 12px',
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: 'pre-line',
              zIndex: 1000,
              maxWidth: 300,
              wordWrap: 'break-word',
              border: `1px solid ${theme.border}`,
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
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: theme.bgPanel,
                padding: 20,
                borderRadius: 10,
                fontSize: 15,
                color: theme.textPrimary,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadowHover,
              }}
            >
              Loading wallet data...
            </div>
          </div>
        )}
      </ChainIconsProvider>
    </MaskValuesProvider>
  );
}

export default App;
