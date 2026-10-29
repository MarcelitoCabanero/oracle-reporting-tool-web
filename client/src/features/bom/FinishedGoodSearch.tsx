import { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export interface FinishedGood {
  FormulaCode: string;
  FGItemCode: string;
  FGName: string;
}

interface FinishedGoodSearchProps {
  selectedFg: FinishedGood | null;
  onSelectFg: (fg: FinishedGood | null) => void;
  disabled?: boolean;
}

export function FinishedGoodSearch({ selectedFg, onSelectFg, disabled }: FinishedGoodSearchProps) {
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<FinishedGood[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search autocomplete with debounce
  useEffect(() => {
    if (!token || !isOpen || disabled) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/reports/bom/finished-goods?search=${encodeURIComponent(searchTerm)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.finishedGoods || []);
        }
      } catch (err) {
        console.error('Error fetching finished goods:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, token, disabled]);

  const handleSelect = (item: FinishedGood) => {
    onSelectFg(item);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelectFg(null);
    setSearchTerm('');
  };

  if (selectedFg) {
    return (
      <div className="fg-selected-badge">
        <span>
          <strong>{selectedFg.FGName}</strong> ({selectedFg.FGItemCode})
        </span>
        <button
          type="button"
          onClick={handleClear}
          title="Clear filter (calculate for all finished goods)"
          disabled={disabled}
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="fg-search-container" ref={wrapperRef}>
      <div className="fg-search-input-wrapper">
        <Search size={16} className="fg-search-inner-icon" aria-hidden="true" />
        <input
          type="text"
          className="form-control bom-filter-input fg-search-input"
          placeholder="Search FG by item code or name (leave empty for All)..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
        />
      </div>

      {isOpen && (
        <ul className="fg-search-dropdown-menu">
          {isLoading && (
            <li className="p-3 text-center small text-secondary">
              <span className="spinner-border spinner-border-sm me-2 text-danger" role="status" />
              Searching menu items...
            </li>
          )}

          {!isLoading && results.length === 0 && (
            <li className="p-3 text-center small text-secondary">
              {searchTerm ? 'No matching finished goods found' : 'Type to search finished goods...'}
            </li>
          )}

          {!isLoading && results.length > 0 && (
            <>
              <li
                className="fg-dropdown-item all-option d-flex align-items-center gap-2"
                onClick={() => {
                  onSelectFg(null);
                  setIsOpen(false);
                }}
              >
                <Sparkles size={16} className="text-OracleRed" style={{ color: 'var(--oracle-red)' }} />
                <div>
                  <div className="fw-semibold small">All Finished Goods</div>
                  <small className="text-secondary" style={{ fontSize: '0.72rem' }}>
                    Calculate consolidated BOM requirements for all sold products
                  </small>
                </div>
              </li>

              {results.map((fg) => (
                <li
                  key={`${fg.FormulaCode}-${fg.FGItemCode}`}
                  className="fg-dropdown-item"
                  onClick={() => handleSelect(fg)}
                >
                  <div className="fw-semibold small text-dark">{fg.FGName}</div>
                  <div className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                    Item Code: <code>{fg.FGItemCode}</code> | Formula: <code>{fg.FormulaCode}</code>
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
