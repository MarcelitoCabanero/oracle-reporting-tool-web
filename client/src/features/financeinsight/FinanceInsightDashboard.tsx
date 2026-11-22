import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Store as StoreIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { StoreSearchSelect, type StoreSearchOption } from '../../components/common/StoreSearchSelect';
import { GrowthPanel } from './GrowthPanel';
import {
  BranchBarChart,
  BranchRevenueCenterStackedChart,
  NetSalesAreaChart,
  SalesDistributionPie,
  distributionColor,
  int,
  pctText,
  peso,
} from './charts';
import {
  financeInsightApi,
  type DistributionResponse,
  type GrowthResponse,
  type OverviewResponse,
} from './financeInsightApi';
import { pct } from './growthUtils';

type Preset = 'mtd' | '30d' | 'ytd' | 'custom';

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    };
  });
}

function yearOptions(): string[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2, y - 3].map(String);
}

function computeRange(
  preset: Preset,
  month: string,
  year: string,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  const today = new Date();
  if (preset === 'mtd') {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return { from: fmt(first), to: fmt(last > today ? today : last) };
  }
  if (preset === 'ytd') {
    const y = Number(year);
    const last = new Date(y, 11, 31);
    return { from: fmt(new Date(y, 0, 1)), to: fmt(last > today ? today : last) };
  }
  if (preset === '30d') {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    return { from: fmt(new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() - 29)), to: fmt(yesterday) };
  }
  return { from: customFrom, to: customTo };
}

