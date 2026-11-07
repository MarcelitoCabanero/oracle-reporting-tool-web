import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Percent,
  Receipt,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  Store as StoreIcon,
  Tag,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { StoreSearchSelect, type StoreSearchOption } from '../../components/common/StoreSearchSelect';
import {
  exportSystemSalesToExcel,
  exportSystemSalesToPdf,
  type SystemSalesData,
} from './systemSalesExportUtils';
import { VoidSummaryReport } from './VoidSummaryReport';

const SYSTEM_SALES_SESSION_KEY = 'oracle-session-system-sales';

interface SystemSalesSavedSession {
  activeTab?: 'summary' | 'void';
  selectedLocation: string;
  dateFrom: string;
  dateTo: string;
  data: SystemSalesData | null;
}

function loadSession(): Partial<SystemSalesSavedSession> {
  try {
    const raw = window.sessionStorage.getItem(SYSTEM_SALES_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Partial<SystemSalesSavedSession>) : {};
  } catch {
    return {};
  }
}

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function isZeroValue(value: number): boolean {
  return Math.abs(Number(value || 0)) < 0.005;
}

export function SystemSalesSummary() {
  const { token } = useAuth();
  const saved = useMemo(() => loadSession(), []);

  // Active Module Tab
  const [activeTab, setActiveTab] = useState<'summary' | 'void'>(
    () => saved.activeTab ?? 'summary'
  );

  // Store options
  const [stores, setStores] = useState<StoreSearchOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    () => saved.selectedLocation ?? ''
  );
  const [dateFrom, setDateFrom] = useState<string>(
    () => saved.dateFrom ?? yesterdayString()
  );
  const [dateTo, setDateTo] = useState<string>(() => saved.dateTo ?? yesterdayString());

  // Report State
  const [reportData, setReportData] = useState<SystemSalesData | null>(
    () => saved.data ?? null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      const payload: SystemSalesSavedSession = {
        activeTab,
        selectedLocation,
        dateFrom,
        dateTo,
        data: reportData,
      };
      window.sessionStorage.setItem(SYSTEM_SALES_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }, [activeTab, selectedLocation, dateFrom, dateTo, reportData]);

  // Fetch active store locations on mount
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetch('/api/reports/system-sales/stores', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load stores');
        return res.json();
      })
      .then((data: { stores?: StoreSearchOption[] }) => {
        if (cancelled) return;
        const list = data.stores ?? [];
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
        if (!cancelled) console.error('Error fetching stores for System Sales:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Generate Report
  const handleGenerate = async () => {
    if (!token || !selectedLocation || !dateFrom || !dateTo) return;

    if (dateFrom > dateTo) {
      setError('Date From cannot be greater than Date To.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `/api/reports/system-sales/summary?locationName=${encodeURIComponent(
        selectedLocation
      )}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Server returned ${res.status}`);
      }

      const data: SystemSalesData = await res.json();
      setReportData(data);
    } catch (err) {
      console.error('Failed to generate System Sales summary:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate System Sales summary report.'
      );
    } finally {
      setLoading(false);
    }
  };

  const summary = reportData?.summary;
  const tenders = reportData?.tenders ?? [];
  const tenderTotalAmount = reportData?.tenderTotalAmount ?? 0;

  return (
    <div className="system-sales-workspace">
      {/* Page Header */}
      <div className="menuitem-header-bar mb-3">
        <div className="d-flex align-items-center gap-3 min-w-0">
          <div className="bom-header-icon-badge d-flex align-items-center justify-content-center rounded-3 flex-shrink-0">
            {activeTab === 'summary' ? <ReceiptText size={20} /> : <XCircle size={20} />}
          </div>
          <div className="min-w-0">
            <h2 className="h5 fw-bold mb-0 bom-main-heading">
              {activeTab === 'summary' ? 'System Sales Summary' : 'Void Summary'}
            </h2>
            <p className="menuitem-subtitle mb-0">
              {activeTab === 'summary'
                ? 'Consolidated daily sales reporting, VAT, discounts, other adjustments, and tender breakdowns.'
                : 'Audits for void transactions, cancellation processing intervals, and item-level cancellations.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="menuitem-tab-switcher" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            className={`menuitem-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <ReceiptText size={15} />
            <span>Sales Summary</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'void'}
            className={`menuitem-tab-btn ${activeTab === 'void' ? 'active' : ''}`}
            onClick={() => setActiveTab('void')}
          >
            <XCircle size={15} />
            <span>Void Summary</span>
          </button>
        </div>
      </div>

      {activeTab === 'void' ? (
        <VoidSummaryReport
          stores={stores}
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
        />
      ) : (
        <>
      {/* Unified Filter Bar */}
      <div className="menuitem-unified-filter-bar mb-3">
        <div className="menuitem-filter-bar-row">
          {/* Store / Location Combobox with Store Code Search */}
          <div className="menuitem-filter-group menuitem-filter-store">
            <label htmlFor="system-sales-store" className="menuitem-filter-label">
              Store / Location
            </label>
            <div className="menuitem-input-with-icon">
              <StoreIcon size={15} className="menuitem-input-left-icon" />
              <StoreSearchSelect
                id="system-sales-store"
                inputClassName="form-select menuitem-filter-control"
                stores={stores}
                value={selectedLocation}
                onChange={setSelectedLocation}
                disabled={loading}
              />
            </div>
          </div>

          {/* Business Date Range */}
          <div className="menuitem-filter-group menuitem-filter-dates">
            <label htmlFor="system-sales-date-from" className="menuitem-filter-label">
              Business Date Range
            </label>
            <div className="menuitem-date-range-capsule">
              <div className="menuitem-date-field">
                <CalendarDays size={15} className="menuitem-input-left-icon" />
                <input
                  id="system-sales-date-from"
                  type="date"
                  className="form-control menuitem-date-input"
                  value={dateFrom}
                  max={todayString()}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={loading}
                  aria-label="Date From"
                />
              </div>
              <span className="menuitem-date-range-sep">to</span>
              <div className="menuitem-date-field">
                <CalendarDays size={15} className="menuitem-input-left-icon" />
                <input
                  id="system-sales-date-to"
                  type="date"
                  className="form-control menuitem-date-input"
                  value={dateTo}
                  max={todayString()}
                  onChange={(e) => setDateTo(e.target.value)}
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
              onClick={handleGenerate}
              disabled={loading || !selectedLocation || !dateFrom || !dateTo}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Generating...' : 'Generate Summary'}</span>
            </button>

            {reportData && (
              <div className="d-inline-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn rof-export-btn rof-export-btn-excel btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                  style={{ height: '38px', borderRadius: '8px' }}
                  onClick={() => exportSystemSalesToExcel(reportData)}
                  title="Download System Sales Workbook (.xlsx)"
                >
                  <FileSpreadsheet size={15} />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  className="btn rof-export-btn rof-export-btn-pdf btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                  style={{ height: '38px', borderRadius: '8px' }}
                  onClick={() => exportSystemSalesToPdf(reportData)}
                  title="Download Printable PDF"
                >
                  <FileText size={15} />
                  <span>PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3 d-flex align-items-center gap-2" role="alert">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {reportData && summary ? (
        <div className="d-flex flex-column gap-3">
          {/* Metadata Toolbar Bar */}
          <div className="menuitem-toolbar-bar">
            <div className="menuitem-toolbar-meta">
              <span className="menuitem-meta-pill">
                Store: <strong>{reportData.locationName}</strong>
              </span>
              <span className="menuitem-meta-pill">
                Period: <strong>{reportData.dateFrom}</strong> to <strong>{reportData.dateTo}</strong>
              </span>
              <span className="menuitem-meta-pill">
                Active Days: <strong>{summary.daysCount}</strong>
              </span>
              <span className="menuitem-meta-pill">
                Guest Count: <strong>{formatInt(summary.numGuest)}</strong>
              </span>
            </div>
          </div>

          {/* 1. Key Figures Overview (4 Flat High-Contrast KPI Cards) */}
          <div className="row g-3">
            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Net Sales</span>
                  <TrendingUp size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">₱{formatMoney(summary.netSales)}</div>
                <div className="menuitem-kpi-subtext">Total net sales across active period</div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Gross Sales</span>
                  <ShoppingBag size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">₱{formatMoney(summary.grossSales)}</div>
                <div className="menuitem-kpi-subtext">Sales before discounts &amp; VAT deductions</div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Tax Collected</span>
                  <Percent size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">₱{formatMoney(summary.taxCollected)}</div>
                <div className="menuitem-kpi-subtext">Collected Output VAT (12%)</div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Total Revenue</span>
                  <Receipt size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">
                  ₱{formatMoney(summary.totalRevenue ?? (summary.netSales + summary.taxCollected))}
                </div>
                <div className="menuitem-kpi-subtext">
                  Net Sales + Output VAT (12%)
                </div>
              </div>
            </div>
          </div>

          {/* 2. Three Report Breakdown Columns */}
          <div className="menuitem-flat-panel p-3 p-md-4">
            <div className="pb-2 mb-3 border-bottom">
              <h3 className="h6 fw-bold mb-0 bom-main-heading">Report Breakdown</h3>
              <p className="menuitem-chart-subtext mb-0 mt-1">
                Sales classification, discounts, and transaction adjustments from daily sales records.
              </p>
            </div>

            <div className="system-sales-breakdown">
              {/* Column 1: VAT Breakdown */}
              <div className="system-sales-breakdown-column">
                <div className="system-sales-breakdown-title system-sales-accent-info d-flex align-items-center gap-2">
                  <Percent size={15} />
                  <span>VAT Breakdown</span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Vatable Sales</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.vatableSales) ? 'menuitem-cell-zero' : ''}`}>
                    ₱{formatMoney(summary.vatableSales)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">VAT Exempt Sales</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.vatExemptSales) ? 'menuitem-cell-zero' : ''}`}>
                    ₱{formatMoney(summary.vatExemptSales)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Zero Rated Sales</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.vatZeroRatedSales) ? 'menuitem-cell-zero' : ''}`}>
                    ₱{formatMoney(summary.vatZeroRatedSales)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Tax Collected</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.taxCollected) ? 'menuitem-cell-zero' : ''}`}>
                    ₱{formatMoney(summary.taxCollected)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Less VAT</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.lessVat) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.lessVat)}
                  </span>
                </div>
              </div>

              {/* Column 2: Discounts */}
              <div className="system-sales-breakdown-column">
                <div className="system-sales-breakdown-title system-sales-accent-danger d-flex align-items-center gap-2">
                  <Tag size={15} />
                  <span>Discounts</span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Senior Citizen</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.seniorCitizen) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.seniorCitizen)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">PWD</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.pwd) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.pwd)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Employee</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.employee) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.employee)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">National Athlete</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.nationalAthlete) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.nationalAthlete)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Solo Parent</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.soloParent) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.soloParent)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Other Discount</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.otherDiscount) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.otherDiscount)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row pt-2 fw-bold" style={{ borderTop: '1px solid #E5E7EB' }}>
                  <span className="system-sales-breakdown-label fw-bold">Total Discounts</span>
                  <span className={`system-sales-breakdown-value fw-bold ${isZeroValue(summary.totalDiscount) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.totalDiscount)}
                  </span>
                </div>
              </div>

              {/* Column 3: Other Sales & Adjustments */}
              <div className="system-sales-breakdown-column">
                <div className="system-sales-breakdown-title system-sales-accent-warning d-flex align-items-center gap-2">
                  <SlidersHorizontal size={15} />
                  <span>Other Sales &amp; Adjustments</span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">GC Sales</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.gcSales) ? 'menuitem-cell-zero' : 'system-sales-value-positive'}`}>
                    ₱{formatMoney(summary.gcSales)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">GC Excess</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.gcExcess) ? 'menuitem-cell-zero' : 'system-sales-value-positive'}`}>
                    ₱{formatMoney(summary.gcExcess)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Void Amount</span>
                  <span className={`system-sales-breakdown-value ${isZeroValue(summary.voidAmount) ? 'menuitem-cell-zero' : 'system-sales-value-negative'}`}>
                    ₱{formatMoney(summary.voidAmount)}
                  </span>
                </div>

                <div className="system-sales-breakdown-row">
                  <span className="system-sales-breakdown-label">Void Count</span>
                  <span className={`system-sales-breakdown-value ${summary.voidCount === 0 ? 'menuitem-cell-zero' : ''}`}>
                    {formatInt(summary.voidCount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Tender Breakdown Card */}
          <div className="menuitem-table-card">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center gap-2">
                <CreditCard size={18} className="bom-charcoal-text" />
                <div>
                  <h3 className="h6 fw-bold mb-0 bom-main-heading">Tender Breakdown</h3>
                  <span className="menuitem-chart-subtext">
                    Payment methods and settlement breakdown recorded for the selected period
                  </span>
                </div>
              </div>
              <span className="system-sales-count-badge">
                {tenders.length} payment method{tenders.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="table-responsive rof-grid-scroll-container menuitem-pivot-scroll-container">
              <table className="table align-middle mb-0 bom-data-table menuitem-summary-table">
                <thead>
                  <tr>
                    <th>TENDER NAME</th>
                    <th className="text-end" style={{ width: '220px' }}>AMOUNT (₱)</th>
                    <th className="text-end" style={{ width: '180px' }}>% SHARE</th>
                  </tr>
                </thead>
                <tbody>
                  {tenders.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-5 menuitem-empty-state">
                        No tender records found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {tenders.map((t) => {
                        const share = t.sharePct != null ? t.sharePct : 0;
                        return (
                          <tr key={t.tenderName}>
                            <td className="fw-semibold bom-charcoal-text">
                              <span className="d-inline-flex align-items-center gap-2">
                                <span className="menuitem-code-badge">{t.tenderName}</span>
                              </span>
                            </td>
                            <td className="num-cell fw-bold bom-charcoal-text">
                              ₱{formatMoney(t.amount)}
                            </td>
                            <td className="num-cell">
                              <div className="d-flex align-items-center justify-content-end gap-2">
                                <div className="menuitem-progress-track" style={{ width: '70px' }}>
                                  <div
                                    className="menuitem-progress-fill"
                                    style={{ width: `${Math.max(share, 2)}%` }}
                                  />
                                </div>
                                <span className="menuitem-secondary-cell fw-semibold" style={{ minWidth: '45px' }}>
                                  {share.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Sticky TOTAL Footer Row */}
                      <tr className="rof-total-row fw-bold">
                        <td className="bom-charcoal-text">TOTAL TENDERS</td>
                        <td className="num-cell bom-charcoal-text">₱{formatMoney(tenderTotalAmount)}</td>
                        <td className="num-cell bom-charcoal-text">100.00%</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="system-sales-placeholder mt-2">
            <ReceiptText size={38} className="mb-2 bom-charcoal-text" />
            <h5 className="fw-bold bom-main-heading">Ready to Generate System Sales Summary</h5>
            <p className="menuitem-placeholder-copy">
              Select a store location and business date range above, then click{' '}
              <strong>Generate Summary</strong> to view the Sales Overview, VAT breakdown, discounts, other adjustments, and tender distributions.
            </p>
          </div>
        )
      )}
        </>
      )}
    </div>
  );
}
