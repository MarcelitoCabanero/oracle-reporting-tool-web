import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Award,
  BarChart3,
  CalendarDays,
  Eye,
  FileSpreadsheet,
  FileText,
  Info,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  StoreSearchSelect,
  type StoreSearchOption,
} from '../../components/common/StoreSearchSelect';
import {
  exportPromotionsToExcel,
  exportPromotionsToPdf,
  type ConsolidatedPromoRow,
  type PromotionCatalogItem,
  type PromotionCheckDetailsResponse,
  type PromotionDailyTrendRow,
  type PromotionFilterMeta,
  type PromotionSummaryRow,
  type StorePromoPerformanceRow,
} from './promotionsExportUtils';

type PromotionsTab = 'monitoring' | 'analytics';
type GroupMode = 'store-item' | 'consolidated';
type TrendGranularity = 'daily' | 'monthly';
type ChartMetricMode = 'amt' | 'qty';
type TrendSortOrder = 'chronological' | 'desc' | 'asc';

const PROMOTIONS_SESSION_KEY = 'oracle-session-promotions';

interface PromotionsSavedSession {
  activeTab: PromotionsTab;
  selectedLocation: string;
  selectedCatalogPromo: string; // 'ALL' or itemNumber from dts_object
  dateFrom: string;
  dateTo: string;
  rows: PromotionSummaryRow[];
  dailyTrend: PromotionDailyTrendRow[];
  loadedFilters: PromotionFilterMeta | null;
  groupMode: GroupMode;
  selectedPromoItem: string;
  selectedStoreFilter: string;
  searchQuery: string;
  trendGranularity: TrendGranularity;
  trendMetric: ChartMetricMode;
  trendSortOrder: TrendSortOrder;
  topPromoMetric: ChartMetricMode;
  storeRankMetric: ChartMetricMode;
  storeChartSortOrder?: 'desc' | 'asc' | 'alpha';
}

