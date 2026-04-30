import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useState, useMemo, useEffect } from 'react';

import { useTheme } from '../../context/ThemeProvider';
import { saveStrategies } from '../../services/apiClient';
import { loadStrategyWithCache, clearStrategyCache } from '../../hooks/useSharedStrategyCache';
import type {
  BestPurchaseWindowStrategy,
  BestPurchaseWindowEntry,
  PurchaseTrigger,
  WindowPeriod,
  WindowDirection,
  PriceDirection,
} from '../../types/strategy';
import type { WalletItem } from '../../types/wallet';

const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'ethereum',
  BTC: 'bitcoin',
  WBTC: 'bitcoin',
  CBBTC: 'bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  SOL: 'solana',
  WSOL: 'solana',
  BNB: 'binancecoin',
  WBNB: 'binancecoin',
  MATIC: 'matic-network',
  POL: 'matic-network',
  ARB: 'arbitrum',
  OP: 'optimism',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  RPL: 'rocket-pool',
  SUSHI: 'sushi',
  COMP: 'compound-governance-token',
  SNX: 'synthetix-network-token',
  YFI: 'yearn-finance',
  BAL: 'balancer',
  '1INCH': '1inch',
  GRT: 'the-graph',
  ENS: 'ethereum-name-service',
  DYDX: 'dydx',
  GMX: 'gmx',
  PENDLE: 'pendle',
  JTO: 'jito-governance-token',
  JUP: 'jupiter-exchange-solana',
  PYTH: 'pyth-network',
  RAY: 'raydium',
  MNDE: 'marinade',
  ORCA: 'orca',
  BONK: 'bonk',
  WIF: 'dogwifcoin',
  RENDER: 'render-token',
  STETH: 'staked-ether',
  RETH: 'rocket-pool-eth',
  CBETH: 'coinbase-wrapped-staked-eth',
  FRAX: 'frax',
  WEETH: 'wrapped-eeth',
  EZETH: 'renzo-restaked-eth',
  RSETH: 'kelp-dao-restaked-eth',
};

const WINDOW_OPTIONS: { value: WindowPeriod; label: string }[] = [
  { value: 'h1', label: '1h' },
  { value: 'h24', label: '24h' },
  { value: 'd7', label: '7d' },
  { value: 'd14', label: '14d' },
  { value: 'd30', label: '30d' },
  { value: 'd200', label: '200d' },
  { value: 'y1', label: '1y' },
  { value: 'ytd', label: 'YTD' },
];

interface EntryDraft {
  id: string;
  assetKey: string;
  symbol: string;
  coingeckoId: string;
  protocolId: string;
  protocolName: string;
  chainId: string;
  tokenName: string;
  tokenAddress: string;
  tokenLogo: string | null;
  triggerType: 'window' | 'price';
  windows: WindowPeriod[];
  windowDirection: WindowDirection;
  priceTarget: string;
  priceDirection: PriceDirection;
}

interface PortfolioAsset {
  symbol: string;
  tokenName: string;
  tokenAddress: string;
  tokenLogo: string | null;
}

const SortableEntryHandle: React.FC<{ id: string; children: React.ReactNode; isLast: boolean }> = ({
  id,
  children,
  isLast,
}) => {
  const { theme } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        gap: 8,
        marginBottom: isLast ? 0 : 16,
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          cursor: 'grab',
          background: theme.bgSecondary ?? theme.bgPanel,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          color: theme.textSecondary,
          fontSize: 16,
          userSelect: 'none',
          flexShrink: 0,
        }}
        title="Drag to reorder"
      >
        ⋮⋮
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
};

interface BestPurchaseWindowStrategyFormProps {
  walletGroupId: string;
  portfolio: WalletItem[];
  initialStrategy?: BestPurchaseWindowStrategy;
  onCancel: () => void;
  onSuccess: () => void;
}

const newDraft = (): EntryDraft => ({
  id: Math.random().toString(36).slice(2),
  assetKey: '',
  symbol: '',
  coingeckoId: '',
  protocolId: '',
  protocolName: '',
  chainId: '',
  tokenName: '',
  tokenAddress: '',
  tokenLogo: null,
  triggerType: 'window',
  windows: ['d7'],
  windowDirection: 'min',
  priceTarget: '',
  priceDirection: 'below',
});

