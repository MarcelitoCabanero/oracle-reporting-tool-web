import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FileText,
  PackageX,
  Receipt,
  RefreshCw,
  Search,
  Store as StoreIcon,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { StoreSearchSelect, type StoreSearchOption } from '../../components/common/StoreSearchSelect';
import {
  exportCombinedVoidReportToExcel,
  exportCombinedVoidReportToPdf,
  type VoidTransactionsData,
  type CancelItemsData,
  type VoidTransactionItem,
} from './voidExportUtils';

export interface VoidSummaryReportProps {
  stores: StoreSearchOption[];
  selectedLocation: string;
  onSelectLocation: (loc: string) => void;
  dateFrom: string;
  onDateFromChange: (d: string) => void;
  dateTo: string;
  onDateToChange: (d: string) => void;
}

const VOID_SUMMARY_SESSION_KEY = 'oracle-session-void-summary';

interface VoidSummarySavedSession {
  voidData?: VoidTransactionsData | null;
  cancelData?: CancelItemsData | null;
  voidSearch?: string;
  cancelSearch?: string;
  expandedInvoices?: Record<string, boolean>;
}

function loadVoidSession(): Partial<VoidSummarySavedSession> {
  try {
    const raw = window.sessionStorage.getItem(VOID_SUMMARY_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Partial<VoidSummarySavedSession>) : {};
  } catch {
    return {};
  }
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatInt(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  });
}

