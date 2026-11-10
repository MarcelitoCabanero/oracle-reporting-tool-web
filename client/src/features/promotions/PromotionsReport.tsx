import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  BarChart3,
  CalendarDays,
  Eye,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Info,
  PackageCheck,
  Pin,
  PinOff,
  Receipt,
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
  type PromotionPairedItem,
  type PromotionSummaryRow,
  type StorePromoPerformanceRow,
} from './promotionsExportUtils';

type PromotionsTab = 'monitoring' | 'analytics';
type GroupMode = 'store-item' | 'consolidated';
type TrendGranularity = 'daily' | 'monthly';
type ChartMetricMode = 'amt' | 'qty';
type TrendSortOrder = 'chronological' | 'desc' | 'asc';
type TableSortDirection = 'asc' | 'desc';

type StoreItemSortField =
  | 'locationName'
  | 'itemNumber'
  | 'itemName'
  | 'checkCount'
  | 'qty'
  | 'avgPrice'
  | 'amt'
  | 'share';

type ConsolidatedSortField =
  | 'itemNumber'
  | 'itemName'
  | 'storeCount'
  | 'checkCount'
  | 'qty'
  | 'avgPrice'
  | 'amt'
  | 'share';

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
  pinnedPromoIds?: string[];
  storeItemSort?: { field: StoreItemSortField; dir: TableSortDirection };
  consolidatedSort?: { field: ConsolidatedSortField; dir: TableSortDirection };
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

  // Table sorting & Pin-to-Compare Matrix state
  const [pinnedPromoIds, setPinnedPromoIds] = useState<string[]>(
    () => savedSession.pinnedPromoIds ?? []
  );
  const [userClearedPins, setUserClearedPins] = useState<boolean>(false);
  const [storeItemSort, setStoreItemSort] = useState<{
    field: StoreItemSortField;
    dir: TableSortDirection;
  }>(() => savedSession.storeItemSort ?? { field: 'amt', dir: 'desc' });
  const [consolidatedSort, setConsolidatedSort] = useState<{
    field: ConsolidatedSortField;
    dir: TableSortDirection;
  }>(() => savedSession.consolidatedSort ?? { field: 'amt', dir: 'desc' });
  const [showAllLeaderboardPromos, setShowAllLeaderboardPromos] = useState<boolean>(false);

  // Drill-down state (Items Used in Promo + per-plan cache for Pin-to-Compare Matrix)
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);
  const [activeDrilldown, setActiveDrilldown] =
    useState<PromotionCheckDetailsResponse | null>(null);
  const [drilldownByPromo, setDrilldownByPromo] = useState<
    Record<string, PromotionCheckDetailsResponse>
  >({});
  const [loadingPromoMap, setLoadingPromoMap] = useState<Record<string, boolean>>({});
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
        pinnedPromoIds,
        storeItemSort,
        consolidatedSort,
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
    pinnedPromoIds,
    storeItemSort,
    consolidatedSort,
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
    setDrilldownByPromo({});
    setDrilldownError(null);
    setUserClearedPins(false);

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
      setPinnedPromoIds([]);
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
    preserveScroll?: boolean;
    cacheOnly?: boolean;
  }) {
    if (!loadedFilters) return;

    const targetStore =
      params.locationName && params.locationName !== 'ALL'
        ? params.locationName
        : selectedStoreFilter || loadedFilters.locationName;

    if (!params.cacheOnly) {
      setDrilldownLoading(true);
      setDrilldownError(null);
      setDrilldownMajorGroup('');
      setDrilldownRoleFilter('all');
    }
    setLoadingPromoMap((prev) => ({ ...prev, [params.itemNumber]: true }));

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

      const detailPayload = data as PromotionCheckDetailsResponse;
      setDrilldownByPromo((prev) => ({
        ...prev,
        [params.itemNumber]: detailPayload,
      }));

      if (!params.cacheOnly) {
        setActiveDrilldown(detailPayload);

        if (!params.preserveScroll) {
          requestAnimationFrame(() => {
            drilldownPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        }
      }
    } catch (err) {
      if (!params.cacheOnly) {
        setDrilldownError((err as Error).message);
      }
    } finally {
      if (!params.cacheOnly) {
        setDrilldownLoading(false);
      }
      setLoadingPromoMap((prev) => ({ ...prev, [params.itemNumber]: false }));
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

  // Consolidated by Promotion Item across stores (with Top Store per plan)
  const consolidatedPromos = useMemo<ConsolidatedPromoRow[]>(() => {
    const map = new Map<
      string,
      {
        itemNumber: string;
        itemName: string;
        familyGroup: string;
        stores: Set<string>;
        storeMetrics: Map<string, { amt: number; qty: number }>;
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
          storeMetrics: new Map<string, { amt: number; qty: number }>(),
          checkCount: 0,
          qty: 0,
          amt: 0,
          netSales: 0,
        };
        map.set(key, entry);
      }
      if (r.locationName) {
        entry.stores.add(r.locationName);
        const currStore = entry.storeMetrics.get(r.locationName) ?? { amt: 0, qty: 0 };
        currStore.amt += r.amt;
        currStore.qty += r.qty;
        entry.storeMetrics.set(r.locationName, currStore);
      }
      entry.checkCount += r.checkCount;
      entry.qty += r.qty;
      entry.amt += r.amt;
      entry.netSales += r.netSales;
    }

    return Array.from(map.values())
      .map((e) => {
        let topStoreName = '—';
        let topStoreAmt = 0;
        let topStoreQty = 0;
        for (const [loc, st] of e.storeMetrics.entries()) {
          if (st.amt > topStoreAmt || (st.amt === topStoreAmt && st.qty > topStoreQty)) {
            topStoreName = loc;
            topStoreAmt = st.amt;
            topStoreQty = st.qty;
          }
        }
        return {
          itemNumber: e.itemNumber,
          itemName: e.itemName,
          familyGroup: e.familyGroup,
          storeCount: e.stores.size,
          checkCount: e.checkCount,
          qty: e.qty,
          amt: e.amt,
          netSales: e.netSales,
          topStoreName,
          topStoreAmt,
          topStoreQty,
        };
      })
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

  // Top Promotions for Leaderboard
  const top10Promos = useMemo(() => {
    return [...consolidatedPromos]
      .sort((a, b) =>
        topPromoMetric === 'amt' ? b.amt - a.amt || b.qty - a.qty : b.qty - a.qty || b.amt - a.amt
      )
      .slice(0, 10);
  }, [consolidatedPromos, topPromoMetric]);

  const leaderboardPromos = useMemo(() => {
    const sorted = [...consolidatedPromos].sort((a, b) =>
      topPromoMetric === 'amt' ? b.amt - a.amt || b.qty - a.qty : b.qty - a.qty || b.amt - a.amt
    );
    return showAllLeaderboardPromos ? sorted : sorted.slice(0, 10);
  }, [consolidatedPromos, topPromoMetric, showAllLeaderboardPromos]);

  // Auto-seed Pin-to-Compare Matrix with top 3 plans (2–4 plans) when results load
  useEffect(() => {
    if (consolidatedPromos.length === 0) return;
    setPinnedPromoIds((curr) => {
      const validExisting = curr.filter((id) =>
        consolidatedPromos.some((p) => p.itemNumber === id)
      );
      if (validExisting.length > 0) {
        return validExisting.length === curr.length ? curr : validExisting;
      }
      if (userClearedPins) return [];
      return consolidatedPromos.slice(0, Math.min(3, consolidatedPromos.length)).map((p) => p.itemNumber);
    });
  }, [consolidatedPromos, userClearedPins]);

  // Resolved Pinned Plans (2–4 plans) for the Pin-to-Compare Matrix
  const pinnedPlans = useMemo<ConsolidatedPromoRow[]>(() => {
    const map = new Map(consolidatedPromos.map((p) => [p.itemNumber, p]));
    return pinnedPromoIds
      .map((id) => map.get(id))
      .filter((p): p is ConsolidatedPromoRow => Boolean(p))
      .slice(0, 4);
  }, [consolidatedPromos, pinnedPromoIds]);

  const compareStats = useMemo(() => {
    let maxAmt = 0;
    let maxQty = 0;
    let maxChecks = 0;
    let maxAvgPrice = 0;
    let maxStoreCount = 0;
    for (const p of pinnedPlans) {
      const avgP = p.qty > 0 ? p.amt / p.qty : 0;
      if (p.amt > maxAmt) maxAmt = p.amt;
      if (p.qty > maxQty) maxQty = p.qty;
      if (p.checkCount > maxChecks) maxChecks = p.checkCount;
      if (avgP > maxAvgPrice) maxAvgPrice = avgP;
      if (p.storeCount > maxStoreCount) maxStoreCount = p.storeCount;
    }
    return { maxAmt, maxQty, maxChecks, maxAvgPrice, maxStoreCount };
  }, [pinnedPlans]);

  function togglePinPromo(itemNumber: string) {
    setUserClearedPins(false);
    setPinnedPromoIds((curr) => {
      if (curr.includes(itemNumber)) {
        const next = curr.filter((id) => id !== itemNumber);
        if (next.length === 0) setUserClearedPins(true);
        return next;
      }
      if (curr.length >= 4) {
        return [...curr.slice(1), itemNumber];
      }
      return [...curr, itemNumber];
    });
  }

  function handlePinTopPlans(count = 3) {
    setUserClearedPins(false);
    const source = top10Promos.length > 0 ? top10Promos : consolidatedPromos;
    setPinnedPromoIds(source.slice(0, Math.min(4, Math.max(2, count))).map((p) => p.itemNumber));
  }

  function handleClearPins() {
    setUserClearedPins(true);
    setPinnedPromoIds([]);
  }

  function handleLoadPinnedReceiptItems() {
    for (const plan of pinnedPlans) {
      if (!drilldownByPromo[plan.itemNumber] && !loadingPromoMap[plan.itemNumber]) {
        void handleInspectPromoDetails({
          itemNumber: plan.itemNumber,
          itemName: plan.itemName,
          preserveScroll: true,
          cacheOnly: true,
        });
      }
    }
  }

  // Click-to-sort handlers and sorted datasets for Store-Item and Consolidated tables
  function handleStoreItemSort(field: StoreItemSortField) {
    setStoreItemSort((curr) => {
      if (curr.field === field) {
        return { field, dir: curr.dir === 'desc' ? 'asc' : 'desc' };
      }
      const defaultAsc =
        field === 'locationName' || field === 'itemNumber' || field === 'itemName';
      return { field, dir: defaultAsc ? 'asc' : 'desc' };
    });
  }

  function handleConsolidatedSort(field: ConsolidatedSortField) {
    setConsolidatedSort((curr) => {
      if (curr.field === field) {
        return { field, dir: curr.dir === 'desc' ? 'asc' : 'desc' };
      }
      const defaultAsc = field === 'itemNumber' || field === 'itemName';
      return { field, dir: defaultAsc ? 'asc' : 'desc' };
    });
  }

  const sortedFilteredRows = useMemo(() => {
    const dirMul = storeItemSort.dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      switch (storeItemSort.field) {
        case 'locationName':
          return (
            dirMul * a.locationName.localeCompare(b.locationName) ||
            b.amt - a.amt
          );
        case 'itemNumber':
          return (
            dirMul *
              a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true }) ||
            b.amt - a.amt
          );
        case 'itemName':
          return dirMul * a.itemName.localeCompare(b.itemName) || b.amt - a.amt;
        case 'checkCount':
          return dirMul * (a.checkCount - b.checkCount) || b.amt - a.amt;
        case 'qty':
          return dirMul * (a.qty - b.qty) || b.amt - a.amt;
        case 'avgPrice': {
          const avgA = a.qty > 0 ? a.amt / a.qty : 0;
          const avgB = b.qty > 0 ? b.amt / b.qty : 0;
          return dirMul * (avgA - avgB) || b.amt - a.amt;
        }
        case 'share':
        case 'amt':
        default:
          return dirMul * (a.amt - b.amt) || b.qty - a.qty;
      }
    });
  }, [filteredRows, storeItemSort]);

  const sortedConsolidatedPromos = useMemo(() => {
    const dirMul = consolidatedSort.dir === 'asc' ? 1 : -1;
    return [...consolidatedPromos].sort((a, b) => {
      switch (consolidatedSort.field) {
        case 'itemNumber':
          return (
            dirMul *
              a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true }) ||
            b.amt - a.amt
          );
        case 'itemName':
          return dirMul * a.itemName.localeCompare(b.itemName) || b.amt - a.amt;
        case 'storeCount':
          return dirMul * (a.storeCount - b.storeCount) || b.amt - a.amt;
        case 'checkCount':
          return dirMul * (a.checkCount - b.checkCount) || b.amt - a.amt;
        case 'qty':
          return dirMul * (a.qty - b.qty) || b.amt - a.amt;
        case 'avgPrice': {
          const avgA = a.qty > 0 ? a.amt / a.qty : 0;
          const avgB = b.qty > 0 ? b.amt / b.qty : 0;
          return dirMul * (avgA - avgB) || b.amt - a.amt;
        }
        case 'share':
        case 'amt':
        default:
          return dirMul * (a.amt - b.amt) || b.qty - a.qty;
      }
    });
  }, [consolidatedPromos, consolidatedSort]);

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
        <div className="d-flex flex-column gap-3 promo-campaign-workspace">
          {/* 4 Executive KPI Cards */}
          <div className="row g-3">
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
                  <span className="menuitem-kpi-label">Total Promo Qty &amp; Checks</span>
                  <ShoppingBag size={16} className="menuitem-kpi-icon" />
                </div>
                <div className="menuitem-kpi-value">{formatQty(visibleTotals.qty)}</div>
                <div className="menuitem-kpi-subtext">
                  {visibleTotals.checkCount.toLocaleString('en-PH')} guest check(s) •{' '}
                  {visibleTotals.checkCount > 0
                    ? (visibleTotals.qty / visibleTotals.checkCount).toFixed(2)
                    : '0.00'}{' '}
                  qty/check
                </div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="menuitem-kpi-card h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="menuitem-kpi-label">Active Promotion Plans</span>
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
                    ? `Leader: ${topPromoOverall.itemName}`
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
                        ? sortedConsolidatedPromos.length
                        : sortedFilteredRows.length}
                    </strong>
                  </span>
                  <span className="menuitem-meta-pill">
                    Checks: <strong>{visibleTotals.checkCount.toLocaleString('en-PH')}</strong>
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
                          rows: sortedFilteredRows,
                          consolidatedPromos: sortedConsolidatedPromos,
                          storePerformance,
                          dailyTrend,
                          filters: loadedFilters,
                          activeDrilldown,
                        })
                      }
                      disabled={sortedFilteredRows.length === 0}
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
                          rows: sortedFilteredRows,
                          consolidatedPromos: sortedConsolidatedPromos,
                          filters: loadedFilters,
                          groupMode,
                        })
                      }
                      disabled={sortedFilteredRows.length === 0}
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
                      Click any column header to sort. Use <strong>Pin</strong> to add up to 4 plans to the Comparison Matrix, or click <strong>Items Used</strong> to inspect receipt items.
                    </span>
                  </div>
                  {pinnedPromoIds.length > 0 && (
                    <button
                      type="button"
                      className="promo-pin-btn active py-0"
                      onClick={() => setActiveTab('analytics')}
                    >
                      <GitCompare size={13} />
                      <span>View Compare Matrix ({pinnedPromoIds.length} pinned)</span>
                    </button>
                  )}
                </div>

                <div className="table-responsive rof-grid-scroll-container menuitem-pivot-scroll-container">
                  {groupMode === 'store-item' ? (
                    <table className="table align-middle mb-0 bom-data-table menuitem-summary-table">
                      <thead>
                        <tr>
                          <SortableHeaderCell
                            label="LOCATION NAME"
                            field="locationName"
                            activeField={storeItemSort.field}
                            direction={storeItemSort.dir}
                            onSort={handleStoreItemSort}
                            style={{ width: '155px' }}
                          />
                          <SortableHeaderCell
                            label="ITEM NUMBER"
                            field="itemNumber"
                            activeField={storeItemSort.field}
                            direction={storeItemSort.dir}
                            onSort={handleStoreItemSort}
                            style={{ width: '120px' }}
                          />
                          <SortableHeaderCell
                            label="PROMOTION ITEM NAME"
                            field="itemName"
                            activeField={storeItemSort.field}
                            direction={storeItemSort.dir}
                            onSort={handleStoreItemSort}
                          />
                          <SortableHeaderCell
                            label="GUEST CHECKS"
                            field="checkCount"
                            activeField={storeItemSort.field}
                            direction={storeItemSort.dir}
                            onSort={handleStoreItemSort}
                            align="end"
                            style={{ width: '125px' }}
                          />
                          <SortableHeaderCell
                            label="QTY SOLD"
                            field="qty"
                            activeField={storeItemSort.field}
                            direction={storeItemSort.dir}
                            onSort={handleStoreItemSort}
                            align="end"
                            style={{ width: '115px' }}
                          />
                          <SortableHeaderCell
                            label="AVG UNIT VALUE"
                            field="avgPrice"
                            activeField={storeItemSort.field}
                            direction={storeItemSort.dir}
                            onSort={handleStoreItemSort}
                            align="end"
                            style={{ width: '135px' }}
                          />
                          <SortableHeaderCell
                            label="TOTAL AMOUNT (AMT)"
                            field="amt"
                            activeField={storeItemSort.field}
                            direction={storeItemSort.dir}
                            onSort={handleStoreItemSort}
                            align="end"
                            style={{ width: '160px' }}
                          />
                          <SortableHeaderCell
                            label="% SHARE"
                            field="share"
                            activeField={storeItemSort.field}
                            direction={storeItemSort.dir}
                            onSort={handleStoreItemSort}
                            align="end"
                            style={{ width: '125px' }}
                          />
                          <th className="text-center" style={{ width: '195px' }}>
                            PROMO DETAILS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedFilteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-5 menuitem-empty-state">
                              No Promotion records found for the selected store, promotion, and date range.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {sortedFilteredRows.map((row, idx) => {
                              const sharePct =
                                visibleTotals.amt > 0
                                  ? (row.amt / visibleTotals.amt) * 100
                                  : 0;
                              const avgUnitVal = row.qty > 0 ? row.amt / row.qty : 0;
                              const isSelectedDrill =
                                activeDrilldown?.promo.itemNumber === row.itemNumber &&
                                activeDrilldown?.promo.locationName === row.locationName;
                              const isPinned = pinnedPromoIds.includes(row.itemNumber);

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
                                      row.checkCount === 0
                                        ? 'menuitem-cell-zero'
                                        : 'menuitem-cell-active'
                                    }`}
                                  >
                                    {row.checkCount.toLocaleString('en-PH')}
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
                                      isZeroValue(avgUnitVal)
                                        ? 'menuitem-cell-zero'
                                        : 'menuitem-secondary-cell fw-semibold'
                                    }`}
                                  >
                                    ₱{formatMoney(avgUnitVal)}
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
                                  <td className="num-cell">
                                    <div className="promo-inline-share-wrap">
                                      <span className="menuitem-secondary-cell fw-semibold">
                                        {sharePct.toFixed(2)}%
                                      </span>
                                      <div className="promo-inline-share-track" aria-hidden="true">
                                        <div
                                          className="promo-inline-share-fill"
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              Math.max(sharePct, sharePct > 0 ? 3 : 0)
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-center">
                                    <div className="d-inline-flex align-items-center gap-1">
                                      <button
                                        type="button"
                                        className={`promo-pin-btn ${isPinned ? 'active' : ''}`}
                                        onClick={() => togglePinPromo(row.itemNumber)}
                                        title={
                                          isPinned
                                            ? 'Unpin from Compare Matrix'
                                            : 'Pin promotion to Compare Matrix'
                                        }
                                      >
                                        {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                                        <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                                      </button>
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
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Sticky TOTAL Footer Row */}
                            <tr className="rof-total-row fw-bold">
                              <td className="bom-charcoal-text">TOTAL</td>
                              <td className="menuitem-footer-count">
                                {sortedFilteredRows.length} Row(s)
                              </td>
                              <td>{visibleTotals.promoCount} Unique Promotion(s)</td>
                              <td className="num-cell bom-charcoal-text">
                                {visibleTotals.checkCount.toLocaleString('en-PH')}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                {formatQty(visibleTotals.qty)}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                ₱
                                {formatMoney(
                                  visibleTotals.qty > 0
                                    ? visibleTotals.amt / visibleTotals.qty
                                    : 0
                                )}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                ₱{formatMoney(visibleTotals.amt)}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                <div className="promo-inline-share-wrap">
                                  <span>100.00%</span>
                                  <div className="promo-inline-share-track" aria-hidden="true">
                                    <div
                                      className="promo-inline-share-fill"
                                      style={{ width: '100%' }}
                                    />
                                  </div>
                                </div>
                              </td>
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
                          <SortableHeaderCell
                            label="ITEM NUMBER"
                            field="itemNumber"
                            activeField={consolidatedSort.field}
                            direction={consolidatedSort.dir}
                            onSort={handleConsolidatedSort}
                            style={{ width: '125px' }}
                          />
                          <SortableHeaderCell
                            label="PROMOTION ITEM NAME"
                            field="itemName"
                            activeField={consolidatedSort.field}
                            direction={consolidatedSort.dir}
                            onSort={handleConsolidatedSort}
                          />
                          <SortableHeaderCell
                            label="STORES SOLD"
                            field="storeCount"
                            activeField={consolidatedSort.field}
                            direction={consolidatedSort.dir}
                            onSort={handleConsolidatedSort}
                            align="center"
                            style={{ width: '130px' }}
                          />
                          <SortableHeaderCell
                            label="GUEST CHECKS"
                            field="checkCount"
                            activeField={consolidatedSort.field}
                            direction={consolidatedSort.dir}
                            onSort={handleConsolidatedSort}
                            align="end"
                            style={{ width: '130px' }}
                          />
                          <SortableHeaderCell
                            label="TOTAL QTY"
                            field="qty"
                            activeField={consolidatedSort.field}
                            direction={consolidatedSort.dir}
                            onSort={handleConsolidatedSort}
                            align="end"
                            style={{ width: '120px' }}
                          />
                          <SortableHeaderCell
                            label="AVG UNIT VALUE"
                            field="avgPrice"
                            activeField={consolidatedSort.field}
                            direction={consolidatedSort.dir}
                            onSort={handleConsolidatedSort}
                            align="end"
                            style={{ width: '135px' }}
                          />
                          <SortableHeaderCell
                            label="TOTAL AMOUNT (AMT)"
                            field="amt"
                            activeField={consolidatedSort.field}
                            direction={consolidatedSort.dir}
                            onSort={handleConsolidatedSort}
                            align="end"
                            style={{ width: '165px' }}
                          />
                          <SortableHeaderCell
                            label="% SHARE"
                            field="share"
                            activeField={consolidatedSort.field}
                            direction={consolidatedSort.dir}
                            onSort={handleConsolidatedSort}
                            align="end"
                            style={{ width: '125px' }}
                          />
                          <th className="text-center" style={{ width: '205px' }}>
                            PROMO DETAILS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedConsolidatedPromos.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-5 menuitem-empty-state">
                              No Promotion records found for the selected filters.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {sortedConsolidatedPromos.map((promo) => {
                              const sharePct =
                                visibleTotals.amt > 0
                                  ? (promo.amt / visibleTotals.amt) * 100
                                  : 0;
                              const avgUnitVal = promo.qty > 0 ? promo.amt / promo.qty : 0;
                              const isSelectedDrill =
                                activeDrilldown?.promo.itemNumber === promo.itemNumber;
                              const isPinned = pinnedPromoIds.includes(promo.itemNumber);

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
                                  <td
                                    className={`num-cell ${
                                      promo.checkCount === 0
                                        ? 'menuitem-cell-zero'
                                        : 'menuitem-cell-active'
                                    }`}
                                  >
                                    {promo.checkCount.toLocaleString('en-PH')}
                                  </td>
                                  <td className="num-cell fw-semibold">
                                    {formatQty(promo.qty)}
                                  </td>
                                  <td className="num-cell menuitem-secondary-cell fw-semibold">
                                    ₱{formatMoney(avgUnitVal)}
                                  </td>
                                  <td className="num-cell fw-bold bom-charcoal-text">
                                    ₱{formatMoney(promo.amt)}
                                  </td>
                                  <td className="num-cell">
                                    <div className="promo-inline-share-wrap">
                                      <span className="menuitem-secondary-cell fw-semibold">
                                        {sharePct.toFixed(2)}%
                                      </span>
                                      <div className="promo-inline-share-track" aria-hidden="true">
                                        <div
                                          className="promo-inline-share-fill"
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              Math.max(sharePct, sharePct > 0 ? 3 : 0)
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-center">
                                    <div className="d-inline-flex align-items-center gap-1">
                                      <button
                                        type="button"
                                        className={`promo-pin-btn ${isPinned ? 'active' : ''}`}
                                        onClick={() => togglePinPromo(promo.itemNumber)}
                                        title={
                                          isPinned
                                            ? 'Unpin from Compare Matrix'
                                            : 'Pin promotion to Compare Matrix'
                                        }
                                      >
                                        {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                                        <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                                      </button>
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
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            <tr className="rof-total-row fw-bold">
                              <td className="bom-charcoal-text">TOTAL</td>
                              <td className="menuitem-footer-count">
                                {sortedConsolidatedPromos.length} Unique Promo(s)
                              </td>
                              <td className="text-center">
                                {visibleTotals.storeCount} store(s)
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                {visibleTotals.checkCount.toLocaleString('en-PH')}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                {formatQty(visibleTotals.qty)}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                ₱
                                {formatMoney(
                                  visibleTotals.qty > 0
                                    ? visibleTotals.amt / visibleTotals.qty
                                    : 0
                                )}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                ₱{formatMoney(visibleTotals.amt)}
                              </td>
                              <td className="num-cell bom-charcoal-text">
                                <div className="promo-inline-share-wrap">
                                  <span>100.00%</span>
                                  <div className="promo-inline-share-track" aria-hidden="true">
                                    <div
                                      className="promo-inline-share-fill"
                                      style={{ width: '100%' }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td></td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ===============================================================
              TAB 2: PROMOTION PERFORMANCE ANALYTICS (3-TIER CAMPAIGN HIERARCHY)
              =============================================================== */}
          {activeTab === 'analytics' && (
            <div className="promo-tier-stack">
              {/* ===========================================================
                  TIER 1 (PRIMARY ANCHOR ABOVE THE FOLD):
                  PROMOTION PLAN LEADERBOARD & PIN-TO-COMPARE MATRIX (2–4 PLANS)
                  =========================================================== */}
              <div className="promo-tier-section">
                <div className="promo-tier1-grid">
                  {/* Left Sub-Panel: Promotion Plan Leaderboard */}
                  <div className="menuitem-flat-panel p-3 p-md-4">
                    <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <Award size={18} className="bom-charcoal-text flex-shrink-0" />
                        <div>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h3 className="h6 fw-bold mb-0 bom-main-heading">
                              Promotion Plan Leaderboard
                            </h3>
                            <span className="menuitem-meta-pill py-0 px-2">
                              {consolidatedPromos.length} Plan(s)
                            </span>
                          </div>
                          <p className="menuitem-chart-subtext mb-0 mt-1">
                            Pin 2–4 plans to compare side-by-side or inspect bundled receipt items in place.
                          </p>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <div className="btn-group btn-group-sm" role="group" aria-label="Leaderboard Metric">
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
                    </div>

                    {leaderboardPromos.length === 0 ? (
                      <div className="text-center py-4 menuitem-empty-state">
                        No promotion plans available for the selected filters.
                      </div>
                    ) : (
                      <>
                        <div className="promo-leaderboard-list">
                          {leaderboardPromos.map((promo, idx) => {
                            const maxVal =
                              topPromoMetric === 'amt'
                                ? leaderboardPromos[0]?.amt || 1
                                : leaderboardPromos[0]?.qty || 1;
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
                            const avgPromoPrice = promo.qty > 0 ? promo.amt / promo.qty : 0;
                            const isPinned = pinnedPromoIds.includes(promo.itemNumber);
                            const isInspecting =
                              activeDrilldown?.promo.itemNumber === promo.itemNumber;
                            const isThisLoading = Boolean(loadingPromoMap[promo.itemNumber]);

                            return (
                              <div
                                key={promo.itemNumber}
                                className={`promo-leaderboard-row ${
                                  isPinned ? 'is-pinned' : ''
                                } ${isInspecting ? 'is-inspecting' : ''}`}
                              >
                                <div className="d-flex align-items-start justify-content-between gap-2">
                                  <div className="d-flex align-items-center gap-2 min-w-0 flex-wrap">
                                    <span className="menuitem-rank-badge">#{idx + 1}</span>
                                    <span className="menuitem-code-badge">
                                      {promo.itemNumber}
                                    </span>
                                    <span
                                      className="fw-bold bom-charcoal-text text-truncate"
                                      title={promo.itemName}
                                    >
                                      {promo.itemName}
                                    </span>
                                  </div>

                                  <div className="text-end flex-shrink-0">
                                    <div className="fw-bold bom-charcoal-text text-nowrap">
                                      {topPromoMetric === 'amt'
                                        ? `₱${formatMoney(promo.amt)}`
                                        : `${formatQty(promo.qty)} units`}{' '}
                                      <span className="menuitem-chart-subtext fw-semibold">
                                        ({sharePct.toFixed(1)}%)
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="menuitem-progress-track">
                                  <div
                                    className="menuitem-progress-fill"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </div>

                                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                                  <div className="promo-leaderboard-metrics">
                                    <span>
                                      Qty: <strong>{formatQty(promo.qty)}</strong>
                                    </span>
                                    <span>
                                      Checks:{' '}
                                      <strong>
                                        {promo.checkCount.toLocaleString('en-PH')}
                                      </strong>
                                    </span>
                                    <span>
                                      Avg: <strong>₱{formatMoney(avgPromoPrice)}</strong>
                                    </span>
                                    <span>
                                      Reach: <strong>{promo.storeCount} store(s)</strong>
                                    </span>
                                    {promo.topStoreName && promo.topStoreName !== '—' && (
                                      <span className="text-truncate" title={promo.topStoreName}>
                                        Top: <strong>{promo.topStoreName}</strong>
                                      </span>
                                    )}
                                  </div>

                                  <div className="d-inline-flex align-items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      className={`promo-pin-btn ${isPinned ? 'active' : ''}`}
                                      onClick={() => togglePinPromo(promo.itemNumber)}
                                      title={
                                        isPinned
                                          ? 'Remove from Pin-to-Compare Matrix'
                                          : 'Pin to Compare Matrix (up to 4 plans)'
                                      }
                                    >
                                      {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                                      <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      className={`promo-inspect-btn ${
                                        isInspecting ? 'active' : ''
                                      }`}
                                      onClick={() => {
                                        if (isInspecting) {
                                          setActiveDrilldown(null);
                                        } else {
                                          void handleInspectPromoDetails({
                                            itemNumber: promo.itemNumber,
                                            itemName: promo.itemName,
                                            preserveScroll: true,
                                          });
                                        }
                                      }}
                                      disabled={isThisLoading}
                                      title="Inspect bundled zero-price & co-sold receipt items without leaving this view"
                                    >
                                      <Receipt size={13} />
                                      <span>
                                        {isThisLoading
                                          ? 'Loading...'
                                          : isInspecting
                                          ? 'Hide Items'
                                          : 'Receipt Items'}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {consolidatedPromos.length > 10 && (
                          <div className="mt-2 pt-2 border-top d-flex justify-content-between align-items-center small">
                            <span className="menuitem-chart-subtext">
                              Showing {leaderboardPromos.length} of {consolidatedPromos.length}{' '}
                              promotional plans
                            </span>
                            <button
                              type="button"
                              className="promo-pin-btn"
                              onClick={() => setShowAllLeaderboardPromos((v) => !v)}
                            >
                              {showAllLeaderboardPromos
                                ? 'Show Top 10 Only'
                                : `Show All (${consolidatedPromos.length})`}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right Sub-Panel: Pin-to-Compare Matrix (2–4 Plans) */}
                  <div className="menuitem-flat-panel p-3 p-md-4">
                    <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <GitCompare size={18} className="bom-charcoal-text flex-shrink-0" />
                        <div>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h3 className="h6 fw-bold mb-0 bom-main-heading">
                              Pin-to-Compare Campaign Matrix
                            </h3>
                            <span className="menuitem-meta-pill py-0 px-2">
                              {pinnedPlans.length} / 4 Pinned
                            </span>
                          </div>
                          <p className="menuitem-chart-subtext mb-0 mt-1">
                            Side-by-side comparison of 2–4 promotional plans across revenue, volume, guest checks, store reach, and bundled receipt items.
                          </p>
                        </div>
                      </div>

                      <div className="d-flex flex-wrap align-items-center gap-2">
                        {pinnedPlans.length > 0 && (
                          <button
                            type="button"
                            className="promo-pin-btn"
                            onClick={handleLoadPinnedReceiptItems}
                            title="Load bundled zero-price receipt items for all pinned plans"
                          >
                            <PackageCheck size={13} />
                            <span>Load Bundled Items</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="promo-pin-btn"
                          onClick={() => handlePinTopPlans(3)}
                          disabled={consolidatedPromos.length === 0}
                        >
                          <Pin size={13} />
                          <span>Pin Top 3</span>
                        </button>
                        {pinnedPlans.length > 0 && (
                          <button
                            type="button"
                            className="promo-pin-btn"
                            onClick={handleClearPins}
                          >
                            <X size={13} />
                            <span>Clear</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {pinnedPlans.length === 0 ? (
                      <div className="text-center py-5 menuitem-empty-state">
                        <GitCompare size={28} className="mb-2 text-secondary" />
                        <div className="fw-semibold bom-charcoal-text mb-1">
                          No Promotional Plans Pinned
                        </div>
                        <p className="menuitem-chart-subtext mb-3">
                          Pin 2 to 4 plans from the Leaderboard on the left to compare Total Promo Amount, Qty Sold, Guest Checks, Avg Promo Price, Store Reach, Top Store, and Bundled Zero-Price Items side by side.
                        </p>
                        {consolidatedPromos.length > 0 && (
                          <button
                            type="button"
                            className="promo-pin-btn active"
                            onClick={() => handlePinTopPlans(3)}
                          >
                            <Pin size={13} />
                            <span>Pin Top {Math.min(3, consolidatedPromos.length)} Plans Now</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {pinnedPlans.length === 1 && consolidatedPromos.length > 1 && (
                          <div className="d-flex align-items-center justify-content-between gap-2 px-3 py-2 mb-3 rounded-3 border bg-light small">
                            <span className="menuitem-chart-subtext">
                              Pin 1 to 3 more promotional plans from the Leaderboard for full side-by-side comparison.
                            </span>
                            <button
                              type="button"
                              className="promo-pin-btn"
                              onClick={() => handlePinTopPlans(3)}
                            >
                              Pin Top 3 Plans
                            </button>
                          </div>
                        )}

                        <div className="promo-compare-matrix-wrap">
                          <table className="promo-compare-table">
                            <thead>
                              <tr>
                                <th className="promo-compare-metric-col">
                                  CAMPAIGN METRIC
                                </th>
                                {pinnedPlans.map((plan) => {
                                  const rankIdx = consolidatedPromos.findIndex(
                                    (p) => p.itemNumber === plan.itemNumber
                                  );
                                  return (
                                    <th
                                      key={plan.itemNumber}
                                      className="promo-compare-plan-col"
                                    >
                                      <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                                        <div className="d-flex align-items-center gap-1 flex-wrap">
                                          {rankIdx >= 0 && (
                                            <span className="menuitem-rank-badge">
                                              #{rankIdx + 1}
                                            </span>
                                          )}
                                          <span className="menuitem-code-badge">
                                            {plan.itemNumber}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          className="menuitem-search-clear position-static"
                                          onClick={() => togglePinPromo(plan.itemNumber)}
                                          title={`Unpin ${plan.itemName}`}
                                          aria-label={`Unpin ${plan.itemName}`}
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                      <div
                                        className="fw-bold bom-charcoal-text text-truncate"
                                        title={plan.itemName}
                                      >
                                        {plan.itemName}
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {/* 1. Total Promo Amount (₱) */}
                              <tr>
                                <th scope="row" className="promo-compare-metric-col">
                                  Total Promo Amount (₱)
                                </th>
                                {pinnedPlans.map((plan) => {
                                  const sharePct =
                                    visibleTotals.amt > 0
                                      ? (plan.amt / visibleTotals.amt) * 100
                                      : 0;
                                  const isLeader =
                                    pinnedPlans.length > 1 &&
                                    plan.amt > 0 &&
                                    plan.amt === compareStats.maxAmt;
                                  return (
                                    <td
                                      key={plan.itemNumber}
                                      className="promo-compare-plan-col"
                                    >
                                      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                        <span className="fw-bold bom-charcoal-text">
                                          ₱{formatMoney(plan.amt)}
                                        </span>
                                        {isLeader && (
                                          <span className="promo-compare-leader-badge">
                                            HIGHEST
                                          </span>
                                        )}
                                      </div>
                                      <div className="d-flex align-items-center gap-2">
                                        <div className="promo-inline-share-track flex-grow-1">
                                          <div
                                            className="promo-inline-share-fill"
                                            style={{
                                              width: `${Math.min(
                                                100,
                                                Math.max(sharePct, sharePct > 0 ? 4 : 0)
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="menuitem-chart-subtext small">
                                          {sharePct.toFixed(1)}%
                                        </span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* 2. Qty Sold */}
                              <tr>
                                <th scope="row" className="promo-compare-metric-col">
                                  Qty Sold
                                </th>
                                {pinnedPlans.map((plan) => {
                                  const qtySharePct =
                                    visibleTotals.qty > 0
                                      ? (plan.qty / visibleTotals.qty) * 100
                                      : 0;
                                  const isLeader =
                                    pinnedPlans.length > 1 &&
                                    plan.qty > 0 &&
                                    plan.qty === compareStats.maxQty;
                                  return (
                                    <td
                                      key={plan.itemNumber}
                                      className="promo-compare-plan-col"
                                    >
                                      <div className="d-flex align-items-center justify-content-between gap-2">
                                        <span className="fw-bold bom-charcoal-text">
                                          {formatQty(plan.qty)} units
                                        </span>
                                        {isLeader && (
                                          <span className="promo-compare-leader-badge">
                                            HIGHEST
                                          </span>
                                        )}
                                      </div>
                                      <div className="menuitem-chart-subtext small">
                                        {qtySharePct.toFixed(1)}% of total promo units
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* 3. Guest Checks (checkCount) */}
                              <tr>
                                <th scope="row" className="promo-compare-metric-col">
                                  Guest Checks
                                </th>
                                {pinnedPlans.map((plan) => {
                                  const unitsPerCheck =
                                    plan.checkCount > 0 ? plan.qty / plan.checkCount : 0;
                                  const isLeader =
                                    pinnedPlans.length > 1 &&
                                    plan.checkCount > 0 &&
                                    plan.checkCount === compareStats.maxChecks;
                                  return (
                                    <td
                                      key={plan.itemNumber}
                                      className="promo-compare-plan-col"
                                    >
                                      <div className="d-flex align-items-center justify-content-between gap-2">
                                        <span className="fw-bold bom-charcoal-text">
                                          {plan.checkCount.toLocaleString('en-PH')} checks
                                        </span>
                                        {isLeader && (
                                          <span className="promo-compare-leader-badge">
                                            MOST
                                          </span>
                                        )}
                                      </div>
                                      <div className="menuitem-chart-subtext small">
                                        Avg {unitsPerCheck.toFixed(2)} promo units / check
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* 4. Avg Promo Price (amt / qty) */}
                              <tr>
                                <th scope="row" className="promo-compare-metric-col">
                                  Avg Promo Price
                                </th>
                                {pinnedPlans.map((plan) => {
                                  const avgPrice = plan.qty > 0 ? plan.amt / plan.qty : 0;
                                  const isLeader =
                                    pinnedPlans.length > 1 &&
                                    avgPrice > 0 &&
                                    Math.abs(avgPrice - compareStats.maxAvgPrice) < 0.005;
                                  return (
                                    <td
                                      key={plan.itemNumber}
                                      className="promo-compare-plan-col"
                                    >
                                      <div className="d-flex align-items-center justify-content-between gap-2">
                                        <span className="fw-bold bom-charcoal-text">
                                          ₱{formatMoney(avgPrice)}
                                        </span>
                                        {isLeader && (
                                          <span className="promo-compare-leader-badge">
                                            PREMIUM
                                          </span>
                                        )}
                                      </div>
                                      <div className="menuitem-chart-subtext small">
                                        Revenue per promo unit
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* 5. Store Reach (storeCount) */}
                              <tr>
                                <th scope="row" className="promo-compare-metric-col">
                                  Store Reach
                                </th>
                                {pinnedPlans.map((plan) => {
                                  const reachPct =
                                    visibleTotals.storeCount > 0
                                      ? (plan.storeCount / visibleTotals.storeCount) * 100
                                      : 0;
                                  const isLeader =
                                    pinnedPlans.length > 1 &&
                                    plan.storeCount > 0 &&
                                    plan.storeCount === compareStats.maxStoreCount;
                                  return (
                                    <td
                                      key={plan.itemNumber}
                                      className="promo-compare-plan-col"
                                    >
                                      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                        <span className="fw-bold bom-charcoal-text">
                                          {plan.storeCount} / {visibleTotals.storeCount} store(s)
                                        </span>
                                        {isLeader && (
                                          <span className="promo-compare-leader-badge">
                                            BROADEST
                                          </span>
                                        )}
                                      </div>
                                      <div className="d-flex align-items-center gap-2">
                                        <div className="promo-inline-share-track flex-grow-1">
                                          <div
                                            className="promo-inline-share-fill"
                                            style={{
                                              width: `${Math.min(100, Math.max(reachPct, 4))}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="menuitem-chart-subtext small">
                                          {reachPct.toFixed(0)}%
                                        </span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* 6. Top Store */}
                              <tr>
                                <th scope="row" className="promo-compare-metric-col">
                                  Top Store
                                </th>
                                {pinnedPlans.map((plan) => {
                                  const topStoreShare =
                                    plan.amt > 0 && plan.topStoreAmt
                                      ? (plan.topStoreAmt / plan.amt) * 100
                                      : 0;
                                  return (
                                    <td
                                      key={plan.itemNumber}
                                      className="promo-compare-plan-col"
                                    >
                                      <div className="fw-semibold bom-charcoal-text">
                                        <span className="rof-mod-badge">
                                          {plan.topStoreName || '—'}
                                        </span>
                                      </div>
                                      <div className="menuitem-chart-subtext small mt-1">
                                        ₱{formatMoney(plan.topStoreAmt ?? 0)} (
                                        {topStoreShare.toFixed(1)}% of plan)
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* 7. Bundled Zero-Price Receipt Items (activeDrilldown / cached details) */}
                              <tr>
                                <th scope="row" className="promo-compare-metric-col">
                                  Bundled Zero-Price Receipt Items
                                </th>
                                {pinnedPlans.map((plan) => {
                                  const cachedDetail =
                                    activeDrilldown?.promo.itemNumber === plan.itemNumber
                                      ? activeDrilldown
                                      : drilldownByPromo[plan.itemNumber] ?? null;
                                  const isPlanLoading = Boolean(loadingPromoMap[plan.itemNumber]);
                                  const isInspecting =
                                    activeDrilldown?.promo.itemNumber === plan.itemNumber;
                                  const bundledZeroItems = cachedDetail
                                    ? cachedDetail.pairedItems.filter(
                                        (item) => item.isZeroPriceBundleItem
                                      )
                                    : [];

                                  return (
                                    <td
                                      key={plan.itemNumber}
                                      className="promo-compare-plan-col"
                                    >
                                      {cachedDetail ? (
                                        <div className="d-flex flex-column gap-2">
                                          <div className="d-flex align-items-center justify-content-between gap-1 small">
                                            <span className="fw-semibold bom-charcoal-text">
                                              {bundledZeroItems.length} Zero-Price Item(s)
                                            </span>
                                            <span className="menuitem-chart-subtext">
                                              {cachedDetail.pairedItems.length} total paired
                                            </span>
                                          </div>

                                          {bundledZeroItems.length === 0 ? (
                                            <div className="menuitem-chart-subtext small">
                                              No zero-price bundle items on matched checks.
                                            </div>
                                          ) : (
                                            <div className="promo-compare-bundle-list">
                                              {bundledZeroItems.slice(0, 4).map((bItem) => (
                                                <div
                                                  key={`${bItem.itemNumber}-${bItem.majorGroup}`}
                                                  className="promo-compare-bundle-item"
                                                >
                                                  <div className="min-w-0">
                                                    <div
                                                      className="fw-semibold bom-charcoal-text text-truncate"
                                                      title={bItem.itemName}
                                                    >
                                                      {bItem.itemName}
                                                    </div>
                                                    <div className="menuitem-chart-subtext">
                                                      #{bItem.itemNumber} • {bItem.majorGroup}
                                                    </div>
                                                  </div>
                                                  <span className="fw-bold bom-charcoal-text text-nowrap">
                                                    {formatQty(bItem.totalQty)} qty
                                                  </span>
                                                </div>
                                              ))}
                                              {bundledZeroItems.length > 4 && (
                                                <div className="menuitem-chart-subtext small">
                                                  +{bundledZeroItems.length - 4} more bundled item(s)
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          <button
                                            type="button"
                                            className={`promo-inspect-btn w-100 ${
                                              isInspecting ? 'active' : ''
                                            }`}
                                            onClick={() => {
                                              if (isInspecting) {
                                                setActiveDrilldown(null);
                                              } else {
                                                setActiveDrilldown(cachedDetail);
                                              }
                                            }}
                                          >
                                            <Eye size={13} />
                                            <span>
                                              {isInspecting
                                                ? 'Hide Full Receipt Table'
                                                : 'Inspect All Receipt Items'}
                                            </span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="d-flex flex-column gap-2">
                                          <span className="menuitem-chart-subtext small">
                                            Inspect guest check items rung up alongside this promotion plan.
                                          </span>
                                          <button
                                            type="button"
                                            className="promo-inspect-btn w-100"
                                            onClick={() =>
                                              handleInspectPromoDetails({
                                                itemNumber: plan.itemNumber,
                                                itemName: plan.itemName,
                                                preserveScroll: true,
                                              })
                                            }
                                            disabled={isPlanLoading}
                                          >
                                            <Receipt size={13} />
                                            <span>
                                              {isPlanLoading
                                                ? 'Inspecting Checks...'
                                                : 'Load Bundled Receipt Items'}
                                            </span>
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ===========================================================
                  IN-PLACE RECEIPT ITEMS INSPECTOR (SHARED DRILL-DOWN PANEL)
                  Renders right below Tier 1 in Analytics without switching tabs!
                  =========================================================== */}
              {(drilldownLoading || drilldownError || activeDrilldown) && (
                <PromoReceiptDrilldownPanel
                  panelRef={drilldownPanelRef}
                  drilldownLoading={drilldownLoading}
                  drilldownError={drilldownError}
                  activeDrilldown={activeDrilldown}
                  filteredPairedItems={filteredPairedItems}
                  availableDrilldownMajorGroups={availableDrilldownMajorGroups}
                  drilldownRoleFilter={drilldownRoleFilter}
                  setDrilldownRoleFilter={setDrilldownRoleFilter}
                  drilldownMajorGroup={drilldownMajorGroup}
                  setDrilldownMajorGroup={setDrilldownMajorGroup}
                  onClose={() => {
                    setActiveDrilldown(null);
                    setDrilldownError(null);
                  }}
                />
              )}

              {/* ===========================================================
                  TIER 2: PER-STORE DISTRIBUTION & LOCATION SHARE BREAKDOWN
                  =========================================================== */}
              <div className="promo-tier-section">
                <div
                  className={`promo-tier2-grid ${
                    isAllStoresLoaded || storeChartSeries.length > 1 ? '' : 'single-col'
                  }`}
                >
                  {/* Per-Store Bar Chart */}
                  {(isAllStoresLoaded || storeChartSeries.length > 1) && (
                    <div className="menuitem-flat-panel p-3 p-md-4 h-100">
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
                            Top Store: <strong>{storeChartStats.topStoreLabel}</strong> (
                            {storeRankMetric === 'amt'
                              ? `₱${formatMoney(storeChartStats.topStoreVal)}`
                              : `${formatQty(storeChartStats.topStoreVal)} units`}
                            ) • Avg per Store:{' '}
                            <strong>
                              {storeRankMetric === 'amt'
                                ? `₱${formatMoney(storeChartStats.avgVal)}`
                                : `${formatQty(storeChartStats.avgVal)} units`}
                            </strong>{' '}
                            • Click any bar to filter by store.
                          </p>
                        </div>

                        {/* Store Chart Sort & Metric Controls */}
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <div
                            className="btn-group btn-group-sm"
                            role="group"
                            aria-label="Store Sort Order"
                          >
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

                          <div
                            className="btn-group btn-group-sm"
                            role="group"
                            aria-label="Store Metric"
                          >
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
                                        idx === storeChartStats.ticks.length - 1
                                          ? 'baseline'
                                          : ''
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
                                        )}, Qty ${formatQty(st.qty)}, Checks ${st.checkCount}`}
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
                                              <span>Guest Checks</span>
                                              <strong>
                                                {st.checkCount.toLocaleString('en-PH')}
                                              </strong>
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

                  {/* Store Location Share & Ranking */}
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
                        style={{ maxHeight: '360px' }}
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
                          const avgUnit = st.qty > 0 ? st.amt / st.qty : 0;

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
                                  Qty: {formatQty(st.qty)} • Checks:{' '}
                                  {st.checkCount.toLocaleString('en-PH')} • Avg: ₱
                                  {formatMoney(avgUnit)}
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

              {/* ===========================================================
                  TIER 3: DAILY / MONTHLY PROMOTION PERFORMANCE TREND
                  =========================================================== */}
              <div className="promo-tier-section">
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
                              Hover over any bar to inspect Business Date, Guest Checks,
                              Promo Qty Sold, and Promo Amount.
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
                                        Math.max(
                                          (val / trendStats.axisMax) * 100,
                                          val > 0 ? 3 : 0
                                        )
                                      )
                                    : 0;
                                const isHovered = hoveredTrendIndex === idx;
                                const isPeak =
                                  pt.periodKey === trendStats.peakKey &&
                                  trendStats.peakVal > 0;
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
                                            <span className="menuitem-tooltip-peak-tag">
                                              PEAK
                                            </span>
                                          )}
                                        </div>
                                        <div className="menuitem-tooltip-row">
                                          <span>Guest Checks</span>
                                          <strong>
                                            {pt.checkCount.toLocaleString('en-PH')}
                                          </strong>
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

                                    <div
                                      className="menuitem-trend-bar-label"
                                      title={pt.fullLabel}
                                    >
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
              </div>
            </div>
          )}

          {/* Shared Drill-Down Panel when active in Monitoring tab */}
          {activeTab === 'monitoring' &&
            (drilldownLoading || drilldownError || activeDrilldown) && (
              <PromoReceiptDrilldownPanel
                panelRef={drilldownPanelRef}
                drilldownLoading={drilldownLoading}
                drilldownError={drilldownError}
                activeDrilldown={activeDrilldown}
                filteredPairedItems={filteredPairedItems}
                availableDrilldownMajorGroups={availableDrilldownMajorGroups}
                drilldownRoleFilter={drilldownRoleFilter}
                setDrilldownRoleFilter={setDrilldownRoleFilter}
                drilldownMajorGroup={drilldownMajorGroup}
                setDrilldownMajorGroup={setDrilldownMajorGroup}
                onClose={() => {
                  setActiveDrilldown(null);
                  setDrilldownError(null);
                }}
              />
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

/**
 * Click-to-sort table header cell (`<th>`) with keyboard button and directional sort icon.
 */
function SortableHeaderCell<T extends string>({
  label,
  field,
  activeField,
  direction,
  onSort,
  align = 'start',
  style,
}: {
  label: string;
  field: T;
  activeField: T;
  direction: TableSortDirection;
  onSort: (field: T) => void;
  align?: 'start' | 'center' | 'end';
  style?: CSSProperties;
}) {
  const isSorted = activeField === field;
  const ariaSort = isSorted
    ? direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';
  const alignClass =
    align === 'end' ? 'align-end' : align === 'center' ? 'align-center' : '';

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className="promo-sortable-th"
      style={style}
    >
      <button
        type="button"
        className={`promo-sort-btn ${alignClass} ${isSorted ? 'is-sorted' : ''}`}
        onClick={() => onSort(field)}
      >
        <span>{label}</span>
        {isSorted ? (
          direction === 'asc' ? (
            <ArrowUp size={13} className="promo-sort-icon" />
          ) : (
            <ArrowDown size={13} className="promo-sort-icon" />
          )
        ) : (
          <ArrowUpDown size={13} className="promo-sort-icon" />
        )}
      </button>
    </th>
  );
}

/**
 * Shared Promotion Receipt & Bundled Zero-Price Items Inspector Panel.
 * Renders in-place in both Analytics (Tier 1) and Monitoring views without losing scroll context.
 */
function PromoReceiptDrilldownPanel({
  panelRef,
  drilldownLoading,
  drilldownError,
  activeDrilldown,
  filteredPairedItems,
  availableDrilldownMajorGroups,
  drilldownRoleFilter,
  setDrilldownRoleFilter,
  drilldownMajorGroup,
  setDrilldownMajorGroup,
  onClose,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  drilldownLoading: boolean;
  drilldownError: string | null;
  activeDrilldown: PromotionCheckDetailsResponse | null;
  filteredPairedItems: PromotionPairedItem[];
  availableDrilldownMajorGroups: Array<{ majorGroup: string; count: number }>;
  drilldownRoleFilter: 'all' | 'target' | 'zero-price' | 'co-sold';
  setDrilldownRoleFilter: (
    role: 'all' | 'target' | 'zero-price' | 'co-sold'
  ) => void;
  drilldownMajorGroup: string;
  setDrilldownMajorGroup: (mg: string) => void;
  onClose: () => void;
}) {
  return (
    <div ref={panelRef} className="menuitem-flat-panel p-3 p-md-4 border-primary">
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
                <strong>{activeDrilldown.promo.itemName}</strong> — Matched Checks:{' '}
                <strong>
                  {activeDrilldown.promo.totalChecksMatched.toLocaleString('en-PH')}
                </strong>{' '}
                • Promo Qty:{' '}
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

              {/* Filter Items by Major Group */}
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
            onClick={onClose}
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
        <div className="alert alert-danger py-2 small mb-0">{drilldownError}</div>
      )}

      {!drilldownLoading && activeDrilldown && (
        <div className="table-responsive rof-grid-scroll-container">
          <table className="table align-middle mb-0 bom-data-table menuitem-summary-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>ITEM NUMBER</th>
                <th>ITEM NAME (USED IN PROMO)</th>
                <th style={{ width: '150px' }}>MAJOR GROUP</th>
                <th style={{ width: '150px' }}>FAMILY GROUP</th>
                <th style={{ width: '195px' }}>ITEM ROLE</th>
                <th className="text-end" style={{ width: '120px' }}>
                  CHECK FREQ
                </th>
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
                  <td colSpan={8} className="text-center py-4 text-secondary">
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
                      <span className="menuitem-code-badge">{item.itemNumber}</span>
                    </td>
                    <td className="menuitem-name-cell fw-semibold">{item.itemName}</td>
                    <td>
                      <span className="rof-mod-badge">{item.majorGroup}</span>
                    </td>
                    <td className="menuitem-secondary-cell">{item.familyGroup}</td>
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
                    <td className="num-cell menuitem-cell-active">
                      {item.checkFrequency.toLocaleString('en-PH')}
                    </td>
                    <td className="num-cell fw-semibold">{formatQty(item.totalQty)}</td>
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
  );
}