function Kpi({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta: number | null;
  hint?: string;
}) {
  const tone = delta === null ? 'flat' : delta >= 0 ? 'up' : 'down';
  return (
    <div className="fi-kpi">
      <div className="fi-kpi-label">{label}</div>
      <div className="fi-kpi-value">{value}</div>
      <div className={`fi-delta-value fi-${tone}`}>
        {pctText(delta)} <span className="fi-note">vs previous period</span>
      </div>
      {hint && <div className="fi-note">{hint}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="fi-card">
      <header className="fi-card-head">
        <h6>{title}</h6>
        {subtitle && <span className="fi-note">{subtitle}</span>}
      </header>
      {children}
    </section>
  );
}

function State({ loading, error, empty }: { loading: boolean; error: string | null; empty?: boolean }) {
  if (loading) return <div className="fi-empty">Loading</div>;
  if (error) return <div className="fi-empty fi-error">{error}</div>;
  if (empty) return <div className="fi-empty">No data for the selected filters.</div>;
  return null;
}

export function FinanceInsightDashboard() {
  const { token } = useAuth();
  const months = useMemo(monthOptions, []);
  const years = useMemo(yearOptions, []);
  const [preset, setPreset] = useState<Preset>('30d');
  const [month, setMonth] = useState(months[0].value);
  const [year, setYear] = useState(years[0]);
  const [customFrom, setCustomFrom] = useState(() => computeRange('30d', '', '', '', '').from);
  const [customTo, setCustomTo] = useState(() => computeRange('30d', '', '', '', '').to);
  const { from: dateFrom, to: dateTo } = useMemo(
    () => computeRange(preset, month, year, customFrom, customTo),
    [preset, month, year, customFrom, customTo],
  );
  const [allStores, setAllStores] = useState<StoreSearchOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const selected = useMemo(() => (selectedStore === 'ALL' ? [] : [selectedStore]), [selectedStore]);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [dist, setDist] = useState<DistributionResponse | null>(null);
  const [pieStore, setPieStore] = useState<string>('ALL');
  const [distStackMode, setDistStackMode] = useState<'sales' | 'qty'>('sales');
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);
  const [ovState, setOvState] = useState<{ loading: boolean; error: string | null }>({ loading: true, error: null });
  const [distState, setDistState] = useState<{ loading: boolean; error: string | null }>({ loading: true, error: null });
  const [growthState, setGrowthState] = useState<{ loading: boolean; error: string | null }>({ loading: true, error: null });

  const storeKey = selected.join('|');

  useEffect(() => {
    financeInsightApi.stores(token).then((r) => setAllStores(r.stores)).catch(() => setAllStores([]));
  }, [token]);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    const ctrl = new AbortController();
    setOvState({ loading: true, error: null });
    setDistState({ loading: true, error: null });
    financeInsightApi
      .overview(token, dateFrom, dateTo, selected, ctrl.signal)
      .then((r) => {
        setOverview(r);
        setOvState({ loading: false, error: null });
      })
      .catch((e: Error) => e.name !== 'AbortError' && setOvState({ loading: false, error: e.message }));
    financeInsightApi
      .distribution(token, dateFrom, dateTo, selected, ctrl.signal)
      .then((r) => {
        setDist(r);
        setDistState({ loading: false, error: null });
      })
      .catch((e: Error) => e.name !== 'AbortError' && setDistState({ loading: false, error: e.message }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dateFrom, dateTo, storeKey]);

  useEffect(() => {
    const ctrl = new AbortController();
    setGrowthState({ loading: true, error: null });
    financeInsightApi
      .growth(token, selected, ctrl.signal)
      .then((r) => {
        setGrowth(r);
        setGrowthState({ loading: false, error: null });
      })
      .catch((e: Error) => e.name !== 'AbortError' && setGrowthState({ loading: false, error: e.message }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, storeKey]);

  const pieRows = useMemo(() => {
    if (!dist) return [];
    if (pieStore === 'ALL') return dist.rows;
    const store = dist.byStore.find((s) => s.locationName === pieStore);
    if (!store) return dist.rows;
    return dist.rows.map((rc) => {
      const cell = store.byCenter[rc.revenueCenter] ?? { qty: 0, netSales: 0 };
      return {
        revenueCenter: rc.revenueCenter,
        qty: cell.qty,
        netSales: cell.netSales,
        share: store.netSales > 0 ? (cell.netSales / store.netSales) * 100 : 0,
      };
    });
  }, [dist, pieStore]);

  useEffect(() => {
    setPieStore('ALL');
  }, [storeKey, dateFrom, dateTo]);

  const kpi = useMemo(() => {
    if (!overview) return null;
    const { current: c, previous: p } = overview.kpis;
    const apc = c.guests > 0 ? c.netSales / c.guests : 0;
    const pApc = p.guests > 0 ? p.netSales / p.guests : 0;
    const avgCheck = c.checks > 0 ? c.netSales / c.checks : 0;
    const pAvgCheck = p.checks > 0 ? p.netSales / p.checks : 0;
    return {
      netSales: { v: c.netSales, d: pct(c.netSales, p.netSales) },
      apc: { v: apc, d: pApc > 0 && apc > 0 ? pct(apc, pApc) : null },
      guests: { v: c.guests, d: pct(c.guests, p.guests) },
      avgCheck: { v: avgCheck, d: pAvgCheck > 0 && avgCheck > 0 ? pct(avgCheck, pAvgCheck) : null },
      checks: { v: c.checks, d: pct(c.checks, p.checks) },
    };
  }, [overview]);

  return (
    <div className="system-sales-workspace fi-page">
      <div className="menuitem-header-bar mb-3">
        <div className="d-flex align-items-center gap-3 min-w-0">
          <div className="bom-header-icon-badge d-flex align-items-center justify-content-center rounded-3 flex-shrink-0">
            <BarChart3 size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="h5 fw-bold mb-0 bom-main-heading">Finance Insight</h2>
            <p className="menuitem-subtitle mb-0">
              Sales performance dashboard: net sales (excl. VAT), branch ranking, revenue center mix, APC, and growth.
            </p>
          </div>
        </div>
      </div>

      <div className="menuitem-unified-filter-bar mb-3">
        <div className="menuitem-filter-bar-row">
          <div className="menuitem-filter-group menuitem-filter-store">
            <label htmlFor="fi-store" className="menuitem-filter-label">
              Store / Location
            </label>
            <div className="menuitem-input-with-icon">
              <StoreIcon size={15} className="menuitem-input-left-icon" />
              <StoreSearchSelect
                id="fi-store"
                inputClassName="form-select menuitem-filter-control"
                stores={allStores}
                value={selectedStore}
                onChange={setSelectedStore}
                includeAllOption
                allOptionLabel="ALL STORES"
              />
            </div>
          </div>

          <div className="menuitem-filter-group">
            <label htmlFor="fi-period" className="menuitem-filter-label">
              Period
            </label>
            <select
              id="fi-period"
              className="form-select menuitem-filter-control"
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
            >
              <option value="30d">Last 30 days</option>
              <option value="mtd">MTD (Month)</option>
              <option value="ytd">YTD (Year)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {preset === 'mtd' && (
            <div className="menuitem-filter-group">
              <label htmlFor="fi-month" className="menuitem-filter-label">
                Month
              </label>
              <select
                id="fi-month"
                className="form-select menuitem-filter-control"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {preset === 'ytd' && (
            <div className="menuitem-filter-group">
              <label htmlFor="fi-year" className="menuitem-filter-label">
                Year
              </label>
              <select
                id="fi-year"
                className="form-select menuitem-filter-control"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {preset === 'custom' && (
            <div className="menuitem-filter-group menuitem-filter-dates">
              <label htmlFor="fi-date-from" className="menuitem-filter-label">
                Business Date Range
              </label>
              <div className="menuitem-date-range-capsule">
                <div className="menuitem-date-field">
                  <CalendarDays size={15} className="menuitem-input-left-icon" />
                  <input
                    id="fi-date-from"
                    type="date"
                    className="form-control menuitem-date-input"
                    value={customFrom}
                    max={fmt(new Date())}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    aria-label="Date From"
                  />
                </div>
                <span className="menuitem-date-range-sep">to</span>
                <div className="menuitem-date-field">
                  <CalendarDays size={15} className="menuitem-input-left-icon" />
                  <input
                    id="fi-date-to"
                    type="date"
                    className="form-control menuitem-date-input"
                    value={customTo}
                    max={fmt(new Date())}
                    onChange={(e) => setCustomTo(e.target.value)}
                    aria-label="Date To"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {dateFrom > dateTo && <div className="fi-empty fi-error">Date From cannot be later than Date To.</div>}

      <div className="fi-kpi-row">
        {kpi ? (
          <>
            <Kpi label="Total Net Sales" value={peso(kpi.netSales.v)} delta={kpi.netSales.d} />
            <Kpi label="APC (per guest)" value={peso(kpi.apc.v)} delta={kpi.apc.d} hint={`${int(kpi.guests.v)} total guests`} />
            <Kpi label="Guest Count" value={int(kpi.guests.v)} delta={kpi.guests.d} />
            <Kpi label="Avg per Check" value={peso(kpi.avgCheck.v)} delta={kpi.avgCheck.d} hint={`${int(kpi.checks.v)} valid checks`} />
          </>
        ) : (
          <State loading={ovState.loading} error={ovState.error} />
        )}
      </div>

      <div className="fi-grid">
        <div className="fi-span-2">
          <Card title="Total Net Sales All Branches" subtitle="Daily">
            <State loading={ovState.loading} error={ovState.error} empty={overview?.daily.length === 0} />
            {overview && !ovState.loading && !ovState.error && overview.daily.length > 0 && (
              <NetSalesAreaChart data={overview.daily} />
            )}
          </Card>
        </div>

        <Card title="Net Sales per Branch" subtitle="Highest to lowest">
          <State loading={ovState.loading} error={ovState.error} empty={overview?.byStore.length === 0} />
          {overview && !ovState.loading && !ovState.error && overview.byStore.length > 0 && (
            <div className="fi-scroll">
              <BranchBarChart data={overview.byStore} />
            </div>
          )}
        </Card>

        <Card title="APC per Branch" subtitle="Net sales ÷ guest count">
          <State loading={ovState.loading} error={ovState.error} empty={overview?.byStore.length === 0} />
          {overview && !ovState.loading && !ovState.error && overview.byStore.length > 0 && (
            <div className="fi-scroll">
              <table className="fi-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Net Sales</th>
                    <th>Guests</th>
                    <th>APC</th>
                  </tr>
                </thead>
                <tbody>
                  {[...overview.byStore]
                    .sort((a, b) => b.apc - a.apc)
                    .map((s) => (
                      <tr key={s.locationName}>
                        <td>{s.locationName}</td>
                        <td>{peso(s.netSales)}</td>
                        <td>{int(s.guests)}</td>
                        <td>{s.guests > 0 ? peso(s.apc) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  {(() => {
                    const totSales = overview.byStore.reduce((acc, s) => acc + s.netSales, 0);
                    const totGuests = overview.byStore.reduce((acc, s) => acc + s.guests, 0);
                    const totApc = totGuests > 0 ? totSales / totGuests : 0;
                    return (
                      <tr className="fw-bold">
                        <td>Total ({overview.byStore.length} branches)</td>
                        <td>{peso(totSales)}</td>
                        <td>{int(totGuests)}</td>
                        <td>{totGuests > 0 ? peso(totApc) : '—'}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        <div className="fi-span-2">
          <Card
            title="Sales Distribution by Revenue Center — Per Branch"
            subtitle="Overall mix donut and per-branch stacked channel comparison"
          >
            <State loading={distState.loading} error={distState.error} empty={dist?.rows.length === 0} />
            {dist && !distState.loading && !distState.error && dist.rows.length > 0 && (
              <div className="fi-dist-split">
                <div className="fi-dist-pane">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <span className="fi-note">
                      Donut focus:{' '}
                      <strong style={{ color: 'var(--fi-text)' }}>
                        {pieStore === 'ALL' ? `All Branches (${dist.byStore.length})` : pieStore}
                      </strong>
                    </span>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 'auto', minWidth: 160 }}
                      value={pieStore}
                      onChange={(e) => setPieStore(e.target.value)}
                      aria-label="Filter donut chart by branch"
                    >
                      <option value="ALL">All Branches ({dist.byStore.length})</option>
                      {dist.byStore.map((s) => (
                        <option key={s.locationName} value={s.locationName}>
                          {s.locationName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <SalesDistributionPie data={pieRows} />
                  <div className="fi-table-wrap">
                    <table className="fi-table">
                      <thead>
                        <tr>
                          <th>Revenue Center</th>
                          <th>Qty</th>
                          <th>Net Sales</th>
                          <th>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pieRows.map((r, i) => (
                          <tr key={r.revenueCenter}>
                            <td>
                              <span className="fi-dot" style={{ background: distributionColor(i) }} />
                              {r.revenueCenter}
                            </td>
                            <td>{int(r.qty)}</td>
                            <td>{peso(r.netSales)}</td>
                            <td>{r.share.toFixed(1)}%</td>
                          </tr>
                        ))}
                        <tr className="fw-bold">
                          <td>Total</td>
                          <td>{int(pieRows.reduce((s, r) => s + r.qty, 0))}</td>
                          <td>{peso(pieRows.reduce((s, r) => s + r.netSales, 0))}</td>
                          <td>100.0%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="fi-dist-pane fi-dist-pane-right">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <span className="fi-note">
                      <strong style={{ color: 'var(--fi-text)' }}>Per-Branch Channel Comparison</strong> (Stacked Bar)
                    </span>
                    <div className="menuitem-tab-switcher" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={distStackMode === 'sales'}
                        className={`menuitem-tab-btn ${distStackMode === 'sales' ? 'active' : ''}`}
                        onClick={() => setDistStackMode('sales')}
                      >
                        <span>₱ Net Sales</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={distStackMode === 'qty'}
                        className={`menuitem-tab-btn ${distStackMode === 'qty' ? 'active' : ''}`}
                        onClick={() => setDistStackMode('qty')}
                      >
                        <span>QTY</span>
                      </button>
                    </div>
                  </div>
                  <div className="fi-legend-bar" aria-label="Revenue Center Legend">
                    {dist.rows.map((r, i) => (
                      <span key={r.revenueCenter} className="fi-legend-pill">
                        <span className="fi-legend-swatch" style={{ background: distributionColor(i) }} />
                        <span>{r.revenueCenter}</span>
                      </span>
                    ))}
                  </div>
                  <div className="fi-dist-scroll">
                    <BranchRevenueCenterStackedChart
                      byStore={dist.byStore}
                      centers={dist.rows.map((r) => r.revenueCenter)}
                      mode={distStackMode}
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="fi-span-2">
          <Card title="Business Growth" subtitle="Past 12 completed months vs prior year">
            <State loading={growthState.loading} error={growthState.error} />
            {growth && !growthState.loading && !growthState.error && <GrowthPanel rows={growth.rows} />}
          </Card>
        </div>
      </div>
    </div>
  );
}
