import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  CalendarDays,
  Eye,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  exportRofSummaryToExcel,
  exportRofSummaryToPdf,
  exportRofDetailsToExcel,
  exportRofDetailsToPdf,
  type RofSummaryRow,
  type RofCashRow,
  type RofNonCashRow,
} from './rofExportUtils';

interface Store {
  LOCATIONID: number;
  LOCATIONNAME: string;
  ORGLOCATIONREF: string;
}

type RofTab = 'summary' | 'details';

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBusinessDate(value: string): string {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getVarianceClass(variance: number): string {
  if (Math.abs(variance) < 0.005) return 'rof-variance-zero';
  return variance > 0 ? 'rof-variance-over' : 'rof-variance-short';
}

const ROF_SESSION_KEY = 'oracle-session-rof';

interface RofSavedSession {
  activeTab: RofTab;
  selectedLocation: string;
  dateFrom: string;
  dateTo: string;
  summaryRows: RofSummaryRow[];
  summaryLoadedFilters: {
    locationName: string;
    dateFrom: string;
    dateTo: string;
  } | null;
  summarySearch: string;
  detailsBusinessDate: string;
  detailsCashRows: RofCashRow[];
  detailsNonCashRows: RofNonCashRow[];
  detailsLoadedFilters: {
    locationName: string;
    businessDate: string;
    exists: boolean;
  } | null;
}

function loadRofSession(): Partial<RofSavedSession> {
  try {
    const raw = window.sessionStorage.getItem(ROF_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<RofSavedSession>;
  } catch {
    return {};
  }
}

export function RofReport() {
  const { token } = useAuth();
  const savedSession = useMemo(() => loadRofSession(), []);

  // Active tab
  const [activeTab, setActiveTab] = useState<RofTab>(() => savedSession.activeTab ?? 'summary');

  // Shared stores list
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    () => savedSession.selectedLocation ?? ''
  );

  // Summary state
  const [dateFrom, setDateFrom] = useState<string>(() => savedSession.dateFrom ?? todayString());
  const [dateTo, setDateTo] = useState<string>(() => savedSession.dateTo ?? todayString());
  const [summaryRows, setSummaryRows] = useState<RofSummaryRow[]>(
    () => savedSession.summaryRows ?? []
  );
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoadedFilters, setSummaryLoadedFilters] = useState<{
    locationName: string;
    dateFrom: string;
    dateTo: string;
  } | null>(() => savedSession.summaryLoadedFilters ?? null);
  const [summarySearch, setSummarySearch] = useState<string>(() => savedSession.summarySearch ?? '');

  // Full-page Details tab state
  const [detailsBusinessDate, setDetailsBusinessDate] = useState<string>(
    () => savedSession.detailsBusinessDate ?? todayString()
  );
  const [detailsCashRows, setDetailsCashRows] = useState<RofCashRow[]>(
    () => savedSession.detailsCashRows ?? []
  );
  const [detailsNonCashRows, setDetailsNonCashRows] = useState<RofNonCashRow[]>(
    () => savedSession.detailsNonCashRows ?? []
  );
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsLoadedFilters, setDetailsLoadedFilters] = useState<{
    locationName: string;
    businessDate: string;
    exists: boolean;
  } | null>(() => savedSession.detailsLoadedFilters ?? null);

  // Persist ROF session state to sessionStorage
  useEffect(() => {
    try {
      const payload: RofSavedSession = {
        activeTab,
        selectedLocation,
        dateFrom,
        dateTo,
        summaryRows,
        summaryLoadedFilters,
        summarySearch,
        detailsBusinessDate,
        detailsCashRows,
        detailsNonCashRows,
        detailsLoadedFilters,
      };
      window.sessionStorage.setItem(ROF_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore sessionStorage quota errors
    }
  }, [
    activeTab,
    selectedLocation,
    dateFrom,
    dateTo,
    summaryRows,
    summaryLoadedFilters,
    summarySearch,
    detailsBusinessDate,
    detailsCashRows,
    detailsNonCashRows,
    detailsLoadedFilters,
  ]);

  // Right Slide-Over Drawer state (for quick "View Details" from Summary ROF)
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerDate, setDrawerDate] = useState<string>('');
  const [drawerLocation, setDrawerLocation] = useState<string>('');
  const [drawerCashRows, setDrawerCashRows] = useState<RofCashRow[]>([]);
  const [drawerNonCashRows, setDrawerNonCashRows] = useState<RofNonCashRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Load active store locations on mount
  useEffect(() => {
    if (!token) return;

    fetch('/api/reports/rof/stores', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load stores');
        return res.json();
      })
      .then((data) => {
        const list: Store[] = data.stores || [];
        setStores(list);
        if (list.length > 0 && list[0]) {
          setSelectedLocation((current) => {
            if (current && list.some((s) => s.LOCATIONNAME === current)) {
              return current;
            }
            return list[0].LOCATIONNAME;
          });
        }
      })
      .catch((err) => {
        console.error('Error fetching ROF stores:', err);
      });
  }, [token]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  // Generate Summary ROF
  const handleGenerateSummary = async () => {
    if (!selectedLocation) {
      setSummaryError('Please select a Store / Location.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setSummaryError('Please select both Date From and Date To.');
      return;
    }
    if (dateTo < dateFrom) {
      setSummaryError('Date To cannot be earlier than Date From.');
      return;
    }

    setSummaryError(null);
    setSummaryLoading(true);

    try {
      const res = await fetch('/api/reports/rof/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locationName: selectedLocation,
          dateFrom,
          dateTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate ROF summary.');
      }

      setSummaryRows(data.rows || []);
      setSummaryLoadedFilters({
        locationName: selectedLocation,
        dateFrom,
        dateTo,
      });
    } catch (err) {
      setSummaryError((err as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Load Details ROF (Full-page Details Tab)
  const handleLoadDetails = async () => {
    if (!selectedLocation) {
      setDetailsError('Please select a Store / Location.');
      return;
    }
    if (!detailsBusinessDate) {
      setDetailsError('Please select a Business Date.');
      return;
    }

    setDetailsError(null);
    setDetailsLoading(true);

    try {
      const res = await fetch('/api/reports/rof/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locationName: selectedLocation,
          businessDate: detailsBusinessDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load ROF details.');
      }

      setDetailsCashRows(data.cash || []);
      setDetailsNonCashRows(data.nonCash || []);
      setDetailsLoadedFilters({
        locationName: selectedLocation,
        businessDate: detailsBusinessDate,
        exists: Boolean(data.exists),
      });
    } catch (err) {
      setDetailsError((err as Error).message);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Right Slide-Over Drawer for a specific row in Summary ROF
  const handleOpenDrawerDetails = async (row: RofSummaryRow) => {
    const loc = row.locationName || summaryLoadedFilters?.locationName || selectedLocation;
    const bDate = row.businessDate;

    setDrawerLocation(loc);
    setDrawerDate(bDate);
    setDrawerCashRows([]);
    setDrawerNonCashRows([]);
    setDrawerError(null);
    setDrawerOpen(true);
    setDrawerLoading(true);

    try {
      const res = await fetch('/api/reports/rof/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locationName: loc,
          businessDate: bDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load ROF details.');
      }

      setDrawerCashRows(data.cash || []);
      setDrawerNonCashRows(data.nonCash || []);
    } catch (err) {
      setDrawerError((err as Error).message);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Filtered Summary rows
  const filteredSummaryRows = useMemo(() => {
    if (!summarySearch.trim()) return summaryRows;
    const term = summarySearch.toLowerCase();
    return summaryRows.filter(
      (r) =>
        r.businessDate.toLowerCase().includes(term) ||
        formatBusinessDate(r.businessDate).toLowerCase().includes(term) ||
        r.cashRemarks.toLowerCase().includes(term) ||
        r.nonCashRemarks.toLowerCase().includes(term)
    );
  }, [summaryRows, summarySearch]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    return filteredSummaryRows.reduce(
      (acc, row) => {
        acc.netSalesVat += Number(row.netSalesVat || 0);
        acc.vat += Number(row.vat || 0);
        acc.netSales += Number(row.netSales || 0);
        acc.gcSales += Number(row.gcSales || 0);
        acc.cash += Number(row.cash || 0);
        acc.nonCash += Number(row.nonCash || 0);
        acc.variance += Number(row.variance || 0);
        return acc;
      },
      {
        netSalesVat: 0,
        vat: 0,
        netSales: 0,
        gcSales: 0,
        cash: 0,
        nonCash: 0,
        variance: 0,
      }
    );
  }, [filteredSummaryRows]);

  // Details Tab Totals
  const detailsCashTotals = useMemo(() => {
    return detailsCashRows.reduce(
      (acc, r) => {
        acc.pos += Number(r.posAmount || 0);
        acc.actual += Number(r.actualAmount || 0);
        return acc;
      },
      { pos: 0, actual: 0 }
    );
  }, [detailsCashRows]);

  const detailsNonCashTotals = useMemo(() => {
    return detailsNonCashRows.reduce(
      (acc, r) => {
        acc.pos += Number(r.posAmount || 0);
        acc.actual += Number(r.actualAmount || 0);
        return acc;
      },
      { pos: 0, actual: 0 }
    );
  }, [detailsNonCashRows]);

  // Drawer Totals
  const drawerCashTotals = useMemo(() => {
    return drawerCashRows.reduce(
      (acc, r) => {
        acc.pos += Number(r.posAmount || 0);
        acc.actual += Number(r.actualAmount || 0);
        return acc;
      },
      { pos: 0, actual: 0 }
    );
  }, [drawerCashRows]);

  const drawerNonCashTotals = useMemo(() => {
    return drawerNonCashRows.reduce(
      (acc, r) => {
        acc.pos += Number(r.posAmount || 0);
        acc.actual += Number(r.actualAmount || 0);
        return acc;
      },
      { pos: 0, actual: 0 }
    );
  }, [drawerNonCashRows]);

  return (
    <div className="system-sales-workspace">
      {/* Workspace Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="bom-header-icon-badge d-flex align-items-center justify-content-center rounded-3 shadow-sm flex-shrink-0">
            <ReceiptText size={22} />
          </div>
          <div>
            <h2 className="h5 fw-bold mb-0 bom-main-heading">Remittance of Funds (ROF)</h2>
            <p className="small text-secondary mb-0">
              Monitor consolidated daily sales remittances, cash/non-cash breakdowns, and cashier variances per store.
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className={`system-sales-navigation-item btn border ${
              activeTab === 'summary' ? 'system-sales-navigation-item-active shadow-sm' : ''
            }`}
            onClick={() => setActiveTab('summary')}
          >
            <BarChart3 size={16} className="me-2" />
            <strong>Summary ROF</strong>
          </button>

          <button
            type="button"
            className={`system-sales-navigation-item btn border ${
              activeTab === 'details' ? 'system-sales-navigation-item-active shadow-sm' : ''
            }`}
            onClick={() => setActiveTab('details')}
          >
            <CalendarDays size={16} className="me-2" />
            <strong>Details ROF</strong>
          </button>
        </div>
      </div>

      {/* =========================================================
          TAB 1: SUMMARY ROF
          ========================================================= */}
      {activeTab === 'summary' && (
        <>
          {/* Filter Card */}
          <div className="card border rounded-4 shadow-sm p-4 mb-4 bg-white bom-filter-card">
            <div className="row g-3 align-items-end">
              {/* Store Location */}
              <div className="col-12 col-md-4 col-lg-3">
                <label htmlFor="rof-store-select" className="form-label small fw-semibold text-secondary">
                  Store / Location
                </label>
                <select
                  id="rof-store-select"
                  className="form-select bom-filter-input"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  disabled={summaryLoading}
                >
                  {stores.length === 0 && <option value="">Loading active stores...</option>}
                  {stores.map((s) => (
                    <option key={s.LOCATIONID} value={s.LOCATIONNAME}>
                      {s.LOCATIONNAME} ({s.ORGLOCATIONREF})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div className="col-12 col-sm-6 col-md-3 col-lg-3">
                <label htmlFor="rof-date-from" className="form-label small fw-semibold text-secondary">
                  Date From
                </label>
                <input
                  id="rof-date-from"
                  type="date"
                  className="form-control bom-filter-input"
                  value={dateFrom}
                  max={todayString()}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={summaryLoading}
                />
              </div>

              {/* Date To */}
              <div className="col-12 col-sm-6 col-md-3 col-lg-3">
                <label htmlFor="rof-date-to" className="form-label small fw-semibold text-secondary">
                  Date To
                </label>
                <input
                  id="rof-date-to"
                  type="date"
                  className="form-control bom-filter-input"
                  value={dateTo}
                  max={todayString()}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={summaryLoading}
                />
              </div>

              {/* Generate Button */}
              <div className="col-12 col-md-2 col-lg-3">
                <button
                  type="button"
                  className="btn btn-oracle-red w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                  onClick={handleGenerateSummary}
                  disabled={summaryLoading || !selectedLocation || !dateFrom || !dateTo}
                >
                  <RefreshCw size={17} className={summaryLoading ? 'spin' : ''} />
                  {summaryLoading ? 'Generating...' : 'Generate Summary'}
                </button>
              </div>
            </div>

            {summaryError && (
              <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3" role="alert">
                {summaryError}
              </div>
            )}
          </div>

          {/* Summary Results */}
          {summaryLoadedFilters && (
            <div className="d-flex flex-column gap-3">
              {/* Action & Export Bar */}
              <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="bom-uom-badge px-3 py-1">
                    Store: <strong>{summaryLoadedFilters.locationName}</strong>
                  </span>
                  <span className="bom-uom-badge px-3 py-1">
                    {filteredSummaryRows.length} {filteredSummaryRows.length === 1 ? 'Day' : 'Days'}
                  </span>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <div className="input-group input-group-sm" style={{ width: 220 }}>
                    <span className="input-group-text bg-white border-end-0">
                      <Search size={14} className="text-secondary" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="Filter date or remarks..."
                      value={summarySearch}
                      onChange={(e) => setSummarySearch(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn rof-export-btn rof-export-btn-excel btn-sm d-flex align-items-center gap-2 px-3 fw-semibold"
                    onClick={() =>
                      exportRofSummaryToExcel(filteredSummaryRows, summaryTotals, summaryLoadedFilters)
                    }
                    disabled={filteredSummaryRows.length === 0}
                    title="Download Excel Workbook (.xlsx)"
                  >
                    <FileSpreadsheet size={15} />
                    Excel (.xlsx)
                  </button>

                  <button
                    type="button"
                    className="btn rof-export-btn rof-export-btn-pdf btn-sm d-flex align-items-center gap-2 px-3 fw-semibold"
                    onClick={() =>
                      exportRofSummaryToPdf(filteredSummaryRows, summaryTotals, summaryLoadedFilters)
                    }
                    disabled={filteredSummaryRows.length === 0}
                    title="Download Printable PDF Report"
                  >
                    <FileText size={15} />
                    PDF
                  </button>
                </div>
              </div>

              {/* Summary Table Card */}
              <div className="card border rounded-4 shadow-sm overflow-hidden bg-white">
                <div className="table-responsive rof-grid-scroll-container">
                  <table className="table align-middle mb-0 bom-data-table rof-summary-table">
                    <colgroup>
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '135px' }} />
                      <col style={{ width: '115px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '135px' }} />
                      <col style={{ width: '145px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '160px' }} />
                      <col style={{ width: '160px' }} />
                      <col style={{ width: '125px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Business Date</th>
                        <th className="text-end">Net Sales w/ VAT</th>
                        <th className="text-end">VAT</th>
                        <th className="text-end">Net Sales</th>
                        <th className="text-end">GC / Srvc Chg</th>
                        <th className="text-end">Cash Remitted</th>
                        <th className="text-end">Non-Cash Remitted</th>
                        <th className="text-end">Variance</th>
                        <th>Cash Remarks</th>
                        <th>Non-Cash Remarks</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSummaryRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="text-center py-5 text-secondary">
                            No ROF summary records found for the selected store and date range.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {filteredSummaryRows.map((row) => (
                            <tr key={row.businessDate}>
                              <td className="fw-semibold bom-charcoal-text text-nowrap">
                                {formatBusinessDate(row.businessDate)}
                              </td>
                              <td className="num-cell">₱{formatMoney(row.netSalesVat)}</td>
                              <td className="num-cell">₱{formatMoney(row.vat)}</td>
                              <td className="num-cell">₱{formatMoney(row.netSales)}</td>
                              <td className="num-cell">₱{formatMoney(row.gcSales)}</td>
                              <td className="num-cell fw-semibold">₱{formatMoney(row.cash)}</td>
                              <td className="num-cell fw-semibold">₱{formatMoney(row.nonCash)}</td>
                              <td className={`num-cell fw-bold ${getVarianceClass(row.variance)}`}>
                                ₱{formatMoney(row.variance)}
                              </td>
                              <td className="rof-remarks-cell" title={row.cashRemarks || ''}>
                                {row.cashRemarks || '—'}
                              </td>
                              <td className="rof-remarks-cell" title={row.nonCashRemarks || ''}>
                                {row.nonCashRemarks || '—'}
                              </td>
                              <td className="text-center text-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1"
                                  onClick={() => handleOpenDrawerDetails(row)}
                                  title={`View Cash & Non-Cash Details for ${formatBusinessDate(row.businessDate)}`}
                                >
                                  <Eye size={14} />
                                  <span>View Details</span>
                                </button>
                              </td>
                            </tr>
                          ))}

                          {/* TOTAL Footer Row */}
                          <tr className="rof-total-row fw-bold">
                            <td className="bom-charcoal-text">TOTAL</td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryTotals.netSalesVat)}
                            </td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryTotals.vat)}
                            </td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryTotals.netSales)}
                            </td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryTotals.gcSales)}
                            </td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryTotals.cash)}
                            </td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryTotals.nonCash)}
                            </td>
                            <td className={`num-cell fw-bold ${getVarianceClass(summaryTotals.variance)}`}>
                              ₱{formatMoney(summaryTotals.variance)}
                            </td>
                            <td colSpan={3} />
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Initial Placeholder before Summary Generation */}
          {!summaryLoadedFilters && !summaryLoading && (
            <div className="system-sales-placeholder mt-2">
              <ReceiptText size={40} className="mb-2 bom-charcoal-text" />
              <h5 className="fw-bold bom-main-heading">Ready to Generate ROF Summary</h5>
              <p className="text-secondary">
                Select a store location and date range above, then click{' '}
                <strong>Generate Summary</strong> to view daily remittance totals and inspect date-level details.
              </p>
            </div>
          )}
        </>
      )}

      {/* =========================================================
          TAB 2: DETAILS ROF (FULL-PAGE VIEW)
          ========================================================= */}
      {activeTab === 'details' && (
        <>
          {/* Filter Card */}
          <div className="card border rounded-4 shadow-sm p-4 mb-4 bg-white bom-filter-card">
            <div className="row g-3 align-items-end">
              {/* Store Location */}
              <div className="col-12 col-md-5 col-lg-4">
                <label htmlFor="rof-details-store" className="form-label small fw-semibold text-secondary">
                  Store / Location
                </label>
                <select
                  id="rof-details-store"
                  className="form-select bom-filter-input"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  disabled={detailsLoading}
                >
                  {stores.length === 0 && <option value="">Loading active stores...</option>}
                  {stores.map((s) => (
                    <option key={s.LOCATIONID} value={s.LOCATIONNAME}>
                      {s.LOCATIONNAME} ({s.ORGLOCATIONREF})
                    </option>
                  ))}
                </select>
              </div>

              {/* Business Date */}
              <div className="col-12 col-sm-6 col-md-4 col-lg-4">
                <label htmlFor="rof-details-date" className="form-label small fw-semibold text-secondary">
                  Business Date
                </label>
                <input
                  id="rof-details-date"
                  type="date"
                  className="form-control bom-filter-input"
                  value={detailsBusinessDate}
                  max={todayString()}
                  onChange={(e) => setDetailsBusinessDate(e.target.value)}
                  disabled={detailsLoading}
                />
              </div>

              {/* Load Details Button */}
              <div className="col-12 col-sm-6 col-md-3 col-lg-4">
                <button
                  type="button"
                  className="btn btn-oracle-red w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                  onClick={handleLoadDetails}
                  disabled={detailsLoading || !selectedLocation || !detailsBusinessDate}
                >
                  <RefreshCw size={17} className={detailsLoading ? 'spin' : ''} />
                  {detailsLoading ? 'Loading Details...' : 'Load ROF Details'}
                </button>
              </div>
            </div>

            {detailsError && (
              <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3" role="alert">
                {detailsError}
              </div>
            )}
          </div>

          {detailsLoadedFilters && (
            <div className="d-flex flex-column gap-4">
              {/* Action & Export Bar */}
              <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="bom-uom-badge px-3 py-1">
                    Store: <strong>{detailsLoadedFilters.locationName}</strong>
                  </span>
                  <span className="bom-uom-badge px-3 py-1">
                    Business Date: <strong>{formatBusinessDate(detailsLoadedFilters.businessDate)}</strong>
                  </span>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn rof-export-btn rof-export-btn-excel btn-sm d-flex align-items-center gap-2 px-3 fw-semibold"
                    onClick={() =>
                      exportRofDetailsToExcel(detailsCashRows, detailsNonCashRows, detailsLoadedFilters)
                    }
                    disabled={detailsCashRows.length === 0 && detailsNonCashRows.length === 0}
                    title="Download Excel Workbook (.xlsx)"
                  >
                    <FileSpreadsheet size={15} />
                    Excel (.xlsx)
                  </button>

                  <button
                    type="button"
                    className="btn rof-export-btn rof-export-btn-pdf btn-sm d-flex align-items-center gap-2 px-3 fw-semibold"
                    onClick={() =>
                      exportRofDetailsToPdf(detailsCashRows, detailsNonCashRows, detailsLoadedFilters)
                    }
                    disabled={detailsCashRows.length === 0 && detailsNonCashRows.length === 0}
                    title="Download Printable PDF Report"
                  >
                    <FileText size={15} />
                    PDF
                  </button>
                </div>
              </div>

              <RofDetailsBreakdownTables
                cashRows={detailsCashRows}
                nonCashRows={detailsNonCashRows}
                cashTotals={detailsCashTotals}
                nonCashTotals={detailsNonCashTotals}
              />
            </div>
          )}

          {!detailsLoadedFilters && !detailsLoading && (
            <div className="system-sales-placeholder mt-2">
              <CalendarDays size={40} className="mb-2 bom-charcoal-text" />
              <h5 className="fw-bold bom-main-heading">Ready to Load ROF Details</h5>
              <p className="text-secondary">
                Select a store location and business date above, then click{' '}
                <strong>Load ROF Details</strong> to view the cashier cash remittance and non-cash tender breakdown.
              </p>
            </div>
          )}
        </>
      )}

      {/* =========================================================
          RIGHT SLIDE-OVER DRAWER MODAL (QUICK "VIEW DETAILS")
          ========================================================= */}
      {drawerOpen && (
        <div
          className="rof-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="ROF Details Breakdown Drawer"
        >
          <div
            className="rof-drawer-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="rof-drawer-header d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span className="bom-uom-badge">
                    {drawerLocation}
                  </span>
                  <span className="small text-secondary">•</span>
                  <span className="small fw-semibold text-secondary">
                    {formatBusinessDate(drawerDate)}
                  </span>
                </div>
                <h3 className="h5 fw-bold mb-0 bom-main-heading">
                  ROF Detailed Breakdown
                </h3>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn rof-export-btn rof-export-btn-excel btn-sm d-inline-flex align-items-center gap-1.5 px-3 fw-semibold"
                  onClick={() =>
                    exportRofDetailsToExcel(drawerCashRows, drawerNonCashRows, {
                      locationName: drawerLocation,
                      businessDate: drawerDate,
                    })
                  }
                  disabled={drawerLoading || (drawerCashRows.length === 0 && drawerNonCashRows.length === 0)}
                  title="Export to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={14} />
                  <span>Excel</span>
                </button>

                <button
                  type="button"
                  className="btn rof-export-btn rof-export-btn-pdf btn-sm d-inline-flex align-items-center gap-1.5 px-3 fw-semibold"
                  onClick={() =>
                    exportRofDetailsToPdf(drawerCashRows, drawerNonCashRows, {
                      locationName: drawerLocation,
                      businessDate: drawerDate,
                    })
                  }
                  disabled={drawerLoading || (drawerCashRows.length === 0 && drawerNonCashRows.length === 0)}
                  title="Export to PDF"
                >
                  <FileText size={14} />
                  <span>PDF</span>
                </button>

                <div className="rof-drawer-header-divider" />

                <button
                  type="button"
                  className="btn rof-drawer-close-btn"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close drawer"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="rof-drawer-body">
              {drawerLoading ? (
                <div className="d-flex flex-column align-items-center justify-content-center py-5 my-4 gap-2 text-secondary">
                  <span className="spinner-border text-secondary" role="status" aria-hidden="true" />
                  <span className="fw-medium">Loading ROF breakdown for {formatBusinessDate(drawerDate)}...</span>
                </div>
              ) : drawerError ? (
                <div className="alert alert-danger rounded-3 small">
                  {drawerError}
                </div>
              ) : (
                <RofDetailsBreakdownTables
                  cashRows={drawerCashRows}
                  nonCashRows={drawerNonCashRows}
                  cashTotals={drawerCashTotals}
                  nonCashTotals={drawerNonCashTotals}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RofDetailsBreakdownTablesProps {
  cashRows: RofCashRow[];
  nonCashRows: RofNonCashRow[];
  cashTotals: { pos: number; actual: number };
  nonCashTotals: { pos: number; actual: number };
}

function RofDetailsBreakdownTables({
  cashRows,
  nonCashRows,
  cashTotals,
  nonCashTotals,
}: RofDetailsBreakdownTablesProps) {
  const cashVariance = cashTotals.actual - cashTotals.pos;
  const nonCashVariance = nonCashTotals.actual - nonCashTotals.pos;

  return (
    <div className="d-flex flex-column gap-4">
      {/* 1. Cash Remittance Section */}
      <section className="card border rounded-4 shadow-sm overflow-hidden bg-white">
        <div className="rof-section-header px-4 py-3 border-bottom d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3">
          <div className="min-w-0">
            <h4 className="h6 fw-bold mb-1 bom-main-heading">1. Cash Remittance</h4>
            <p className="small text-secondary mb-0">
              Cashier-level POS cash reading vs. actual remitted cash and MOD verification.
            </p>
          </div>

          <div className="rof-section-kpi-strip">
            <div className="rof-kpi-item">
              <span className="rof-kpi-label">POS:</span>
              <strong className="rof-kpi-value bom-charcoal-text">₱{formatMoney(cashTotals.pos)}</strong>
            </div>
            <span className="rof-kpi-divider" aria-hidden="true" />
            <div className="rof-kpi-item">
              <span className="rof-kpi-label">Actual:</span>
              <strong className="rof-kpi-value bom-charcoal-text">₱{formatMoney(cashTotals.actual)}</strong>
            </div>
            <span className="rof-kpi-divider" aria-hidden="true" />
            <div className="rof-kpi-item">
              <span className="rof-kpi-label">Variance:</span>
              <strong className={`rof-kpi-value ${getVarianceClass(cashVariance)}`}>
                ₱{formatMoney(cashVariance)}
              </strong>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0 bom-data-table rof-aligned-details-table">
            <colgroup>
              <col style={{ width: '17%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Cashier Name</th>
                <th className="text-center">Tender</th>
                <th className="text-end">POS Amount</th>
                <th className="text-end">Actual Amount</th>
                <th className="text-end">Variance</th>
                <th className="text-center">MOD</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {cashRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-secondary">
                    No cash remittance records encoded for this business date.
                  </td>
                </tr>
              ) : (
                <>
                  {cashRows.map((row, idx) => {
                    const rowVar = Number(row.actualAmount || 0) - Number(row.posAmount || 0);
                    return (
                      <tr key={`${row.cashierName}-${idx}`}>
                        <td className="fw-semibold bom-charcoal-text text-truncate" title={row.cashierName}>
                          {row.cashierName}
                        </td>
                        <td className="text-center">
                          <span className="bom-uom-badge">{row.tenderName || 'CASH'}</span>
                        </td>
                        <td className="num-cell">₱{formatMoney(row.posAmount)}</td>
                        <td className="num-cell fw-semibold">₱{formatMoney(row.actualAmount)}</td>
                        <td className={`num-cell fw-bold ${getVarianceClass(rowVar)}`}>
                          ₱{formatMoney(rowVar)}
                        </td>
                        <td className="text-center">
                          {row.mod ? (
                            <span className="rof-mod-badge">{row.mod}</span>
                          ) : (
                            <span className="text-secondary">—</span>
                          )}
                        </td>
                        <td className="rof-detail-remarks-cell" title={row.remarks || ''}>
                          {row.remarks || '—'}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="rof-total-row fw-bold">
                    <td colSpan={2} className="bom-charcoal-text">
                      TOTAL
                    </td>
                    <td className="num-cell bom-charcoal-text">₱{formatMoney(cashTotals.pos)}</td>
                    <td className="num-cell bom-charcoal-text">₱{formatMoney(cashTotals.actual)}</td>
                    <td className={`num-cell fw-bold ${getVarianceClass(cashVariance)}`}>
                      ₱{formatMoney(cashVariance)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Non-Cash Remittance Section */}
      <section className="card border rounded-4 shadow-sm overflow-hidden bg-white">
        <div className="rof-section-header px-4 py-3 border-bottom d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3">
          <div className="min-w-0">
            <h4 className="h6 fw-bold mb-1 bom-main-heading">2. Non-Cash Remittance</h4>
            <p className="small text-secondary mb-0">
              Credit card, e-wallet, gift certificate, and non-cash tender reconciliation.
            </p>
          </div>

          <div className="rof-section-kpi-strip">
            <div className="rof-kpi-item">
              <span className="rof-kpi-label">POS:</span>
              <strong className="rof-kpi-value bom-charcoal-text">₱{formatMoney(nonCashTotals.pos)}</strong>
            </div>
            <span className="rof-kpi-divider" aria-hidden="true" />
            <div className="rof-kpi-item">
              <span className="rof-kpi-label">Actual:</span>
              <strong className="rof-kpi-value bom-charcoal-text">₱{formatMoney(nonCashTotals.actual)}</strong>
            </div>
            <span className="rof-kpi-divider" aria-hidden="true" />
            <div className="rof-kpi-item">
              <span className="rof-kpi-label">Variance:</span>
              <strong className={`rof-kpi-value ${getVarianceClass(nonCashVariance)}`}>
                ₱{formatMoney(nonCashVariance)}
              </strong>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0 bom-data-table rof-aligned-details-table">
            <colgroup>
              <col style={{ width: '17%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={2}>Tender Name</th>
                <th className="text-end">POS Amount</th>
                <th className="text-end">Actual Amount</th>
                <th className="text-end">Variance</th>
                <th colSpan={2} className="rof-noncash-remarks-col">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {nonCashRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-secondary">
                    No non-cash remittance records encoded for this business date.
                  </td>
                </tr>
              ) : (
                <>
                  {nonCashRows.map((row, idx) => {
                    const rowVar = Number(row.actualAmount || 0) - Number(row.posAmount || 0);
                    return (
                      <tr key={`${row.tenderName}-${idx}`}>
                        <td colSpan={2} className="fw-semibold bom-charcoal-text text-truncate" title={row.tenderName}>
                          {row.tenderName}
                        </td>
                        <td className="num-cell">₱{formatMoney(row.posAmount)}</td>
                        <td className="num-cell fw-semibold">₱{formatMoney(row.actualAmount)}</td>
                        <td className={`num-cell fw-bold ${getVarianceClass(rowVar)}`}>
                          ₱{formatMoney(rowVar)}
                        </td>
                        <td colSpan={2} className="rof-detail-remarks-cell rof-noncash-remarks-col" title={row.remarks || ''}>
                          {row.remarks || '—'}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="rof-total-row fw-bold">
                    <td colSpan={2} className="bom-charcoal-text">
                      TOTAL
                    </td>
                    <td className="num-cell bom-charcoal-text">₱{formatMoney(nonCashTotals.pos)}</td>
                    <td className="num-cell bom-charcoal-text">₱{formatMoney(nonCashTotals.actual)}</td>
                    <td className={`num-cell fw-bold ${getVarianceClass(nonCashVariance)}`}>
                      ₱{formatMoney(nonCashVariance)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
