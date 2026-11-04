import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface StoreSearchOption {
  LOCATIONID: number;
  LOCATIONNAME: string;
  ORGLOCATIONREF: string;
}

interface StoreSearchSelectProps {
  id: string;
  stores: StoreSearchOption[];
  /** Selected LOCATIONNAME (e.g. "PH002-MOA") */
  value: string;
  onChange: (locationName: string) => void;
  disabled?: boolean;
  /** Classes applied to the text input so it matches the surrounding filter styling */
  inputClassName?: string;
  placeholder?: string;
}

/** "PH002-MOA" -> "MOA" */
function getStoreCode(locationName: string): string {
  const idx = locationName.lastIndexOf('-');
  return idx >= 0 ? locationName.slice(idx + 1).trim() : locationName.trim();
}

function formatStoreLabel(store: StoreSearchOption): string {
  return `${store.LOCATIONNAME} (${store.ORGLOCATIONREF})`;
}

/**
 * Lower score = better match.
 * 0: exact store code / exact location name / exact ORGLOCATIONREF
 * 1: store code starts with query
 * 2: location name or ORGLOCATIONREF starts with query
 * 3: contains query anywhere
 * -1: no match
 */
function scoreStore(store: StoreSearchOption, q: string): number {
  const name = store.LOCATIONNAME.toLowerCase();
  const code = getStoreCode(store.LOCATIONNAME).toLowerCase();
  const ref = String(store.ORGLOCATIONREF ?? '').toLowerCase();
  const label = formatStoreLabel(store).toLowerCase();

  if (code === q || name === q || ref === q || label === q) return 0;
  if (code.startsWith(q)) return 1;
  if (name.startsWith(q) || ref.startsWith(q)) return 2;
  if (label.includes(q)) return 3;
  return -1;
}

export function StoreSearchSelect({
  id,
  stores,
  value,
  onChange,
  disabled = false,
  inputClassName = 'form-select',
  placeholder = 'Type store code (e.g. MOA) or select...',
}: StoreSearchSelectProps) {
  const selectedStore = useMemo(
    () => stores.find((s) => s.LOCATIONNAME === value) ?? null,
    [stores, value]
  );
  const selectedLabel = selectedStore ? formatStoreLabel(selectedStore) : '';

  const [query, setQuery] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim().toLowerCase();

  const filteredStores = useMemo(() => {
    if (!isEditing || !trimmedQuery) return stores;
    return stores
      .map((s) => ({ store: s, score: scoreStore(s, trimmedQuery) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score || a.store.LOCATIONNAME.localeCompare(b.store.LOCATIONNAME))
      .map((x) => x.store);
  }, [stores, trimmedQuery, isEditing]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Keep highlighted option visible while navigating with arrow keys
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);

  const commitStore = (store: StoreSearchOption, keepFocus = true) => {
    onChange(store.LOCATIONNAME);
    setIsEditing(false);
    setIsOpen(false);
    setQuery('');
    if (keepFocus) {
      // Select the full label so the next keystroke starts a fresh search
      requestAnimationFrame(() => inputRef.current?.select());
    }
  };

  const handleInputChange = (raw: string) => {
    setQuery(raw);
    setIsEditing(true);
    setIsOpen(true);
    setHighlightIndex(0);

    const q = raw.trim().toLowerCase();
    if (!q) return;

    // Auto-load when the typed text is an exact store code / name / ref match
    // and no other store code still begins with the typed text (avoids hijacking "MOA" vs "MOAX").
    const exactMatches = stores.filter((s) => scoreStore(s, q) === 0);
    if (exactMatches.length === 1) {
      const competingPrefix = stores.filter(
        (s) =>
          s.LOCATIONNAME !== exactMatches[0].LOCATIONNAME &&
          getStoreCode(s.LOCATIONNAME).toLowerCase().startsWith(q)
      );
      if (competingPrefix.length === 0) {
        commitStore(exactMatches[0]);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightIndex((i) => Math.min(i + 1, Math.max(filteredStores.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (isOpen && filteredStores[highlightIndex]) {
        e.preventDefault();
        commitStore(filteredStores[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setIsEditing(false);
      setQuery('');
    } else if (e.key === 'Tab') {
      // Commit the top match when tabbing away mid-search
      if (isEditing && trimmedQuery && filteredStores[highlightIndex]) {
        commitStore(filteredStores[highlightIndex], false);
      } else {
        setIsOpen(false);
        setIsEditing(false);
        setQuery('');
      }
    }
  };

  const openList = () => {
    if (disabled || stores.length === 0) return;
    setIsOpen(true);
    const idx = stores.findIndex((s) => s.LOCATIONNAME === value);
    setHighlightIndex(idx >= 0 ? idx : 0);
  };

  const displayValue = isEditing ? query : selectedLabel;
  const listboxId = `${id}-listbox`;

  return (
    <div className="store-search-select" ref={wrapperRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        className={`${inputClassName} store-search-input`}
        value={displayValue}
        placeholder={stores.length === 0 ? 'Loading active stores...' : placeholder}
        disabled={disabled || stores.length === 0}
        onFocus={(e) => {
          e.target.select();
          openList();
        }}
        onClick={openList}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {isOpen && (
        <ul className="store-search-menu" role="listbox" id={listboxId} ref={listRef}>
          {filteredStores.length === 0 ? (
            <li className="store-search-empty">
              No store matches “{query.trim()}”
            </li>
          ) : (
            filteredStores.map((s, idx) => {
              const isSelected = s.LOCATIONNAME === value;
              const isHighlighted = idx === highlightIndex;
              return (
                <li
                  key={s.LOCATIONID}
                  role="option"
                  aria-selected={isSelected}
                  className={`store-search-option ${isHighlighted ? 'highlighted' : ''} ${
                    isSelected ? 'selected' : ''
                  }`}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onMouseDown={(e) => {
                    // Prevent input blur before the click registers
                    e.preventDefault();
                    commitStore(s);
                  }}
                >
                  <span className="store-search-option-code">{getStoreCode(s.LOCATIONNAME)}</span>
                  <span className="store-search-option-label">{formatStoreLabel(s)}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