export const BestPurchaseWindowStrategyForm: React.FC<BestPurchaseWindowStrategyFormProps> = ({
  walletGroupId,
  portfolio,
  initialStrategy,
  onCancel,
  onSuccess,
}) => {
  const { theme } = useTheme();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [name, setName] = useState(initialStrategy?.name ?? 'Best Purchase Window');
  const [description, setDescription] = useState(initialStrategy?.description ?? '');
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<EntryDraft[]>(() => {
    if (initialStrategy?.purchaseWindowEntries?.length) {
      return initialStrategy.purchaseWindowEntries.map((e) => {
        const triggers: PurchaseTrigger[] =
          e.triggers && e.triggers.length > 0 ? e.triggers : e.trigger ? [e.trigger] : [];

        const windowTriggers = triggers.filter(
          (t): t is Extract<PurchaseTrigger, { type: 'window' }> => t.type === 'window'
        );
        const priceTrigger = triggers.find(
          (t): t is Extract<PurchaseTrigger, { type: 'price' }> => t.type === 'price'
        );

        const isWindow = windowTriggers.length > 0;

        return {
          id: Math.random().toString(36).slice(2),
          assetKey: e.symbol,
          symbol: e.symbol,
          coingeckoId: e.coingeckoId,
          protocolId: e.protocol.id,
          protocolName: e.protocol.name,
          chainId: e.chain.id,
          tokenName: e.token.name,
          tokenAddress: e.token.address,
          tokenLogo: e.token.logo,
          triggerType: isWindow ? 'window' : 'price',
          windows: isWindow ? windowTriggers.map((t) => t.window) : ['d7'],
          windowDirection: isWindow ? windowTriggers[0].direction : 'min',
          priceTarget: priceTrigger ? String(priceTrigger.target) : '',
          priceDirection: priceTrigger ? priceTrigger.direction : 'below',
        };
      });
    }
    return [newDraft()];
  });

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    if (!openDropdownId) return;
    const handler = () => setOpenDropdownId(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdownId]);

  const portfolioAssets = useMemo<PortfolioAsset[]>(() => {
    const seen = new Set<string>();
    const assets: PortfolioAsset[] = [];

    portfolio.forEach((item) => {
      const tokens = item.position?.tokens ?? [];
      tokens.forEach((token) => {
        const sym = token.symbol?.toUpperCase();
        if (!sym || seen.has(sym)) return;
        seen.add(sym);
        assets.push({
          symbol: token.symbol,
          tokenName: token.name,
          tokenAddress: token.contractAddress ?? '',
          tokenLogo: token.logo ?? null,
        });
      });
    });

    return assets.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [portfolio]);

  const updateEntry = (id: string, patch: Partial<EntryDraft>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const selectAsset = (entryId: string, symbol: string) => {
    const asset = portfolioAssets.find((a) => a.symbol === symbol);
    if (!asset) return;
    const coingeckoId = SYMBOL_TO_COINGECKO_ID[asset.symbol.toUpperCase()] ?? '';
    updateEntry(entryId, {
      assetKey: asset.symbol,
      symbol: asset.symbol,
      coingeckoId,
      protocolId: '',
      protocolName: '',
      chainId: '',
      tokenName: asset.tokenName,
      tokenAddress: asset.tokenAddress,
      tokenLogo: asset.tokenLogo,
    });
    setOpenDropdownId(null);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, newDraft()]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = entries.findIndex((e) => e.id === active.id);
      const newIndex = entries.findIndex((e) => e.id === over.id);
      setEntries((prev) => arrayMove(prev, oldIndex, newIndex));
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Name is required';
    for (const e of entries) {
      if (!e.symbol) return 'Select an asset for each entry';
      if (!e.coingeckoId) return `CoinGecko ID missing for ${e.symbol}. Fill it in manually.`;
      if (e.triggerType === 'window') {
        if (e.windows.length === 0) return `Select at least one period for ${e.symbol}`;
      } else {
        const n = parseFloat(e.priceTarget);
        if (!e.priceTarget || isNaN(n) || n <= 0) return `Invalid price target for ${e.symbol}`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      alert(err);
      return;
    }

    setSaving(true);
    try {
      const purchaseWindowEntries: BestPurchaseWindowEntry[] = entries.map((e) => {
        let triggers: PurchaseTrigger[];
        if (e.triggerType === 'price') {
          triggers = [
            { type: 'price', target: parseFloat(e.priceTarget), direction: e.priceDirection },
          ];
        } else {
          triggers = e.windows.map((w) => ({
            type: 'window',
            window: w,
            direction: e.windowDirection,
          }));
        }

        return {
          assetKey: e.symbol,
          symbol: e.symbol,
          coingeckoId: e.coingeckoId,
          protocol: { id: '', name: '' },
          chain: { id: '', name: '' },
          token: {
            symbol: e.symbol,
            name: e.tokenName,
            address: e.tokenAddress,
            logo: e.tokenLogo,
          },
          triggers,
        };
      });

      const newStrategyPayload = {
        id: initialStrategy?.id,
        strategyType: 8 as const,
        name: name.trim(),
        description: description.trim() || null,
        purchaseWindowEntries,
      };

      const existingData = await loadStrategyWithCache(walletGroupId);
      const existingStrategies: any[] = existingData?.strategies || [];
      const merged: any[] = [];

      let placed = false;
      for (const s of existingStrategies) {
        if (initialStrategy && s.id === initialStrategy.id) {
          merged.push(newStrategyPayload);
          placed = true;
        } else {
          merged.push(s);
        }
      }
      if (!placed) {
        merged.push(newStrategyPayload);
      }

      await saveStrategies({ walletGroupId, strategies: merged });
      clearStrategyCache(walletGroupId);
      onSuccess();
    } catch (e) {
      console.error(e);
      alert(`Failed to save: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    fontSize: 14,
    background: theme.bgPanel,
    color: theme.textPrimary,
    boxSizing: 'border-box',
  };

  const segmentStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    border: `1px solid ${active ? theme.accent : theme.border}`,
    borderRadius: 8,
    background: active ? `${theme.accent}20` : 'transparent',
    color: active ? theme.accent : theme.textSecondary,
    fontWeight: active ? 600 : 400,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    border: `1px solid ${active ? theme.accent : theme.border}`,
    borderRadius: 20,
    background: active ? `${theme.accent}20` : 'transparent',
    color: active ? theme.accent : theme.textSecondary,
    fontWeight: active ? 600 : 400,
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          background: theme.bgPanel,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 600,
              color: theme.textPrimary,
            }}
          >
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 600,
              color: theme.textPrimary,
            }}
          >
            Description{' '}
            <span style={{ fontWeight: 400, color: theme.textSecondary }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>

      <div
        style={{
          background: theme.bgPanel,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, color: theme.textPrimary }}>Assets</div>
          <button
            onClick={addEntry}
            style={{
              padding: '6px 14px',
              background: theme.accent,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add asset
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            {entries.map((entry, i) => (
              <SortableEntryHandle key={entry.id} id={entry.id} isLast={i === entries.length - 1}>
                <div
                  style={{
                    padding: 16,
                    background: theme.bgSecondary ?? theme.bgPanel,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10,
                    position: 'relative',
                  }}
                >
                  {entries.length > 1 && (
                    <button
                      onClick={() => removeEntry(entry.id)}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 24,
                        height: 24,
                        border: 'none',
                        background: 'transparent',
                        color: theme.textSecondary,
                        cursor: 'pointer',
                        fontSize: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                      }}
                    >
                      ×
                    </button>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.textPrimary,
                      }}
                    >
                      Asset
                    </label>
                    <div style={{ position: 'relative' }} onMouseDown={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDropdownId(openDropdownId === entry.id ? null : entry.id)
                        }
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          border: `1px solid ${theme.border}`,
                          borderRadius: 8,
                          background: theme.bgPanel,
                          color: theme.textPrimary,
                          fontSize: 14,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          boxSizing: 'border-box',
                        }}
                      >
                        {entry.symbol ? (
                          <>
                            {entry.tokenLogo && (
                              <img
                                src={entry.tokenLogo}
                                alt={entry.symbol}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span style={{ fontWeight: 600 }}>{entry.symbol}</span>
                            <span
                              style={{
                                marginLeft: 'auto',
                                color: theme.textSecondary,
                                fontSize: 12,
                              }}
                            >
                              ▼
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ color: theme.textSecondary }}>Select asset...</span>
                            <span
                              style={{
                                marginLeft: 'auto',
                                color: theme.textSecondary,
                                fontSize: 12,
                              }}
                            >
                              ▼
                            </span>
                          </>
                        )}
                      </button>

                      {openDropdownId === entry.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            maxHeight: 260,
                            overflowY: 'auto',
                            background: theme.bgPanel,
                            border: `1px solid ${theme.border}`,
                            borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            zIndex: 1000,
                            padding: 6,
                          }}
                        >
                          {portfolioAssets.map((a) => (
                            <button
                              key={a.symbol}
                              type="button"
                              onClick={() => selectAsset(entry.id, a.symbol)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 10px',
                                border: 'none',
                                borderRadius: 7,
                                background:
                                  entry.symbol === a.symbol ? `${theme.accent}18` : 'transparent',
                                color: theme.textPrimary,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                if (entry.symbol !== a.symbol)
                                  e.currentTarget.style.background = `${theme.border}60`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  entry.symbol === a.symbol ? `${theme.accent}18` : 'transparent';
                              }}
                            >
                              {a.tokenLogo ? (
                                <img
                                  src={a.tokenLogo}
                                  alt={a.symbol}
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: theme.border,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: theme.textSecondary,
                                  }}
                                >
                                  {a.symbol.slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.symbol}</div>
                                {a.tokenName && a.tokenName !== a.symbol && (
                                  <div style={{ fontSize: 11, color: theme.textSecondary }}>
                                    {a.tokenName}
                                  </div>
                                )}
                              </div>
                              {entry.symbol === a.symbol && (
                                <span
                                  style={{ marginLeft: 'auto', color: theme.accent, fontSize: 14 }}
                                >
                                  ✓
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {entry.symbol && !SYMBOL_TO_COINGECKO_ID[entry.symbol.toUpperCase()] && (
                    <div style={{ marginBottom: 14 }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#f59e0b',
                        }}
                      >
                        CoinGecko ID{' '}
                        <span style={{ fontWeight: 400 }}>(not found automatically)</span>
                      </label>
                      <input
                        type="text"
                        value={entry.coingeckoId}
                        onChange={(e) => updateEntry(entry.id, { coingeckoId: e.target.value })}
                        placeholder="ex: ethereum, usd-coin"
                        style={inputStyle}
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.textPrimary,
                      }}
                    >
                      Trigger type
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={segmentStyle(entry.triggerType === 'window')}
                        onClick={() => updateEntry(entry.id, { triggerType: 'window' })}
                      >
                        By window
                      </button>
                      <button
                        style={segmentStyle(entry.triggerType === 'price')}
                        onClick={() => updateEntry(entry.id, { triggerType: 'price' })}
                      >
                        By price
                      </button>
                    </div>
                  </div>

                  {entry.triggerType === 'window' ? (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.textPrimary,
                          }}
                        >
                          Periods{' '}
                          <span style={{ fontWeight: 400, color: theme.textSecondary }}>
                            (select one or more — signal fires when ALL are met)
                          </span>
                        </label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {WINDOW_OPTIONS.map((opt) => {
                            const active = entry.windows.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                style={chipStyle(active)}
                                onClick={() => {
                                  const next = active
                                    ? entry.windows.filter((w) => w !== opt.value)
                                    : [...entry.windows, opt.value];
                                  updateEntry(entry.id, { windows: next });
                                }}
                              >
                                {active ? '✓ ' : ''}
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.textPrimary,
                          }}
                        >
                          Trigger when % is
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={segmentStyle(entry.windowDirection === 'min')}
                            onClick={() => updateEntry(entry.id, { windowDirection: 'min' })}
                          >
                            Negative
                          </button>
                          <button
                            style={segmentStyle(entry.windowDirection === 'max')}
                            onClick={() => updateEntry(entry.id, { windowDirection: 'max' })}
                          >
                            Positive
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.textPrimary,
                          }}
                        >
                          Target price (USD)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={entry.priceTarget}
                          onChange={(e) => {
                            const v = e.target.value.replace(',', '.');
                            if (v === '' || /^\d*\.?\d*$/.test(v))
                              updateEntry(entry.id, { priceTarget: v });
                          }}
                          placeholder="ex: 2500"
                          style={{
                            ...inputStyle,
                            width: 240,
                            fontSize: 15,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.textPrimary,
                          }}
                        >
                          Signal when price is
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={segmentStyle(entry.priceDirection === 'below')}
                            onClick={() => updateEntry(entry.id, { priceDirection: 'below' })}
                          >
                            Below
                          </button>
                          <button
                            style={segmentStyle(entry.priceDirection === 'above')}
                            onClick={() => updateEntry(entry.id, { priceDirection: 'above' })}
                          >
                            Above
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </SortableEntryHandle>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            border: 'none',
            fontSize: 14,
            color: theme.textPrimary,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            padding: '10px 24px',
            background: saving ? theme.border : theme.accent,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : initialStrategy ? 'Update' : 'Create strategy'}
        </button>
      </div>
    </div>
  );
};

export default BestPurchaseWindowStrategyForm;
