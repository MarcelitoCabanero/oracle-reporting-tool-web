import { useState, useEffect } from 'react';
import {
  Calculator,
  FileSpreadsheet,
  FileText,
  Info,
  ListTree,
  Search,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { FinishedGoodSearch, type FinishedGood } from './FinishedGoodSearch';
import {
  exportToExcel,
  exportToPdf,
  type ConsolidatedItem,
  type BreakdownItem,
  type ReportFilters,
} from './exportUtils';

interface Store {
  LOCATIONID: number;
  LOCATIONNAME: string;
  ORGLOCATIONREF: string;
}

export function BomReport() {
  const { token } = useAuth();

  // Stores filter
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Date filters
  const todayStr = new Date().toISOString().split('T')[0] ?? '';
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Finished Good filter
  const [selectedFg, setSelectedFg] = useState<FinishedGood | null>(null);

  // Calculation state & results
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consolidatedData, setConsolidatedData] = useState<ConsolidatedItem[]>([]);
  const [breakdownData, setBreakdownData] = useState<BreakdownItem[]>([]);
  const [lastFilters, setLastFilters] = useState<ReportFilters | null>(null);

  // Active view tab & in-table quick search
  const [activeTab, setActiveTab] = useState<'consolidated' | 'breakdown'>('consolidated');
  const [tableSearch, setTableSearch] = useState<string>('');

  // Fetch active store locations on mount
  useEffect(() => {
    if (!token) return;

    fetch('/api/reports/bom/stores', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load stores');
        return res.json();
      })
      .then((data) => {
        const storeList: Store[] = data.stores || [];
        setStores(storeList);
        if (storeList.length > 0 && !selectedLocation && storeList[0]) {
          setSelectedLocation(storeList[0].LOCATIONNAME);
        }
      })
      .catch((err) => {
        console.error('Error fetching stores:', err);
      });
  }, [token]);

  // Execute BOM calculation
  const handleCalculate = async () => {
    if (!selectedLocation) {
      setErrorMessage('Please select a store / location.');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage('Please choose both start and end business dates.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/reports/bom/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locationName: selectedLocation,
          startDate,
          endDate,
          fgItemCode: selectedFg?.FormulaCode || selectedFg?.FGItemCode || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'BOM calculation failed.');
      }

      setConsolidatedData(data.consolidated || []);
      setBreakdownData(data.breakdown || []);
      setLastFilters({
        locationName: selectedLocation,
        startDate,
        endDate,
        fgItemCode: selectedFg?.FGItemCode || null,
        fgName: selectedFg?.FGName || null,
      });
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items in table
  const filteredConsolidated = consolidatedData.filter((item) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      item.RMCode.toLowerCase().includes(term) ||
      item.RMName.toLowerCase().includes(term) ||
      item.Inv_UOM.toLowerCase().includes(term)
    );
  });

  const filteredBreakdown = breakdownData.filter((item) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      item.RMCode.toLowerCase().includes(term) ||
      item.RMName.toLowerCase().includes(term) ||
      item.CurrentParentName.toLowerCase().includes(term) ||
      item.CurrentParentCode.toLowerCase().includes(term) ||
      item.BOMPath.toLowerCase().includes(term)
    );
  });

  return (
    <div className="system-sales-workspace">
      {/* Workspace Header */}
      <div className="d-flex align-items-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center rounded-3 text-white shadow-sm flex-shrink-0"
            style={{ width: 44, height: 44, background: 'linear-gradient(135deg, var(--oracle-red), var(--oracle-red-hover))' }}
          >
            <Calculator size={22} />
          </div>
          <div>
            <h2 className="h5 fw-bold mb-0 bom-main-heading">Theoretical BOM Requirements</h2>
            <p className="small text-secondary mb-0">
              Calculate theoretical raw-material usage from sold items and cascaded sub-recipes.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card border rounded-4 shadow-sm p-4 mb-4 bg-white bom-filter-card">
        <div className="row g-3">
          {/* Store Location */}
          <div className="col-12 col-md-4">
            <label htmlFor="store-select" className="form-label small fw-semibold text-secondary">
              Store / Location
            </label>
            <select
              id="store-select"
              className="form-select bom-filter-input"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              disabled={isLoading}
            >
              {stores.length === 0 && <option value="">Loading active stores...</option>}
              {stores.map((s) => (
                <option key={s.LOCATIONID} value={s.LOCATIONNAME}>
                  {s.LOCATIONNAME} ({s.ORGLOCATIONREF})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="col-12 col-sm-6 col-md-4">
            <label htmlFor="start-date" className="form-label small fw-semibold text-secondary">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              className="form-control bom-filter-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="col-12 col-sm-6 col-md-4">
            <label htmlFor="end-date" className="form-label small fw-semibold text-secondary">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              className="form-control bom-filter-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Finished Good Autocomplete */}
          <div className="col-12 col-lg-8">
            <label className="form-label small fw-semibold text-secondary">
              Finished Good (Optional Single Item Filter)
            </label>
            <FinishedGoodSearch
              selectedFg={selectedFg}
              onSelectFg={setSelectedFg}
              disabled={isLoading}
            />
          </div>

          {/* Action Button */}
          <div className="col-12 col-lg-4 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-oracle-red w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
              onClick={handleCalculate}
              disabled={isLoading || !selectedLocation}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  Calculating Multi-Level BOM...
                </>
              ) : (
                <>
                  <Calculator size={18} />
                  Calculate Requirements
                </>
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3" role="alert">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Results Workspace */}
      {lastFilters && (
        <div className="d-flex flex-column gap-3">
          {/* Navigation & Action Bar */}
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 border-bottom pb-2">
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={`system-sales-navigation-item btn border-0 ${
                  activeTab === 'consolidated' ? 'system-sales-navigation-item-active' : ''
                }`}
                onClick={() => setActiveTab('consolidated')}
              >
                <FileSpreadsheet size={16} className="me-2 text-inherit" />
                <strong>Consolidated Raw Materials ({consolidatedData.length})</strong>
              </button>

              <button
                type="button"
                className={`system-sales-navigation-item btn border-0 ${
                  activeTab === 'breakdown' ? 'system-sales-navigation-item-active' : ''
                }`}
                onClick={() => setActiveTab('breakdown')}
              >
                <ListTree size={16} className="me-2 text-inherit" />
                <strong>Recipe Breakdown Trace ({breakdownData.length})</strong>
              </button>
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className="input-group input-group-sm" style={{ width: 220 }}>
                <span className="input-group-text bg-white border-end-0">
                  <Search size={14} className="text-secondary" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Filter rows..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn btn-outline-success btn-sm d-flex align-items-center gap-2 px-3 fw-semibold"
                onClick={() => exportToExcel(consolidatedData, breakdownData, lastFilters)}
                title="Download Excel Workbook (.xlsx)"
              >
                <FileSpreadsheet size={15} />
                Excel (.xlsx)
              </button>

              <button
                type="button"
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2 px-3 fw-semibold"
                onClick={() => exportToPdf(consolidatedData, breakdownData, lastFilters)}
                title="Download Printable PDF Report"
              >
                <FileText size={15} />
                PDF
              </button>
            </div>
          </div>

          {/* Variance Scoping Readiness Banner */}
          <div className="bom-info-banner d-flex align-items-center gap-3 py-2 px-3 mb-1 small">
            <Info size={18} className="bom-info-banner-icon flex-shrink-0" />
            <div>
              <strong className="bom-info-banner-title">Variance Analysis Readiness:</strong> Theoretical BOM usage is computed below. Columns for{' '}
              <em className="fw-medium">Actual Consumption</em> and <em className="fw-medium">Variance</em> are staged and will automatically activate once physical count scoping concludes.
            </div>
          </div>

          {/* Table View: Consolidated */}
          {activeTab === 'consolidated' && (
            <div className="card border rounded-4 shadow-sm overflow-hidden bg-white">
              <div className="table-responsive">
                <table className="table align-middle mb-0 bom-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 52 }} className="text-center">#</th>
                      <th>RM Code</th>
                      <th>Raw Material Description</th>
                      <th>UOM</th>
                      <th className="text-end">Standard Consumption</th>
                      <th className="text-end">Actual Consumption</th>
                      <th className="text-end">Usage Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConsolidated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-5 text-secondary">
                          No raw material requirements found for the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredConsolidated.map((item, idx) => (
                        <tr key={`${item.RMCode}-${idx}`}>
                          <td className="text-center text-secondary">{idx + 1}</td>
                          <td>
                            <code className="bom-rm-code">
                              {item.RMCode}
                            </code>
                          </td>
                          <td className="fw-semibold bom-charcoal-text">{item.RMName}</td>
                          <td>
                            <span className="bom-uom-badge">
                              {item.Inv_UOM}
                            </span>
                          </td>
                          <td className="num-cell fw-bold bom-charcoal-text">
                            {Number(item.QtyFromQtySold).toLocaleString(undefined, {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4,
                            })}
                          </td>
                          <td className="text-end">
                            <span className="scoping-badge-stage">Pending Scoping</span>
                          </td>
                          <td className="text-end">
                            <span className="scoping-badge-stage scoping-badge-variance">Pending Scoping</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table View: Multi-Level Breakdown */}
          {activeTab === 'breakdown' && (
            <div className="card border rounded-4 shadow-sm overflow-hidden bg-white">
              <div className="table-responsive">
                <table className="table align-middle mb-0 bom-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 48 }} className="text-center">#</th>
                      <th style={{ width: 56 }}>Lvl</th>
                      <th>Parent Item</th>
                      <th>BOM Recipe Path</th>
                      <th>Component / Material</th>
                      <th>UOM</th>
                      <th className="text-end">Qty Sold</th>
                      <th className="text-end">Needs</th>
                      <th className="text-end">Denom</th>
                      <th className="text-end">Conversion</th>
                      <th className="text-end">Calculated Qty</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center py-5 text-secondary">
                          No multi-level breakdown rows match your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBreakdown.map((item, idx) => (
                        <tr
                          key={`${item.BOMPath}-${item.RMCode}-${idx}`}
                          className={item.IsSubAssembly ? 'bg-warning bg-opacity-10' : ''}
                        >
                          <td className="text-center text-secondary">{idx + 1}</td>
                          <td>
                            <span className={`level-badge level-${item.BOMLevel}`}>
                              L{item.BOMLevel}
                            </span>
                          </td>
                          <td className="fw-semibold bom-charcoal-text">{item.CurrentParentName}</td>
                          <td>
                            <span className="path-code" title={item.BOMPath}>
                              {item.BOMPath}
                            </span>
                          </td>
                          <td>
                            <div className="fw-semibold bom-charcoal-text">{item.RMName}</div>
                            <small className="text-secondary" style={{ fontSize: '0.76rem' }}>
                              {item.RMCode}
                            </small>
                          </td>
                          <td>
                            <span className="bom-uom-badge">
                              {item.Inv_UOM}
                            </span>
                          </td>
                          <td className="num-cell">{Number(item.QtySold).toLocaleString()}</td>
                          <td className="num-cell">{Number(item.QtyNeeds).toFixed(4)}</td>
                          <td className="num-cell">{Number(item.QtyDenominator || 1).toFixed(2)}</td>
                          <td className="num-cell">{Number(item.UnitConversion || 1).toFixed(4)}</td>
                          <td className="num-cell fw-bold bom-charcoal-text">
                            {Number(item.QtyFromQtySold).toFixed(4)}
                          </td>
                          <td>
                            {item.IsSubAssembly ? (
                              <span className="subassembly-tag">Sub-Assembly</span>
                            ) : (
                              <span className="rawmat-tag">Raw Material</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initial Placeholder before Calculation */}
      {!lastFilters && !isLoading && (
        <div className="system-sales-placeholder mt-2">
          <Calculator size={40} style={{ color: 'var(--oracle-red)' }} className="mb-2" />
          <h5 className="fw-bold bom-main-heading">Ready to Calculate Theoretical BOM</h5>
          <p className="text-secondary">
            Select a store location and date range above, then click{' '}
            <strong>Calculate Requirements</strong> to cascade recipes through all sub-assemblies.
          </p>
        </div>
      )}
    </div>
  );
}
