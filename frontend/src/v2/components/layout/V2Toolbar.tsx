import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useV2 } from '../../context/V2Context';
import s from './V2Toolbar.module.css';

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M16 16l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 10 10" fill="none"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.16s ease' }}
  >
    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const normKey = (v: any): string => String(v ?? '').trim().toLowerCase();

export const V2Toolbar: React.FC = () => {
  const { positionSearch, setPositionSearch, selectedChains, setSelectedChains, supportedChains } =
    useV2();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allKeys = supportedChains.map((c: any) => normKey(c.canonicalKey ?? c.id ?? c.name));
  const activeCount = selectedChains ? selectedChains.size : allKeys.length;
  const allSelected = !selectedChains;

  const toggleChain = useCallback(
    (key: string) => {
      if (!selectedChains) {
        const next = new Set(allKeys);
        next.delete(key);
        setSelectedChains(next);
      } else {
        const next = new Set(selectedChains);
        if (next.has(key)) {
          if (next.size > 1) next.delete(key);
        } else {
          next.add(key);
        }
        setSelectedChains(next.size === allKeys.length ? null : next);
      }
    },
    [selectedChains, setSelectedChains, allKeys]
  );

  const selectAll = () => setSelectedChains(null);
  const clearAll = () => {
    if (allKeys.length > 0) setSelectedChains(new Set([allKeys[0]]));
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = allSelected
    ? 'All chains'
    : activeCount === 1
    ? '1 chain'
    : `${activeCount} chains`;

  return (
    <div className={s.toolbar}>
      <div className={s.searchWrap}>
        <span className={s.searchIcon}><IconSearch /></span>
        <input
          className={s.searchInput}
          placeholder="Search positions, protocols, tokens…"
          value={positionSearch}
          onChange={(e) => setPositionSearch(e.target.value)}
        />
      </div>

      <div className={s.chainDropdownWrap} ref={dropdownRef}>
        <button
          className={`${s.chainTrigger} ${!allSelected ? s.chainTriggerActive : ''}`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={s.chainTriggerLabel}>{label}</span>
          <IconChevron open={open} />
        </button>

        {open && (
          <div className={s.chainDropdown}>
            <div className={s.chainList}>
              {supportedChains.map((chain: any) => {
                const key = normKey(chain.canonicalKey ?? chain.id ?? chain.name);
                const on = !selectedChains || selectedChains.has(key);
                return (
                  <label key={key} className={s.chainRow}>
                    <input
                      type="checkbox"
                      className={s.chainCheckbox}
                      checked={on}
                      onChange={() => toggleChain(key)}
                    />
                    {chain.iconUrl ? (
                      <img
                        src={chain.iconUrl}
                        alt={chain.displayName ?? chain.name}
                        className={s.chainIcon}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className={s.chainInitial}>
                        {(chain.displayName ?? chain.name)[0].toUpperCase()}
                      </span>
                    )}
                    <span className={s.chainRowName}>{chain.displayName ?? chain.name}</span>
                  </label>
                );
              })}
            </div>
            <div className={s.chainFooter}>
              <button className={s.chainFooterBtn} onClick={selectAll}>Select all</button>
              <button className={s.chainFooterBtn} onClick={clearAll}>Clear</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default V2Toolbar;
