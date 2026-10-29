import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Download,
  Eye,
  ImageIcon,
  RefreshCw,
  RotateCw,
  Search,
  WalletCards,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export interface StoreOption {
  LOCATIONID: number;
  LOCATIONNAME: string;
  ORGLOCATIONREF: string;
}

export interface DepositRecord {
  depositId: number;
  locationName: string;
  businessDate: string;
  depositDate: string;
  depositReference: string;
  posAmount: number;
  depositAmount: number;
  pettyCash: number;
  bir2307: number;
  openSales: number;
  otherDepartmentExpense: number;
  variance: number;
  filename: string;
}

export interface DepositFilterMeta {
  locationName: string;
  dateFrom: string;
  dateTo: string;
}

function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function firstDayOfCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDisplayDate(value: string): string {
  if (!value) return '—';
  const clean = value.includes('T') ? value.split('T')[0] : value;
  const date = new Date(`${clean}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getVarianceClass(variance: number): string {
  if (Math.abs(variance) < 0.005) return 'rof-variance-zero';
  return variance > 0 ? 'rof-variance-over' : 'rof-variance-short';
}

const DEPOSIT_SESSION_KEY = 'oracle-session-deposit';

interface DepositSavedSession {
  selectedLocation: string;
  dateFrom: string;
  dateTo: string;
  searchKeyword: string;
  rows: DepositRecord[];
  loadedFilters: DepositFilterMeta | null;
}

function loadDepositSession(): Partial<DepositSavedSession> {
  try {
    const raw = window.sessionStorage.getItem(DEPOSIT_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<DepositSavedSession>;
  } catch {
    return {};
  }
}

export function DepositMonitoring() {
  const { user, token } = useAuth();
  const savedSession = useMemo(() => loadDepositSession(), []);

  // Store list & selection (strictly one store at a time)
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    () => savedSession.selectedLocation ?? ''
  );

  // Date range & search filters
  const [dateFrom, setDateFrom] = useState<string>(
    () => savedSession.dateFrom ?? firstDayOfCurrentMonthString()
  );
  const [dateTo, setDateTo] = useState<string>(
    () => savedSession.dateTo ?? todayString()
  );
  const [searchKeyword, setSearchKeyword] = useState<string>(
    () => savedSession.searchKeyword ?? ''
  );

  // Data state
  const [rows, setRows] = useState<DepositRecord[]>(() => savedSession.rows ?? []);
  const [loadedFilters, setLoadedFilters] = useState<DepositFilterMeta | null>(
    () => savedSession.loadedFilters ?? null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Persist Deposit Monitoring session state to sessionStorage
  useEffect(() => {
    try {
      const payload: DepositSavedSession = {
        selectedLocation,
        dateFrom,
        dateTo,
        searchKeyword,
        rows,
        loadedFilters,
      };
      window.sessionStorage.setItem(DEPOSIT_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore sessionStorage quota errors
    }
  }, [selectedLocation, dateFrom, dateTo, searchKeyword, rows, loadedFilters]);

  // Deposit Slip Attachment Viewer Modal state
  const [attachmentTarget, setAttachmentTarget] = useState<DepositRecord | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string>('');
  const [attachmentLoading, setAttachmentLoading] = useState<boolean>(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentZoom, setAttachmentZoom] = useState<number>(1);
  const [attachmentRotation, setAttachmentRotation] = useState<number>(0);

  // Fetch active stores on mount
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetch('/api/reports/deposit/stores', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: { stores?: StoreOption[] }) => {
        if (cancelled) return;
        const list = data.stores ?? [];
        setStores(list);
        if (list.length > 0) {
          setSelectedLocation((current) => {
            if (current && list.some((s) => s.LOCATIONNAME === current)) {
              return current;
            }
            const userStore = list.find(
              (s) => s.LOCATIONNAME.toLowerCase() === (user?.locationName ?? '').toLowerCase()
            );
            return userStore ? userStore.LOCATIONNAME : list[0].LOCATIONNAME;
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load active stores for Deposit Monitoring:', err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.locationName]);

  // Close attachment modal on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && attachmentTarget && !attachmentLoading) {
        setAttachmentTarget(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachmentTarget, attachmentLoading]);

  async function handleGenerateDeposits() {
    if (!selectedLocation) {
      setError('Please select a Store / Location.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setError('Please select both Start Date and End Date.');
      return;
    }
    if (dateTo < dateFrom) {
      setError('End Date cannot be earlier than Start Date.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/deposit/list', {
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load Deposit Monitoring records.');
      }

      setRows(data.rows ?? []);
      setLoadedFilters({
        locationName: selectedLocation,
        dateFrom,
        dateTo,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenAttachment(row: DepositRecord) {
    if (!row.filename) return;

    setAttachmentTarget(row);
    setAttachmentPreview('');
    setAttachmentError(null);
    setAttachmentZoom(1);
    setAttachmentRotation(0);
    setAttachmentLoading(true);

    try {
      const response = await fetch('/api/reports/deposit/attachment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: row.filename,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to load deposit slip attachment from FTP.');
      }

      setAttachmentPreview(data.previewDataUrl || '');
    } catch (err) {
      setAttachmentError((err as Error).message);
    } finally {
      setAttachmentLoading(false);
    }
  }

  function handleCloseAttachment() {
    if (attachmentLoading) return;
    setAttachmentTarget(null);
    setAttachmentPreview('');
    setAttachmentError(null);
    setAttachmentZoom(1);
    setAttachmentRotation(0);
  }

  function handleDownloadAttachment() {
    if (!attachmentTarget || !attachmentPreview) return;
    const link = document.createElement('a');
    link.href = attachmentPreview;
    link.download = attachmentTarget.filename || `Deposit_${attachmentTarget.depositId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filter loaded rows by keyword (ID, reference, dates, filename, deposit amount)
  const filteredRows = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.depositId).includes(q) ||
        r.businessDate.toLowerCase().includes(q) ||
        formatDisplayDate(r.businessDate).toLowerCase().includes(q) ||
        r.depositDate.toLowerCase().includes(q) ||
        formatDisplayDate(r.depositDate).toLowerCase().includes(q) ||
        (r.depositReference || '').toLowerCase().includes(q) ||
        (r.filename || '').toLowerCase().includes(q) ||
        formatMoney(r.depositAmount).includes(q) ||
        formatMoney(r.posAmount).includes(q)
    );
  }, [rows, searchKeyword]);

  // Totals across filtered rows
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.posAmount += Number(r.posAmount || 0);
        acc.depositAmount += Number(r.depositAmount || 0);
        acc.pettyCash += Number(r.pettyCash || 0);
        acc.bir2307 += Number(r.bir2307 || 0);
        acc.openSales += Number(r.openSales || 0);
        acc.otherDepartmentExpense += Number(r.otherDepartmentExpense || 0);
        acc.variance += Number(r.variance || 0);
        return acc;
      },
      {
        posAmount: 0,
        depositAmount: 0,
        pettyCash: 0,
        bir2307: 0,
        openSales: 0,
        otherDepartmentExpense: 0,
        variance: 0,
      }
    );
  }, [filteredRows]);

  const totalDeductions =
    totals.pettyCash + totals.bir2307 + totals.openSales + totals.otherDepartmentExpense;

  return (
    <div className="bom-report-container">
      {/* Header Banner */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="bom-header-icon-badge rounded-3 d-flex align-items-center justify-content-center flex-shrink-0">
            <WalletCards size={22} />
          </div>
          <div>
            <h2 className="h5 fw-bold mb-0 bom-main-heading">
              Deposit Monitoring
            </h2>
            <p className="small text-secondary mb-0">
              View store bank deposits, petty cash &amp; BIR 2307 deductions, variance reconciliation, and deposit slip attachments.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card border rounded-4 shadow-sm p-4 mb-4 bg-white bom-filter-card">
        <div className="row g-3 align-items-end">
          {/* Store Location */}
          <div className="col-12 col-md-4 col-lg-4">
            <label htmlFor="deposit-store" className="form-label small fw-semibold text-secondary">
              Store / Location
            </label>
            <select
              id="deposit-store"
              className="form-select bom-filter-input"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              disabled={loading}
            >
              {stores.length === 0 && <option value="">Loading active stores...</option>}
              {stores.map((s) => (
                <option key={s.LOCATIONID} value={s.LOCATIONNAME}>
                  {s.LOCATIONNAME} ({s.ORGLOCATIONREF})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="col-12 col-sm-6 col-md-3 col-lg-3">
            <label htmlFor="deposit-date-from" className="form-label small fw-semibold text-secondary">
              Start Date (Business Date)
            </label>
            <input
              id="deposit-date-from"
              type="date"
              className="form-control bom-filter-input"
              value={dateFrom}
              max={todayString()}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* End Date */}
          <div className="col-12 col-sm-6 col-md-3 col-lg-3">
            <label htmlFor="deposit-date-to" className="form-label small fw-semibold text-secondary">
              End Date (Business Date)
            </label>
            <input
              id="deposit-date-to"
              type="date"
              className="form-control bom-filter-input"
              value={dateTo}
              max={todayString()}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Load Button */}
          <div className="col-12 col-md-2 col-lg-2">
            <button
              type="button"
              className="btn btn-oracle-red w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
              onClick={handleGenerateDeposits}
              disabled={loading || !selectedLocation}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Loading...' : 'Load Deposits'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {loadedFilters && (
        <div className="d-flex flex-column gap-4">
          {/* KPI Summary Strip */}
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 p-3 h-100 shadow-sm bg-white">
                <div className="small text-secondary fw-semibold mb-1">Total POS Cash</div>
                <div className="h4 fw-bold mb-0 bom-charcoal-text">
                  ₱{formatMoney(totals.posAmount)}
                </div>
                <div className="small text-secondary mt-1">
                  {filteredRows.length} deposit record(s)
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 p-3 h-100 shadow-sm bg-white">
                <div className="small text-secondary fw-semibold mb-1">Total Deposited Cash</div>
                <div className="h4 fw-bold mb-0 bom-charcoal-text">
                  ₱{formatMoney(totals.depositAmount)}
                </div>
                <div className="small text-secondary mt-1">
                  Actual bank deposit total
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 p-3 h-100 shadow-sm bg-white">
                <div className="small text-secondary fw-semibold mb-1">Total Deductions / Credits</div>
                <div className="h4 fw-bold mb-0 bom-charcoal-text">
                  ₱{formatMoney(totalDeductions)}
                </div>
                <div className="small text-secondary mt-1">
                  Petty Cash, BIR 2307, Open Sales, Other Exp.
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 p-3 h-100 shadow-sm bg-white">
                <div className="small text-secondary fw-semibold mb-1">Total Net Variance</div>
                <div className={`h4 fw-bold mb-0 ${getVarianceClass(totals.variance)}`}>
                  ₱{formatMoney(totals.variance)}
                </div>
                <div className="small text-secondary mt-1">
                  Over / Short deposit reconciliation
                </div>
              </div>
            </div>
          </div>

          {/* Filter Pills & Keyword Search Bar */}
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="bom-uom-badge px-3 py-1">
                Store: <strong>{loadedFilters.locationName}</strong>
              </span>
              <span className="bom-uom-badge px-3 py-1">
                Period: <strong>{loadedFilters.dateFrom}</strong> to{' '}
                <strong>{loadedFilters.dateTo}</strong>
              </span>
              <span className="bom-uom-badge px-3 py-1">
                Records: <strong>{filteredRows.length}</strong>
              </span>
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className="input-group input-group-sm" style={{ width: 280 }}>
                <span className="input-group-text bg-white border-end-0">
                  <Search size={14} className="text-secondary" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Search ID, Ref#, filename, amount..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
                {searchKeyword && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary border-start-0"
                    onClick={() => setSearchKeyword('')}
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Deposit Monitoring Table Card */}
          <div className="card border rounded-4 shadow-sm overflow-hidden bg-white">
            <div className="table-responsive rof-grid-scroll-container">
              <table className="table align-middle mb-0 bom-data-table deposit-monitoring-table">
                <colgroup>
                  <col style={{ width: '118px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '124px' }} />
                  <col style={{ width: '124px' }} />
                  <col style={{ width: '165px' }} />
                  <col style={{ width: '128px' }} />
                  <col style={{ width: '128px' }} />
                  <col style={{ width: '115px' }} />
                  <col style={{ width: '112px' }} />
                  <col style={{ width: '115px' }} />
                  <col style={{ width: '122px' }} />
                  <col style={{ width: '122px' }} />
                  <col style={{ width: '175px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-center">Attachment</th>
                    <th>ID</th>
                    <th>Business Date</th>
                    <th>Deposit Date</th>
                    <th>Deposit Ref#</th>
                    <th className="text-end">POS Amount</th>
                    <th className="text-end">Deposit Amt</th>
                    <th className="text-end">Petty Cash</th>
                    <th className="text-end">BIR 2307</th>
                    <th className="text-end">Open Sales</th>
                    <th className="text-end">Other Expense</th>
                    <th className="text-end">Variance</th>
                    <th>Filename</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-5 text-secondary">
                        No deposit records found for the selected store and date range.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredRows.map((row) => (
                        <tr key={row.depositId}>
                          <td className="text-center text-nowrap">
                            {row.filename ? (
                              <button
                                type="button"
                                className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1"
                                onClick={() => void handleOpenAttachment(row)}
                                title={`View Deposit Slip (${row.filename})`}
                              >
                                <Eye size={14} />
                                <span>View Slip</span>
                              </button>
                            ) : (
                              <span className="small text-secondary">—</span>
                            )}
                          </td>
                          <td className="fw-semibold bom-charcoal-text text-nowrap">
                            #{row.depositId}
                          </td>
                          <td className="text-nowrap fw-medium">
                            {formatDisplayDate(row.businessDate)}
                          </td>
                          <td className="text-nowrap text-secondary">
                            {formatDisplayDate(row.depositDate)}
                          </td>
                          <td className="text-truncate" title={row.depositReference || ''}>
                            {row.depositReference ? (
                              <span className="rof-mod-badge">{row.depositReference}</span>
                            ) : (
                              <span className="text-secondary">—</span>
                            )}
                          </td>
                          <td className="num-cell">₱{formatMoney(row.posAmount)}</td>
                          <td className="num-cell fw-semibold">₱{formatMoney(row.depositAmount)}</td>
                          <td className="num-cell">₱{formatMoney(row.pettyCash)}</td>
                          <td className="num-cell">₱{formatMoney(row.bir2307)}</td>
                          <td className="num-cell">₱{formatMoney(row.openSales)}</td>
                          <td className="num-cell">₱{formatMoney(row.otherDepartmentExpense)}</td>
                          <td className={`num-cell fw-bold ${getVarianceClass(row.variance)}`}>
                            ₱{formatMoney(row.variance)}
                          </td>
                          <td className="rof-remarks-cell" title={row.filename || ''}>
                            {row.filename || '—'}
                          </td>
                        </tr>
                      ))}

                      {/* TOTAL Footer Row */}
                      <tr className="rof-total-row fw-bold">
                        <td colSpan={5} className="bom-charcoal-text">
                          TOTAL
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.posAmount)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.depositAmount)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.pettyCash)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.bir2307)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.openSales)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.otherDepartmentExpense)}
                        </td>
                        <td className={`num-cell fw-bold ${getVarianceClass(totals.variance)}`}>
                          ₱{formatMoney(totals.variance)}
                        </td>
                        <td />
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Initial Placeholder before Loading Deposits */}
      {!loadedFilters && !loading && (
        <div className="system-sales-placeholder mt-2">
          <WalletCards size={40} className="mb-2 bom-charcoal-text" />
          <h5 className="fw-bold bom-main-heading">Ready to Load Deposit Monitoring</h5>
          <p className="text-secondary">
            Select a store location and business date range above, then click{' '}
            <strong>Load Deposits</strong> to inspect deposit history, variances, and bank deposit slip images.
          </p>
        </div>
      )}

      {/* =========================================================
          DEPOSIT SLIP ATTACHMENT VIEWER MODAL
          ========================================================= */}
      {attachmentTarget && (
        <div
          className="rof-drawer-backdrop deposit-modal-backdrop"
          onClick={handleCloseAttachment}
          role="dialog"
          aria-modal="true"
          aria-label="Deposit Slip Attachment Viewer"
        >
          <div
            className="deposit-attachment-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="rof-drawer-header d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                  <span className="bom-uom-badge">{attachmentTarget.locationName}</span>
                  <span className="small text-secondary">•</span>
                  <span className="small fw-semibold text-secondary">
                    Deposit #{attachmentTarget.depositId}
                  </span>
                  <span className="small text-secondary">•</span>
                  <span className="small text-secondary">
                    Business Date: <strong>{formatDisplayDate(attachmentTarget.businessDate)}</strong>
                  </span>
                  {attachmentTarget.depositReference && (
                    <>
                      <span className="small text-secondary">•</span>
                      <span className="rof-mod-badge">Ref: {attachmentTarget.depositReference}</span>
                    </>
                  )}
                </div>
                <h3 className="h5 fw-bold mb-0 bom-main-heading d-flex align-items-center gap-2">
                  <ImageIcon size={19} />
                  <span>Deposit Slip Attachment</span>
                  <span className="small fw-normal text-secondary ms-1">
                    ({attachmentTarget.filename})
                  </span>
                </h3>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div className="rof-section-kpi-strip me-1 d-none d-lg-inline-flex">
                  <div className="rof-kpi-item">
                    <span className="rof-kpi-label">Deposit:</span>
                    <strong className="rof-kpi-value bom-charcoal-text">
                      ₱{formatMoney(attachmentTarget.depositAmount)}
                    </strong>
                  </div>
                  <span className="rof-kpi-divider" aria-hidden="true" />
                  <div className="rof-kpi-item">
                    <span className="rof-kpi-label">Variance:</span>
                    <strong className={`rof-kpi-value ${getVarianceClass(attachmentTarget.variance)}`}>
                      ₱{formatMoney(attachmentTarget.variance)}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn rof-drawer-close-btn"
                  onClick={handleCloseAttachment}
                  disabled={attachmentLoading}
                  aria-label="Close viewer"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Image Canvas */}
            <div className="deposit-attachment-canvas-wrapper">
              <div className="deposit-attachment-canvas">
                {attachmentLoading ? (
                  <div className="d-flex flex-column align-items-center justify-content-center py-5 text-secondary gap-2">
                    <span className="spinner-border text-secondary" role="status" aria-hidden="true" />
                    <span className="fw-medium">Loading deposit slip image from FTP...</span>
                  </div>
                ) : attachmentError ? (
                  <div className="d-flex flex-column align-items-center justify-content-center p-4 text-center">
                    <ImageIcon size={40} className="text-secondary mb-2" />
                    <div className="fw-semibold text-danger mb-1">Unable to Load Attachment</div>
                    <div className="small text-secondary">{attachmentError}</div>
                  </div>
                ) : attachmentPreview ? (
                  <img
                    src={attachmentPreview}
                    alt={attachmentTarget.filename}
                    className="deposit-attachment-img"
                    style={{
                      transform: `scale(${attachmentZoom}) rotate(${attachmentRotation}deg)`,
                    }}
                  />
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center p-4 text-secondary">
                    <ImageIcon size={40} className="mb-2" />
                    <span>No preview available.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer: Zoom / Rotate / Download Controls */}
            <div className="deposit-attachment-footer d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1.5"
                  onClick={() => setAttachmentZoom((z) => Math.max(z - 0.25, 0.5))}
                  disabled={!attachmentPreview || attachmentLoading || attachmentZoom <= 0.5}
                >
                  <ZoomOut size={15} />
                  <span>Zoom Out</span>
                </button>

                <span className="rof-mod-badge px-3 py-1">
                  {Math.round(attachmentZoom * 100)}%
                </span>

                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1.5"
                  onClick={() => setAttachmentZoom((z) => Math.min(z + 0.25, 3))}
                  disabled={!attachmentPreview || attachmentLoading || attachmentZoom >= 3}
                >
                  <ZoomIn size={15} />
                  <span>Zoom In</span>
                </button>

                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1.5"
                  onClick={() => setAttachmentRotation((r) => (r + 90) % 360)}
                  disabled={!attachmentPreview || attachmentLoading}
                >
                  <RotateCw size={15} />
                  <span>Rotate</span>
                </button>

                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn"
                  onClick={() => {
                    setAttachmentZoom(1);
                    setAttachmentRotation(0);
                  }}
                  disabled={
                    !attachmentPreview ||
                    attachmentLoading ||
                    (attachmentZoom === 1 && attachmentRotation === 0)
                  }
                >
                  Reset View
                </button>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn px-3"
                  onClick={handleCloseAttachment}
                  disabled={attachmentLoading}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-oracle-red d-inline-flex align-items-center gap-1.5 px-3 py-1.5 fw-semibold"
                  onClick={handleDownloadAttachment}
                  disabled={!attachmentPreview || attachmentLoading}
                >
                  <Download size={15} />
                  <span>Download Slip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
