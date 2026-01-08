import React, { useEffect, useRef, useCallback } from 'react';

/**
 * RebalanceItemDialog
 * Glass-style dialog for adding or editing a strategy item.
 * Accessible: focus trap, ESC to close, aria labels.
 */
export default function RebalanceItemDialog({
  open,
  editing = false,
  title = editing ? 'Edit Strategy Item' : 'Add Strategy Item',
  description = 'Define a target allocation using a token, protocol, group or total wallet reference.',
  assetType,
  setAssetType,
  assetId,
  setAssetId,
  assetIds,
  setAssetIds,
  assetOptions,
  referenceType,
  setReferenceType,
  referenceValue,
  setReferenceValue,
  referenceOptions,
  note,
  setNote,
  ASSET_TYPE_OPTIONS,
  RebalanceReferenceType,
  ITEM_TYPES,
  AssetDropdown,
  TokenDisplay,
  tokensList,
  protocolsList,
  getOptionsForType,
  canAdd,
  isDuplicateCandidate,
  onCancel,
  onSubmit,
  loading = false,
  failedCount = 0,
  timedOutCount = 0,
  theme,
}) {
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const lastActiveRef = useRef(null);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
      if (e.key === 'Tab') {
        // rudimentary focus trap
        const focusable = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const list = Array.from(focusable).filter((el) => !el.hasAttribute('disabled'));
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, onCancel]);

  // Manage focus on open/close
  useEffect(() => {
    if (open) {
      lastActiveRef.current = document.activeElement;
      setTimeout(() => {
        firstFieldRef.current?.focus();
      }, 0);
    } else if (lastActiveRef.current) {
      try {
        lastActiveRef.current.focus();
      } catch {}
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal-card rebalance-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rebalanceDialogTitle"
        aria-describedby="rebalanceDialogDesc"
        ref={dialogRef}
        style={{ maxWidth: 1000, width: 'min(96vw,1000px)', padding: 24 }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="rebalanceDialogTitle"
              style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '.5px' }}
            >
              {title}
            </h2>
            <p
              id="rebalanceDialogDesc"
              style={{ margin: '6px 0 14px', fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: '1px solid var(--mw-border,var(--app-border))',
              width: 34,
              height: 34,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              lineHeight: 1,
              color: 'var(--mw-text-secondary,var(--app-text-secondary))',
            }}
          >
            ×
          </button>
        </header>

        <div className="rebalance-form-grid" style={{ marginTop: 4 }}>
          {/* Asset Type */}
          <div className="form-group">
            <div className="text-secondary label-sm">Asset Type</div>
            <select
              ref={firstFieldRef}
              value={assetType}
              onChange={(e) => setAssetType(e.target.value === '' ? '' : Number(e.target.value))}
              className="input-base"
              title="Choose the category of asset you want to rebalance"
            >
              <option value="">Select asset type…</option>
              {ASSET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {assetType === '' && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--mw-text-secondary,var(--app-text-secondary))', opacity: 0.7 }}>
                💡 Wallet = tokens, Liquidity = LP positions, Lending = lend/borrow, Staking = staked assets
              </div>
            )}
          </div>

          {/* Asset */}
          <div className="form-group">
            <div className="text-secondary label-sm">
              Asset{assetIds.length > 0 && ` (${assetIds.length} selected)`}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <AssetDropdown
                  theme={theme}
                  assetType={assetType}
                  value={assetId}
                  options={assetOptions}
                  onChange={setAssetId}
                  tokensList={tokensList}
                  placeholder="Select asset…"
                />
              </div>
              {assetId && (
                <button
                  type="button"
                  onClick={() => {
                    if (assetId && !assetIds.some(a => a.type === assetType && a.id === assetId)) {
                      setAssetIds([...assetIds, { type: assetType, id: assetId }]);
                      setAssetId('');
                    }
                  }}
                  style={{
                    background: theme.mode === 'dark' ? theme.primary : theme.accent,
                    color: 'white',
                    border: 'none',
                    padding: '0 16px',
                    height: 38,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                  title="Add asset to group"
                >
                  + Add
                </button>
              )}
            </div>
            {assetIds.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {assetIds.map((asset, idx) => {
                  const opts = getOptionsForType ? getOptionsForType(asset.type) : assetOptions;
                  const option = opts.find((a) => a.id === asset.id);
                  const label = option?.label || asset.id;
                  const raw = option?.raw || {};
                  
                  // Extract tokens based on asset type to pass to TokenDisplay
                  let tokens = [];
                  let lendingType = null; // 'supply' or 'borrow'
                  
                  // Use numeric comparison for asset type
                  const assetTypeNum = typeof asset.type === 'number' ? asset.type : parseInt(asset.type);
                  
                  if (assetTypeNum === 1) { // RebalanceAssetType.Wallet
                    // For wallet, the option.raw IS the token directly
                    tokens = [raw];
                  } else if (assetTypeNum === 3) { // Lending
                    const pos = raw.position || raw;
                    
                    if (Array.isArray(pos.tokens) && pos.tokens.length > 0) {
                      tokens = pos.tokens.slice(0, 2).map(t => t?.token || t).filter(Boolean);
                      
                      // 🔍 DEBUG: Log position data
                      console.log('🔍 [DIALOG LENDING DETECTION] Position:', {
                        label: pos.label,
                        key: pos.key,
                        name: pos.name,
                        tokensCount: pos.tokens?.length,
                        allTokens: pos.tokens
                      });
                      
                      // Check position label/key first
                      const positionLabel = pos.label?.toLowerCase() || pos.key?.toLowerCase() || pos.name?.toLowerCase() || '';
                      const isBorrowPosition = positionLabel.includes('borrow') || positionLabel.includes('debt');
                      
                      console.log('📊 Dialog position label check:', { positionLabel, isBorrowPosition });
                      
                      // Check all tokens to find if any is borrowed
                      const hasBorrowedToken = pos.tokens.some(t => {
                        const tokenType = t?.type?.toLowerCase();
                        const tokenLabel = t?.label?.toLowerCase() || t?.name?.toLowerCase() || '';
                        const hasDebt = t?.debt === true || t?.debt > 0;
                        const negativeBalance = t?.balance && t.balance < 0;
                        const negativePrice = (t?.totalPrice || t?.financials?.totalPrice || 0) < 0;
                        
                        const isBorrowed = tokenType === 'borrowed' || 
                               tokenType === 'borrow' || 
                               tokenType === 'debt' ||
                               tokenLabel.includes('borrow') ||
                               tokenLabel.includes('debt') ||
                               hasDebt || 
                               negativeBalance ||
                               negativePrice;
                        
                        console.log('🪙 Dialog token check:', t.symbol, {
                          type: t?.type,
                          tokenType,
                          tokenLabel,
                          hasDebt,
                          negativeBalance,
                          negativePrice,
                          isBorrowed
                        });
                        
                        return isBorrowed;
                      });
                      
                      console.log('✅ Dialog token check result:', { hasBorrowedToken });
                      
                      if (isBorrowPosition || hasBorrowedToken) {
                        lendingType = 'borrow';
                      } else {
                        lendingType = 'supply';
                      }
                      
                      console.log('🎯 DIALOG FINAL RESULT:', { lendingType, label: pos.label });
                      console.log('---');
                    }
                  } else if (assetTypeNum === 2 || assetTypeNum === 4) { // LP, Staking
                    // For LP/Staking, extract tokens
                    const pos = raw.position || raw;
                    
                    if (Array.isArray(pos.tokens) && pos.tokens.length > 0) {
                      tokens = pos.tokens.slice(0, 2).map(t => t?.token || t).filter(Boolean);
                    } else if (Array.isArray(pos.pool?.tokens) && pos.pool.tokens.length > 0) {
                      tokens = pos.pool.tokens.slice(0, 2).map(t => t?.token || t).filter(Boolean);
                    } else {
                      const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken;
                      const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken;
                      if (t0) tokens.push(t0?.token || t0);
                      if (t1) tokens.push(t1?.token || t1);
                      tokens = tokens.filter(Boolean);
                    }
                  }
                  
                  return (
                    <div
                      key={`${asset.type}-${asset.id}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '0 10px',
                        height: 38,
                        background: 'var(--mw-bg-panel,var(--app-bg-panel))',
                        border: '1px solid var(--mw-border,var(--app-border))',
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
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
                      <span style={{ flex: 1 }}>{label}</span>
                      {/* Lending type badge */}
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
                      {/* Type icon - monocromático e à direita */}
                      <span style={{ 
                        fontSize: 14, 
                        opacity: 0.5,
                        filter: 'grayscale(1)',
                        display: 'flex',
                        alignItems: 'center',
                      }} title={
                        assetTypeNum === 1 ? 'Wallet' :
                        assetTypeNum === 2 ? 'Liquidity Pool' :
                        assetTypeNum === 3 ? 'Lending Position' :
                        assetTypeNum === 4 ? 'Staking Position' : 'Asset'
                      }>
                        {assetTypeNum === 1 ? '💼' : 
                         assetTypeNum === 2 ? '💧' : 
                         assetTypeNum === 3 ? '🏦' : 
                         assetTypeNum === 4 ? '🔒' : '📦'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAssetIds(assetIds.filter((a) => !(a.type === asset.type && a.id === asset.id)))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--mw-text-secondary,var(--app-text-secondary))',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 16,
                          lineHeight: 1,
                          width: 16,
                          height: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Remove asset"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reference Type */}
          <div className="form-group">
            <div className="text-secondary label-sm">Reference Type</div>
            <select
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value)}
              className="input-base"
            >
              <option value="">Select reference type…</option>
              {Object.values(RebalanceReferenceType).map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>

          {/* Reference Value (conditional) */}
          <div className="form-group">
            <div className="text-secondary label-sm">Reference Value</div>
            {referenceType === RebalanceReferenceType.TotalWallet ? (
              <div className="input-static">—</div>
            ) : referenceType === RebalanceReferenceType.Token ? (
              <AssetDropdown
                theme={theme}
                assetType={ITEM_TYPES.WALLET}
                value={referenceValue}
                options={tokensList}
                onChange={setReferenceValue}
                tokensList={tokensList}
                placeholder="Select value…"
              />
            ) : referenceType === RebalanceReferenceType.Protocol ? (
              <AssetDropdown
                theme={theme}
                assetType="PROTOCOL"
                value={referenceValue}
                options={protocolsList}
                onChange={setReferenceValue}
                placeholder="Select value…"
              />
            ) : (
              <select
                value={referenceValue}
                onChange={(e) => setReferenceValue(e.target.value)}
                className="input-base"
              >
                <option value="">Select value…</option>
                {referenceOptions.map((opt, idx) => (
                  <option key={`${opt.id}-${idx}`} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Note */}
          <div className="form-group">
            <div className="text-secondary label-sm">Note</div>
            <select
              value={note}
              onChange={(e) => setNote(Number(e.target.value))}
              className="input-base"
            >
              {Array.from({ length: 101 }, (_, n) => n).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <hr
          style={{
            border: 'none',
            height: 1,
            background: 'var(--mw-border,var(--app-border))',
            margin: '20px 0 14px',
          }}
        />
        <footer className="dialog-actions" style={{ marginTop: 8 }}>
          <div
            className={`label-sm ${isDuplicateCandidate ? 'text-secondary' : 'text-transparent'}`}
            style={{ minHeight: 16 }}
          >
            {isDuplicateCandidate ? 'This item is already in the list.' : ' '}
          </div>
          <div className="flex gap-8">
            <button type="button" className="btn btn--outline" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canAdd || isDuplicateCandidate || loading}
              onClick={() => {
                if (!isDuplicateCandidate && canAdd) onSubmit();
              }}
            >
              {loading ? 'Saving…' : editing ? 'Save' : 'Add'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