function loadPromotionsSession(): Partial<PromotionsSavedSession> {
  try {
    const raw = window.sessionStorage.getItem(PROMOTIONS_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PromotionsSavedSession>;
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

function formatQty(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.length === 7) {
    const [y, m] = dateStr.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
  }
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.length === 7) {
    const [y, m] = dateStr.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  }
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "PH002-MOA" -> "MOA" */
function getShortStoreLabel(locationName: string): string {
  const idx = locationName.lastIndexOf('-');
  return idx >= 0 ? locationName.slice(idx + 1).trim() : locationName.trim();
}

function isZeroValue(value: number): boolean {
  return Math.abs(Number(value || 0)) < 0.005;
}

function computeNiceAxisScale(maxVal: number): { axisMax: number; ticks: number[] } {
  if (!Number.isFinite(maxVal) || maxVal <= 0) {
    return { axisMax: 100, ticks: [100, 75, 50, 25, 0] };
  }
  const roughStep = maxVal / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceMultipliers = [1, 1.25, 1.5, 2, 2.5, 5, 10];
  const chosenMultiplier = niceMultipliers.find((m) => m >= normalized) ?? 10;
  const step = chosenMultiplier * magnitude;
  const axisMax = step * 4;
  return {
    axisMax,
    ticks: [step * 4, step * 3, step * 2, step, 0],
  };
}

function formatAxisTick(value: number, metric: ChartMetricMode): string {
  if (value === 0) return metric === 'amt' ? '₱0' : '0';
  const abs = Math.abs(value);
  const prefix = metric === 'amt' ? '₱' : '';
  if (abs >= 1_000_000) {
    const m = value / 1_000_000;
    return `${prefix}${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = value / 1_000;
    return `${prefix}${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${prefix}${Math.round(value).toLocaleString('en-PH')}`;
}

export function PromotionsReport() {
  const { token } = useAuth();
  const savedSession = useMemo(() => loadPromotionsSession(), []);

  // View Tab (Performance Analysis first, Promo Details second)
  const [activeTab, setActiveTab] = useState<PromotionsTab>(
    () => savedSession.activeTab ?? 'analytics'
  );

  // Store list, Promo catalog (from dts_object WHERE majorgroup = 'Promotion'), and primary filters
  const [stores, setStores] = useState<StoreSearchOption[]>([]);
  const [promoCatalog, setPromoCatalog] = useState<PromotionCatalogItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    () => savedSession.selectedLocation ?? 'ALL'
  );
  const [selectedCatalogPromo, setSelectedCatalogPromo] = useState<string>(
    () => savedSession.selectedCatalogPromo ?? 'ALL'
  );
  const [dateFrom, setDateFrom] = useState<string>(
    () => savedSession.dateFrom ?? yesterdayString()
  );
  const [dateTo, setDateTo] = useState<string>(
    () => savedSession.dateTo ?? yesterdayString()
  );

  // Report state
  const [rows, setRows] = useState<PromotionSummaryRow[]>(() => savedSession.rows ?? []);
  const [dailyTrend, setDailyTrend] = useState<PromotionDailyTrendRow[]>(
    () => savedSession.dailyTrend ?? []
  );
  const [loadedFilters, setLoadedFilters] = useState<PromotionFilterMeta | null>(
    () => savedSession.loadedFilters ?? null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Secondary table & grouping filters
  const [groupMode, setGroupMode] = useState<GroupMode>(
    () => savedSession.groupMode ?? 'store-item'
  );
  const [selectedPromoItem, setSelectedPromoItem] = useState<string>(
    () => savedSession.selectedPromoItem ?? ''
  );
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>(
    () => savedSession.selectedStoreFilter ?? ''
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => savedSession.searchQuery ?? ''
  );

  // Analytics chart controls
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>(
    () => savedSession.trendGranularity ?? 'daily'
  );
  const [trendMetric, setTrendMetric] = useState<ChartMetricMode>(
    () => savedSession.trendMetric ?? 'amt'
  );
  const [trendSortOrder, setTrendSortOrder] = useState<TrendSortOrder>(
    () => savedSession.trendSortOrder ?? 'chronological'
  );
  const [topPromoMetric, setTopPromoMetric] = useState<ChartMetricMode>(
    () => savedSession.topPromoMetric ?? 'amt'
  );
  const [storeRankMetric, setStoreRankMetric] = useState<ChartMetricMode>(
    () => savedSession.storeRankMetric ?? 'amt'
  );
  const [storeChartSortOrder, setStoreChartSortOrder] = useState<'desc' | 'asc' | 'alpha'>(
    () => savedSession.storeChartSortOrder ?? 'desc'
  );
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [hoveredStoreIndex, setHoveredStoreIndex] = useState<number | null>(null);
  const [showChartInfo, setShowChartInfo] = useState<boolean>(false);

  // Drill-down state (Items Used in Promo)
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);
  const [activeDrilldown, setActiveDrilldown] =
    useState<PromotionCheckDetailsResponse | null>(null);
  const [drilldownMajorGroup, setDrilldownMajorGroup] = useState<string>('');
  const [drilldownRoleFilter, setDrilldownRoleFilter] = useState<
    'all' | 'target' | 'zero-price' | 'co-sold'
  >('all');
  const drilldownPanelRef = useRef<HTMLDivElement>(null);

  // Persist session state
  useEffect(() => {
    try {
      const payload: PromotionsSavedSession = {
        activeTab,
        selectedLocation,
        selectedCatalogPromo,
        dateFrom,
        dateTo,
        rows,
        dailyTrend,
        loadedFilters,
        groupMode,
        selectedPromoItem,
        selectedStoreFilter,
        searchQuery,
        trendGranularity,
        trendMetric,
        trendSortOrder,
        topPromoMetric,
        storeRankMetric,
        storeChartSortOrder,
      };
      window.sessionStorage.setItem(PROMOTIONS_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    activeTab,
    selectedLocation,
    selectedCatalogPromo,
    dateFrom,
    dateTo,
    rows,
    dailyTrend,
    loadedFilters,
    groupMode,
    selectedPromoItem,
    selectedStoreFilter,
    searchQuery,
    trendGranularity,
    trendMetric,
    trendSortOrder,
    topPromoMetric,
    storeRankMetric,
    storeChartSortOrder,
  ]);

  // Fetch active physical stores AND promotion catalog from dts_object on mount
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    Promise.all([
      fetch('/api/reports/promotions/stores', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => (res.ok ? res.json() : { stores: [] })),
      fetch('/api/reports/promotions/catalog', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => (res.ok ? res.json() : { promotions: [] })),
    ])
      .then(([storesData, catalogData]) => {
        if (cancelled) return;
        const storeList: StoreSearchOption[] = storesData.stores ?? [];
        const promoList: PromotionCatalogItem[] = catalogData.promotions ?? [];
        setStores(storeList);
        setPromoCatalog(promoList);

        setSelectedLocation((current) => {
          if (!current || current === 'ALL') return 'ALL';
          if (storeList.some((s) => s.LOCATIONNAME === current)) return current;
          return 'ALL';
        });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error fetching Promotions stores/catalog:', err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Find selected catalog item metadata
  const selectedCatalogPromoMeta = useMemo(() => {
    if (!selectedCatalogPromo || selectedCatalogPromo === 'ALL') return null;
    return promoCatalog.find((p) => p.itemNumber === selectedCatalogPromo) ?? null;
  }, [promoCatalog, selectedCatalogPromo]);

  // Generate Promotions Summary Report
  async function handleGenerateReport() {
    if (!selectedLocation) {
      setError('Please select a Store / Location (or ALL STORES).');
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
    setActiveDrilldown(null);
    setDrilldownError(null);

    const filterItemNum =
      selectedCatalogPromo && selectedCatalogPromo !== 'ALL' ? selectedCatalogPromo : '';
    const filterPromoName = selectedCatalogPromoMeta?.itemName ?? '';

    try {
      const res = await fetch('/api/reports/promotions/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locationName: selectedLocation,
          dateFrom,
          dateTo,
          itemNumber: filterItemNum || undefined,
          promoName: filterPromoName || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate Promotion Monitoring report.');
      }

      const loadedTrend: PromotionDailyTrendRow[] = data.dailyTrend ?? [];
      setRows(data.rows ?? []);
      setDailyTrend(loadedTrend);
      setSelectedPromoItem('');
      setSelectedStoreFilter('');
      setSearchQuery('');
      setTrendGranularity(loadedTrend.length > 45 ? 'monthly' : 'daily');
      setLoadedFilters({
        locationName: selectedLocation,
        dateFrom,
        dateTo,
        itemNumber: filterItemNum || null,
        promoName: filterPromoName || null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Drill-down: Inspect items used in a particular promotion on the same guest check
  async function handleInspectPromoDetails(params: {
    itemNumber: string;
    itemName: string;
    locationName?: string;
  }) {
    if (!loadedFilters) return;

    const targetStore =
      params.locationName && params.locationName !== 'ALL'
        ? params.locationName
        : selectedStoreFilter || loadedFilters.locationName;

    setDrilldownLoading(true);
    setDrilldownError(null);
    setDrilldownMajorGroup('');
    setDrilldownRoleFilter('all');

    try {
      const res = await fetch('/api/reports/promotions/check-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locationName: targetStore,
          itemNumber: params.itemNumber,
          itemName: params.itemName,
          dateFrom: loadedFilters.dateFrom,
          dateTo: loadedFilters.dateTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load promotion check details.');
      }

      setActiveDrilldown(data as PromotionCheckDetailsResponse);

      requestAnimationFrame(() => {
        drilldownPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (err) {
      setDrilldownError((err as Error).message);
    } finally {
      setDrilldownLoading(false);
    }
  }

  // ============================================================================
  // COMPUTED DATA: FILTERS, CONSOLIDATED PROMOS, STORE PERFORMANCE & CHARTS
  // ============================================================================

  // Distinct promotions list from loaded rows for quick table sub-filtering
  const availablePromosInResult = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.itemNumber && !map.has(r.itemNumber)) {
        map.set(r.itemNumber, r.itemName);
      }
    }
    return Array.from(map.entries())
      .map(([itemNumber, itemName]) => ({ itemNumber, itemName }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [rows]);

  // Distinct stores present in the loaded dataset
  const availableStoreNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.locationName) set.add(r.locationName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Filtered Store + Item rows
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedPromoItem && r.itemNumber !== selectedPromoItem) return false;
      if (selectedStoreFilter && r.locationName !== selectedStoreFilter) return false;
      if (
        q &&
        !r.locationName.toLowerCase().includes(q) &&
        !r.itemNumber.toLowerCase().includes(q) &&
        !r.itemName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, selectedPromoItem, selectedStoreFilter, searchQuery]);

  // Consolidated by Promotion Item across stores
  const consolidatedPromos = useMemo<ConsolidatedPromoRow[]>(() => {
    const map = new Map<
      string,
      {
        itemNumber: string;
        itemName: string;
        familyGroup: string;
        stores: Set<string>;
        checkCount: number;
        qty: number;
        amt: number;
        netSales: number;
      }
    >();

    for (const r of filteredRows) {
      const key = `${r.itemNumber}||${r.itemName}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          itemNumber: r.itemNumber,
          itemName: r.itemName,
          familyGroup: r.familyGroup,
          stores: new Set<string>(),
          checkCount: 0,
          qty: 0,
          amt: 0,
          netSales: 0,
        };
        map.set(key, entry);
      }
      if (r.locationName) entry.stores.add(r.locationName);
      entry.checkCount += r.checkCount;
      entry.qty += r.qty;
      entry.amt += r.amt;
      entry.netSales += r.netSales;
    }

    return Array.from(map.values())
      .map((e) => ({
        itemNumber: e.itemNumber,
        itemName: e.itemName,
        familyGroup: e.familyGroup,
        storeCount: e.stores.size,
        checkCount: e.checkCount,
        qty: e.qty,
        amt: e.amt,
        netSales: e.netSales,
      }))
      .sort((a, b) => b.amt - a.amt || b.qty - a.qty);
  }, [filteredRows]);

  // Store Performance Ranking (computed across rows matching promo/search filters)
  const storePerformance = useMemo<StorePromoPerformanceRow[]>(() => {
    const map = new Map<
      string,
      {
        locationName: string;
        promos: Set<string>;
        checkCount: number;
        qty: number;
        amt: number;
        netSales: number;
        topPromoName: string;
        topPromoAmt: number;
      }
    >();

    for (const r of filteredRows) {
      const loc = r.locationName || 'Unknown Store';
      let entry = map.get(loc);
      if (!entry) {
        entry = {
          locationName: loc,
          promos: new Set<string>(),
          checkCount: 0,
          qty: 0,
          amt: 0,
          netSales: 0,
          topPromoName: r.itemName,
          topPromoAmt: r.amt,
        };
        map.set(loc, entry);
      }
      entry.promos.add(r.itemNumber);
      entry.checkCount += r.checkCount;
      entry.qty += r.qty;
      entry.amt += r.amt;
      entry.netSales += r.netSales;
      if (r.amt > entry.topPromoAmt) {
        entry.topPromoAmt = r.amt;
        entry.topPromoName = r.itemName;
      }
    }

    return Array.from(map.values())
      .map((s) => ({
        locationName: s.locationName,
        promoItemCount: s.promos.size,
        checkCount: s.checkCount,
        qty: s.qty,
        amt: s.amt,
        netSales: s.netSales,
        topPromoName: s.topPromoName,
        topPromoAmt: s.topPromoAmt,
      }))
      .sort((a, b) =>
        storeRankMetric === 'amt' ? b.amt - a.amt || b.qty - a.qty : b.qty - a.qty || b.amt - a.amt
      );
  }, [filteredRows, storeRankMetric]);

  // Sorted Store Series for the "Graph per Store" vertical bar chart (when All Stores is active)
  const storeChartSeries = useMemo(() => {
    // Build from rows without `selectedStoreFilter` so all stores remain visible on the Per-Store chart
    const map = new Map<
      string,
      {
        locationName: string;
        shortLabel: string;
        promoItemCount: number;
        promos: Set<string>;
        checkCount: number;
        qty: number;
        amt: number;
        topPromoName: string;
        topPromoAmt: number;
      }
    >();

    const q = searchQuery.trim().toLowerCase();
    for (const r of rows) {
      if (selectedPromoItem && r.itemNumber !== selectedPromoItem) continue;
      if (
        q &&
        !r.locationName.toLowerCase().includes(q) &&
        !r.itemNumber.toLowerCase().includes(q) &&
        !r.itemName.toLowerCase().includes(q)
      ) {
        continue;
      }

      const loc = r.locationName || 'Unknown Store';
      let entry = map.get(loc);
      if (!entry) {
        entry = {
          locationName: loc,
          shortLabel: getShortStoreLabel(loc),
          promoItemCount: 0,
          promos: new Set<string>(),
          checkCount: 0,
          qty: 0,
          amt: 0,
          topPromoName: r.itemName,
          topPromoAmt: r.amt,
        };
        map.set(loc, entry);
      }
      entry.promos.add(r.itemNumber);
      entry.promoItemCount = entry.promos.size;
      entry.checkCount += r.checkCount;
      entry.qty += r.qty;
      entry.amt += r.amt;
      if (r.amt > entry.topPromoAmt) {
        entry.topPromoAmt = r.amt;
        entry.topPromoName = r.itemName;
      }
    }

    const list = Array.from(map.values());
    if (storeChartSortOrder === 'alpha') {
      return list.sort((a, b) => a.locationName.localeCompare(b.locationName));
    }
    return list.sort((a, b) => {
      const valA = storeRankMetric === 'amt' ? a.amt : a.qty;
      const valB = storeRankMetric === 'amt' ? b.amt : b.qty;
      return storeChartSortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [rows, selectedPromoItem, searchQuery, storeRankMetric, storeChartSortOrder]);

  const storeChartStats = useMemo(() => {
    if (storeChartSeries.length === 0) {
      return {
        maxVal: 0,
        avgVal: 0,
        topStoreLabel: '—',
        topStoreKey: '',
        topStoreVal: 0,
        axisMax: 100,
        ticks: [100, 75, 50, 25, 0],
      };
    }
    let maxVal = 0;
    let sumVal = 0;
    let topStoreLabel = '';
    let topStoreKey = '';
    for (const st of storeChartSeries) {
      const val = storeRankMetric === 'amt' ? st.amt : st.qty;
      sumVal += val;
      if (val >= maxVal) {
        maxVal = val;
        topStoreLabel = st.locationName;
        topStoreKey = st.locationName;
      }
    }
    const { axisMax, ticks } = computeNiceAxisScale(maxVal);
    return {
      maxVal,
      avgVal: sumVal / storeChartSeries.length,
      topStoreLabel,
      topStoreKey,
      topStoreVal: maxVal,
      axisMax,
      ticks,
    };
  }, [storeChartSeries, storeRankMetric]);

  // Visible KPI Totals
  const visibleTotals = useMemo(() => {
    const storeSet = new Set<string>();
    const promoSet = new Set<string>();
    let qty = 0;
    let amt = 0;
    let netSales = 0;
    let checkCount = 0;

    for (const r of filteredRows) {
      if (r.locationName) storeSet.add(r.locationName);
      if (r.itemNumber) promoSet.add(r.itemNumber);
      qty += r.qty;
      amt += r.amt;
      netSales += r.netSales;
      checkCount += r.checkCount;
    }

    return {
      qty,
      amt,
      netSales,
      checkCount,
      storeCount: storeSet.size,
      promoCount: promoSet.size,
    };
  }, [filteredRows]);

  // Top 10 Promotions for Ranking Chart
  const top10Promos = useMemo(() => {
    return [...consolidatedPromos]
      .sort((a, b) =>
        topPromoMetric === 'amt' ? b.amt - a.amt || b.qty - a.qty : b.qty - a.qty || b.amt - a.amt
      )
      .slice(0, 10);
  }, [consolidatedPromos, topPromoMetric]);

  // Trend Series (Daily or Monthly)
  const trendSeries = useMemo(() => {
    let baseSeries: Array<{
      periodKey: string;
      shortLabel: string;
      fullLabel: string;
      qty: number;
      amt: number;
      checkCount: number;
    }>;

    if (trendGranularity === 'daily') {
      baseSeries = dailyTrend.map((d) => ({
        periodKey: d.businessDate,
        shortLabel: formatShortDate(d.businessDate),
        fullLabel: formatFullDate(d.businessDate),
        qty: d.qty,
        amt: d.amt,
        checkCount: d.checkCount,
      }));
    } else {
      const monthMap = new Map<
        string,
        { qty: number; amt: number; checkCount: number }
      >();
      for (const d of dailyTrend) {
        const monthKey = d.businessDate.slice(0, 7);
        const curr = monthMap.get(monthKey) ?? { qty: 0, amt: 0, checkCount: 0 };
        curr.qty += d.qty;
        curr.amt += d.amt;
        curr.checkCount += d.checkCount;
        monthMap.set(monthKey, curr);
      }

      baseSeries = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, m]) => ({
          periodKey: monthKey,
          shortLabel: formatShortDate(monthKey),
          fullLabel: formatFullDate(monthKey),
          ...m,
        }));
    }

    if (trendSortOrder === 'chronological') {
      return baseSeries;
    }

    return [...baseSeries].sort((a, b) => {
      const valA = trendMetric === 'amt' ? a.amt : a.qty;
      const valB = trendMetric === 'amt' ? b.amt : b.qty;
      return trendSortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [dailyTrend, trendGranularity, trendSortOrder, trendMetric]);

  const trendStats = useMemo(() => {
    if (trendSeries.length === 0) {
      return {
        maxVal: 0,
        avgVal: 0,
        peakLabel: '—',
        peakKey: '',
        peakVal: 0,
        axisMax: 100,
        ticks: [100, 75, 50, 25, 0],
      };
    }
    let maxVal = 0;
    let sumVal = 0;
    let peakLabel = '';
    let peakKey = '';
    for (const pt of trendSeries) {
      const val = trendMetric === 'amt' ? pt.amt : pt.qty;
      sumVal += val;
      if (val >= maxVal) {
        maxVal = val;
        peakLabel = pt.fullLabel;
        peakKey = pt.periodKey;
      }
    }
    const { axisMax, ticks } = computeNiceAxisScale(maxVal);
    return {
      maxVal,
      avgVal: sumVal / trendSeries.length,
      peakLabel,
      peakKey,
      peakVal: maxVal,
      axisMax,
      ticks,
    };
  }, [trendSeries, trendMetric]);

  // Distinct Major Groups available in the active drill-down's paired items
  const availableDrilldownMajorGroups = useMemo(() => {
    if (!activeDrilldown) return [];
    const countMap = new Map<string, number>();
    for (const item of activeDrilldown.pairedItems) {
      const mg = item.majorGroup || 'Uncategorized';
      countMap.set(mg, (countMap.get(mg) ?? 0) + 1);
    }
    return Array.from(countMap.entries())
      .map(([majorGroup, count]) => ({ majorGroup, count }))
      .sort((a, b) => a.majorGroup.localeCompare(b.majorGroup));
  }, [activeDrilldown]);

  // Filtered drill-down paired items (Target Promotion, Bundled / Zero-Price Item, and Co-Sold; filtered by Major Group & Role)
  const filteredPairedItems = useMemo(() => {
    if (!activeDrilldown) return [];
    return activeDrilldown.pairedItems.filter((item) => {
      if (drilldownMajorGroup && item.majorGroup !== drilldownMajorGroup) {
        return false;
      }
      if (drilldownRoleFilter === 'target' && !item.isSelectedPromo) {
        return false;
      }
      if (drilldownRoleFilter === 'zero-price' && !item.isZeroPriceBundleItem) {
        return false;
      }
      if (
        drilldownRoleFilter === 'co-sold' &&
        (item.isSelectedPromo || item.isZeroPriceBundleItem)
      ) {
        return false;
      }
      return true;
    });
  }, [activeDrilldown, drilldownMajorGroup, drilldownRoleFilter]);

  const topPromoOverall = consolidatedPromos[0] ?? null;
  const isAllStoresLoaded = loadedFilters?.locationName === 'ALL';

  return (
    <div className="system-sales-workspace menuitem-workspace">
      {/* Workspace Header & Tab Switcher */}
      <div className="menuitem-header-bar mb-3">
        <div className="d-flex align-items-center gap-3 min-w-0">
          <div className="bom-header-icon-badge d-flex align-items-center justify-content-center rounded-3 flex-shrink-0">
            <Tag size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="h5 fw-bold mb-0 bom-main-heading">
              Promotion Monitoring &amp; Performance Analytics
            </h2>
            <p className="menuitem-subtitle mb-0">
              Monitor all promotional sales across stores, inspect bundled receipt items, and analyze per-store performance.
            </p>
          </div>
        </div>

        {/* View Mode Tabs: (Performance Analysis, Promo Details) */}
        <div className="menuitem-tab-switcher flex-shrink-0" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'analytics'}
            className={`menuitem-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={15} />
            <span>Performance Analysis</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'monitoring'}
            className={`menuitem-tab-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('monitoring')}
          >
            <Tag size={15} />
            <span>Promo Details</span>
          </button>
        </div>
      </div>

      {/* Unified Filter Bar */}
      <div className="menuitem-unified-filter-bar mb-3">
        <div className="menuitem-filter-bar-row">
          {/* 1. Store / Location with ALL STORES option */}
          <div className="menuitem-filter-group menuitem-filter-store">
            <label htmlFor="promotions-store-select" className="menuitem-filter-label">
              Store / Location
            </label>
            <div className="menuitem-input-with-icon">
              <StoreIcon size={15} className="menuitem-input-left-icon" />
              <StoreSearchSelect
                id="promotions-store-select"
                inputClassName="form-select menuitem-filter-control"
                stores={stores}
                value={selectedLocation}
                onChange={setSelectedLocation}
                disabled={loading}
                includeAllOption
                allOptionLabel="ALL STORES (Consolidated)"
                placeholder="Type ALL, store code (e.g. MOA), or select..."
              />
            </div>
          </div>

          {/* 2. Promotion Name Filter (from dbo.dts_object WHERE majorgroup = 'Promotion') */}
          <div className="menuitem-filter-group menuitem-filter-store" style={{ minWidth: '280px' }}>
            <label htmlFor="promotions-object-select" className="menuitem-filter-label">
              Promotion Name
            </label>
            <div className="menuitem-input-with-icon">
              <Tag size={15} className="menuitem-input-left-icon" />
              <PromotionCatalogSearchSelect
                id="promotions-object-select"
                inputClassName="form-select menuitem-filter-control"
                catalog={promoCatalog}
                value={selectedCatalogPromo}
                onChange={setSelectedCatalogPromo}
                disabled={loading}
              />
            </div>
          </div>

          {/* 3. Business Date Range */}
          <div className="menuitem-filter-group menuitem-filter-dates">
            <label htmlFor="promotions-date-from" className="menuitem-filter-label">
              Business Date Range
            </label>
            <div className="menuitem-date-range-capsule">
              <div className="menuitem-date-field">
                <CalendarDays size={15} className="menuitem-input-left-icon" />
                <input
                  id="promotions-date-from"
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
                  id="promotions-date-to"
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

          {/* 4. Generate CTA */}
          <div className="menuitem-filter-cta">
            <button
              type="button"
              className="btn menuitem-generate-btn d-inline-flex align-items-center justify-content-center gap-2"
              onClick={handleGenerateReport}
              disabled={loading || !selectedLocation || !dateFrom || !dateTo}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Generating...' : 'Generate Promos'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3" role="alert">
            {error}
          </div>
        )}
      </div>

      {loadedFilters ? (
        <div className="d-flex flex-column gap-3">
          {/* 4 Executive KPI Cards */}
          <div className="row g-3">
            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Total Promo Qty Sold</span>
                  <ShoppingBag size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">{formatQty(visibleTotals.qty)}</div>
                <div className="menuitem-kpi-subtext">
                  Across {visibleTotals.storeCount} store(s) • {visibleTotals.promoCount} promo(s)
                </div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Total Promo Amount (AMT)</span>
                  <TrendingUp size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">₱{formatMoney(visibleTotals.amt)}</div>
                <div className="menuitem-kpi-subtext">
                  Avg ₱
                  {formatMoney(
                    visibleTotals.qty > 0 ? visibleTotals.amt / visibleTotals.qty : 0
                  )}{' '}
                  per promo unit
                </div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Active Promotions</span>
                  <Tag size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">{visibleTotals.promoCount}</div>
                <div
                  className="menuitem-kpi-subtext text-truncate"
                  title={
                    topPromoOverall
                      ? `Top Promo: ${topPromoOverall.itemName} (₱${formatMoney(
                          topPromoOverall.amt
                        )})`
                      : ''
                  }
                >
                  {topPromoOverall
                    ? `Top: ${topPromoOverall.itemName}`
                    : 'No promotions recorded'}
                </div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Participating Stores</span>
                  <StoreIcon size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">{visibleTotals.storeCount}</div>
                <div className="menuitem-kpi-subtext">
                  {dailyTrend.length} active business day(s) in range
                </div>
              </div>
            </div>
          </div>

          {/* ===============================================================
              TAB 1: PROMOTION MONITORING & RECEIPT / ITEM DRILL-DOWN
              =============================================================== */}
          {activeTab === 'monitoring' && (
            <>
              {/* Filter, Grouping & Export Toolbar */}
              <div className="menuitem-toolbar-bar">
                <div className="menuitem-toolbar-meta">
                  <span className="menuitem-meta-pill">
                    Scope:{' '}
                    <strong>
                      {loadedFilters.locationName === 'ALL'
                        ? `All Stores (${visibleTotals.storeCount})`
                        : loadedFilters.locationName}
                    </strong>
                  </span>
                  {loadedFilters.itemNumber && (
                    <span className="menuitem-meta-pill">
                      Promo Filter:{' '}
                      <strong>
                        {loadedFilters.itemNumber}{' '}
                        {loadedFilters.promoName ? `— ${loadedFilters.promoName}` : ''}
                      </strong>
                    </span>
                  )}
                  <span className="menuitem-meta-pill">
                    Period: <strong>{loadedFilters.dateFrom}</strong> to{' '}
                    <strong>{loadedFilters.dateTo}</strong>
                  </span>
                  <span className="menuitem-meta-pill">
                    Rows:{' '}
                    <strong>
                      {groupMode === 'consolidated'
                        ? consolidatedPromos.length
                        : filteredRows.length}
                    </strong>
                  </span>
                </div>

                <div className="menuitem-toolbar-actions">
                  {/* Grouping Mode Toggle */}
                  <div className="btn-group btn-group-sm" role="group" aria-label="Grouping Mode">
                    <button
                      type="button"
                      className={`btn ${
                        groupMode === 'store-item'
                          ? 'menuitem-seg-btn-active'
                          : 'menuitem-seg-btn'
                      }`}
                      onClick={() => setGroupMode('store-item')}
                      title="Group by Location Name, Item Number, and Item Name"
                    >
                      By Store &amp; Promo
                    </button>
                    <button
                      type="button"
                      className={`btn ${
                        groupMode === 'consolidated'
                          ? 'menuitem-seg-btn-active'
                          : 'menuitem-seg-btn'
                      }`}
                      onClick={() => setGroupMode('consolidated')}
                      title="Consolidate totals per Promotion across all stores"
                    >
                      Consolidated by Promo
                    </button>
                  </div>

                  {/* Store sub-filter when viewing ALL stores */}
                  {availableStoreNames.length > 1 && (
                    <select
                      className="form-select form-select-sm menuitem-toolbar-select"
                      value={selectedStoreFilter}
                      onChange={(e) => setSelectedStoreFilter(e.target.value)}
                      aria-label="Filter by Store"
                    >
                      <option value="">
                        All Stores in Result ({availableStoreNames.length})
                      </option>
                      {availableStoreNames.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Promotion Item Sub-Filter within loaded results */}
                  {availablePromosInResult.length > 1 && (
                    <select
                      className="form-select form-select-sm menuitem-toolbar-select"
                      value={selectedPromoItem}
                      onChange={(e) => setSelectedPromoItem(e.target.value)}
                      aria-label="Filter by Promotion Item"
                    >
                      <option value="">
                        All Loaded Promotions ({availablePromosInResult.length})
                      </option>
                      {availablePromosInResult.map((p) => (
                        <option key={p.itemNumber} value={p.itemNumber}>
                          {p.itemNumber} — {p.itemName}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Search Input */}
                  <div className="menuitem-search-box">
                    <Search size={14} className="menuitem-search-icon" />
                    <input
                      type="text"
                      className="form-control form-control-sm menuitem-search-input"
                      placeholder="Search store, item # or promo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="menuitem-search-clear"
                        onClick={() => setSearchQuery('')}
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Export Buttons */}
                  <div className="d-inline-flex align-items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      className="btn rof-export-btn rof-export-btn-excel btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                      onClick={() =>
                        exportPromotionsToExcel({
                          rows: filteredRows,
                          consolidatedPromos,
                          storePerformance,
                          dailyTrend,
                          filters: loadedFilters,
                          activeDrilldown,
                        })
                      }
                      disabled={filteredRows.length === 0}
                      title="Download Multi-Sheet Promotion Monitoring Excel Workbook (.xlsx)"
                    >
                      <FileSpreadsheet size={15} />
                      <span>Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      className="btn rof-export-btn rof-export-btn-pdf btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                      onClick={() =>
                        exportPromotionsToPdf({
                          rows: filteredRows,
                          consolidatedPromos,
                          filters: loadedFilters,
                          groupMode,
                        })
                      }
                      disabled={filteredRows.length === 0}
                      title="Download Printable Promotion Monitoring PDF"
                    >
                      <FileText size={15} />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Promotion Monitoring Table */}
              <div className="menuitem-table-card">
                <div className="px-3 py-2 border-bottom bg-light d-flex flex-wrap align-items-center justify-content-between gap-2 small">
                  <div className="d-flex align-items-center gap-2 text-secondary">
                    <Sparkles size={14} style={{ color: 'var(--brand-orange)' }} />
                    <span>
                      Click <strong>Items Used</strong> on any row to inspect the actual items rung up on the same guest check/receipt for that promotion.
                    </span>
                  </div>
                </div>

                <div className="table-responsive rof-grid-scroll-container menuitem-pivot-scroll-container">
                  {groupMode === 'store-item' ? (
                    <table className="table align-middle mb-0 bom-data-table menuitem-summary-table">
                      <thead>
                        <tr>
                          <th style={{ width: '165px' }}>LOCATION NAME</th>
                          <th style={{ width: '125px' }}>ITEM NUMBER</th>
                          <th>PROMOTION ITEM NAME</th>
                          <th className="text-end" style={{ width: '120px' }}>
                            QTY SOLD
                          </th>
                          <th className="text-end" style={{ width: '160px' }}>
                            TOTAL AMOUNT (AMT)
                          </th>
                          <th className="text-end" style={{ width: '105px' }}>
                            % SHARE
                          </th>
                          <th className="text-center" style={{ width: '175px' }}>
                            PROMO DETAILS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-5 menuitem-empty-state">
                              No Promotion records found for the selected store, promotion, and date range.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {filteredRows.map((row, idx) => {
                              const sharePct =
                                visibleTotals.amt > 0
                                  ? (row.amt / visibleTotals.amt) * 100
                                  : 0;
                              const isSelectedDrill =
                                activeDrilldown?.promo.itemNumber === row.itemNumber &&
                                activeDrilldown?.promo.locationName === row.locationName;

                              return (
                                <tr
                                  key={`${row.locationName}-${row.itemNumber}-${idx}`}
                                  className={isSelectedDrill ? 'table-active' : ''}
                                >
                                  <td className="fw-semibold bom-charcoal-text text-nowrap">
                                    <span className="rof-mod-badge">{row.locationName}</span>
                                  </td>
                                  <td className="menuitem-code-cell text-nowrap">
                                    <span className="menuitem-code-badge">{row.itemNumber}</span>
                                  </td>
                                  <td className="menuitem-name-cell fw-semibold">
                                    {row.itemName}
                                  </td>
                                  <td
                                    className={`num-cell ${
                                      isZeroValue(row.qty) ? 'menuitem-cell-zero' : 'fw-semibold'
                                    }`}
                                  >
                                    {formatQty(row.qty)}
                                  </td>
                                  <td
                                    className={`num-cell ${
                                      isZeroValue(row.amt)
                                        ? 'menuitem-cell-zero'
                                        : 'fw-bold bom-charcoal-text'
                                    }`}
                                  >
                                    ₱{formatMoney(row.amt)}
                                  </td>
                                  <td className="num-cell menuitem-secondary-cell fw-semibold">
                                    {sharePct.toFixed(2)}%
                                  </td>
                                  <td className="text-center">
                                    <button
                                      type="button"
                                      className={`btn btn-sm d-inline-flex align-items-center gap-1 px-2 py-1 ${
                                        isSelectedDrill
                                          ? 'btn-primary'
                                          : 'btn-outline-secondary'
                                      }`}
                                      onClick={() =>
                                        handleInspectPromoDetails({
                                          itemNumber: row.itemNumber,
                                          itemName: row.itemName,
                                          locationName: row.locationName,
                                        })
                                      }
                                      disabled={drilldownLoading}
                                    >
                                      <Eye size={13} />
                                      <span>Items Used</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Sticky TOTAL Footer Row */}
                            <tr className="rof-total-row fw-bold">
                              <td className="bom-charcoal-text">TOTAL</td>
                              <td className="menuitem-footer-count">
                                {filteredRows.length} Row(s)
                              </td>
                              <td>{visibleTotals.promoCount} Unique Promotion(s)</td>
                              <td className="num-cell bom-charcoal-text">
                                {formatQty(visibleTotals.qty)}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                ₱{formatMoney(visibleTotals.amt)}
                              </td>
                              <td className="num-cell bom-charcoal-text">100.00%</td>
                              <td></td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    /* Consolidated by Promotion Table */
                    <table className="table align-middle mb-0 bom-data-table menuitem-summary-table">
                      <thead>
                        <tr>
                          <th style={{ width: '130px' }}>ITEM NUMBER</th>
                          <th>PROMOTION ITEM NAME</th>
                          <th className="text-center" style={{ width: '140px' }}>
                            STORES SOLD
                          </th>
                          <th className="text-end" style={{ width: '130px' }}>
                            TOTAL QTY
                          </th>
                          <th className="text-end" style={{ width: '165px' }}>
                            TOTAL AMOUNT (AMT)
                          </th>
                          <th className="text-end" style={{ width: '105px' }}>
                            % SHARE
                          </th>
                          <th className="text-center" style={{ width: '185px' }}>
                            PROMO DETAILS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedPromos.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-5 menuitem-empty-state">
                              No Promotion records found for the selected filters.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {consolidatedPromos.map((promo) => {
                              const sharePct =
                                visibleTotals.amt > 0
                                  ? (promo.amt / visibleTotals.amt) * 100
                                  : 0;
                              const isSelectedDrill =
                                activeDrilldown?.promo.itemNumber === promo.itemNumber;

                              return (
                                <tr
                                  key={promo.itemNumber}
                                  className={isSelectedDrill ? 'table-active' : ''}
                                >
                                  <td className="menuitem-code-cell text-nowrap">
                                    <span className="menuitem-code-badge">
                                      {promo.itemNumber}
                                    </span>
                                  </td>
                                  <td className="menuitem-name-cell fw-semibold">
                                    {promo.itemName}
                                  </td>
                                  <td className="text-center">
                                    <span className="menuitem-meta-pill">
                                      {promo.storeCount} store(s)
                                    </span>
                                  </td>
                                  <td className="num-cell fw-semibold">
                                    {formatQty(promo.qty)}
                                  </td>
                                  <td className="num-cell fw-bold bom-charcoal-text">
                                    ₱{formatMoney(promo.amt)}
                                  </td>
                                  <td className="num-cell menuitem-secondary-cell fw-semibold">
                                    {sharePct.toFixed(2)}%
                                  </td>
                                  <td className="text-center">
                                    <button
                                      type="button"
                                      className={`btn btn-sm d-inline-flex align-items-center gap-1 px-2 py-1 ${
                                        isSelectedDrill
                                          ? 'btn-primary'
                                          : 'btn-outline-secondary'
                                      }`}
                                      onClick={() =>
                                        handleInspectPromoDetails({
                                          itemNumber: promo.itemNumber,
                                          itemName: promo.itemName,
                                        })
                                      }
                                      disabled={drilldownLoading}
                                    >
                                      <Eye size={13} />
                                      <span>All Stores Items</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}

                            <tr className="rof-total-row fw-bold">
                              <td className="bom-charcoal-text">TOTAL</td>
                              <td className="menuitem-footer-count">
                                {consolidatedPromos.length} Unique Promo(s)
                              </td>
                              <td className="text-center">
                                {visibleTotals.storeCount} store(s)
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                {formatQty(visibleTotals.qty)}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                ₱{formatMoney(visibleTotals.amt)}
                              </td>
                              <td className="num-cell bom-charcoal-text">100.00%</td>
                              <td></td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* =========================================================
                  PROMOTION DETAILS / CHECK & BUNDLED ITEMS DRILL-DOWN PANEL
                  ========================================================= */}
              {(drilldownLoading || drilldownError || activeDrilldown) && (
                <div ref={drilldownPanelRef} className="menuitem-flat-panel p-3 p-md-4 border-primary">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pb-3 mb-3 border-bottom">
                    <div className="d-flex align-items-center gap-3 min-w-0">
                      <div className="bom-header-icon-badge d-flex align-items-center justify-content-center rounded-3 flex-shrink-0">
                        <PackageCheck size={19} />
                      </div>
                      <div className="min-w-0">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <h3 className="h6 fw-bold mb-0 bom-main-heading">
                            Promotion Details &amp; Items Used in Receipts
                          </h3>
                          {activeDrilldown && (
                            <span className="menuitem-code-badge">
                              #{activeDrilldown.promo.itemNumber}
                            </span>
                          )}
                          {activeDrilldown && (
                            <span className="menuitem-meta-pill">
                              Store:{' '}
                              <strong>
                                {activeDrilldown.promo.locationName === 'ALL'
                                  ? 'All Stores'
                                  : activeDrilldown.promo.locationName}
                              </strong>
                            </span>
                          )}
                        </div>
                        {activeDrilldown && (
                          <p className="menuitem-chart-subtext mb-0 mt-1">
                            <strong>{activeDrilldown.promo.itemName}</strong> — Promo Qty:{' '}
                            <strong>{formatQty(activeDrilldown.promo.totalPromoQty)}</strong> •
                            Promo Amount:{' '}
                            <strong>₱{formatMoney(activeDrilldown.promo.totalPromoAmt)}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                      {activeDrilldown && (
                        <>
                          <span className="menuitem-meta-pill">
                            Items Used in Promo ({filteredPairedItems.length})
                          </span>

                          {/* Item Role Filter */}
                          <select
                            className="form-select form-select-sm menuitem-toolbar-select"
                            value={drilldownRoleFilter}
                            onChange={(e) =>
                              setDrilldownRoleFilter(
                                e.target.value as 'all' | 'target' | 'zero-price' | 'co-sold'
                              )
                            }
                            aria-label="Filter by Item Role"
                          >
                            <option value="all">All Item Roles</option>
                            <option value="target">Target Promotion</option>
                            <option value="zero-price">Bundled / Zero-Price Item</option>
                            <option value="co-sold">Co-Sold on Receipt</option>
                          </select>

                          {/* Filter Items by Entire Major Group Only */}
                          <select
                            className="form-select form-select-sm menuitem-toolbar-select"
                            value={drilldownMajorGroup}
                            onChange={(e) => setDrilldownMajorGroup(e.target.value)}
                            aria-label="Filter items by Major Group"
                          >
                            <option value="">
                              All Major Groups ({activeDrilldown.pairedItems.length})
                            </option>
                            {availableDrilldownMajorGroups.map((mg) => (
                              <option key={mg.majorGroup} value={mg.majorGroup}>
                                {mg.majorGroup} ({mg.count})
                              </option>
                            ))}
                          </select>
                        </>
                      )}

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                        onClick={() => {
                          setActiveDrilldown(null);
                          setDrilldownError(null);
                        }}
                      >
                        <X size={14} />
                        <span>Close</span>
                      </button>
                    </div>
                  </div>

                  {drilldownLoading && (
                    <div className="text-center py-4 text-secondary">
                      <span
                        className="spinner-border spinner-border-sm text-primary me-2"
                        role="status"
                      />
                      Inspecting items used for this promotion...
                    </div>
                  )}

                  {drilldownError && (
                    <div className="alert alert-danger py-2 small mb-0">
                      {drilldownError}
                    </div>
                  )}

                  {!drilldownLoading && activeDrilldown && (
                    <div className="table-responsive rof-grid-scroll-container">
                      <table className="table align-middle mb-0 bom-data-table menuitem-summary-table">
                        <thead>
                          <tr>
                            <th style={{ width: '120px' }}>ITEM NUMBER</th>
                            <th>ITEM NAME (USED IN PROMO)</th>
                            <th style={{ width: '160px' }}>MAJOR GROUP</th>
                            <th style={{ width: '160px' }}>FAMILY GROUP</th>
                            <th style={{ width: '195px' }}>ITEM ROLE</th>
                            <th className="text-end" style={{ width: '130px' }}>
                              TOTAL QTY
                            </th>
                            <th className="text-end" style={{ width: '155px' }}>
                              LINE AMOUNT
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPairedItems.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-4 text-secondary">
                                No items matched the selected Item Role / Major Group filter.
                              </td>
                            </tr>
                          ) : (
                            filteredPairedItems.map((item) => (
                              <tr
                                key={`${item.itemNumber}-${item.majorGroup}-${item.familyGroup}`}
                                className={item.isSelectedPromo ? 'table-warning' : ''}
                              >
                                <td className="menuitem-code-cell text-nowrap">
                                  <span className="menuitem-code-badge">
                                    {item.itemNumber}
                                  </span>
                                </td>
                                <td className="menuitem-name-cell fw-semibold">
                                  {item.itemName}
                                </td>
                                <td>
                                  <span className="rof-mod-badge">{item.majorGroup}</span>
                                </td>
                                <td className="menuitem-secondary-cell">
                                  {item.familyGroup}
                                </td>
                                <td>
                                  {item.isSelectedPromo ? (
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                      Target Promotion
                                    </span>
                                  ) : item.isZeroPriceBundleItem ? (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                                      Bundled / Zero-Price Item
                                    </span>
                                  ) : (
                                    <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
                                      Co-Sold on Receipt
                                    </span>
                                  )}
                                </td>
                                <td className="num-cell fw-semibold">
                                  {formatQty(item.totalQty)}
                                </td>
                                <td className="num-cell fw-bold bom-charcoal-text">
                                  ₱{formatMoney(item.totalAmt)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===============================================================
              TAB 2: PROMOTION PERFORMANCE ANALYTICS (CHARTS & BREAKDOWNS)
              =============================================================== */}
          {activeTab === 'analytics' && (
            <>
              {/* 1. PER-STORE GRAPH (Displayed prominently when ALL STORES is selected or multiple stores exist) */}
              {(isAllStoresLoaded || storeChartSeries.length > 1) && (
                <div className="menuitem-flat-panel p-3 p-md-4">
                  <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 pb-3 mb-3 border-bottom">
                    <div>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <StoreIcon size={18} className="bom-charcoal-text" />
                        <h3 className="h6 fw-bold mb-0 bom-main-heading">
                          Promotion Performance Graph per Store
                        </h3>
                        <span className="menuitem-meta-pill">
                          {storeChartSeries.length} Active Store(s)
                        </span>
                        {loadedFilters.promoName && (
                          <span className="menuitem-meta-pill">
                            Promo: <strong>{loadedFilters.promoName}</strong>
                          </span>
                        )}
                        {selectedStoreFilter && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2"
                            onClick={() => setSelectedStoreFilter('')}
                          >
                            Clear Store Filter ({selectedStoreFilter})
                          </button>
                        )}
                      </div>
                      <p className="menuitem-chart-subtext mb-0 mt-1">
                        Top Performing Store:{' '}
                        <strong>{storeChartStats.topStoreLabel}</strong> (
                        {storeRankMetric === 'amt'
                          ? `₱${formatMoney(storeChartStats.topStoreVal)}`
                          : `${formatQty(storeChartStats.topStoreVal)} units`}
                        ) • Avg per Store:{' '}
                        <strong>
                          {storeRankMetric === 'amt'
                            ? `₱${formatMoney(storeChartStats.avgVal)}`
                            : `${formatQty(storeChartStats.avgVal)} units`}
                        </strong>{' '}
                        • Click any bar to filter by that store.
                      </p>
                    </div>

                    {/* Store Chart Sort & Metric Controls */}
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <div className="btn-group btn-group-sm" role="group" aria-label="Store Sort Order">
                        <button
                          type="button"
                          className={`btn ${
                            storeChartSortOrder === 'desc'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setStoreChartSortOrder('desc')}
                        >
                          Highest First
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            storeChartSortOrder === 'asc'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setStoreChartSortOrder('asc')}
                        >
                          Lowest First
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            storeChartSortOrder === 'alpha'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setStoreChartSortOrder('alpha')}
                        >
                          Store Name (A–Z)
                        </button>
                      </div>

                      <div className="btn-group btn-group-sm" role="group" aria-label="Store Metric">
                        <button
                          type="button"
                          className={`btn ${
                            storeRankMetric === 'amt'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setStoreRankMetric('amt')}
                        >
                          Amount (₱)
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            storeRankMetric === 'qty'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setStoreRankMetric('qty')}
                        >
                          Qty Sold
                        </button>
                      </div>
                    </div>
                  </div>

                  {storeChartSeries.length === 0 ? (
                    <div className="text-center py-4 menuitem-empty-state">
                      No per-store promotion data available for the selected filters.
                    </div>
                  ) : (
                    <div className="menuitem-chart-stage">
                      <div className="menuitem-chart-layout">
                        {/* Left Y-Axis Labels */}
                        <div className="menuitem-yaxis-col" aria-hidden="true">
                          {storeChartStats.ticks.map((tickVal, idx) => (
                            <div key={idx} className="menuitem-yaxis-label">
                              {formatAxisTick(tickVal, storeRankMetric)}
                            </div>
                          ))}
                        </div>

                        {/* Horizontally Scrollable Per-Store Bar Plot */}
                        <div className="menuitem-trend-bars-scroll">
                          <div
                            className="menuitem-plot-canvas"
                            style={{
                              minWidth: Math.max(storeChartSeries.length * 64, 480),
                            }}
                          >
                            <div className="menuitem-gridlines-layer" aria-hidden="true">
                              {storeChartStats.ticks.map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`menuitem-gridline-row ${
                                    idx === storeChartStats.ticks.length - 1 ? 'baseline' : ''
                                  }`}
                                />
                              ))}
                            </div>

                            <div className="menuitem-trend-bars-grid">
                              {storeChartSeries.map((st, idx) => {
                                const val = storeRankMetric === 'amt' ? st.amt : st.qty;
                                const heightPct =
                                  storeChartStats.axisMax > 0
                                    ? Math.min(
                                        100,
                                        Math.max(
                                          (val / storeChartStats.axisMax) * 100,
                                          val > 0 ? 3 : 0
                                        )
                                      )
                                    : 0;
                                const isHovered = hoveredStoreIndex === idx;
                                const isTop =
                                  st.locationName === storeChartStats.topStoreKey &&
                                  storeChartStats.topStoreVal > 0;
                                const isSelectedStore =
                                  selectedStoreFilter === st.locationName;
                                const tooltipAlignClass =
                                  idx <= 1
                                    ? 'align-left'
                                    : idx >= storeChartSeries.length - 2
                                    ? 'align-right'
                                    : 'align-center';

                                return (
                                  <div
                                    key={st.locationName}
                                    className={`menuitem-trend-bar-col ${
                                      isHovered ? 'hovered' : ''
                                    } ${isTop || isSelectedStore ? 'is-peak' : ''}`}
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredStoreIndex(idx)}
                                    onMouseLeave={() => setHoveredStoreIndex(null)}
                                    onFocus={() => setHoveredStoreIndex(idx)}
                                    onBlur={() => setHoveredStoreIndex(null)}
                                    onClick={() =>
                                      setSelectedStoreFilter((curr) =>
                                        curr === st.locationName ? '' : st.locationName
                                      )
                                    }
                                    tabIndex={0}
                                    aria-label={`${st.locationName}: Amount ₱${formatMoney(
                                      st.amt
                                    )}, Qty ${formatQty(st.qty)}`}
                                  >
                                    {isHovered && (
                                      <div
                                        className={`menuitem-bar-floating-tooltip ${tooltipAlignClass}`}
                                        role="tooltip"
                                      >
                                        <div className="menuitem-tooltip-header">
                                          <span>{st.locationName}</span>
                                          {isTop && (
                                            <span className="menuitem-tooltip-peak-tag">
                                              TOP STORE
                                            </span>
                                          )}
                                        </div>
                                        <div className="menuitem-tooltip-row">
                                          <span>Active Promos</span>
                                          <strong>{st.promoItemCount}</strong>
                                        </div>
                                        <div className="menuitem-tooltip-row">
                                          <span>Promo Qty Sold</span>
                                          <strong>{formatQty(st.qty)}</strong>
                                        </div>
                                        <div className="menuitem-tooltip-row menuitem-tooltip-net">
                                          <span>Promo Amount</span>
                                          <strong>₱{formatMoney(st.amt)}</strong>
                                        </div>
                                      </div>
                                    )}

                                    <div className="menuitem-bar-plot-slot">
                                      <div
                                        className="menuitem-trend-bar-fill"
                                        style={{ height: `${heightPct}%` }}
                                      />
                                    </div>

                                    <div
                                      className="menuitem-trend-bar-label"
                                      title={st.locationName}
                                    >
                                      {st.shortLabel}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Daily / Monthly Promotion Sales Trend Chart */}
              <div className="menuitem-flat-panel p-3 p-md-4">
                <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 pb-3 mb-3 border-bottom">
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <TrendingUp size={18} className="bom-charcoal-text" />
                      <h3 className="h6 fw-bold mb-0 bom-main-heading">
                        {trendGranularity === 'monthly'
                          ? 'Monthly Promotion Performance Trend'
                          : 'Daily Promotion Performance Trend'}
                      </h3>
                      <span className="menuitem-meta-pill">
                        {loadedFilters.locationName === 'ALL'
                          ? 'All Stores'
                          : loadedFilters.locationName}
                      </span>

                      <div
                        className="menuitem-info-trigger-wrap"
                        onMouseEnter={() => setShowChartInfo(true)}
                        onMouseLeave={() => setShowChartInfo(false)}
                      >
                        <button
                          type="button"
                          className="menuitem-info-icon-btn"
                          onClick={() => setShowChartInfo((v) => !v)}
                          aria-label="Chart interaction tips"
                        >
                          <Info size={14} />
                        </button>
                        {showChartInfo && (
                          <div className="menuitem-info-popover" role="tooltip">
                            Hover over any bar to inspect Business Date, Promo Qty
                            Sold, and Promo Amount.
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="menuitem-chart-subtext mb-0 mt-1">
                      Peak {trendGranularity === 'monthly' ? 'Month' : 'Day'}:{' '}
                      <strong>{trendStats.peakLabel}</strong> (
                      {trendMetric === 'amt'
                        ? `₱${formatMoney(trendStats.peakVal)}`
                        : `${formatQty(trendStats.peakVal)} units`}
                      ) • Avg per {trendGranularity === 'monthly' ? 'Month' : 'Day'}:{' '}
                      <strong>
                        {trendMetric === 'amt'
                          ? `₱${formatMoney(trendStats.avgVal)}`
                          : `${formatQty(trendStats.avgVal)} units`}
                      </strong>
                    </p>
                  </div>

                  {/* Chart Controls */}
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${
                          trendSortOrder === 'chronological'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendSortOrder('chronological')}
                      >
                        Date Order
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          trendSortOrder === 'desc'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendSortOrder('desc')}
                      >
                        Highest First
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          trendSortOrder === 'asc'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendSortOrder('asc')}
                      >
                        Lowest First
                      </button>
                    </div>

                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${
                          trendGranularity === 'daily'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendGranularity('daily')}
                      >
                        Daily View
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          trendGranularity === 'monthly'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendGranularity('monthly')}
                      >
                        Monthly View
                      </button>
                    </div>

                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${
                          trendMetric === 'amt'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendMetric('amt')}
                      >
                        Amount (₱)
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          trendMetric === 'qty'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendMetric('qty')}
                      >
                        Qty Sold
                      </button>
                    </div>
                  </div>
                </div>

                {trendSeries.length === 0 ? (
                  <div className="text-center py-4 menuitem-empty-state">
                    No daily promotion trend data available for the selected period.
                  </div>
                ) : (
                  <div className="menuitem-chart-stage">
                    <div className="menuitem-chart-layout">
                      <div className="menuitem-yaxis-col" aria-hidden="true">
                        {trendStats.ticks.map((tickVal, idx) => (
                          <div key={idx} className="menuitem-yaxis-label">
                            {formatAxisTick(tickVal, trendMetric)}
                          </div>
                        ))}
                      </div>

                      <div className="menuitem-trend-bars-scroll">
                        <div
                          className="menuitem-plot-canvas"
                          style={{
                            minWidth: Math.max(trendSeries.length * 60, 480),
                          }}
                        >
                          <div className="menuitem-gridlines-layer" aria-hidden="true">
                            {trendStats.ticks.map((_, idx) => (
                              <div
                                key={idx}
                                className={`menuitem-gridline-row ${
                                  idx === trendStats.ticks.length - 1 ? 'baseline' : ''
                                }`}
                              />
                            ))}
                          </div>

                          <div className="menuitem-trend-bars-grid">
                            {trendSeries.map((pt, idx) => {
                              const val = trendMetric === 'amt' ? pt.amt : pt.qty;
                              const heightPct =
                                trendStats.axisMax > 0
                                  ? Math.min(
                                      100,
                                      Math.max((val / trendStats.axisMax) * 100, val > 0 ? 3 : 0)
                                    )
                                  : 0;
                              const isHovered = hoveredTrendIndex === idx;
                              const isPeak =
                                pt.periodKey === trendStats.peakKey && trendStats.peakVal > 0;
                              const tooltipAlignClass =
                                idx <= 1
                                  ? 'align-left'
                                  : idx >= trendSeries.length - 2
                                  ? 'align-right'
                                  : 'align-center';

                              return (
                                <div
                                  key={pt.periodKey}
                                  className={`menuitem-trend-bar-col ${
                                    isHovered ? 'hovered' : ''
                                  } ${isPeak ? 'is-peak' : ''}`}
                                  onMouseEnter={() => setHoveredTrendIndex(idx)}
                                  onMouseLeave={() => setHoveredTrendIndex(null)}
                                  onFocus={() => setHoveredTrendIndex(idx)}
                                  onBlur={() => setHoveredTrendIndex(null)}
                                  tabIndex={0}
                                >
                                  {isHovered && (
                                    <div
                                      className={`menuitem-bar-floating-tooltip ${tooltipAlignClass}`}
                                      role="tooltip"
                                    >
                                      <div className="menuitem-tooltip-header">
                                        <span>{pt.fullLabel}</span>
                                        {isPeak && (
                                          <span className="menuitem-tooltip-peak-tag">PEAK</span>
                                        )}
                                      </div>
                                      <div className="menuitem-tooltip-row">
                                        <span>Promo Qty Sold</span>
                                        <strong>{formatQty(pt.qty)}</strong>
                                      </div>
                                      <div className="menuitem-tooltip-row menuitem-tooltip-net">
                                        <span>Promo Amount</span>
                                        <strong>₱{formatMoney(pt.amt)}</strong>
                                      </div>
                                    </div>
                                  )}

                                  <div className="menuitem-bar-plot-slot">
                                    <div
                                      className="menuitem-trend-bar-fill"
                                      style={{ height: `${heightPct}%` }}
                                    />
                                  </div>

                                  <div className="menuitem-trend-bar-label" title={pt.fullLabel}>
                                    {pt.shortLabel}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Side-by-Side Rankings: Top 10 Promotions + Store Performance Comparison */}
              <div className="row g-3">
                {/* Left Column: Top 10 Promotions */}
                <div className="col-12 col-xl-6">
                  <div className="menuitem-flat-panel p-3 p-md-4 h-100">
                    <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <Award size={18} className="bom-charcoal-text" />
                        <div>
                          <h3 className="h6 fw-bold mb-0 bom-main-heading">
                            Top Performing Promotions
                          </h3>
                          <span className="menuitem-chart-subtext">
                            Click any promotion to inspect its receipt items in Monitoring view
                          </span>
                        </div>
                      </div>

                      <div className="btn-group btn-group-sm" role="group">
                        <button
                          type="button"
                          className={`btn ${
                            topPromoMetric === 'amt'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setTopPromoMetric('amt')}
                        >
                          By Amount (₱)
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            topPromoMetric === 'qty'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setTopPromoMetric('qty')}
                        >
                          By Qty
                        </button>
                      </div>
                    </div>

                    {top10Promos.length === 0 ? (
                      <div className="text-center py-4 menuitem-empty-state">
                        No promotion data available.
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {top10Promos.map((promo, idx) => {
                          const maxVal =
                            topPromoMetric === 'amt'
                              ? top10Promos[0]?.amt || 1
                              : top10Promos[0]?.qty || 1;
                          const currVal = topPromoMetric === 'amt' ? promo.amt : promo.qty;
                          const barPct = Math.max((currVal / maxVal) * 100, 3);
                          const sharePct =
                            topPromoMetric === 'amt'
                              ? visibleTotals.amt > 0
                                ? (promo.amt / visibleTotals.amt) * 100
                                : 0
                              : visibleTotals.qty > 0
                              ? (promo.qty / visibleTotals.qty) * 100
                              : 0;

                          return (
                            <div
                              key={promo.itemNumber}
                              className="menuitem-rank-row"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setActiveTab('monitoring');
                                handleInspectPromoDetails({
                                  itemNumber: promo.itemNumber,
                                  itemName: promo.itemName,
                                });
                              }}
                              title="Click to inspect items used in this promotion"
                            >
                              <div className="d-flex align-items-center justify-content-between gap-2 mb-1 small">
                                <div className="d-flex align-items-center gap-2 min-w-0">
                                  <span className="menuitem-rank-badge">#{idx + 1}</span>
                                  <span className="menuitem-code-badge">
                                    {promo.itemNumber}
                                  </span>
                                  <span
                                    className="fw-semibold bom-charcoal-text text-truncate"
                                    title={promo.itemName}
                                  >
                                    {promo.itemName}
                                  </span>
                                  <span className="menuitem-chart-subtext d-none d-md-inline">
                                    ({promo.storeCount} store{promo.storeCount === 1 ? '' : 's'})
                                  </span>
                                </div>
                                <div className="text-nowrap fw-bold bom-charcoal-text">
                                  {topPromoMetric === 'amt'
                                    ? `₱${formatMoney(promo.amt)}`
                                    : `${formatQty(promo.qty)} pcs`}{' '}
                                  <span className="menuitem-chart-subtext fw-normal">
                                    ({sharePct.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                              <div className="menuitem-progress-track">
                                <div
                                  className="menuitem-progress-fill"
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Store Performance Breakdown */}
                <div className="col-12 col-xl-6">
                  <div className="menuitem-flat-panel p-3 p-md-4 h-100">
                    <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <StoreIcon size={18} className="bom-charcoal-text" />
                        <div>
                          <h3 className="h6 fw-bold mb-0 bom-main-heading">
                            Store Location Share &amp; Ranking
                          </h3>
                          <span className="menuitem-chart-subtext">
                            Click any store below to filter the report to that location
                          </span>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        {selectedStoreFilter && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2"
                            onClick={() => setSelectedStoreFilter('')}
                          >
                            Reset Store
                          </button>
                        )}
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            type="button"
                            className={`btn ${
                              storeRankMetric === 'amt'
                                ? 'menuitem-seg-btn-active'
                                : 'menuitem-seg-btn'
                            }`}
                            onClick={() => setStoreRankMetric('amt')}
                          >
                            By Amount (₱)
                          </button>
                          <button
                            type="button"
                            className={`btn ${
                              storeRankMetric === 'qty'
                                ? 'menuitem-seg-btn-active'
                                : 'menuitem-seg-btn'
                            }`}
                            onClick={() => setStoreRankMetric('qty')}
                          >
                            By Qty
                          </button>
                        </div>
                      </div>
                    </div>

                    {storePerformance.length === 0 ? (
                      <div className="text-center py-4 menuitem-empty-state">
                        No store breakdown available.
                      </div>
                    ) : (
                      <div
                        className="d-flex flex-column gap-2 overflow-auto pe-1"
                        style={{ maxHeight: '420px' }}
                      >
                        {storePerformance.map((st, idx) => {
                          const isSelected = selectedStoreFilter === st.locationName;
                          const maxVal =
                            storeRankMetric === 'amt'
                              ? storePerformance[0]?.amt || 1
                              : storePerformance[0]?.qty || 1;
                          const currVal = storeRankMetric === 'amt' ? st.amt : st.qty;
                          const barPct = Math.max((currVal / maxVal) * 100, 3);
                          const sharePct =
                            storeRankMetric === 'amt'
                              ? visibleTotals.amt > 0
                                ? (st.amt / visibleTotals.amt) * 100
                                : 0
                              : visibleTotals.qty > 0
                              ? (st.qty / visibleTotals.qty) * 100
                              : 0;

                          return (
                            <button
                              key={st.locationName}
                              type="button"
                              className={`menuitem-category-card text-start border rounded-3 p-2 ${
                                isSelected ? 'active' : ''
                              }`}
                              onClick={() =>
                                setSelectedStoreFilter((curr) =>
                                  curr === st.locationName ? '' : st.locationName
                                )
                              }
                            >
                              <div className="d-flex align-items-center justify-content-between gap-2 mb-1 small">
                                <div className="d-flex align-items-center gap-2 min-w-0">
                                  <span className="menuitem-rank-badge">#{idx + 1}</span>
                                  <span className="fw-bold bom-charcoal-text">
                                    {st.locationName}
                                  </span>
                                  <span className="menuitem-meta-pill py-0 px-2">
                                    {st.promoItemCount} promo(s)
                                  </span>
                                </div>
                                <div className="fw-bold bom-charcoal-text text-nowrap">
                                  {storeRankMetric === 'amt'
                                    ? `₱${formatMoney(st.amt)}`
                                    : `${formatQty(st.qty)} pcs`}{' '}
                                  <span className="menuitem-chart-subtext fw-semibold">
                                    ({sharePct.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                              <div className="menuitem-progress-track">
                                <div
                                  className="menuitem-progress-fill"
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                              <div
                                className="d-flex justify-content-between menuitem-chart-subtext mt-1 text-truncate"
                                style={{ fontSize: '12px' }}
                              >
                                <span>
                                  Qty: {formatQty(st.qty)}
                                </span>
                                <span className="text-truncate ms-2" title={st.topPromoName}>
                                  Top: {st.topPromoName}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        !loading && (
          <div className="system-sales-placeholder mt-2">
            <Tag size={36} className="mb-2 bom-charcoal-text" />
            <h5 className="fw-bold bom-main-heading">
              Ready to Monitor Promotions &amp; Analyze Performance
            </h5>
            <p className="menuitem-placeholder-copy">
              Select <strong>ALL STORES</strong> or a specific store, optionally choose a{' '}
              <strong>Promotion Name</strong>, and pick a business date range above, then click{' '}
              <strong>Generate Promos</strong>.
            </p>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Searchable combobox for selecting a Promotion from `dbo.dts_object WHERE majorgroup = 'Promotion'`
 * (includes an "ALL PROMOTIONS" option at the top).
 */
function PromotionCatalogSearchSelect({
  id,
  catalog,
  value,
  onChange,
  disabled = false,
  inputClassName = 'form-select',
}: {
  id: string;
  catalog: PromotionCatalogItem[];
  value: string;
  onChange: (itemNumber: string) => void;
  disabled?: boolean;
  inputClassName?: string;
}) {
  const options = useMemo<PromotionCatalogItem[]>(() => {
    const allEntry: PromotionCatalogItem = {
      itemNumber: 'ALL',
      itemName: 'ALL PROMOTIONS (All Promo Items)',
      majorGroup: 'Promotion',
      familyGroup: 'All',
    };
    return [allEntry, ...catalog];
  }, [catalog]);

  const selectedOption = useMemo(
    () => options.find((o) => o.itemNumber === value) ?? options[0] ?? null,
    [options, value]
  );

  const formatOptionLabel = (opt: PromotionCatalogItem) =>
    opt.itemNumber === 'ALL'
      ? opt.itemName
      : `${opt.itemName} (#${opt.itemNumber})`;

  const selectedLabel = selectedOption ? formatOptionLabel(selectedOption) : '';

  const [query, setQuery] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!isEditing || !trimmedQuery) return options;
    return options.filter(
      (o) =>
        o.itemNumber.toLowerCase().includes(trimmedQuery) ||
        o.itemName.toLowerCase().includes(trimmedQuery) ||
        o.familyGroup.toLowerCase().includes(trimmedQuery)
    );
  }, [options, isEditing, trimmedQuery]);

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

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);

  const commitOption = (opt: PromotionCatalogItem, keepFocus = true) => {
    onChange(opt.itemNumber);
    setIsEditing(false);
    setIsOpen(false);
    setQuery('');
    if (keepFocus) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightIndex((i) => Math.min(i + 1, Math.max(filteredOptions.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (isOpen && filteredOptions[highlightIndex]) {
        e.preventDefault();
        commitOption(filteredOptions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setIsEditing(false);
      setQuery('');
    } else if (e.key === 'Tab') {
      if (isEditing && trimmedQuery && filteredOptions[highlightIndex]) {
        commitOption(filteredOptions[highlightIndex], false);
      } else {
        setIsOpen(false);
        setIsEditing(false);
        setQuery('');
      }
    }
  };

  const openList = () => {
    if (disabled) return;
    setIsOpen(true);
    const idx = options.findIndex((o) => o.itemNumber === value);
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
        placeholder="Search promo name or item # from dts_object..."
        disabled={disabled}
        onFocus={(e) => {
          e.target.select();
          openList();
        }}
        onClick={openList}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsEditing(true);
          setIsOpen(true);
          setHighlightIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />

      {isOpen && (
        <ul className="store-search-menu" role="listbox" id={listboxId} ref={listRef}>
          {filteredOptions.length === 0 ? (
            <li className="store-search-empty">
              No promotion matches “{query.trim()}”
            </li>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.itemNumber === value;
              const isHighlighted = idx === highlightIndex;
              return (
                <li
                  key={`${opt.itemNumber}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`store-search-option ${isHighlighted ? 'highlighted' : ''} ${
                    isSelected ? 'selected' : ''
                  }`}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitOption(opt);
                  }}
                >
                  <span className="store-search-option-code">
                    {opt.itemNumber === 'ALL' ? 'ALL' : opt.itemNumber}
                  </span>
                  <span className="store-search-option-label">
                    {opt.itemName}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
