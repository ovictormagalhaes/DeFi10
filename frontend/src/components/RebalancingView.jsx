import React from 'react';

import { config } from '../config/api';
// import { getFontStyles } from '../styles/fontStyles'; // (Unused after refactor)
import {
  RebalanceAssetType,
  RebalanceReferenceTypeEnum,
  getAssetTypeLabel,
} from '../constants/rebalanceEnums';
import { useMaskValues } from '../context/MaskValuesContext.tsx';
import { useTheme } from '../context/ThemeProvider.tsx';
import { formatPercent, formatUsd } from '../utils/formatting';
import { ITEM_TYPES } from '../utils/walletUtils';

import CollapsibleMenu from './CollapsibleMenu';
import IconButton from './IconButton';
import RebalanceItemDialog from './RebalanceItemDialog';
import Skeleton from './Skeleton';
import StandardHeader from './table/StandardHeader';
import TokenDisplay from './TokenDisplay.tsx';
import RebalancingCards from './cards/RebalancingCards';

// Frontend mirror of backend enum
const RebalanceReferenceType = {
  Token: 'Token',
  Protocol: 'Protocol',
  Group: 'Group',
  TotalWallet: 'TotalWallet',
};

// Unified control height for selects and dropdowns
const CONTROL_HEIGHT = 38;

// Asset type select now uses backend numeric enums (migrating from ITEM_TYPES for persistence)
const ASSET_TYPE_OPTIONS = [
  { value: RebalanceAssetType.Wallet, label: 'Wallet' },
  { value: RebalanceAssetType.LiquidityPool, label: 'Liquidity Pools' },
  { value: RebalanceAssetType.LendingAndBorrowing, label: 'Lending Position' },
  { value: RebalanceAssetType.Staking, label: 'Staking Position' },
  { value: RebalanceAssetType.Depositing, label: 'Depositing Position' },
  { value: RebalanceAssetType.Locking, label: 'Locking Position' },
  { value: RebalanceAssetType.Group, label: 'Group' },
];

const GROUP_OPTIONS = [
  { value: RebalanceAssetType.Wallet, label: 'Wallet' },
  { value: RebalanceAssetType.LiquidityPool, label: 'Liquidity Pools' },
  { value: RebalanceAssetType.LendingAndBorrowing, label: 'Lending Position' },
  { value: RebalanceAssetType.Staking, label: 'Staking Position' },
  { value: RebalanceAssetType.Depositing, label: 'Depositing Position' },
  { value: RebalanceAssetType.Locking, label: 'Locking Position' },
  { value: RebalanceAssetType.Group, label: 'Group' },
];