export function VoidSummaryReport({
  stores,
  selectedLocation,
  onSelectLocation,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: VoidSummaryReportProps) {
  const { token } = useAuth();
  const saved = useMemo(() => loadVoidSession(), []);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [voidData, setVoidData] = useState<VoidTransactionsData | null>(
    () => saved.voidData ?? null
  );
  const [cancelData, setCancelData] = useState<CancelItemsData | null>(
    () => saved.cancelData ?? null
  );

  // Table filtering & row expansion
  const [voidSearch, setVoidSearch] = useState<string>(() => saved.voidSearch ?? '');
  const [cancelSearch, setCancelSearch] = useState<string>(() => saved.cancelSearch ?? '');
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>(
    () => saved.expandedInvoices ?? {}
  );

  // Persist report state to sessionStorage
  useEffect(() => {
    try {
      const payload: VoidSummarySavedSession = {
        voidData,
        cancelData,
        voidSearch,
        cancelSearch,
        expandedInvoices,
      };
      window.sessionStorage.setItem(VOID_SUMMARY_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors if storage is constrained
    }
  }, [voidData, cancelData, voidSearch, cancelSearch, expandedInvoices]);

  function toggleExpand(invNum: string) {
    setExpandedInvoices((prev) => ({
      ...prev,
      [invNum]: !prev[invNum],
    }));
  }

  // Fetch both Void Transactions and Cancel Items simultaneously
  async function handleGenerateReport() {
    if (!selectedLocation) {
      setError('Please select a Store / Location.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setError('Please select both Date From and Date To.');
      return;
    }
    if (dateTo < dateFrom) {
      setError('Date To cannot be earlier than Date From.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const queryParams = new URLSearchParams({
        locationName: selectedLocation,
        dateFrom,
        dateTo,
      });

      const [voidRes, cancelRes] = await Promise.all([
        fetch(`/api/reports/system-sales/void-transactions?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/reports/system-sales/cancel-items?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [vData, cData] = await Promise.all([voidRes.json(), cancelRes.json()]);

      if (!voidRes.ok) {
        throw new Error(vData.message || 'Failed to retrieve void transactions.');
      }
      if (!cancelRes.ok) {
        throw new Error(cData.message || 'Failed to retrieve cancel items.');
      }

      setVoidData(vData);
      setCancelData(cData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Filtered Void Transactions
  const filteredVoidItems = useMemo(() => {
    if (!voidData?.items) return [];
    if (!voidSearch.trim()) return voidData.items;

    const term = voidSearch.toLowerCase();
    return voidData.items.filter(
      (item) =>
        item.fcrInvNum.toLowerCase().includes(term) ||
        item.checkNum.toLowerCase().includes(term) ||
        item.posName.toLowerCase().includes(term) ||
        item.businessDate.toLowerCase().includes(term)
    );
  }, [voidData, voidSearch]);

  // Filtered Cancel Items: exclude any items from void transactions, then apply search
  const filteredCancelItems = useMemo(() => {
    if (!cancelData?.items) return [];

    const voidInvoiceSet = new Set(
      (voidData?.items || []).map((v) => v.fcrInvNum.trim().toLowerCase())
    );

    // 1. Exclude items belonging to void transactions
    const nonVoidItems = cancelData.items.filter(
      (item) => !voidInvoiceSet.has(item.fcrInvNum.trim().toLowerCase())
    );

    // 2. Apply search filter
    if (!cancelSearch.trim()) return nonVoidItems;

    const term = cancelSearch.toLowerCase();
    return nonVoidItems.filter(
      (item) =>
        item.fcrInvNum.toLowerCase().includes(term) ||
        item.checkNum.toLowerCase().includes(term) ||
        item.itemName.toLowerCase().includes(term) ||
        item.itemNumber.toLowerCase().includes(term) ||
        item.businessDate.toLowerCase().includes(term)
    );
  }, [cancelData, voidData, cancelSearch]);

  // Aggregate totals for Cancel Items (displayed in the table footer)
  const cancelTotals = useMemo(() => {
    let qty = 0;
    let amount = 0;
    for (const item of filteredCancelItems) {
      qty += item.lineCount;
      amount += item.lineTotal;
    }
    return { qty, amount };
  }, [filteredCancelItems]);

  const hasData = !!(voidData || cancelData);

  function handleExportExcel() {
    const sanitizedCancelData = cancelData
      ? {
          ...cancelData,
          items: filteredCancelItems,
          summary: {
            ...cancelData.summary,
            totalCancelledQty: cancelTotals.qty,
            totalCancelledAmount: cancelTotals.amount,
            rowCount: filteredCancelItems.length,
          },
        }
      : null;

    exportCombinedVoidReportToExcel({
      voidData,
      cancelData: sanitizedCancelData,
      locationName: selectedLocation,
      dateFrom,
      dateTo,
    });
  }

  function handleExportPdf() {
    const sanitizedCancelData = cancelData
      ? {
          ...cancelData,
          items: filteredCancelItems,
          summary: {
            ...cancelData.summary,
            totalCancelledQty: cancelTotals.qty,
            totalCancelledAmount: cancelTotals.amount,
            rowCount: filteredCancelItems.length,
          },
        }
      : null;

    exportCombinedVoidReportToPdf({
      voidData,
      cancelData: sanitizedCancelData,
      locationName: selectedLocation,
      dateFrom,
      dateTo,
    });
  }

  return (
    <div className="void-summary-report-container d-grid gap-4">
      {/* 1. Unified Filter Bar */}
      <div className="menuitem-unified-filter-bar mb-3">
        <div className="menuitem-filter-bar-row">
          {/* Store / Location Combobox with Store Code Search */}
          <div className="menuitem-filter-group menuitem-filter-store">
            <label htmlFor="void-store-select" className="menuitem-filter-label">
              Store / Location
            </label>
            <div className="menuitem-input-with-icon">
              <StoreIcon size={15} className="menuitem-input-left-icon" />
              <StoreSearchSelect
                id="void-store-select"
                inputClassName="form-select menuitem-filter-control"
                stores={stores}
                value={selectedLocation}
                onChange={onSelectLocation}
                disabled={loading}
              />
            </div>
          </div>

          {/* Business Date Range Filter */}
          <div className="menuitem-filter-group menuitem-filter-dates">
            <label htmlFor="void-date-from" className="menuitem-filter-label">
              Business Date Range
            </label>
            <div className="menuitem-date-range-capsule">
              <div className="menuitem-date-field">
                <CalendarDays size={15} className="menuitem-input-left-icon" />
                <input
                  id="void-date-from"
                  type="date"
                  className="form-control menuitem-date-input"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  disabled={loading}
                  aria-label="Date From"
                />
              </div>
              <span className="menuitem-date-range-sep">to</span>
              <div className="menuitem-date-field">
                <CalendarDays size={15} className="menuitem-input-left-icon" />
                <input
                  id="void-date-to"
                  type="date"
                  className="form-control menuitem-date-input"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  disabled={loading}
                  aria-label="Date To"
                />
              </div>
            </div>
          </div>

          {/* Action CTAs: Generate & Exports */}
          <div className="menuitem-filter-cta gap-2">
            <button
              type="button"
              className="btn menuitem-generate-btn d-inline-flex align-items-center justify-content-center gap-2"
              onClick={handleGenerateReport}
              disabled={loading || !selectedLocation || !dateFrom || !dateTo}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Generating...' : 'Generate Report'}</span>
            </button>

            {/* Retain ONLY Beside Generate Button */}
            {hasData && (
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn rof-export-btn rof-export-btn-excel btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                  onClick={handleExportExcel}
                  title="Download Excel Workbook (Void Invoices & Cancelled Items)"
                >
                  <FileSpreadsheet size={15} />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  className="btn rof-export-btn rof-export-btn-pdf btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                  onClick={handleExportPdf}
                  title="Download Combined PDF Document"
                >
                  <FileText size={15} />
                  <span>PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-0" role="alert">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* 2. Unified Single Viewing Content */}
      {hasData ? (
        <div className="d-grid gap-4">
          {/* TOP SECTION: Void Transactions */}
          <section className="d-grid gap-3">
            {voidData && (
              <>
                {/* Retained KPI Summary Cards for Void Transactions */}
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className="card shadow-sm border h-100 p-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="text-secondary small fw-bold text-uppercase">
                          Total Void Count
                        </span>
                        <div className="p-2 rounded-3 bg-danger-subtle text-danger">
                          <XCircle size={18} />
                        </div>
                      </div>
                      <div className="fs-3 fw-bold text-dark">
                        {formatInt(voidData.summary.totalVoidCount)}
                      </div>
                      <div className="small text-secondary mt-1">
                        Invoices voided in period
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="card shadow-sm border h-100 p-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="text-secondary small fw-bold text-uppercase">
                          Total Void Amount
                        </span>
                        <div className="p-2 rounded-3 bg-danger-subtle text-danger">
                          <Receipt size={18} />
                        </div>
                      </div>
                      <div className="fs-3 fw-bold text-dark">
                        ₱{formatMoney(voidData.summary.totalVoidAmount)}
                      </div>
                      <div className="small text-secondary mt-1">
                        Cumulative gross sales voided
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="card shadow-sm border h-100 p-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="text-secondary small fw-bold text-uppercase">
                          Avg Void Process Interval
                        </span>
                        <div className="p-2 rounded-3 bg-primary-subtle text-primary">
                          <Clock size={18} />
                        </div>
                      </div>
                      <div className="fs-3 fw-bold text-primary">
                        {voidData.summary.avgIntervalFormatted || '0s'}
                      </div>
                      <div className="small text-secondary mt-1">
                        Time elapsed: wrong order to void
                      </div>
                    </div>
                  </div>
                </div>

                {/* Void Transactions Table Card */}
                <div className="menuitem-table-card">
                  <div className="p-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="p-1 rounded bg-danger-subtle text-danger">
                        <XCircle size={16} />
                      </div>
                      <div>
                        <h6 className="mb-0 fw-bold bom-main-heading">
                          Void Transactions ({filteredVoidItems.length})
                        </h6>
                        <small className="text-secondary">
                          Invoice processing intervals and transaction audit logs
                        </small>
                      </div>
                    </div>
                    <div style={{ maxWidth: '280px', width: '100%' }}>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-light border-end-0">
                          <Search size={14} className="text-secondary" />
                        </span>
                        <input
                          type="text"
                          className="form-control border-start-0"
                          placeholder="Filter invoice, check #, POS..."
                          value={voidSearch}
                          onChange={(e) => setVoidSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive rof-grid-scroll-container">
                    <table className="table align-middle mb-0 bom-data-table menuitem-summary-table void-summary-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }} aria-label="Expand"></th>
                          <th>Business Date</th>
                          <th>Invoice Number</th>
                          <th>Check #</th>
                          <th>POS Station</th>
                          <th>Transaction Start</th>
                          <th>Void Processed</th>
                          <th>Void Interval</th>
                          <th className="text-end">Void Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVoidItems.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-4 text-secondary">
                              No void transactions found matching your criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredVoidItems.map((item) => {
                            const isExpanded = !!expandedInvoices[item.fcrInvNum];
                            return (
                              <VoidTableRow
                                key={item.fcrInvNum}
                                item={item}
                                isExpanded={isExpanded}
                                onToggle={() => toggleExpand(item.fcrInvNum)}
                              />
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* BOTTOM SECTION: Cancel Items (No KPI cards, pure table viewing) */}
          <section className="d-grid gap-3">
            {cancelData && (
              <div className="menuitem-table-card">
                <div className="p-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="p-1 rounded bg-warning-subtle text-warning">
                      <PackageX size={16} />
                    </div>
                    <div>
                      <h6 className="mb-0 fw-bold bom-main-heading">
                        Cancelled Items ({filteredCancelItems.length})
                      </h6>
                      <small className="text-secondary">
                        Line-item cancellations with negative sales values ({formatInt(cancelData.summary.totalCancelledQty)} items total)
                      </small>
                    </div>
                  </div>
                  <div style={{ maxWidth: '280px', width: '100%' }}>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0">
                        <Search size={14} className="text-secondary" />
                      </span>
                      <input
                        type="text"
                        className="form-control border-start-0"
                        placeholder="Filter item name, code, invoice..."
                        value={cancelSearch}
                        onChange={(e) => setCancelSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="table-responsive rof-grid-scroll-container">
                  <table className="table align-middle mb-0 bom-data-table menuitem-summary-table void-summary-table">
                    <thead>
                      <tr>
                        <th>Business Date</th>
                        <th>Time</th>
                        <th>Invoice Number</th>
                        <th>Check #</th>
                        <th>Item Code</th>
                        <th>Item Description</th>
                        <th className="text-center">Qty</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCancelItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-secondary">
                            No cancelled items found matching your criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredCancelItems.map((item, idx) => (
                          <tr key={`${item.fcrInvNum}-${item.itemNumber}-${idx}`}>
                            <td className="text-nowrap">{item.businessDate}</td>
                            <td className="text-nowrap text-secondary">
                              {item.transDatetime.split(' ')[1] || item.transDatetime}
                            </td>
                            <td className="fw-semibold text-primary">{item.fcrInvNum}</td>
                            <td className="text-secondary">{item.checkNum}</td>
                            <td>
                              <span className="badge bg-light text-dark border">
                                {item.itemNumber}
                              </span>
                            </td>
                            <td className="fw-medium">{item.itemName}</td>
                            <td className="text-center fw-semibold text-danger">
                              -{item.lineCount}
                            </td>
                            <td className="text-end fw-semibold text-danger">
                              -₱{formatMoney(item.lineTotal)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredCancelItems.length > 0 && (
                      <tfoot className="table-light">
                        <tr className="rof-total-row fw-bold">
                          <td colSpan={6} className="bom-charcoal-text text-uppercase">
                            Total Cancelled Items ({filteredCancelItems.length} lines)
                          </td>
                          <td className="text-center fw-bold text-danger">
                            -{cancelTotals.qty}
                          </td>
                          <td className="text-end fw-bold text-danger">
                            -₱{formatMoney(cancelTotals.amount)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        <EmptyReportPlaceholder
          title="Void Summary Report"
          subtitle="Select a store and business date range above, then click 'Generate Report' to view voided transactions, processing intervals, and cancelled items."
        />
      )}
    </div>
  );
}

function VoidTableRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: VoidTransactionItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`void-row-clickable ${isExpanded ? 'void-row-expanded' : ''}`}
      >
        <td className="text-center text-secondary">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td className="text-nowrap">{item.businessDate}</td>
        <td className="fw-semibold text-primary">{item.fcrInvNum}</td>
        <td className="text-secondary">{item.checkNum}</td>
        <td>
          <span className="badge bg-light text-dark border">{item.posName}</span>
        </td>
        <td className="text-nowrap text-secondary">{item.startTime}</td>
        <td className="text-nowrap text-secondary">{item.voidTime}</td>
        <td>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
            <Clock size={12} className="me-1 d-inline" />
            {item.intervalFormatted}
          </span>
        </td>
        <td className="text-end fw-bold text-danger">
          ₱{formatMoney(item.voidAmount)}
        </td>
      </tr>

      {/* Expanded Audit Log Sub-table */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <div className="void-subtable-container m-3 shadow-sm">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <small className="fw-bold text-uppercase text-secondary">
                  Transaction Audit Trail for Invoice {item.fcrInvNum}
                </small>
                <small className="badge bg-secondary-subtle text-secondary">
                  {item.transactionCount} entries recorded
                </small>
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0 bom-data-table" style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }} className="text-center">Seq</th>
                      <th>Timestamp</th>
                      <th>POS Terminal</th>
                      <th>Check #</th>
                      <th className="text-end">Gross Sale</th>
                      <th>Event Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.records.map((rec, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === item.records.length - 1;
                      return (
                        <tr key={idx}>
                          <td className="text-center text-secondary">{idx + 1}</td>
                          <td className="text-nowrap fw-semibold">{rec.transdatetime}</td>
                          <td>{rec.posname}</td>
                          <td>{rec.checknum}</td>
                          <td className={`text-end fw-bold ${rec.grossSale < 0 ? 'text-danger' : 'text-dark'}`}>
                            ₱{formatMoney(rec.grossSale)}
                          </td>
                          <td>
                            {isFirst ? (
                              <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                                Wrong / Original Transaction
                              </span>
                            ) : isLast ? (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                Void Completed
                              </span>
                            ) : (
                              <span className="badge bg-secondary-subtle text-secondary">
                                Intermediary POS Event
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function EmptyReportPlaceholder({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="card shadow-sm border py-5 text-center bg-white">
      <div className="card-body">
        <div
          className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle bg-light"
          style={{ width: '64px', height: '64px' }}
        >
          <Receipt size={32} className="text-secondary" />
        </div>
        <h5 className="fw-bold text-dark mb-1">{title}</h5>
        <p className="text-secondary mx-auto mb-0" style={{ maxWidth: '480px', fontSize: '14px' }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