export default function RebalancingView({
  walletTokens = [],
  getLiquidityPoolsData,
  getLendingAndBorrowingData,
  getStakingData,
  getDepositingData,
  getLockingData,
  theme: themeProp,
  account,
  selectedWalletGroupId,
  initialSavedKey,
  initialSavedCount,
  initialSavedItems,
  onRebalancesSaved,
}) {
  // Theme (allow override via prop, else context)
  const { theme: themeCtx } = useTheme();
  const theme = themeProp || themeCtx;
  const { maskValue } = useMaskValues();

  // Responsive breakpoint detection
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const useCardView = windowWidth < 900; // Use cards below 900px

  // Normalize chain identifier for token grouping / id composition
  const getChainKey = React.useCallback((tok) => {
    if (!tok || typeof tok !== 'object') return 'unknown';
    const raw =
      tok.chain || tok.chainId || tok.chainID || tok.network || tok.chainName || tok.chain_name;
    if (raw == null) return 'unknown';
    const lower = String(raw).trim().toLowerCase();
    const norm = {
      1: 'eth',
      eth: 'eth',
      ethereum: 'eth',
      mainnet: 'eth',
      erc20: 'eth',

      137: 'polygon',
      polygon: 'polygon',
      matic: 'polygon',

      avalanche: 'avalanche',
      43114: 'avalanche',
      avax: 'avalanche',

      10: 'optimism',
      optimism: 'optimism',
      op: 'optimism',

      56: 'bsc',
      bsc: 'bsc',
      bnb: 'bsc',
      binance: 'bsc',
      'binance smart chain': 'bsc',
      'bnb smart chain': 'bsc',

      250: 'fantom',
      fantom: 'fantom',
      ftm: 'fantom',

      base: 'base',
      84531: 'base',
    };
    return norm[lower] || lower;
  }, []);

  // Prepare candidate lists
  const tokensList = React.useMemo(() => {
    return (walletTokens || []).map((t, i) => {
      const tok = t.token || t;
      const baseId = tok.contractAddress || tok.tokenAddress || tok.symbol || tok.name || 'token';
      const chainKey = getChainKey(tok);
      const id = `${baseId}#${chainKey || i}`;
      const label = tok.symbol || tok.name || baseId;
      return { id, label, raw: tok };
    });
  }, [walletTokens, getChainKey]);

  // Virtual group definitions (can be extended or sourced from config later)
  const virtualGroups = React.useMemo(
    () => [
      {
        id: 'group:stablecoins',
        label: 'Stablecoins',
        members: ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD'],
      },
      { id: 'group:lending', label: 'Lending Positions', members: [] },
      { id: 'group:liquidity', label: 'Liquidity Pools', members: [] },
      { id: 'group:staking', label: 'Staking Positions', members: [] },
      { id: 'group:defi', label: 'DeFi Positions', members: [] },
    ],
    []
  );

  const groupList = React.useMemo(() => {
    return virtualGroups.map((g) => ({ id: g.id, label: g.label, raw: g }));
  }, [virtualGroups]);

  // Simple loading heuristic: if no tokens yet but account exists, show skeleton placeholders
  const isLoadingPrimary = (!walletTokens || walletTokens.length === 0) && !!account;
  const skeletonRows = React.useMemo(() => Array.from({ length: 4 }), []);

  const poolsList = React.useMemo(() => {
    const arr = getLiquidityPoolsData?.() || [];
    return arr.map((item, i) => {
      const pos = item.position || item;
      let label = pos?.name || item?.name;
      if (!label && Array.isArray(pos?.tokens)) {
        const syms = pos.tokens.map((x) => x?.symbol || x?.name).filter(Boolean);
        if (syms.length >= 2) label = `${syms[0]}/${syms[1]}`;
      }
      const baseId = pos?.id || item?.id || label || `pool-${i}`;
      const id = `${String(baseId)}#${i}`;
      return { id, label: label || String(baseId), raw: item };
    });
  }, [getLiquidityPoolsData]);

  const lendingList = React.useMemo(() => {
    const arr = getLendingAndBorrowingData?.() || [];
    return arr.map((item, i) => {
      const pos = item.position || item;
      const baseId = pos?.id || item?.id || `lend-${i}`;
      const id = `${String(baseId)}#${i}`;
      let label = pos?.name || item?.name;
      if (!label) {
        const toks = Array.isArray(pos?.tokens) ? pos.tokens : [];
        const norm = (x) => (x && x.token ? x.token : x);
        const supplied = toks
          .filter((t) => {
            const ty = (t?.type || '').toString().toLowerCase();
            return ty === 'supplied' || ty === 'supply' || ty === 'deposit' || ty === 'collateral';
          })
          .map(norm);
        const choose = supplied.length ? supplied : toks.map(norm);
        const syms = choose.map((t) => t?.symbol || t?.name).filter(Boolean);
        if (syms.length >= 2) label = `${syms[0]}/${syms[1]}`;
        else if (syms.length === 1) label = syms[0];
      }
      if (!label) label = `Lending #${i + 1}`;
      return { id, label, raw: item };
    });
  }, [getLendingAndBorrowingData]);

  const stakingList = React.useMemo(() => {
    const arr = getStakingData?.() || [];
    return arr.map((item, i) => {
      const pos = item.position || item;
      const baseId = pos?.id || item?.id || `stake-${i}`;
      const id = `${String(baseId)}#${i}`;
      const label = pos?.name || item?.name || `Staking #${i + 1}`;
      return { id, label, raw: item };
    });
  }, [getStakingData]);

  const depositingList = React.useMemo(() => {
    const arr = getDepositingData?.() || [];
    return arr.map((item, i) => {
      const pos = item.position || item;
      const baseId = pos?.id || item?.id || `deposit-${i}`;
      const id = `${String(baseId)}#${i}`;
      const label = pos?.name || pos?.label || item?.name || `Deposit #${i + 1}`;
      return { id, label, raw: item };
    });
  }, [getDepositingData]);

  const lockingList = React.useMemo(() => {
    const arr = getLockingData?.() || [];
    return arr.map((item, i) => {
      const pos = item.position || item;
      const baseId = pos?.id || item?.id || `lock-${i}`;
      const id = `${String(baseId)}#${i}`;
      const label = pos?.name || pos?.label || item?.name || `Lock #${i + 1}`;
      return { id, label, raw: item };
    });
  }, [getLockingData]);

  const allDefi = React.useMemo(() => {
    return [
      ...(getLiquidityPoolsData?.() || []),
      ...(getLendingAndBorrowingData?.() || []),
      ...(getStakingData?.() || []),
      ...(getDepositingData?.() || []),
      ...(getLockingData?.() || []),
    ];
  }, [getLiquidityPoolsData, getLendingAndBorrowingData, getStakingData, getDepositingData, getLockingData]);

  const protocolsList = React.useMemo(() => {
    const set = new Map();
    const getLogoFromAny = (t) => {
      if (!t || typeof t !== 'object') return '';
      return (
        t.logo ||
        t.logoURI ||
        t.image ||
        t.icon ||
        t.logoUrl ||
        t.logo_url ||
        t.iconUrl ||
        t.icon_url ||
        ''
      );
    };
    allDefi.forEach((it, idx) => {
      const p = it.protocol || it.provider || it.platform || it?.position?.protocol;
      const name =
        (typeof p === 'string' ? p : p?.name) || it?.protocolName || it?.position?.protocolName;
      if (!name) return;
      if (!set.has(name)) {
        // Try to find a logo from various shapes
        let logo = '';
        if (typeof p === 'object') logo = getLogoFromAny(p);
        if (!logo && it) logo = getLogoFromAny(it);
        if (!logo && it?.position) logo = getLogoFromAny(it.position);
        if (!logo && it?.position?.protocol) logo = getLogoFromAny(it.position.protocol);
        set.set(name, { id: name, label: name, raw: { logo } });
      }
    });
    return Array.from(set.values());
  }, [allDefi]);

  // Form state
  // Start all selects unselected (placeholder)
  const [assetType, setAssetType] = React.useState('');
  const [assetId, setAssetId] = React.useState('');
  const [assetIds, setAssetIds] = React.useState([]); // Array of {type, id} for grouping multiple assets
  const [referenceType, setReferenceType] = React.useState('');
  const [referenceValue, setReferenceValue] = React.useState('');
  const [note, setNote] = React.useState(0);
  const [entries, setEntries] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [saveResult, setSaveResult] = React.useState(null);
  const [saveError, setSaveError] = React.useState(null);
  const [didInitialLoad, setDidInitialLoad] = React.useState(false);

  // Map reference type to backend enum numeric values (Token=0, Protocol=1, Group=2, TotalWallet=3)
  const REF_ENUM_MAP = React.useMemo(
    () => ({
      [RebalanceReferenceType.Token]: RebalanceReferenceTypeEnum.Token,
      [RebalanceReferenceType.Protocol]: RebalanceReferenceTypeEnum.Protocol,
      [RebalanceReferenceType.Group]: RebalanceReferenceTypeEnum.Group,
      [RebalanceReferenceType.TotalWallet]: RebalanceReferenceTypeEnum.TotalWallet,
    }),
    []
  );

  // Map numeric asset types to backend string values
  const ASSET_TYPE_TO_STRING = React.useMemo(
    () => ({
      [RebalanceAssetType.Unknown]: 'Unknown',
      [RebalanceAssetType.Wallet]: 'Wallet',
      [RebalanceAssetType.LiquidityPool]: 'LiquidityPool',
      [RebalanceAssetType.LendingAndBorrowing]: 'LendingAndBorrowing',
      [RebalanceAssetType.Staking]: 'Staking',
      [RebalanceAssetType.Depositing]: 'Depositing',
      [RebalanceAssetType.Locking]: 'Locking',
      [RebalanceAssetType.Token]: 'Token',
      [RebalanceAssetType.Group]: 'Group',
      [RebalanceAssetType.Protocol]: 'Protocol',
      [RebalanceAssetType.Other]: 'Other',
    }),
    []
  );

  // Map backend string values to numeric types
  const ASSET_TYPE_FROM_STRING = React.useMemo(
    () => ({
      Unknown: RebalanceAssetType.Unknown,
      Wallet: RebalanceAssetType.Wallet,
      LiquidityPool: RebalanceAssetType.LiquidityPool,
      LendingAndBorrowing: RebalanceAssetType.LendingAndBorrowing,
      Staking: RebalanceAssetType.Staking,
      Depositing: RebalanceAssetType.Depositing,
      Locking: RebalanceAssetType.Locking,
      Token: RebalanceAssetType.Token,
      Group: RebalanceAssetType.Group,
      Protocol: RebalanceAssetType.Protocol,
      Other: RebalanceAssetType.Other,
    }),
    []
  );

  // Map referenceType to backend enum string values
  const REFERENCE_TYPE_TO_STRING = React.useMemo(
    () => ({
      [RebalanceReferenceType.Token]: 'Token',
      [RebalanceReferenceType.Protocol]: 'Protocol',
      [RebalanceReferenceType.Group]: 'Group',
      [RebalanceReferenceType.TotalWallet]: 'TotalWallet',
    }),
    []
  );
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);

  // Options based on selections
  const assetOptions = React.useMemo(() => {
    switch (assetType) {
      case RebalanceAssetType.Wallet:
        return tokensList;
      case RebalanceAssetType.LiquidityPool:
        return poolsList;
      case RebalanceAssetType.LendingAndBorrowing:
        return lendingList;
      case RebalanceAssetType.Staking:
        return stakingList;
      case RebalanceAssetType.Depositing:
        return depositingList;
      case RebalanceAssetType.Locking:
        return lockingList;
      case RebalanceAssetType.Group:
        return groupList;
      default:
        return [];
    }
  }, [assetType, tokensList, poolsList, lendingList, stakingList, depositingList, lockingList, groupList]);

  // Helper to get options for any type
  const getOptionsForType = React.useCallback((type) => {
    switch (type) {
      case RebalanceAssetType.Wallet:
        return tokensList;
      case RebalanceAssetType.LiquidityPool:
        return poolsList;
      case RebalanceAssetType.LendingAndBorrowing:
        return lendingList;
      case RebalanceAssetType.Staking:
        return stakingList;
      case RebalanceAssetType.Depositing:
        return depositingList;
      case RebalanceAssetType.Locking:
        return lockingList;
      case RebalanceAssetType.Group:
        return groupList;
      default:
        return [];
    }
  }, [tokensList, poolsList, lendingList, stakingList, depositingList, lockingList, groupList]);

  const referenceOptions = React.useMemo(() => {
    switch (referenceType) {
      case RebalanceReferenceType.Token:
        return tokensList;
      case RebalanceReferenceType.Protocol:
        return protocolsList;
      case RebalanceReferenceType.Group:
        return GROUP_OPTIONS.map((g) => ({ id: String(g.value), label: g.label }));
      case RebalanceReferenceType.TotalWallet:
        return [];
      default:
        return [];
    }
  }, [referenceType, tokensList, protocolsList]);

  // Reset dependent fields on changes
  React.useEffect(() => {
    if (!editingId) setAssetId('');
  }, [assetType, editingId]);
  React.useEffect(() => {
    if (!editingId) setReferenceValue('');
  }, [referenceType, editingId]);

  const canAdd =
    assetType !== '' &&
    (assetId || assetIds.length > 0) &&
    referenceType !== '' &&
    (referenceType === RebalanceReferenceType.TotalWallet || referenceValue);

  // Legacy migration: convert any in-memory entries using old virtual GROUP=98 to backend enum 6
  React.useEffect(() => {
    setEntries((prev) => {
      let changed = false;
      const mapped = prev.map((e) => {
        if (e.assetType === 98) {
          // old group value
          changed = true;
          const newType = RebalanceAssetType.Group;
          return {
            ...e,
            assetType: newType,
            id: e.id.replace(/^98-/, `${newType}-`),
          };
        }
        return e;
      });
      return changed ? mapped : prev;
    });
  }, []);

  const handleAdd = () => {
    if (!canAdd) return;
    const atLabel =
      ASSET_TYPE_OPTIONS.find((a) => a.value === assetType)?.label || getAssetTypeLabel(assetType);
    // Use assetIds if available, otherwise use single assetId
    const finalAssets = assetIds.length > 0 ? assetIds : [{ type: assetType, id: assetId }];
    const assetLabels = finalAssets.map(asset => {
      const opts = getOptionsForType(asset.type);
      return opts.find((a) => a.id === asset.id)?.label || asset.id;
    }).join(' + ');
    const refLabel =
      referenceType === RebalanceReferenceType.TotalWallet
        ? 'Total Wallet'
        : referenceOptions.find((r) => r.id === referenceValue)?.label || referenceValue;
    const newId = `${finalAssets.map(a => `${a.type}-${a.id}`).join(',')}-${referenceType}-${referenceValue || 'total'}`;
    setEntries((prev) => {
      if (prev.some((e) => e.id === newId)) return prev; // prevent duplicates
      return [
        ...prev,
        {
          id: newId,
          assetType,
          assetIds: finalAssets,
          assetLabel: assetLabels,
          referenceType,
          referenceValue: referenceValue || null,
          referenceLabel: refLabel,
          note: Number(note) || 0,
        },
      ];
    });
    // Clear form
    setAssetId('');
    setAssetIds([]);
  };

  const handleSubmit = () => {
    if (!canAdd) return;
    const refLabel =
      referenceType === RebalanceReferenceType.TotalWallet
        ? 'Total Wallet'
        : referenceOptions.find((r) => r.id === referenceValue)?.label || referenceValue;
    // Use assetIds if available, otherwise use single assetId
    const finalAssets = assetIds.length > 0 ? assetIds : [{ type: assetType, id: assetId }];
    const assetLabels = finalAssets.map(asset => {
      const opts = getOptionsForType(asset.type);
      return opts.find((a) => a.id === asset.id)?.label || asset.id;
    }).join(' + ');
    const newId = `${finalAssets.map(a => `${a.type}-${a.id}`).join(',')}-${referenceType}-${referenceValue || 'total'}`;
    if (editingId) {
      // Update existing
      const dup = entries.some((e) => e.id === newId && e.id !== editingId);
      if (dup) return;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? {
                ...e,
                id: newId,
                assetType,
                assetIds: finalAssets,
                assetLabel: assetLabels,
                referenceType,
                referenceValue: referenceValue || null,
                referenceLabel: refLabel,
                note: Number(note) || 0,
              }
            : e
        )
      );
      setEditingId(null);
    } else {
      handleAdd();
    }
    setShowDialog(false);
  };

  const removeEntry = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));

  // Helpers reused for icon rendering in entries list
  const getLogoFromAnyTop = React.useCallback((t) => {
    if (!t || typeof t !== 'object') return '';
    return (
      t.logo ||
      t.logoURI ||
      t.image ||
      t.icon ||
      t.logoUrl ||
      t.logo_url ||
      t.iconUrl ||
      t.icon_url ||
      ''
    );
  }, []);
  // No token logo fallbacks: rely only on provided logo fields

  const inputBase = {
    background: theme.bgPanel,
    border: `1px solid ${theme.border}`,
    color: theme.textPrimary,
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    height: CONTROL_HEIGHT,
    boxSizing: 'border-box',
  };

  // --- Current value and percentage computations ---
  const getPositionTokens = React.useCallback((pos) => {
    if (!pos || typeof pos !== 'object') return [];
    if (Array.isArray(pos.tokens) && pos.tokens.length) return pos.tokens;
    if (Array.isArray(pos.pool?.tokens) && pos.pool.tokens.length) return pos.pool.tokens;
    const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken;
    const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken;
    const arr = [];
    if (t0) arr.push(t0);
    if (t1) arr.push(t1);
    return arr;
  }, []);

  const toNumber = (v) => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };

  const tokenTotalPrice = React.useCallback((tok) => {
    if (!tok || typeof tok !== 'object') return 0;
    const raw = tok.token || tok;
    const direct = raw.totalPrice ?? raw.financials?.totalPrice;
    return toNumber(direct);
  }, []);

  const signedTokenValue = React.useCallback(
    (tok, pos) => {
      // Borrowed/debt negative, others positive (best-effort)
      const t = ((tok?.type || tok?.label || '') + '').toLowerCase();
      const val = Math.abs(tokenTotalPrice(tok));
      if (t.includes('borrow') || t.includes('debt')) return -val;
      if (!t) {
        const lbl = ((pos?.position?.label || pos?.label || '') + '').toLowerCase();
        if (lbl.includes('borrow') || lbl.includes('debt')) return -val;
      }
      return val;
    },
    [tokenTotalPrice]
  );

  const entryCurrentValues = React.useMemo(() => {
    const map = new Map();
    entries.forEach((e) => {
      let cur = 0;
      
      // Support multiple assets: iterate over assetIds array
      const assetsArray = e.assetIds || (e.assetId ? [{ type: e.assetType, id: e.assetId }] : []);
      
      assetsArray.forEach((asset) => {
        const assetType = asset.type;
        const assetId = asset.id;
        
        if (assetType === RebalanceAssetType.Wallet) {
          const tok = tokensList.find((o) => o.id === assetId)?.raw;
          cur += tokenTotalPrice(tok);
        } else if (assetType === RebalanceAssetType.LiquidityPool) {
          const raw = poolsList.find((o) => o.id === assetId)?.raw;
          const pos = raw?.position || raw;
          const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
          if (toks.length) cur += toks.reduce((s, t) => s + tokenTotalPrice(t), 0);
          else cur += toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
        } else if (assetType === RebalanceAssetType.LendingAndBorrowing) {
          const raw = lendingList.find((o) => o.id === assetId)?.raw;
          const pos = raw?.position || raw;
          const toks = Array.isArray(pos?.tokens) ? pos.tokens : [];
          if (toks.length) cur += toks.reduce((s, t) => s + signedTokenValue(t, pos), 0);
          else cur += toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
        } else if (assetType === RebalanceAssetType.Staking) {
          const raw = stakingList.find((o) => o.id === assetId)?.raw;
          const pos = raw?.position || raw;
          // Prefer explicit totalPrice/value; else sum tokens; else use balance (already USD?)
          const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
          if (explicit) cur += explicit;
          else {
            const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
            if (toks.length) cur += toks.reduce((s, t) => s + tokenTotalPrice(t), 0);
            else cur += toNumber(pos?.balance);
          }
        } else if (assetType === RebalanceAssetType.Depositing) {
          const raw = depositingList.find((o) => o.id === assetId)?.raw;
          const pos = raw?.position || raw;
          const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
          if (explicit) cur += explicit;
          else {
            const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
            if (toks.length) cur += toks.reduce((s, t) => s + tokenTotalPrice(t), 0);
            else cur += toNumber(pos?.balance);
          }
        } else if (assetType === RebalanceAssetType.Locking) {
          const raw = lockingList.find((o) => o.id === assetId)?.raw;
          const pos = raw?.position || raw;
          const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
          if (explicit) cur += explicit;
          else {
            const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
            if (toks.length) cur += toks.reduce((s, t) => s + tokenTotalPrice(t), 0);
            else cur += toNumber(pos?.balance);
          }
        } else if (assetType === RebalanceAssetType.Group) {
        } else if (assetType === RebalanceAssetType.Group) {
          // Aggregate based on virtual group id
          const gid = assetId; // e.g., group:liquidity, group:lending, group:staking, group:defi, group:stablecoins
          if (gid === 'group:liquidity') {
            cur += poolsList.reduce((s, o) => {
              const pos = o.raw?.position || o.raw;
              const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
              if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0);
              const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
              return s + explicit;
            }, 0);
          } else if (gid === 'group:lending') {
            cur += lendingList.reduce((s, o) => {
              const pos = o.raw?.position || o.raw;
              const toks = Array.isArray(pos?.tokens) ? pos.tokens : [];
              if (toks.length) return s + toks.reduce((ss, t) => ss + signedTokenValue(t, pos), 0);
              const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
              return s + explicit;
            }, 0);
          } else if (gid === 'group:staking') {
            cur += stakingList.reduce((s, o) => {
              const pos = o.raw?.position || o.raw;
              const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
              if (explicit) return s + explicit;
              const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
              if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0);
              return s + toNumber(pos?.balance);
            }, 0);
          } else if (gid === 'group:defi') {
            // Defi = liquidity + lending + staking
            const liq = poolsList.reduce((s, o) => {
              const pos = o.raw?.position || o.raw;
              const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
              if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0);
              const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
              return s + explicit;
            }, 0);
            const lend = lendingList.reduce((s, o) => {
              const pos = o.raw?.position || o.raw;
              const toks = Array.isArray(pos?.tokens) ? pos.tokens : [];
              if (toks.length) return s + toks.reduce((ss, t) => ss + signedTokenValue(t, pos), 0);
              const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
              return s + explicit;
            }, 0);
            const stake = stakingList.reduce((s, o) => {
              const pos = o.raw?.position || o.raw;
              const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
              if (explicit) return s + explicit;
              const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
              if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0);
              return s + toNumber(pos?.balance);
            }, 0);
            cur += liq + lend + stake;
          } else if (gid === 'group:stablecoins') {
            // Sum wallet tokens whose symbol is in the stablecoin group definition
            const stableGroup = virtualGroups.find((v) => v.id === 'group:stablecoins');
            const syms = new Set((stableGroup?.members || []).map((s) => s.toUpperCase()));
            cur += tokensList.reduce((s, o) => {
              const tok = o.raw?.token || o.raw;
              const sym = (tok?.symbol || tok?.name || '').toUpperCase();
              if (syms.has(sym)) return s + tokenTotalPrice(tok);
              return s;
            }, 0);
          }
        }
      });
      
      map.set(e.id, cur);
    });
    return map;
  }, [
    entries,
    tokensList,
    poolsList,
    lendingList,
    stakingList,
    depositingList,
    lockingList,
    getPositionTokens,
    tokenTotalPrice,
    signedTokenValue,
    virtualGroups,
  ]);

  // Total portfolio current value (Wallet + Liquidity + Lending net + Staking + Depositing + Locking)
  const totalPortfolioCurrent = React.useMemo(() => {
    // Wallet tokens
    const walletSum = tokensList.reduce((s, o) => s + tokenTotalPrice(o.raw), 0);
    // Liquidity pools
    const poolsSum = poolsList.reduce((s, o) => {
      const pos = o.raw?.position || o.raw;
      const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
      if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0);
      const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
      return s + explicit;
    }, 0);
    // Lending (signed)
    const lendingSum = lendingList.reduce((s, o) => {
      const pos = o.raw?.position || o.raw;
      const toks = Array.isArray(pos?.tokens) ? pos.tokens : [];
      if (toks.length) return s + toks.reduce((ss, t) => ss + signedTokenValue(t, pos), 0);
      const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
      return s + explicit;
    }, 0);
    // Staking
    const stakingSum = stakingList.reduce((s, o) => {
      const pos = o.raw?.position || o.raw;
      const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
      if (explicit) return s + explicit;
      const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
      if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0);
      return s + toNumber(pos?.balance);
    }, 0);
    // Depositing
    const depositingSum = depositingList.reduce((s, o) => {
      const pos = o.raw?.position || o.raw;
      const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
      if (explicit) return s + explicit;
      const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
      if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0);
      return s + toNumber(pos?.balance);
    }, 0);
    // Locking
    const lockingSum = lockingList.reduce((s, o) => {
      const pos = o.raw?.position || o.raw;
      const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice);
      if (explicit) return s + explicit;
      const toks = getPositionTokens(pos).map((x) => (x && x.token ? x.token : x));
      if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0);
      return s + toNumber(pos?.balance);
    }, 0);
    return walletSum + poolsSum + lendingSum + stakingSum + depositingSum + lockingSum;
  }, [
    tokensList,
    poolsList,
    lendingList,
    stakingList,
    depositingList,
    lockingList,
    getPositionTokens,
    tokenTotalPrice,
    signedTokenValue,
  ]);

  const bucketKey = (e) => `${e.referenceType}:${e.referenceValue ?? 'total'}`;

  const bucketNoteSums = React.useMemo(() => {
    const m = new Map();
    entries.forEach((e) => {
      const k = bucketKey(e);
      m.set(k, (m.get(k) || 0) + (Number(e.note) || 0));
    });
    return m;
  }, [entries]);

  const bucketCurrentSums = React.useMemo(() => {
    const m = new Map();
    entries.forEach((e) => {
      const k = bucketKey(e);
      const v = entryCurrentValues.get(e.id) || 0;
      m.set(k, (m.get(k) || 0) + v);
    });
    // For TotalWallet bucket, use the entire portfolio current value
    const hasTotalWallet = entries.some(
      (e) => e.referenceType === RebalanceReferenceType.TotalWallet
    );
    if (hasTotalWallet) {
      m.set(`${RebalanceReferenceType.TotalWallet}:total`, totalPortfolioCurrent);
    }
    return m;
  }, [entries, entryCurrentValues, totalPortfolioCurrent]);

  // Prefill entries from backend-saved items
  React.useEffect(() => {
    if (!Array.isArray(initialSavedItems) || initialSavedItems.length === 0) return;
    // Build a lookup for labels
    const tokenById = new Map(tokensList.map((t) => [t.id, t]));
    const poolById = new Map(poolsList.map((p) => [p.id, p]));
    const lendById = new Map(lendingList.map((l) => [l.id, l]));
    const stakeById = new Map(stakingList.map((s) => [s.id, s]));
    const protoById = new Map(protocolsList.map((p) => [p.id, p]));

    const mapRefType = (n) => {
      if (n === RebalanceReferenceTypeEnum.Token) return RebalanceReferenceType.Token;
      if (n === RebalanceReferenceTypeEnum.Protocol) return RebalanceReferenceType.Protocol;
      if (n === RebalanceReferenceTypeEnum.Group) return RebalanceReferenceType.Group;
      if (n === RebalanceReferenceTypeEnum.TotalWallet) return RebalanceReferenceType.TotalWallet;
      return RebalanceReferenceType.Protocol;
    };

    const makeAssetLabel = (assetId, type) => {
      const groupById = new Map(groupList.map((g) => [g.id, g]));
      const depositById = new Map(depositingList.map((d) => [d.id, d]));
      const lockById = new Map(lockingList.map((l) => [l.id, l]));
      const src =
        type === RebalanceAssetType.Wallet
          ? tokenById
          : type === RebalanceAssetType.LiquidityPool
            ? poolById
            : type === RebalanceAssetType.LendingAndBorrowing
              ? lendById
              : type === RebalanceAssetType.Staking
                ? stakeById
                : type === RebalanceAssetType.Depositing
                  ? depositById
                  : type === RebalanceAssetType.Locking
                    ? lockById
                    : type === RebalanceAssetType.Group
                      ? groupById
                      : null;
      return src?.get(assetId)?.label || assetId;
    };

    const makeRefLabel = (refType, val) => {
      if (refType === RebalanceReferenceType.TotalWallet) return 'Total Wallet';
      if (refType === RebalanceReferenceType.Group) {
        const g = GROUP_OPTIONS.find((g) => String(g.value) === String(val));
        return g?.label || String(val);
      }
      if (refType === RebalanceReferenceType.Token) return tokenById.get(val)?.label || String(val);
      if (refType === RebalanceReferenceType.Protocol)
        return protoById.get(val)?.label || String(val);
      return String(val);
    };

    const mapped = initialSavedItems.map((it) => {
      const refType = mapRefType(it.byGroupType);
      
      // Convert assets array from backend format {key, type: number} to internal format {id, type: number}
      const assetsRaw = it.assets || [];
      const assets = assetsRaw.map(a => ({
        type: typeof a.type === 'number' ? a.type : (ASSET_TYPE_FROM_STRING[a.type] || RebalanceAssetType.Unknown),
        id: a.key
      }));
      
      // All assets should have valid types
      const primaryType = assets[0]?.type || RebalanceAssetType.Unknown;
      const assetLabels = assets.map(asset => makeAssetLabel(asset.id, asset.type)).join(' + ');
      
      const entry = {
        id: `${assets.map(a => `${a.type}-${a.id}`).join(',')}-${refType}-${refType === RebalanceReferenceType.TotalWallet ? 'total' : it.value || ''}`,
        assetType: primaryType,
        assetIds: assets,
        assetLabel: assetLabels,
        referenceType: refType,
        referenceValue: it.value,
        referenceLabel: makeRefLabel(refType, it.value),
        note: it.note ?? 0,
      };
      return entry;
    });
    // Deduplicate with existing entries and set
    setEntries((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]));
      mapped.forEach((m) => {
        if (!byId.has(m.id)) byId.set(m.id, m);
      });
      return Array.from(byId.values());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSavedItems, tokensList, poolsList, lendingList, stakingList, depositingList, lockingList, protocolsList, ASSET_TYPE_FROM_STRING]);

  // Mark initial load done (for auto-save skip)
  const lastSavedHashRef = React.useRef(null);

  React.useEffect(() => {
    if (!didInitialLoad) {
      setDidInitialLoad(true);
      // Initialize hash with current entries to prevent initial save
      if (entries.length > 0) {
        lastSavedHashRef.current = JSON.stringify(
          entries.map((e) => ({
            id: e.id,
            assetType: e.assetType,
            assetIds: e.assetIds || [e.assetId],
            referenceType: e.referenceType,
            referenceValue: e.referenceValue,
            note: e.note,
          }))
        );
      }
    }
  }, [entries, didInitialLoad]);

  const saveRebalance = React.useCallback(async () => {
    if (entries.length === 0) {
      setSaveResult(null);
      return;
    }
    try {
      setSaving(true);
      setSaveError(null);
      const findLogosForEntry = (entry) => {
        const type = entry.assetType;
        let logos = [];
        // Support multiple assets from different types
        const assetsWithType = entry.assetIds || [{ type: entry.assetType, id: entry.assetId }];
        
        const pickFromTokens = (tokens) => {
          tokens.forEach((t) => {
            if (logos.length >= 2) return;
            const tok = t?.token || t;
            const lg =
              tok?.logo ||
              tok?.logoURI ||
              tok?.image ||
              tok?.icon ||
              tok?.logoUrl ||
              tok?.logo_url ||
              tok?.iconUrl ||
              tok?.icon_url;
            if (lg && !logos.includes(lg)) logos.push(lg);
          });
        };
        
        // Iterate through all assets to collect logos
        assetsWithType.forEach((asset) => {
          if (logos.length >= 2) return;
          const assetId = asset.id || asset;
          const assetType = asset.type || entry.assetType;
          
          if (assetType === RebalanceAssetType.Wallet) {
            const tok = tokensList.find((x) => x.id === assetId)?.raw || {};
            const lg =
              tok?.logo ||
              tok?.logoURI ||
              tok?.image ||
              tok?.icon ||
              tok?.logoUrl ||
              tok?.logo_url ||
              tok?.iconUrl ||
              tok?.icon_url;
            if (lg && !logos.includes(lg)) logos.push(lg);
          } else if (assetType === RebalanceAssetType.LiquidityPool) {
            const pool =
              poolsList.find((x) => x.id === assetId)?.raw?.position ||
              poolsList.find((x) => x.id === assetId)?.raw;
            if (pool) {
              if (Array.isArray(pool.tokens) && pool.tokens.length) pickFromTokens(pool.tokens);
              if (logos.length === 0) {
                const lg =
                  pool.logo ||
                  pool.logoURI ||
                  pool.image ||
                  pool.icon ||
                  pool.logoUrl ||
                  pool.logo_url ||
                  pool.iconUrl ||
                  pool.icon_url;
                if (lg) logos.push(lg);
              }
            }
          } else if (assetType === RebalanceAssetType.LendingAndBorrowing) {
            const lend =
              lendingList.find((x) => x.id === assetId)?.raw?.position ||
              lendingList.find((x) => x.id === assetId)?.raw;
            if (lend && Array.isArray(lend.tokens)) pickFromTokens(lend.tokens);
          } else if (assetType === RebalanceAssetType.Staking) {
            const stake =
              stakingList.find((x) => x.id === assetId)?.raw?.position ||
              stakingList.find((x) => x.id === assetId)?.raw;
            if (stake && Array.isArray(stake.tokens)) pickFromTokens(stake.tokens);
          } else if (assetType === RebalanceAssetType.Depositing) {
            const deposit =
              depositingList.find((x) => x.id === assetId)?.raw?.position ||
              depositingList.find((x) => x.id === assetId)?.raw;
            if (deposit && Array.isArray(deposit.tokens)) pickFromTokens(deposit.tokens);
          } else if (assetType === RebalanceAssetType.Locking) {
            const lock =
              lockingList.find((x) => x.id === assetId)?.raw?.position ||
              lockingList.find((x) => x.id === assetId)?.raw;
            if (lock && Array.isArray(lock.tokens)) pickFromTokens(lock.tokens);
          }
        });
        
        return { Logo1: logos[0] || null, Logo2: logos[1] || null };
      };
      
      // Build items and filter out any with empty assets
      const items = entries.map((e) => {
        const logos = saveResult?.entriesHash ? null : findLogosForEntry(e); // Always recalc (could hash later)
        // Extract assets from {type, id} format, or use legacy assetId
        const assetsWithType = e.assetIds || [{ type: e.assetType, id: e.assetId }];
        const assets = assetsWithType
          .filter(a => a.id) // Filter out any assets without id
          .map(a => ({
            Key: a.id,
            Type: a.type // Use numeric type directly (backend expects number)
          }));
        return {
          Version: '1',
          Assets: assets,
          Note: e.note,
          ByGroupType: REF_ENUM_MAP[e.referenceType] ?? 0,
          Value:
            e.referenceType === RebalanceReferenceType.TotalWallet
              ? null
              : e.referenceValue || e.referenceLabel,
          AdditionalInfo: logos,
        };
      }).filter(item => item.Assets.length > 0); // Only include items with at least one asset
      
      const payload = {
        AccountId: selectedWalletGroupId ? undefined : (account || undefined),
        WalletGroupId: selectedWalletGroupId || undefined,
        Items: items,
      };
      const res = await fetch(`${config.API_BASE_URL}/api/v1/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `Save failed: ${res.status} ${res.statusText}`;
        try {
          const errJson = await res.json();
          if (errJson?.title || errJson?.error) msg += ` - ${errJson.title || errJson.error}`;
          if (errJson?.errors) msg += `\n${JSON.stringify(errJson.errors)}`;
        } catch {
          const text = await res.text();
          if (text) msg += ` - ${text}`;
        }
        throw new Error(msg);
      }
      const data = await res.json();
      setSaveResult({
        key: data.key,
        itemsCount: data.itemsCount,
        accounts: data.accounts,
        savedAt: new Date(),
      });
      // Notify parent to refresh rebalances data
      if (onRebalancesSaved) {
        onRebalancesSaved();
      }
    } catch (err) {
      console.error('Auto-save error', err);
      setSaveError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [
    entries,
    account,
    selectedWalletGroupId,
    ASSET_TYPE_TO_STRING,
    REFERENCE_TYPE_TO_STRING,
    RebalanceReferenceType.TotalWallet,
    tokensList,
    poolsList,
    lendingList,
    stakingList,
    depositingList,
    lockingList,
  ]);

  // Auto-save DISABLED - save only on explicit button click or delete action
  // const saveTimerRef = React.useRef(null);
  // const saveRebalanceRef = React.useRef(saveRebalance);

  // Keep ref updated with latest saveRebalance function
  // React.useEffect(() => {
  //   saveRebalanceRef.current = saveRebalance;
  // }, [saveRebalance]);

  // React.useEffect(() => {
  //   if (!didInitialLoad) return; // skip first population
  //   if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  //   if (entries.length === 0) {
  //     setSaveResult(null);
  //     lastSavedHashRef.current = null;
  //     return;
  //   }
  //
  //   // Calculate hash of current entries to detect real changes
  //   const currentHash = JSON.stringify(entries.map(e => ({
  //     id: e.id,
  //     assetType: e.assetType,
  //     assetId: e.assetId,
  //     referenceType: e.referenceType,
  //     referenceValue: e.referenceValue,
  //     note: e.note
  //   })));
  //
  //   // Skip save if nothing changed
  //   if (lastSavedHashRef.current === currentHash) {
  //     return;
  //   }
  //
  //   saveTimerRef.current = setTimeout(() => {
  //     saveRebalanceRef.current().then(() => {
  //       // Update hash after successful save
  //       lastSavedHashRef.current = currentHash;
  //     });
  //   }, 300);
  //   return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [entries]);

  // Duplicate detection for current selection (used to disable Add in dialog)
  const candidateId =
    assetType !== '' && assetId && referenceType !== ''
      ? `${assetType}-${assetId}-${referenceType}-${referenceType === RebalanceReferenceType.TotalWallet ? 'total' : referenceValue || ''}`
      : '';
  const isDuplicateCandidate = candidateId
    ? entries.some((e) => e.id === candidateId && e.id !== editingId)
    : false;

  // (REF_ENUM_MAP declared earlier)

  return (
    <div className="panel rebalance-panel pad-16 text-primary">
      <div className="panel-header">
        <div className="panel-title">Rebalancing</div>
        <button type="button" onClick={() => setShowDialog(true)} className="btn btn--outline">
          Add
        </button>
      </div>

      {/* Rebalance Item Dialog (glass UI) */}
      <RebalanceItemDialog
        open={showDialog}
        editing={!!editingId}
        assetType={assetType}
        setAssetType={setAssetType}
        assetId={assetId}
        setAssetId={setAssetId}
        assetIds={assetIds}
        setAssetIds={setAssetIds}
        assetOptions={assetOptions}
        referenceType={referenceType}
        setReferenceType={setReferenceType}
        referenceValue={referenceValue}
        setReferenceValue={setReferenceValue}
        referenceOptions={referenceOptions}
        note={note}
        setNote={setNote}
        ASSET_TYPE_OPTIONS={ASSET_TYPE_OPTIONS}
        RebalanceReferenceType={RebalanceReferenceType}
        ITEM_TYPES={ITEM_TYPES}
        AssetDropdown={AssetDropdown}
        TokenDisplay={TokenDisplay}
        tokensList={tokensList}
        protocolsList={protocolsList}
        getOptionsForType={getOptionsForType}
        canAdd={canAdd}
        isDuplicateCandidate={isDuplicateCandidate}
        onCancel={() => {
          setShowDialog(false);
          if (editingId) setEditingId(null);
          setAssetId('');
          setAssetIds([]);
        }}
        onSubmit={handleSubmit}
        theme={theme}
      />

      {/* Entries List (Grouped Collapsible Sections by Reference Type + Value) */}
      {entries.length > 0 && (
        <div className="mt-20 flex column gap-20">
          {useCardView ? (
            // Card View for mobile/small screens
            (() => {
              // Group entries by bucketKey (referenceType:referenceValue)
              const buckets = new Map();
              entries.forEach((e) => {
                const key = bucketKey(e);
                if (!buckets.has(key)) {
                  buckets.set(key, {
                    label: `${e.referenceLabel}`,
                    entries: []
                  });
                }
                buckets.get(key).entries.push(e);
              });
              
              return Array.from(buckets.entries()).map(([key, { label, entries: groupEntries }]) => (
                <CollapsibleMenu
                  key={key}
                  title={label}
                  variant="flat"
                  showSummary={false}
                >
                  <RebalancingCards
                    entries={groupEntries}
                    onEdit={(row) => {
                      setEditingId(row.id);
                      setShowDialog(true);
                      setAssetType(row.assetType);
                      const assets = row.assetIds || [{ type: row.assetType, id: row.assetId }];
                      if (assets.length === 1) {
                        setAssetId(assets[0].id || assets[0]);
                        setAssetIds([]);
                      } else {
                        setAssetId('');
                        setAssetIds(assets);
                      }
                      setReferenceType(row.referenceType);
                      setReferenceValue(row.referenceValue || '');
                      setNote(row.note || 0);
                    }}
                    onDelete={removeEntry}
                    entryCurrentValues={entryCurrentValues}
                    bucketCurrentSums={bucketCurrentSums}
                    bucketNoteSums={bucketNoteSums}
                    bucketKey={bucketKey}
                    tokensList={tokensList}
                    poolsList={poolsList}
                    lendingList={lendingList}
                    stakingList={stakingList}
                  />
                </CollapsibleMenu>
              ));
            })()
          ) : (
            // Table View for desktop/large screens
            (() => {
            // Group entries by bucketKey (referenceType:referenceValue)
            const buckets = new Map();
            entries.forEach((e) => {
              const key = bucketKey(e);
              if (!buckets.has(key)) {
                buckets.set(key, {
                  label: `${e.referenceLabel}`,
                  entries: []
                });
              }
              buckets.get(key).entries.push(e);
            });
            
            return Array.from(buckets.entries()).map(([key, { label, entries: groupEntries }]) => (
              <CollapsibleMenu
                key={key}
                title={label}
                variant="flat"
                showSummary={false}
              >
                <div className="table-wrapper">
                  <table className="table-unified text-primary">
                    <StandardHeader
                      columnDefs={[
                        // Icon + name are merged in the first (token) column; remaining metric/action columns follow
                        { key: 'current', label: 'Current', align: 'right' },
                        { key: 'target', label: 'Target', align: 'right' },
                      { key: 'diff', label: 'Diff', align: 'right' },
                      { key: 'note', label: 'Note', align: 'left' },
                      { key: 'actions', label: '', align: 'right', className: 'col-actions' },
                    ]}
                    labels={{ token: 'Asset' }}
                  />
                  <tbody>
                    {isLoadingPrimary && groupEntries.length === 0
                      ? skeletonRows.map((_, i) => (
                          <tr
                            key={'sk-' + group.type + i}
                            className={`table-row ${i === skeletonRows.length - 1 ? '' : 'tbody-divider'}`}
                          >
                            <td className="td col-name">
                              <span className="flex align-center gap-8">
                                <Skeleton width={26} height={26} className="circle" />
                                <Skeleton width={140} className="text" />
                              </span>
                            </td>
                            <td className="td td-right col-current">
                              <Skeleton width={60} className="text" />
                            </td>
                            <td className="td td-right col-target">
                              <Skeleton width={60} className="text" />
                            </td>
                            <td className="td td-right col-diff">
                              <Skeleton width={60} className="text" />
                            </td>
                            <td className="td col-note text-secondary">
                              <Skeleton width={40} className="text" />
                            </td>
                            <td className="td td-right col-actions">
                              <div className="flex-end gap-6">
                                <Skeleton width={34} height={34} />
                                <Skeleton width={34} height={34} />
                              </div>
                            </td>
                          </tr>
                        ))
                      : groupEntries.map((row, idx) => {
                          // Support both assetIds with {type, id} format and legacy assetId (single)
                          const assetsWithType = row.assetIds || [{ type: row.assetType, id: row.assetId }];
                          const primaryAsset = assetsWithType[0];
                          const primaryAssetId = primaryAsset.id || primaryAsset;
                          const primaryAssetType = primaryAsset.type || row.assetType;
                          
                          let assetOpt = null;
                          if (primaryAssetType === RebalanceAssetType.Wallet)
                            assetOpt = tokensList.find((o) => o.id === primaryAssetId);
                          else if (primaryAssetType === RebalanceAssetType.LiquidityPool)
                            assetOpt = poolsList.find((o) => o.id === primaryAssetId);
                          else if (primaryAssetType === RebalanceAssetType.LendingAndBorrowing)
                            assetOpt = lendingList.find((o) => o.id === primaryAssetId);
                          else if (primaryAssetType === RebalanceAssetType.Staking)
                            assetOpt = stakingList.find((o) => o.id === primaryAssetId);

                          const renderAssetIcons = () => {
                            // Render individual TokenDisplay for each asset
                            return assetsWithType.slice(0, 10).map((asset, idx) => {
                              const assetId = asset.id || asset;
                              const assetType = typeof asset.type === 'number' ? asset.type : (asset.type || row.assetType);
                              let opt = null;
                              
                              if (assetType === RebalanceAssetType.Wallet)
                                opt = tokensList.find(o => o.id === assetId);
                              else if (assetType === RebalanceAssetType.LiquidityPool)
                                opt = poolsList.find(o => o.id === assetId);
                              else if (assetType === RebalanceAssetType.LendingAndBorrowing)
                                opt = lendingList.find(o => o.id === assetId);
                              else if (assetType === RebalanceAssetType.Staking)
                                opt = stakingList.find(o => o.id === assetId);
                              
                              if (!opt) return null;
                              
                              // For Wallet, use raw directly
                              if (assetType === RebalanceAssetType.Wallet) {
                                return (
                                  <TokenDisplay
                                    key={`${idx}-${assetId}`}
                                    tokens={[opt.raw]}
                                    showName={false}
                                    showText={false}
                                    size={18}
                                    gap={6}
                                    showChain={true}
                                  />
                                );
                              } else {
                                // For LP/Lending/Staking, extract tokens
                                const pos = opt.raw?.position || opt.raw;
                                let toks = [];
                                if (Array.isArray(pos?.tokens) && pos.tokens.length) {
                                  toks = pos.tokens.map((x) => (x && x.token ? x.token : x));
                                } else if (Array.isArray(pos?.pool?.tokens) && pos.pool.tokens.length) {
                                  toks = pos.pool.tokens.map((x) => (x && x.token ? x.token : x));
                                } else {
                                  const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken;
                                  const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken;
                                  if (t0) toks.push(t0 && t0.token ? t0.token : t0);
                                  if (t1) toks.push(t1 && t1.token ? t1.token : t1);
                                }
                                toks = toks.filter(Boolean).slice(0, 2);
                                
                                if (toks.length > 0) {
                                  return (
                                    <TokenDisplay
                                      key={`${idx}-${assetId}`}
                                      tokens={toks}
                                      showName={false}
                                      showText={false}
                                      size={18}
                                      gap={6}
                                      showChain={true}
                                    />
                                  );
                                }
                              }
                              
                              return null;
                            }).filter(Boolean);
                          };

                          const bucket = bucketKey(row);
                          const curSum = bucketCurrentSums.get(bucket) || 0;
                          const noteSum = bucketNoteSums.get(bucket) || 0;
                          const curVal = entryCurrentValues.get(row.id) || 0;
                          const pctCurrent = curSum > 0 ? (curVal / curSum) * 100 : 0;
                          const pctTarget =
                            noteSum > 0 ? ((Number(row.note) || 0) / noteSum) * 100 : 0;
                          const fmtPct = (n) => formatPercent(n, { decimals: 2 });
                          const fmtUSD = (n) => maskValue(formatUsd(n, { decimals: 2 }));
                          const targetVal =
                            noteSum > 0 ? ((Number(row.note) || 0) / noteSum) * curSum : 0;
                          const diffVal = targetVal - curVal;

                          return (
                            <tr
                              key={row.id}
                              className={`table-row table-row-hover ${idx === groupEntries.length - 1 ? '' : 'tbody-divider'}`}
                            >
                              <td className="td text-primary col-name">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {assetsWithType.slice(0, 10).map((asset, assetIdx) => {
                                    const assetId = asset.id || asset;
                                    const assetType = typeof asset.type === 'number' ? asset.type : (asset.type || row.assetType);
                                    let opt = null;
                                    
                                    if (assetType === RebalanceAssetType.Wallet)
                                      opt = tokensList.find(o => o.id === assetId);
                                    else if (assetType === RebalanceAssetType.LiquidityPool)
                                      opt = poolsList.find(o => o.id === assetId);
                                    else if (assetType === RebalanceAssetType.LendingAndBorrowing)
                                      opt = lendingList.find(o => o.id === assetId);
                                    else if (assetType === RebalanceAssetType.Staking)
                                      opt = stakingList.find(o => o.id === assetId);
                                    
                                    if (!opt) return null;
                                    
                                    const label = opt.label || assetId;
                                    let tokens = [];
                                    let lendingType = null; // 'supply' or 'borrow'
                                    
                                    // Extract tokens for TokenDisplay
                                    if (assetType === RebalanceAssetType.Wallet) {
                                      tokens = [opt.raw];
                                    } else if (assetType === RebalanceAssetType.LendingAndBorrowing) {
                                      const pos = opt.raw?.position || opt.raw;
                                      if (Array.isArray(pos?.tokens) && pos.tokens.length) {
                                        tokens = pos.tokens.slice(0, 2).map((x) => (x && x.token ? x.token : x)).filter(Boolean);
                                        // Check first token type to determine supply/borrow
                                        const firstToken = pos.tokens[0];
                                        if (firstToken?.type === 'borrowed' || firstToken?.type === 'borrow' || firstToken?.type === 'debt') {
                                          lendingType = 'borrow';
                                        } else {
                                          lendingType = 'supply';
                                        }
                                      }
                                    } else {
                                      const pos = opt.raw?.position || opt.raw;
                                      if (Array.isArray(pos?.tokens) && pos.tokens.length) {
                                        tokens = pos.tokens.slice(0, 2).map((x) => (x && x.token ? x.token : x)).filter(Boolean);
                                      } else if (Array.isArray(pos?.pool?.tokens) && pos.pool.tokens.length) {
                                        tokens = pos.pool.tokens.slice(0, 2).map((x) => (x && x.token ? x.token : x)).filter(Boolean);
                                      } else {
                                        const t0 = pos?.token0 || pos?.tokenA || pos?.baseToken || pos?.primaryToken;
                                        const t1 = pos?.token1 || pos?.tokenB || pos?.quoteToken || pos?.secondaryToken;
                                        if (t0) tokens.push(t0 && t0.token ? t0.token : t0);
                                        if (t1) tokens.push(t1 && t1.token ? t1.token : t1);
                                        tokens = tokens.filter(Boolean);
                                      }
                                    }
                                    
                                    return (
                                      <div
                                        key={`${assetType}-${assetId}-${assetIdx}`}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          padding: '0 10px',
                                          minHeight: 32,
                                          background: 'var(--mw-bg-panel,var(--app-bg-panel))',
                                          border: '1px solid var(--mw-border,var(--app-border))',
                                          borderRadius: 8,
                                          fontSize: 13,
                                        }}
                                      >
                                        {/* Type icon */}
                                        <span style={{ fontSize: 14, opacity: 0.7 }} title={
                                          assetType === 1 ? 'Wallet' :
                                          assetType === 2 ? 'Liquidity Pool' :
                                          assetType === 3 ? 'Lending Position' :
                                          assetType === 4 ? 'Staking Position' : 
                                          assetType === 8 ? 'Depositing Position' : 
                                          assetType === 9 ? 'Locking Position' : 'Asset'
                                        }>
                                          {assetType === 1 ? '💼' : 
                                           assetType === 2 ? '💧' : 
                                           assetType === 3 ? '🏦' : 
                                           assetType === 4 ? '🔒' : 
                                           assetType === 8 ? '💰' : 
                                           assetType === 9 ? '🔐' : '📦'}
                                        </span>
                                        {tokens.length > 0 && TokenDisplay && (
                                          <TokenDisplay
                                            tokens={tokens}
                                            showName={false}
                                            showText={false}
                                            size={18}
                                            gap={6}
                                            showChain={true}
                                          />
                                        )}
                                        <span className="truncate" style={{ maxWidth: 200 }}>{label}</span>
                                        {/* Lending type badge */}
                                        {lendingType && (
                                          <span style={{
                                            fontSize: 10,
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            fontWeight: 600,
                                            marginLeft: 'auto',
                                            background: lendingType === 'borrow' 
                                              ? 'rgba(239, 68, 68, 0.15)' 
                                              : 'rgba(34, 197, 94, 0.15)',
                                            color: lendingType === 'borrow' 
                                              ? 'rgb(239, 68, 68)' 
                                              : 'rgb(34, 197, 94)',
                                          }}>
                                            {lendingType === 'borrow' ? 'BORROW' : 'SUPPLY'}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="td td-right td-mono tabular-nums text-primary col-current">
                                {(() => {
                                  const pctStr = fmtPct(Math.max(0, pctCurrent));
                                  return (
                                    <div className="flex flex-column items-end leading-tight">
                                      <span className="text-base">{pctStr}</span>
                                      <span className="text-secondary text-sm">
                                        {fmtUSD(curVal)}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="td td-right td-mono tabular-nums text-primary col-target">
                                {(() => {
                                  const pctStr = fmtPct(Math.max(0, pctTarget));
                                  return (
                                    <div
                                      className="flex column align-end"
                                      style={{ lineHeight: '14px' }}
                                    >
                                      <span style={{ fontSize: 12 }}>{pctStr}</span>
                                      <span className="text-secondary" style={{ fontSize: 11 }}>
                                        {fmtUSD(targetVal)}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="td td-right td-mono tabular-nums text-primary col-diff">
                                {(() => {
                                  const diffPct = pctTarget - pctCurrent;
                                  const arrow = diffPct > 0 ? '▲' : diffPct < 0 ? '▼' : '•';
                                  const cls =
                                    diffPct > 0
                                      ? 'text-positive'
                                      : diffPct < 0
                                        ? 'text-negative'
                                        : 'text-secondary';
                                  const pctStr = `${arrow} ${formatPercent(diffPct, { decimals: 2, sign: true })}`;
                                  const valStr = fmtUSD(diffVal);
                                  return (
                                    <div
                                      className={`flex column align-end`}
                                      style={{ lineHeight: '14px' }}
                                    >
                                      <span className={cls} style={{ fontSize: 12 }}>
                                        {pctStr}
                                      </span>
                                      <span className="text-secondary" style={{ fontSize: 11 }}>
                                        {valStr}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="td col-note text-secondary">{row.note || '-'}</td>
                              <td className="td td-right col-actions">
                                <div className="flex-end gap-6 w-full">
                                  <IconButton
                                    label="Edit"
                                    size={34}
                                    onClick={() => {
                                      setEditingId(row.id);
                                      setShowDialog(true);
                                      setAssetType(row.assetType);
                                      // Support both legacy assetId and new assetIds array with {type, id}
                                      const assets = row.assetIds || [{ type: row.assetType, id: row.assetId }];
                                      if (assets.length === 1) {
                                        setAssetId(assets[0].id || assets[0]);
                                        setAssetIds([]);
                                      } else {
                                        setAssetId('');
                                        setAssetIds(assets);
                                      }
                                      setReferenceType(row.referenceType);
                                      setReferenceValue(row.referenceValue || '');
                                      setNote(row.note || 0);
                                    }}
                                    icon={
                                      <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                      </svg>
                                    }
                                  />
                                  <IconButton
                                    label="Delete"
                                    size={34}
                                    variant="danger"
                                    onClick={() => removeEntry(row.id)}
                                    icon={
                                      <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        <line x1="10" y1="11" x2="10" y2="17" />
                                        <line x1="14" y1="11" x2="14" y2="17" />
                                      </svg>
                                    }
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
                </div>
              </CollapsibleMenu>
            ));
          })()
          )}
        </div>
      )}
      {/* Manual save bar with Save button */}
      <div className="save-bar mt-20" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '32px' }}>
          {entries.length === 0 && <span>Adicione items para iniciar configuração.</span>}
          {saving && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mw-text-secondary, var(--app-text-secondary))' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Saving changes...</span>
            </div>
          )}
          {!saving && saveResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mw-success-text, #10b981)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Saved successfully</span>
              {saveResult.savedAt && (
                <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '4px' }}>
                  • {saveResult.savedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
          {saveError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mw-danger-text, #ef4444)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Failed to save: {saveError}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => saveRebalance()}
              disabled={saving}
              className="btn btn--primary"
              style={{ fontSize: '14px', padding: '6px 16px', minWidth: '80px' }}
            >
              {saving ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Saving
                </span>
              ) : (
                'Save'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetDropdown({
  theme,
  assetType,
  value,
  options,
  onChange,
  tokensList = [],
  placeholder = 'Select asset…',
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = options.find((o) => o.id === value);

  const getLogoFromAny = (t) => {
    if (!t || typeof t !== 'object') return '';
    return (
      t.logo ||
      t.logoURI ||
      t.image ||
      t.icon ||
      t.logoUrl ||
      t.logo_url ||
      t.iconUrl ||
      t.icon_url ||
      ''
    );
  };

  const renderAssetIcon = (type, opt) => {
    if (type === RebalanceAssetType.Group) return null;
    const raw = opt.raw || {};
    if (type === RebalanceAssetType.Wallet) {
      const tok = raw;
      return (
        <TokenDisplay
          tokens={[tok]}
          showName={false}
          showText={false}
          size={18}
          gap={6}
          showChain={true}
        />
      );
    }
    if (type === 'PROTOCOL') {
      const logo = getLogoFromAny(raw);
      if (logo) {
        return (
          <div style={{ position: 'relative', width: 18, height: 18, flex: '0 0 auto' }}>
            <img
              src={logo}
              alt="protocol"
              style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
            />
          </div>
        );
      }
      return (
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: theme.bgPanel,
            border: `1px solid ${theme.border}`,
          }}
        />
      );
    }
    const pos = raw.position || raw;
    // Try multiple shapes to extract up to 2 tokens with logo/symbol/name
    let toks = [];
    if (Array.isArray(pos?.tokens) && pos.tokens.length) {
      toks = pos.tokens.map((x) => (x && x.token ? x.token : x));
    } else if (Array.isArray(pos?.pool?.tokens) && pos.pool.tokens.length) {
      toks = pos.pool.tokens.map((x) => (x && x.token ? x.token : x));
    } else {
      const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken;
      const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken;
      if (t0) toks.push(t0 && t0.token ? t0.token : t0);
      if (t1) toks.push(t1 && t1.token ? t1.token : t1);
    }
    toks = toks.filter(Boolean);
    // No token logo fallbacks: rely only on provided logo fields
    if (toks.length >= 2) {
      return (
        <TokenDisplay
          tokens={[toks[0], toks[1]]}
          showName={false}
          showText={false}
          size={18}
          gap={6}
          showChain={true}
        />
      );
    }
    if (toks.length === 1) {
      return (
        <TokenDisplay
          tokens={[toks[0]]}
          showName={false}
          showText={false}
          size={18}
          gap={6}
          showChain={true}
        />
      );
    }
    // Fallback icon
    return (
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: theme.bgPanel,
          border: `1px solid ${theme.border}`,
        }}
      />
    );
  };

  const renderPreview = () => {
    if (!selected)
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Ghost icon placeholder to keep height stable (matches TokenDisplay size 18, pair width ~21) */}
          <div style={{ position: 'relative', width: 21, height: 18, flex: '0 0 auto' }}>
            <div style={{ position: 'absolute', left: 0, top: 2, width: 14, height: 14 }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'transparent',
                }}
              />
            </div>
            <div style={{ position: 'absolute', left: 7, top: 2, width: 14, height: 14 }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'transparent',
                }}
              />
            </div>
          </div>
          <span style={{ color: theme.textSecondary }}>{placeholder}</span>
        </div>
      );
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {assetType === RebalanceAssetType.Group ? null : renderAssetIcon(assetType, selected)}
        <span style={{ color: theme.textPrimary }}>{selected.label}</span>
      </div>
    );
  };

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" className="dropdown-btn" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-8 min-w-0 flex-1">{renderPreview()}</div>
        <span className="text-secondary">▾</span>
      </button>
      {open && (
        <div className="dropdown-menu" role="listbox">
          <div className="pad-6">
            <button
              type="button"
              className="dropdown-option text-secondary"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <span>— None —</span>
            </button>
            {options.map((opt, idx) => {
              // Check if lending and determine supply/borrow
              let lendingType = null;
              if (assetType === RebalanceAssetType.LendingAndBorrowing) {
                const pos = opt.raw?.position || opt.raw;
                if (Array.isArray(pos?.tokens) && pos.tokens.length > 0) {
                  const firstToken = pos.tokens[0];
                  if (firstToken?.type === 'borrowed' || firstToken?.type === 'borrow' || firstToken?.type === 'debt') {
                    lendingType = 'borrow';
                  } else {
                    lendingType = 'supply';
                  }
                }
              }
              
              return (
                <button
                  key={`${opt.id}-${idx}`}
                  type="button"
                  className="dropdown-option"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {assetType === RebalanceAssetType.Group ? null : renderAssetIcon(assetType, opt)}
                  <span className="text-ellipsis-sm" style={{ flex: 1 }}>{opt.label}</span>
                  {lendingType && (
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 600,
                      background: lendingType === 'borrow' 
                        ? 'rgba(239, 68, 68, 0.15)' 
                        : 'rgba(34, 197, 94, 0.15)',
                      color: lendingType === 'borrow' 
                        ? 'rgb(239, 68, 68)' 
                        : 'rgb(34, 197, 94)',
                    }}>
                      {lendingType === 'borrow' ? 'BORROW' : 'SUPPLY'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
