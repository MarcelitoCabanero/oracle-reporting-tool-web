import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarDays,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Info,
  Layers3,
  PieChart,
  RefreshCw,
  Search,
  ShoppingBag,
  Store as StoreIcon,
  TrendingUp,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { StoreSearchSelect } from '../../components/common/StoreSearchSelect';
import {
  exportMenuItemPivotToExcel,
  exportMenuItemPivotToPdf,
  exportMenuItemSummaryToExcel,
  exportMenuItemSummaryToPdf,
  type MenuItemDailyTrendRow,
  type MenuItemFilterMeta,
  type MenuItemMetrics,
  type MenuItemSalesTypeRow,
  type MenuItemSummaryRow,
  type PivotedMenuItemRow,
} from './menuItemExportUtils';

interface StoreOption {
  LOCATIONID: number;
  LOCATIONNAME: string;
  ORGLOCATIONREF: string;
}

type MenuItemTab = 'sales-type' | 'summary';
type TrendGranularity = 'daily' | 'monthly';
type ChartMetricMode = 'netSales' | 'qty';
type TrendSortOrder = 'chronological' | 'desc' | 'asc';

const MENU_ITEM_SESSION_KEY = 'oracle-session-menuitem';

interface MenuItemSavedSession {
  activeTab: MenuItemTab;
  selectedLocation: string;
  dateFrom: string;
  dateTo: string;
  // Tab 1: Sales Type Pivot
  salesTypeRows: MenuItemSalesTypeRow[];
  salesTypes: string[];
  salesTypeLoadedFilters: MenuItemFilterMeta | null;
  selectedSalesType: string;
  salesTypeSearch: string;
  hideZeroItems: boolean;
  // Tab 2: Summary + Graphical Report
  summaryRows: MenuItemSummaryRow[];
  dailyTrend: MenuItemDailyTrendRow[];
  majorGroups: string[];
  familyGroups: string[];
  summaryLoadedFilters: MenuItemFilterMeta | null;
  selectedMajorGroup: string;
  selectedFamilyGroup: string;
  summarySearch: string;
  trendGranularity: TrendGranularity;
  trendMetric: ChartMetricMode;
  trendSortOrder?: TrendSortOrder;
  topItemsMetric: ChartMetricMode;
}

function loadMenuItemSession(): Partial<MenuItemSavedSession> {
  try {
    const raw = window.sessionStorage.getItem(MENU_ITEM_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<MenuItemSavedSession>;
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

function firstDayOfMonthString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
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
  if (value === 0) return metric === 'netSales' ? '₱0' : '0';
  const abs = Math.abs(value);
  const prefix = metric === 'netSales' ? '₱' : '';
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

const emptyMetrics: MenuItemMetrics = {
  qty: 0,
  grossAmount: 0,
  itemDiscount: 0,
  netSales: 0,
};

export function MenuItemReport() {
  const { user, token } = useAuth();
  const savedSession = useMemo(() => loadMenuItemSession(), []);

  // View Tab
  const [activeTab, setActiveTab] = useState<MenuItemTab>(
    () => savedSession.activeTab ?? 'sales-type'
  );

  // Store list & shared filters
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    () => savedSession.selectedLocation ?? ''
  );
  const [dateFrom, setDateFrom] = useState<string>(
    () => savedSession.dateFrom ?? firstDayOfMonthString()
  );
  const [dateTo, setDateTo] = useState<string>(() => savedSession.dateTo ?? todayString());

  // Tab 1: Menu Item by Sales Type state
  const [salesTypeRows, setSalesTypeRows] = useState<MenuItemSalesTypeRow[]>(
    () => savedSession.salesTypeRows ?? []
  );
  const [salesTypes, setSalesTypes] = useState<string[]>(() => savedSession.salesTypes ?? []);
  const [salesTypeLoadedFilters, setSalesTypeLoadedFilters] = useState<MenuItemFilterMeta | null>(
    () => savedSession.salesTypeLoadedFilters ?? null
  );
  const [salesTypeLoading, setSalesTypeLoading] = useState<boolean>(false);
  const [salesTypeError, setSalesTypeError] = useState<string | null>(null);
  const [selectedSalesType, setSelectedSalesType] = useState<string>(
    () => savedSession.selectedSalesType ?? ''
  );
  const [salesTypeSearch, setSalesTypeSearch] = useState<string>(
    () => savedSession.salesTypeSearch ?? ''
  );
  const [hideZeroItems, setHideZeroItems] = useState<boolean>(
    () => savedSession.hideZeroItems ?? false
  );

  // Tab 2: Menu Item Summary + Graphical Report state
  const [summaryRows, setSummaryRows] = useState<MenuItemSummaryRow[]>(
    () => savedSession.summaryRows ?? []
  );
  const [dailyTrend, setDailyTrend] = useState<MenuItemDailyTrendRow[]>(
    () => savedSession.dailyTrend ?? []
  );
  const [majorGroups, setMajorGroups] = useState<string[]>(() => savedSession.majorGroups ?? []);
  const [familyGroups, setFamilyGroups] = useState<string[]>(() => savedSession.familyGroups ?? []);
  const [summaryLoadedFilters, setSummaryLoadedFilters] = useState<MenuItemFilterMeta | null>(
    () => savedSession.summaryLoadedFilters ?? null
  );
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedMajorGroup, setSelectedMajorGroup] = useState<string>(
    () => savedSession.selectedMajorGroup ?? ''
  );
  const [selectedFamilyGroup, setSelectedFamilyGroup] = useState<string>(
    () => savedSession.selectedFamilyGroup ?? ''
  );
  const [summarySearch, setSummarySearch] = useState<string>(
    () => savedSession.summarySearch ?? ''
  );

  // Graphical Chart Controls
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>(
    () => savedSession.trendGranularity ?? 'daily'
  );
  const [trendMetric, setTrendMetric] = useState<ChartMetricMode>(
    () => savedSession.trendMetric ?? 'netSales'
  );
  const [trendSortOrder, setTrendSortOrder] = useState<TrendSortOrder>(
    () => savedSession.trendSortOrder ?? 'chronological'
  );
  const [topItemsMetric, setTopItemsMetric] = useState<ChartMetricMode>(
    () => savedSession.topItemsMetric ?? 'netSales'
  );
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [showChartInfo, setShowChartInfo] = useState<boolean>(false);

  // Persist session state to sessionStorage
  useEffect(() => {
    try {
      const payload: MenuItemSavedSession = {
        activeTab,
        selectedLocation,
        dateFrom,
        dateTo,
        salesTypeRows,
        salesTypes,
        salesTypeLoadedFilters,
        selectedSalesType,
        salesTypeSearch,
        hideZeroItems,
        summaryRows,
        dailyTrend,
        majorGroups,
        familyGroups,
        summaryLoadedFilters,
        selectedMajorGroup,
        selectedFamilyGroup,
        summarySearch,
        trendGranularity,
        trendMetric,
        trendSortOrder,
        topItemsMetric,
      };
      window.sessionStorage.setItem(MENU_ITEM_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    activeTab,
    selectedLocation,
    dateFrom,
    dateTo,
    salesTypeRows,
    salesTypes,
    salesTypeLoadedFilters,
    selectedSalesType,
    salesTypeSearch,
    hideZeroItems,
    summaryRows,
    dailyTrend,
    majorGroups,
    familyGroups,
    summaryLoadedFilters,
    selectedMajorGroup,
    selectedFamilyGroup,
    summarySearch,
    trendGranularity,
    trendMetric,
    trendSortOrder,
    topItemsMetric,
  ]);

  // Fetch active physical stores on mount
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetch('/api/reports/menu-item/stores', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load stores');
        return res.json();
      })
      .then((data: { stores?: StoreOption[] }) => {
        if (cancelled) return;
        const list = data.stores ?? [];
        setStores(list);
        if (list.length > 0 && list[0]) {
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
          console.error('Error fetching Menu Item stores:', err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.locationName]);

  // Generate Tab 1: Menu Item by Sales Type
  async function handleGenerateSalesType() {
    if (!selectedLocation) {
      setSalesTypeError('Please select a Store / Location.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setSalesTypeError('Please select both Date From and Date To.');
      return;
    }
    if (dateTo < dateFrom) {
      setSalesTypeError('Date To cannot be earlier than Date From.');
      return;
    }

    setSalesTypeError(null);
    setSalesTypeLoading(true);

    try {
      const res = await fetch('/api/reports/menu-item/by-sales-type', {
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
        throw new Error(data.error || 'Failed to generate Menu Item by Sales Type report.');
      }

      setSalesTypeRows(data.rows ?? []);
      setSalesTypes(data.salesTypes ?? []);
      setSelectedSalesType('');
      setSalesTypeSearch('');
      setSalesTypeLoadedFilters({
        locationName: selectedLocation,
        dateFrom,
        dateTo,
      });
    } catch (err) {
      setSalesTypeError((err as Error).message);
    } finally {
      setSalesTypeLoading(false);
    }
  }

  // Generate Tab 2: Menu Item Summary + Graphical Report
  async function handleGenerateSummary() {
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
      const res = await fetch('/api/reports/menu-item/summary', {
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
        throw new Error(data.error || 'Failed to generate Menu Item Summary report.');
      }

      const loadedTrend: MenuItemDailyTrendRow[] = data.dailyTrend ?? [];
      setSummaryRows(data.rows ?? []);
      setDailyTrend(loadedTrend);
      setMajorGroups(data.majorGroups ?? []);
      setFamilyGroups(data.familyGroups ?? []);
      setSelectedMajorGroup('');
      setSelectedFamilyGroup('');
      setSummarySearch('');
      setTrendGranularity(loadedTrend.length > 45 ? 'monthly' : 'daily');
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
  }

  // ============================================================================
  // TAB 1 COMPUTATIONS: PIVOT MATRIX BY SALES TYPE
  // ============================================================================

  const visibleSalesTypes = useMemo(() => {
    if (selectedSalesType && salesTypes.includes(selectedSalesType)) {
      return [selectedSalesType];
    }
    return salesTypes;
  }, [salesTypes, selectedSalesType]);

  const { pivotedRows, pivotColumnTotals, pivotGrandTotal } = useMemo(() => {
    const query = salesTypeSearch.trim().toLowerCase();
    const itemMap = new Map<string, PivotedMenuItemRow>();

    for (const r of salesTypeRows) {
      if (selectedSalesType && r.salesType !== selectedSalesType) {
        continue;
      }

      if (
        query &&
        !r.itemNumber.toLowerCase().includes(query) &&
        !r.itemName.toLowerCase().includes(query) &&
        !r.salesType.toLowerCase().includes(query)
      ) {
        continue;
      }

      const key = `${r.itemNumber}||${r.itemName}`;
      let entry = itemMap.get(key);
      if (!entry) {
        entry = {
          itemNumber: r.itemNumber,
          itemName: r.itemName,
          bySalesType: {},
          rowTotal: { qty: 0, grossAmount: 0, itemDiscount: 0, netSales: 0 },
        };
        itemMap.set(key, entry);
      }

      const stMetrics = entry.bySalesType[r.salesType] ?? {
        qty: 0,
        grossAmount: 0,
        itemDiscount: 0,
        netSales: 0,
      };
      stMetrics.qty += r.qty;
      stMetrics.grossAmount += r.grossAmount;
      stMetrics.itemDiscount += r.itemDiscount;
      stMetrics.netSales += r.netSales;
      entry.bySalesType[r.salesType] = stMetrics;

      entry.rowTotal.qty += r.qty;
      entry.rowTotal.grossAmount += r.grossAmount;
      entry.rowTotal.itemDiscount += r.itemDiscount;
      entry.rowTotal.netSales += r.netSales;
    }

    let sortedItems = Array.from(itemMap.values()).sort((a, b) => {
      const numA = Number(a.itemNumber);
      const numB = Number(b.itemNumber);
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.itemNumber.localeCompare(b.itemNumber);
    });

    if (hideZeroItems) {
      sortedItems = sortedItems.filter(
        (item) => !isZeroValue(item.rowTotal.qty) || !isZeroValue(item.rowTotal.netSales)
      );
    }

    const colTotals: Record<string, MenuItemMetrics> = {};
    for (const st of visibleSalesTypes) {
      colTotals[st] = { qty: 0, grossAmount: 0, itemDiscount: 0, netSales: 0 };
    }

    const grand: MenuItemMetrics = { qty: 0, grossAmount: 0, itemDiscount: 0, netSales: 0 };

    for (const item of sortedItems) {
      for (const st of visibleSalesTypes) {
        const m = item.bySalesType[st];
        if (m && colTotals[st]) {
          colTotals[st].qty += m.qty;
          colTotals[st].grossAmount += m.grossAmount;
          colTotals[st].itemDiscount += m.itemDiscount;
          colTotals[st].netSales += m.netSales;
        }
      }
      grand.qty += item.rowTotal.qty;
      grand.grossAmount += item.rowTotal.grossAmount;
      grand.itemDiscount += item.rowTotal.itemDiscount;
      grand.netSales += item.rowTotal.netSales;
    }

    return {
      pivotedRows: sortedItems,
      pivotColumnTotals: colTotals,
      pivotGrandTotal: grand,
    };
  }, [salesTypeRows, visibleSalesTypes, selectedSalesType, salesTypeSearch, hideZeroItems]);

  // ============================================================================
  // TAB 2 COMPUTATIONS: SUMMARY, CHARTS & ANALYTICS
  // ============================================================================

  const availableFamilyGroups = useMemo(() => {
    if (!selectedMajorGroup) return familyGroups;
    const set = new Set<string>();
    for (const r of summaryRows) {
      if (r.majorGroup === selectedMajorGroup && r.familyGroup) {
        set.add(r.familyGroup);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [summaryRows, selectedMajorGroup, familyGroups]);

  const filteredSummaryRows = useMemo(() => {
    const query = summarySearch.trim().toLowerCase();
    return summaryRows.filter((r) => {
      if (selectedMajorGroup && r.majorGroup !== selectedMajorGroup) return false;
      if (selectedFamilyGroup && r.familyGroup !== selectedFamilyGroup) return false;
      if (hideZeroItems && isZeroValue(r.qty) && isZeroValue(r.netSales)) return false;
      if (
        query &&
        !r.itemNumber.toLowerCase().includes(query) &&
        !r.itemName.toLowerCase().includes(query) &&
        !r.majorGroup.toLowerCase().includes(query) &&
        !r.familyGroup.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [summaryRows, selectedMajorGroup, selectedFamilyGroup, summarySearch, hideZeroItems]);

  const summaryVisibleTotals = useMemo(() => {
    return filteredSummaryRows.reduce<MenuItemMetrics>(
      (acc, r) => ({
        qty: acc.qty + r.qty,
        grossAmount: acc.grossAmount + r.grossAmount,
        itemDiscount: acc.itemDiscount + r.itemDiscount,
        netSales: acc.netSales + r.netSales,
      }),
      { ...emptyMetrics }
    );
  }, [filteredSummaryRows]);

  const top10Items = useMemo(() => {
    return [...filteredSummaryRows]
      .sort((a, b) =>
        topItemsMetric === 'netSales' ? b.netSales - a.netSales : b.qty - a.qty
      )
      .slice(0, 10);
  }, [filteredSummaryRows, topItemsMetric]);

  const majorGroupBreakdown = useMemo(() => {
    const totalAllNet = summaryRows.reduce((s, r) => s + r.netSales, 0);
    const map = new Map<
      string,
      { majorGroup: string; itemCount: number; qty: number; grossAmount: number; netSales: number }
    >();

    for (const r of summaryRows) {
      const key = r.majorGroup || 'Uncategorized';
      const existing = map.get(key) ?? {
        majorGroup: key,
        itemCount: 0,
        qty: 0,
        grossAmount: 0,
        netSales: 0,
      };
      existing.itemCount += 1;
      existing.qty += r.qty;
      existing.grossAmount += r.grossAmount;
      existing.netSales += r.netSales;
      map.set(key, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => b.netSales - a.netSales)
      .map((g) => ({
        ...g,
        sharePct: totalAllNet > 0 ? (g.netSales / totalAllNet) * 100 : 0,
      }));
  }, [summaryRows]);

  const trendSeries = useMemo(() => {
    let baseSeries: Array<{
      periodKey: string;
      shortLabel: string;
      fullLabel: string;
      qty: number;
      grossAmount: number;
      itemDiscount: number;
      netSales: number;
    }>;

    if (trendGranularity === 'daily') {
      baseSeries = dailyTrend.map((d) => ({
        periodKey: d.businessDate,
        shortLabel: formatShortDate(d.businessDate),
        fullLabel: formatFullDate(d.businessDate),
        qty: d.qty,
        grossAmount: d.grossAmount,
        itemDiscount: d.itemDiscount,
        netSales: d.netSales,
      }));
    } else {
      const monthMap = new Map<
        string,
        { qty: number; grossAmount: number; itemDiscount: number; netSales: number }
      >();
      for (const d of dailyTrend) {
        const monthKey = d.businessDate.slice(0, 7);
        const curr = monthMap.get(monthKey) ?? {
          qty: 0,
          grossAmount: 0,
          itemDiscount: 0,
          netSales: 0,
        };
        curr.qty += d.qty;
        curr.grossAmount += d.grossAmount;
        curr.itemDiscount += d.itemDiscount;
        curr.netSales += d.netSales;
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
      const valA = trendMetric === 'netSales' ? a.netSales : a.qty;
      const valB = trendMetric === 'netSales' ? b.netSales : b.qty;
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
      const val = trendMetric === 'netSales' ? pt.netSales : pt.qty;
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

  const topSellingItemOverall = useMemo(() => {
    if (filteredSummaryRows.length === 0) return null;
    return [...filteredSummaryRows].sort((a, b) => b.netSales - a.netSales)[0] ?? null;
  }, [filteredSummaryRows]);

  const isLoadingCurrentTab = activeTab === 'sales-type' ? salesTypeLoading : summaryLoading;

  return (
    <div className="system-sales-workspace menuitem-workspace">
      {/* Workspace Header & Side-by-Side View Mode Tabs */}
      <div className="menuitem-header-bar mb-3">
        <div className="d-flex align-items-center gap-3 min-w-0">
          <div className="bom-header-icon-badge d-flex align-items-center justify-content-center rounded-3 flex-shrink-0">
            <UtensilsCrossed size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="h5 fw-bold mb-0 bom-main-heading">Menu Item Sales &amp; Analytics</h2>
            <p className="menuitem-subtitle mb-0">
              Analyze store product performance across sales channels (Pivot Matrix) and visual category/monthly summaries.
            </p>
          </div>
        </div>

        {/* View Mode Tabs (Always side-by-side) */}
        <div className="menuitem-tab-switcher flex-shrink-0" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sales-type'}
            className={`menuitem-tab-btn ${activeTab === 'sales-type' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales-type')}
          >
            <ShoppingBag size={15} />
            <span>Menu Item by Sales Type</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            className={`menuitem-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <Layers3 size={15} />
            <span>Menu Item Summary</span>
          </button>
        </div>
      </div>

      {/* Unified Cohesive Filter Bar */}
      <div className="menuitem-unified-filter-bar mb-3">
        <div className="menuitem-filter-bar-row">
          {/* Store / Location */}
          <div className="menuitem-filter-group menuitem-filter-store">
            <label htmlFor="menuitem-store-select" className="menuitem-filter-label">
              Store / Location
            </label>
            <div className="menuitem-input-with-icon">
              <StoreIcon size={15} className="menuitem-input-left-icon" />
              <StoreSearchSelect
                id="menuitem-store-select"
                inputClassName="form-select menuitem-filter-control"
                stores={stores}
                value={selectedLocation}
                onChange={setSelectedLocation}
                disabled={isLoadingCurrentTab}
              />
            </div>
          </div>

          {/* Date Range Group (Date From + Date To) */}
          <div className="menuitem-filter-group menuitem-filter-dates">
            <label htmlFor="menuitem-date-from" className="menuitem-filter-label">
              Business Date Range
            </label>
            <div className="menuitem-date-range-capsule">
              <div className="menuitem-date-field">
                <CalendarDays size={15} className="menuitem-input-left-icon" />
                <input
                  id="menuitem-date-from"
                  type="date"
                  className="form-control menuitem-date-input"
                  value={dateFrom}
                  max={todayString()}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={isLoadingCurrentTab}
                  aria-label="Date From"
                />
              </div>
              <span className="menuitem-date-range-sep">to</span>
              <div className="menuitem-date-field">
                <CalendarDays size={15} className="menuitem-input-left-icon" />
                <input
                  id="menuitem-date-to"
                  type="date"
                  className="form-control menuitem-date-input"
                  value={dateTo}
                  max={todayString()}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={isLoadingCurrentTab}
                  aria-label="Date To"
                />
              </div>
            </div>
          </div>

          {/* Refined Generate CTA Button */}
          <div className="menuitem-filter-cta">
            <button
              type="button"
              className="btn menuitem-generate-btn d-inline-flex align-items-center justify-content-center gap-2"
              onClick={
                activeTab === 'sales-type' ? handleGenerateSalesType : handleGenerateSummary
              }
              disabled={isLoadingCurrentTab || !selectedLocation || !dateFrom || !dateTo}
            >
              <RefreshCw size={15} className={isLoadingCurrentTab ? 'spin' : ''} />
              <span>
                {isLoadingCurrentTab
                  ? 'Generating...'
                  : activeTab === 'sales-type'
                  ? 'Generate Matrix'
                  : 'Generate Summary'}
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'sales-type' && salesTypeError && (
          <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3" role="alert">
            {salesTypeError}
          </div>
        )}

        {activeTab === 'summary' && summaryError && (
          <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3" role="alert">
            {summaryError}
          </div>
        )}
      </div>

      {/* ===================================================================
          TAB 1: MENU ITEM BY SALES TYPE (PIVOT MATRIX)
          =================================================================== */}
      {activeTab === 'sales-type' && (
        <>
          {salesTypeLoadedFilters ? (
            <div className="d-flex flex-column gap-3">
              {/* 4 Flat, Responsive KPI Summary Cards */}
              <div className="row g-3">
                <div className="col-6 col-xl-3">
                  <div className="menuitem-kpi-card h-100">
                    <div className="menuitem-kpi-label">Total Qty Sold</div>
                    <div className="menuitem-kpi-value">
                      {formatQty(pivotGrandTotal.qty)}
                    </div>
                    <div className="menuitem-kpi-subtext">
                      Across {pivotedRows.length} unique menu item(s)
                    </div>
                  </div>
                </div>

                <div className="col-6 col-xl-3">
                  <div className="menuitem-kpi-card h-100">
                    <div className="menuitem-kpi-label">Amt Total (Gross)</div>
                    <div className="menuitem-kpi-value">
                      ₱{formatMoney(pivotGrandTotal.grossAmount)}
                    </div>
                    <div className="menuitem-kpi-subtext">
                      Line total before VAT/discount split
                    </div>
                  </div>
                </div>

                <div className="col-6 col-xl-3">
                  <div className="menuitem-kpi-card h-100">
                    <div className="menuitem-kpi-label">Total Item Discount</div>
                    <div className="menuitem-kpi-value">
                      ₱{formatMoney(pivotGrandTotal.itemDiscount)}
                    </div>
                    <div className="menuitem-kpi-subtext">
                      VAT, SC, PWD, Emp &amp; Nat&apos;l Athlete
                    </div>
                  </div>
                </div>

                <div className="col-6 col-xl-3">
                  <div className="menuitem-kpi-card h-100">
                    <div className="menuitem-kpi-label">Total Net Sales</div>
                    <div className="menuitem-kpi-value">
                      ₱{formatMoney(pivotGrandTotal.netSales)}
                    </div>
                    <div className="menuitem-kpi-subtext">
                      {visibleSalesTypes.length} active sales type channel(s)
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsive Action, Filter & Export Toolbar */}
              <div className="menuitem-toolbar-bar">
                <div className="menuitem-toolbar-meta">
                  <span className="menuitem-meta-pill">
                    Store: <strong>{salesTypeLoadedFilters.locationName}</strong>
                  </span>
                  <span className="menuitem-meta-pill">
                    Period: <strong>{salesTypeLoadedFilters.dateFrom}</strong> to{' '}
                    <strong>{salesTypeLoadedFilters.dateTo}</strong>
                  </span>
                  <span className="menuitem-meta-pill">
                    Items: <strong>{pivotedRows.length}</strong>
                  </span>
                  <span
                    className="menuitem-meta-pill menuitem-meta-pill-channels"
                    title={visibleSalesTypes.join(', ') || 'None'}
                  >
                    Channels: <strong>{visibleSalesTypes.join(', ') || 'None'}</strong>
                  </span>
                </div>

                <div className="menuitem-toolbar-actions">
                  {/* Hide Zero-Value Items Toggle */}
                  <button
                    type="button"
                    className={`btn btn-sm menuitem-toggle-zero-btn d-inline-flex align-items-center gap-2 ${
                      hideZeroItems ? 'active' : ''
                    }`}
                    onClick={() => setHideZeroItems((v) => !v)}
                    title="Hide items with zero sales in the selected period"
                  >
                    <EyeOff size={14} className="flex-shrink-0" />
                    <span>{hideZeroItems ? 'Zero Items Hidden' : 'Hide Zero Items'}</span>
                  </button>

                  {/* Sales Type Channel Filter */}
                  <select
                    className="form-select form-select-sm menuitem-toolbar-select"
                    value={selectedSalesType}
                    onChange={(e) => setSelectedSalesType(e.target.value)}
                    disabled={salesTypes.length === 0}
                    aria-label="Filter by Sales Type"
                  >
                    <option value="">All Sales Types ({salesTypes.length})</option>
                    {salesTypes.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  {/* Instant Keyword Search */}
                  <div className="menuitem-search-box">
                    <Search size={14} className="menuitem-search-icon" />
                    <input
                      type="text"
                      className="form-control form-control-sm menuitem-search-input"
                      placeholder="Search item # or item name..."
                      value={salesTypeSearch}
                      onChange={(e) => setSalesTypeSearch(e.target.value)}
                    />
                    {salesTypeSearch && (
                      <button
                        type="button"
                        className="menuitem-search-clear"
                        onClick={() => setSalesTypeSearch('')}
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Export Buttons Group */}
                  <div className="d-inline-flex align-items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      className="btn rof-export-btn rof-export-btn-excel btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                      onClick={() =>
                        exportMenuItemPivotToExcel(
                          pivotedRows,
                          visibleSalesTypes,
                          pivotColumnTotals,
                          pivotGrandTotal,
                          salesTypeLoadedFilters,
                          selectedSalesType
                        )
                      }
                      disabled={pivotedRows.length === 0}
                      title="Download Pivot Matrix Excel Workbook (.xlsx)"
                    >
                      <FileSpreadsheet size={15} />
                      <span>Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      className="btn rof-export-btn rof-export-btn-pdf btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                      onClick={() =>
                        exportMenuItemPivotToPdf(
                          pivotedRows,
                          visibleSalesTypes,
                          pivotColumnTotals,
                          pivotGrandTotal,
                          salesTypeLoadedFilters,
                          selectedSalesType
                        )
                      }
                      disabled={pivotedRows.length === 0}
                      title="Download Printable Pivot Matrix PDF"
                    >
                      <FileText size={15} />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2-Tier Pivot Matrix Table Card */}
              <div className="menuitem-table-card">
                <div className="table-responsive rof-grid-scroll-container menuitem-pivot-scroll-container">
                  <table className="table align-middle mb-0 bom-data-table menuitem-pivot-table">
                    <thead>
                      {/* Tier 1: Clean Light-Gray Group Headers */}
                      <tr className="menuitem-pivot-tier1">
                        <th
                          rowSpan={2}
                          className="menuitem-sticky-col menuitem-sticky-col-1"
                        >
                          ITEM NUMBER
                        </th>
                        <th
                          rowSpan={2}
                          className="menuitem-sticky-col menuitem-sticky-col-2"
                        >
                          ITEM NAME
                        </th>
                        {visibleSalesTypes.map((st) => (
                          <th
                            key={st}
                            colSpan={4}
                            className="text-center menuitem-salestype-group-header"
                          >
                            {st}
                          </th>
                        ))}
                        <th
                          colSpan={4}
                          className="text-center menuitem-total-group-header"
                        >
                          TOTAL
                        </th>
                      </tr>

                      {/* Tier 2: Sub-column Headers */}
                      <tr className="menuitem-pivot-tier2">
                        {visibleSalesTypes.map((st) => (
                          <SubHeaderCells key={`sub-${st}`} prefix={st} />
                        ))}
                        <SubHeaderCells prefix="TOTAL" isTotalGroup />
                      </tr>
                    </thead>

                    <tbody>
                      {pivotedRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2 + (visibleSalesTypes.length + 1) * 4}
                            className="text-center py-5 menuitem-empty-state"
                          >
                            No Menu Item by Sales Type records found for the selected store and filters.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {pivotedRows.map((item) => (
                            <tr key={`${item.itemNumber}-${item.itemName}`}>
                              <td className="menuitem-sticky-col menuitem-sticky-col-1 menuitem-code-cell text-nowrap">
                                <span className="menuitem-code-badge">{item.itemNumber}</span>
                              </td>
                              <td
                                className="menuitem-sticky-col menuitem-sticky-col-2 menuitem-name-cell text-truncate"
                                title={item.itemName}
                              >
                                {item.itemName}
                              </td>

                              {visibleSalesTypes.map((st) => (
                                <MetricCells
                                  key={`${item.itemNumber}-${st}`}
                                  metrics={item.bySalesType[st]}
                                />
                              ))}

                              {/* Row Total Group */}
                              <MetricCells
                                metrics={item.rowTotal}
                                isRowTotal
                              />
                            </tr>
                          ))}

                          {/* Sticky TOTAL Footer Row */}
                          <tr className="rof-total-row fw-bold">
                            <td className="menuitem-sticky-col menuitem-sticky-col-1 bom-charcoal-text">
                              TOTAL
                            </td>
                            <td className="menuitem-sticky-col menuitem-sticky-col-2 menuitem-footer-count">
                              {pivotedRows.length} Item(s)
                            </td>
                            {visibleSalesTypes.map((st) => (
                              <MetricCells
                                key={`tot-${st}`}
                                metrics={pivotColumnTotals[st]}
                                isFooterTotal
                              />
                            ))}
                            <MetricCells
                              metrics={pivotGrandTotal}
                              isFooterTotal
                              isRowTotal
                            />
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            !salesTypeLoading && (
              <div className="system-sales-placeholder mt-2">
                <ShoppingBag size={36} className="mb-2 bom-charcoal-text" />
                <h5 className="fw-bold bom-main-heading">
                  Ready to Generate Menu Item by Sales Type (Pivot Matrix)
                </h5>
                <p className="menuitem-placeholder-copy">
                  Select a store location and business date range above, then click{' '}
                  <strong>Generate Matrix</strong> to view side-by-side sales channel columns with Qty, Amt Total, Discount, and Net Sales per item.
                </p>
              </div>
            )
          )}
        </>
      )}

      {/* ===================================================================
          TAB 2: MENU ITEM SUMMARY (KPI + GRAPHICAL REPORT + TABLE)
          =================================================================== */}
      {activeTab === 'summary' && (
        <>
          {summaryLoadedFilters ? (
            <div className="d-flex flex-column gap-3">
              {/* 4 Flat, Responsive Executive KPI Cards */}
              <div className="row g-3">
                <div className="col-6 col-xl-3">
                  <div className="menuitem-kpi-card h-100">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="menuitem-kpi-label">Total Qty Sold</span>
                      <ShoppingBag size={16} className="menuitem-kpi-icon" />
                    </div>
                    <div className="menuitem-kpi-value">
                      {formatQty(summaryVisibleTotals.qty)}
                    </div>
                    <div className="menuitem-kpi-subtext">
                      {filteredSummaryRows.length} item(s) • Avg{' '}
                      {formatQty(
                        dailyTrend.length > 0
                          ? summaryVisibleTotals.qty / dailyTrend.length
                          : 0
                      )}
                      /day
                    </div>
                  </div>
                </div>

                <div className="col-6 col-xl-3">
                  <div className="menuitem-kpi-card h-100">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="menuitem-kpi-label">Amt Total (Gross)</span>
                      <BarChart3 size={16} className="menuitem-kpi-icon" />
                    </div>
                    <div className="menuitem-kpi-value">
                      ₱{formatMoney(summaryVisibleTotals.grossAmount)}
                    </div>
                    <div className="menuitem-kpi-subtext">
                      Across {dailyTrend.length} active business day(s)
                    </div>
                  </div>
                </div>

                <div className="col-6 col-xl-3">
                  <div className="menuitem-kpi-card h-100">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="menuitem-kpi-label">Total Item Discount</span>
                      <CalendarDays size={16} className="menuitem-kpi-icon" />
                    </div>
                    <div className="menuitem-kpi-value">
                      ₱{formatMoney(summaryVisibleTotals.itemDiscount)}
                    </div>
                    <div className="menuitem-kpi-subtext">
                      {summaryVisibleTotals.grossAmount > 0
                        ? `${(
                            (summaryVisibleTotals.itemDiscount /
                              summaryVisibleTotals.grossAmount) *
                            100
                          ).toFixed(2)}% of gross sales`
                        : '0.00% of gross sales'}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-xl-3">
                  <div className="menuitem-kpi-card h-100">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="menuitem-kpi-label">Total Net Sales</span>
                      <TrendingUp size={16} className="menuitem-kpi-icon" />
                    </div>
                    <div className="menuitem-kpi-value">
                      ₱{formatMoney(summaryVisibleTotals.netSales)}
                    </div>
                    <div
                      className="menuitem-kpi-subtext text-truncate"
                      title={
                        topSellingItemOverall
                          ? `Top Item: ${topSellingItemOverall.itemName} (₱${formatMoney(
                              topSellingItemOverall.netSales
                            )})`
                          : ''
                      }
                    >
                      {topSellingItemOverall
                        ? `Top: ${topSellingItemOverall.itemName}`
                        : 'No sales recorded'}
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  GRAPHICAL REPORT SECTION (TREND + TOP 10 + CATEGORY SHARE)
                  ========================================================= */}
              <div className="menuitem-flat-panel p-3 p-md-4">
                <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 pb-3 mb-3 border-bottom">
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <TrendingUp size={18} className="bom-charcoal-text" />
                      <h3 className="h6 fw-bold mb-0 bom-main-heading">
                        {trendGranularity === 'monthly'
                          ? 'Monthly Menu Item Sales Trend'
                          : 'Daily Menu Item Sales Trend'}
                      </h3>
                      <span className="menuitem-meta-pill">
                        {summaryLoadedFilters.locationName}
                      </span>

                      {/* Subtle Info Icon with Tooltip instead of full-width instruction banner */}
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
                            Hover over any bar to inspect Date, Qty Sold, Gross Amount, Discount,
                            and Net Sales. Use the sort controls to rank bars by highest or lowest
                            sales.
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="menuitem-chart-subtext mb-0 mt-1">
                      Peak {trendGranularity === 'monthly' ? 'Month' : 'Day'}:{' '}
                      <strong>{trendStats.peakLabel}</strong> (
                      {trendMetric === 'netSales'
                        ? `₱${formatMoney(trendStats.peakVal)}`
                        : `${formatQty(trendStats.peakVal)} units`}
                      ) • Avg per {trendGranularity === 'monthly' ? 'Month' : 'Day'}:{' '}
                      <strong>
                        {trendMetric === 'netSales'
                          ? `₱${formatMoney(trendStats.avgVal)}`
                          : `${formatQty(trendStats.avgVal)} units`}
                      </strong>
                    </p>
                  </div>

                  {/* Granularity, Metric, and Sort Toggles */}
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <div className="btn-group btn-group-sm" role="group" aria-label="Trend Sort Order">
                      <button
                        type="button"
                        className={`btn ${
                          trendSortOrder === 'chronological'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendSortOrder('chronological')}
                        title="Order chronologically by date"
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
                        title="Sort highest sales first"
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
                        title="Sort lowest sales first"
                      >
                        Lowest First
                      </button>
                    </div>

                    <div className="btn-group btn-group-sm" role="group" aria-label="Trend Granularity">
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

                    <div className="btn-group btn-group-sm" role="group" aria-label="Trend Metric">
                      <button
                        type="button"
                        className={`btn ${
                          trendMetric === 'netSales'
                            ? 'menuitem-seg-btn-active'
                            : 'menuitem-seg-btn'
                        }`}
                        onClick={() => setTrendMetric('netSales')}
                      >
                        Net Sales (₱)
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

                {/* Elevated Trend Bar Chart Container with Y-Axis, Dashed Gridlines & Floating Tooltip */}
                {trendSeries.length === 0 ? (
                  <div className="text-center py-4 menuitem-empty-state">
                    No daily trend data available for the selected period.
                  </div>
                ) : (
                  <div className="menuitem-chart-stage">
                    <div className="menuitem-chart-layout">
                      {/* Left Y-Axis Labels Column */}
                      <div className="menuitem-yaxis-col" aria-hidden="true">
                        {trendStats.ticks.map((tickVal, idx) => (
                          <div key={idx} className="menuitem-yaxis-label">
                            {formatAxisTick(tickVal, trendMetric)}
                          </div>
                        ))}
                      </div>

                      {/* Horizontally Scrollable Plot Area */}
                      <div className="menuitem-trend-bars-scroll">
                        <div
                          className="menuitem-plot-canvas"
                          style={{
                            minWidth: Math.max(trendSeries.length * 60, 480),
                          }}
                        >
                          {/* Subtle Dashed Horizontal Y-Axis Gridlines */}
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

                          {/* Data Bars Row (No overlapping inline labels, no gray background tracks) */}
                          <div className="menuitem-trend-bars-grid">
                            {trendSeries.map((pt, idx) => {
                              const val = trendMetric === 'netSales' ? pt.netSales : pt.qty;
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
                                  aria-label={`${pt.fullLabel}: Net Sales ₱${formatMoney(
                                    pt.netSales
                                  )}, Qty ${formatQty(pt.qty)}`}
                                >
                                  {/* Floating Modern Tooltip on Hover */}
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
                                        <span>Qty Sold</span>
                                        <strong>{formatQty(pt.qty)}</strong>
                                      </div>
                                      <div className="menuitem-tooltip-row">
                                        <span>Amt Total (Gross)</span>
                                        <strong>₱{formatMoney(pt.grossAmount)}</strong>
                                      </div>
                                      <div className="menuitem-tooltip-row">
                                        <span>Discount</span>
                                        <strong>₱{formatMoney(pt.itemDiscount)}</strong>
                                      </div>
                                      <div className="menuitem-tooltip-row menuitem-tooltip-net">
                                        <span>Net Sales</span>
                                        <strong>₱{formatMoney(pt.netSales)}</strong>
                                      </div>
                                    </div>
                                  )}

                                  {/* Bar Plot Area (No gray background track) */}
                                  <div className="menuitem-bar-plot-slot">
                                    <div
                                      className="menuitem-trend-bar-fill"
                                      style={{ height: `${heightPct}%` }}
                                    />
                                  </div>

                                  {/* Readable 12.5px X-Axis Date Label */}
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

              {/* Secondary Graphical Cards: Top 10 Menu Items + Major Group Category Share */}
              <div className="row g-3">
                {/* Top 10 Best-Selling Menu Items */}
                <div className="col-12 col-xl-7">
                  <div className="menuitem-flat-panel p-3 p-md-4 h-100">
                    <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <Award size={18} className="bom-charcoal-text" />
                        <div>
                          <h3 className="h6 fw-bold mb-0 bom-main-heading">
                            Top 10 Best-Selling Menu Items
                          </h3>
                          <span className="menuitem-chart-subtext">
                            {selectedMajorGroup
                              ? `Filtered by Major Group: ${selectedMajorGroup}`
                              : 'Ranked across all active categories'}
                          </span>
                        </div>
                      </div>

                      <div className="btn-group btn-group-sm" role="group">
                        <button
                          type="button"
                          className={`btn ${
                            topItemsMetric === 'netSales'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setTopItemsMetric('netSales')}
                        >
                          By Net Sales
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            topItemsMetric === 'qty'
                              ? 'menuitem-seg-btn-active'
                              : 'menuitem-seg-btn'
                          }`}
                          onClick={() => setTopItemsMetric('qty')}
                        >
                          By Qty
                        </button>
                      </div>
                    </div>

                    {top10Items.length === 0 ? (
                      <div className="text-center py-4 menuitem-empty-state">
                        No items match the current filter.
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {top10Items.map((item, idx) => {
                          const maxTopVal =
                            topItemsMetric === 'netSales'
                              ? top10Items[0]?.netSales || 1
                              : top10Items[0]?.qty || 1;
                          const currVal =
                            topItemsMetric === 'netSales' ? item.netSales : item.qty;
                          const barPct = Math.max((currVal / maxTopVal) * 100, 3);
                          const sharePct =
                            topItemsMetric === 'netSales'
                              ? summaryVisibleTotals.netSales > 0
                                ? (item.netSales / summaryVisibleTotals.netSales) * 100
                                : 0
                              : summaryVisibleTotals.qty > 0
                              ? (item.qty / summaryVisibleTotals.qty) * 100
                              : 0;

                          return (
                            <div key={item.itemNumber} className="menuitem-rank-row">
                              <div className="d-flex align-items-center justify-content-between gap-2 mb-1 small">
                                <div className="d-flex align-items-center gap-2 min-w-0">
                                  <span className="menuitem-rank-badge">#{idx + 1}</span>
                                  <span className="menuitem-code-badge">{item.itemNumber}</span>
                                  <span
                                    className="fw-semibold bom-charcoal-text text-truncate"
                                    title={item.itemName}
                                  >
                                    {item.itemName}
                                  </span>
                                  <span className="menuitem-chart-subtext d-none d-md-inline">
                                    ({item.majorGroup})
                                  </span>
                                </div>
                                <div className="text-nowrap fw-bold bom-charcoal-text">
                                  {topItemsMetric === 'netSales'
                                    ? `₱${formatMoney(item.netSales)}`
                                    : `${formatQty(item.qty)} pcs`}{' '}
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

                {/* Category Share by Major Group */}
                <div className="col-12 col-xl-5">
                  <div className="menuitem-flat-panel p-3 p-md-4 h-100">
                    <div className="d-flex align-items-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <PieChart size={18} className="bom-charcoal-text" />
                        <div>
                          <h3 className="h6 fw-bold mb-0 bom-main-heading">
                            Sales Share by Major Group
                          </h3>
                          <span className="menuitem-chart-subtext">
                            Click any category below to filter the report
                          </span>
                        </div>
                      </div>
                      {selectedMajorGroup && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2"
                          onClick={() => {
                            setSelectedMajorGroup('');
                            setSelectedFamilyGroup('');
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {majorGroupBreakdown.length === 0 ? (
                      <div className="text-center py-4 menuitem-empty-state">
                        No category data available.
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {majorGroupBreakdown.map((cat) => {
                          const isSelected = selectedMajorGroup === cat.majorGroup;
                          return (
                            <button
                              key={cat.majorGroup}
                              type="button"
                              className={`menuitem-category-card text-start border rounded-3 p-2 ${
                                isSelected ? 'active' : ''
                              }`}
                              onClick={() => {
                                setSelectedMajorGroup((curr) =>
                                  curr === cat.majorGroup ? '' : cat.majorGroup
                                );
                                setSelectedFamilyGroup('');
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between gap-2 mb-1 small">
                                <div className="d-flex align-items-center gap-2">
                                  <span className="fw-bold bom-charcoal-text">
                                    {cat.majorGroup}
                                  </span>
                                  <span className="menuitem-meta-pill py-0 px-2">
                                    {cat.itemCount} items
                                  </span>
                                </div>
                                <div className="fw-bold bom-charcoal-text">
                                  ₱{formatMoney(cat.netSales)}{' '}
                                  <span className="menuitem-chart-subtext fw-semibold">
                                    ({cat.sharePct.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                              <div className="menuitem-progress-track">
                                <div
                                  className="menuitem-progress-fill"
                                  style={{ width: `${Math.max(cat.sharePct, 2)}%` }}
                                />
                              </div>
                              <div className="d-flex justify-content-between menuitem-chart-subtext mt-1" style={{ fontSize: '12px' }}>
                                <span>Qty: {formatQty(cat.qty)}</span>
                                <span>Gross: ₱{formatMoney(cat.grossAmount)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* =========================================================
                  DETAILED ITEM SUMMARY TABLE & TOOLBAR
                  ========================================================= */}
              <div className="menuitem-toolbar-bar">
                <div className="menuitem-toolbar-meta">
                  <span className="menuitem-meta-pill">
                    Store: <strong>{summaryLoadedFilters.locationName}</strong>
                  </span>
                  <span className="menuitem-meta-pill">
                    Showing <strong>{filteredSummaryRows.length}</strong> of{' '}
                    <strong>{summaryRows.length}</strong> Item(s)
                  </span>
                </div>

                <div className="menuitem-toolbar-actions">
                  {/* Hide Zero-Value Items Toggle */}
                  <button
                    type="button"
                    className={`btn btn-sm menuitem-toggle-zero-btn d-inline-flex align-items-center gap-2 ${
                      hideZeroItems ? 'active' : ''
                    }`}
                    onClick={() => setHideZeroItems((v) => !v)}
                  >
                    <EyeOff size={14} className="flex-shrink-0" />
                    <span>{hideZeroItems ? 'Zero Items Hidden' : 'Hide Zero Items'}</span>
                  </button>

                  {/* Major Group Dropdown */}
                  <select
                    className="form-select form-select-sm menuitem-toolbar-select"
                    value={selectedMajorGroup}
                    onChange={(e) => {
                      setSelectedMajorGroup(e.target.value);
                      setSelectedFamilyGroup('');
                    }}
                    aria-label="Filter by Major Group"
                  >
                    <option value="">All Major Groups ({majorGroups.length})</option>
                    {majorGroups.map((mg) => (
                      <option key={mg} value={mg}>
                        {mg}
                      </option>
                    ))}
                  </select>

                  {/* Family Group Dropdown */}
                  <select
                    className="form-select form-select-sm menuitem-toolbar-select"
                    value={selectedFamilyGroup}
                    onChange={(e) => setSelectedFamilyGroup(e.target.value)}
                    aria-label="Filter by Family Group"
                  >
                    <option value="">All Family Groups ({availableFamilyGroups.length})</option>
                    {availableFamilyGroups.map((fg) => (
                      <option key={fg} value={fg}>
                        {fg}
                      </option>
                    ))}
                  </select>

                  {/* Keyword Search */}
                  <div className="menuitem-search-box">
                    <Search size={14} className="menuitem-search-icon" />
                    <input
                      type="text"
                      className="form-control form-control-sm menuitem-search-input"
                      placeholder="Search item or group..."
                      value={summarySearch}
                      onChange={(e) => setSummarySearch(e.target.value)}
                    />
                    {summarySearch && (
                      <button
                        type="button"
                        className="menuitem-search-clear"
                        onClick={() => setSummarySearch('')}
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Export Buttons Group */}
                  <div className="d-inline-flex align-items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      className="btn rof-export-btn rof-export-btn-excel btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                      onClick={() =>
                        exportMenuItemSummaryToExcel(
                          filteredSummaryRows,
                          dailyTrend,
                          summaryVisibleTotals,
                          summaryLoadedFilters,
                          selectedMajorGroup
                        )
                      }
                      disabled={filteredSummaryRows.length === 0}
                      title="Download Menu Item Summary Workbook (.xlsx)"
                    >
                      <FileSpreadsheet size={15} />
                      <span>Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      className="btn rof-export-btn rof-export-btn-pdf btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
                      onClick={() =>
                        exportMenuItemSummaryToPdf(
                          filteredSummaryRows,
                          summaryVisibleTotals,
                          summaryLoadedFilters,
                          selectedMajorGroup
                        )
                      }
                      disabled={filteredSummaryRows.length === 0}
                      title="Download Printable Summary PDF"
                    >
                      <FileText size={15} />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Detailed Summary Table Card */}
              <div className="menuitem-table-card">
                <div className="table-responsive rof-grid-scroll-container menuitem-pivot-scroll-container">
                  <table className="table align-middle mb-0 bom-data-table menuitem-summary-table">
                    <thead>
                      <tr>
                        <th style={{ width: '125px' }}>ITEM NUMBER</th>
                        <th>ITEM NAME</th>
                        <th style={{ width: '165px' }}>MAJOR GROUP</th>
                        <th style={{ width: '175px' }}>FAMILY GROUP</th>
                        <th className="text-end" style={{ width: '115px' }}>
                          QTY
                        </th>
                        <th className="text-end" style={{ width: '150px' }}>
                          AMT TOTAL (GROSS)
                        </th>
                        <th className="text-end" style={{ width: '140px' }}>
                          ITEM DISCOUNT
                        </th>
                        <th className="text-end" style={{ width: '150px' }}>
                          NET SALES
                        </th>
                        <th className="text-end" style={{ width: '105px' }}>
                          % SHARE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSummaryRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-5 menuitem-empty-state">
                            No Menu Item Summary records found for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {filteredSummaryRows.map((row, index) => {
                            const sharePct =
                              summaryVisibleTotals.netSales > 0
                                ? (row.netSales / summaryVisibleTotals.netSales) * 100
                                : 0;
                            return (
                              <tr
                                key={`${row.itemNumber}-${row.majorGroup}-${row.familyGroup}-${index}`}
                              >
                                <td className="menuitem-code-cell text-nowrap">
                                  <span className="menuitem-code-badge">{row.itemNumber}</span>
                                </td>
                                <td className="menuitem-name-cell">{row.itemName}</td>
                                <td>
                                  <span className="rof-mod-badge">{row.majorGroup}</span>
                                </td>
                                <td className="menuitem-secondary-cell">
                                  {row.familyGroup}
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
                                    isZeroValue(row.grossAmount) ? 'menuitem-cell-zero' : ''
                                  }`}
                                >
                                  ₱{formatMoney(row.grossAmount)}
                                </td>
                                <td
                                  className={`num-cell ${
                                    isZeroValue(row.itemDiscount) ? 'menuitem-cell-zero' : ''
                                  }`}
                                >
                                  ₱{formatMoney(row.itemDiscount)}
                                </td>
                                <td
                                  className={`num-cell ${
                                    isZeroValue(row.netSales)
                                      ? 'menuitem-cell-zero'
                                      : 'fw-bold bom-charcoal-text'
                                  }`}
                                >
                                  ₱{formatMoney(row.netSales)}
                                </td>
                                <td
                                  className={`num-cell ${
                                    isZeroValue(sharePct)
                                      ? 'menuitem-cell-zero'
                                      : 'menuitem-secondary-cell fw-semibold'
                                  }`}
                                >
                                  {sharePct.toFixed(2)}%
                                </td>
                              </tr>
                            );
                          })}

                          {/* Sticky TOTAL Footer Row */}
                          <tr className="rof-total-row fw-bold">
                            <td className="bom-charcoal-text">TOTAL</td>
                            <td className="menuitem-footer-count">
                              {filteredSummaryRows.length} Item(s)
                            </td>
                            <td>{selectedMajorGroup || 'All Major Groups'}</td>
                            <td>{selectedFamilyGroup || 'All Family Groups'}</td>
                            <td className="num-cell bom-charcoal-text">
                              {formatQty(summaryVisibleTotals.qty)}
                            </td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryVisibleTotals.grossAmount)}
                            </td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryVisibleTotals.itemDiscount)}
                            </td>
                            <td className="num-cell bom-charcoal-text">
                              ₱{formatMoney(summaryVisibleTotals.netSales)}
                            </td>
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
            !summaryLoading && (
              <div className="system-sales-placeholder mt-2">
                <Layers3 size={36} className="mb-2 bom-charcoal-text" />
                <h5 className="fw-bold bom-main-heading">
                  Ready to Generate Menu Item Summary &amp; Graphical Report
                </h5>
                <p className="menuitem-placeholder-copy">
                  Select a store location and business date range above, then click{' '}
                  <strong>Generate Summary</strong> to view KPI metrics, Daily/Monthly Sales Trend charts, Top 10 Best-Selling Items, Major Group category share, and the item summary table.
                </p>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function SubHeaderCells({
  prefix,
  isTotalGroup = false,
}: {
  prefix: string;
  isTotalGroup?: boolean;
}) {
  const cls = isTotalGroup
    ? 'text-end menuitem-subcol-header menuitem-subcol-total'
    : 'text-end menuitem-subcol-header';
  return (
    <>
      <th key={`${prefix}-qty`} className={`${cls} menuitem-group-start`}>
        QTY
      </th>
      <th key={`${prefix}-gross`} className={cls}>
        AMT TOTAL
      </th>
      <th key={`${prefix}-disc`} className={cls}>
        DISCOUNT
      </th>
      <th key={`${prefix}-net`} className={cls}>
        NET SALES
      </th>
    </>
  );
}

function MetricCells({
  metrics,
  isRowTotal = false,
  isFooterTotal = false,
}: {
  metrics?: MenuItemMetrics;
  isRowTotal?: boolean;
  isFooterTotal?: boolean;
}) {
  const m = metrics ?? emptyMetrics;
  const zeroQty = isZeroValue(m.qty);
  const zeroGross = isZeroValue(m.grossAmount);
  const zeroDisc = isZeroValue(m.itemDiscount);
  const zeroNet = isZeroValue(m.netSales);

  const cellClass = (isZero: boolean, emphasize = false) =>
    [
      'num-cell',
      isRowTotal ? 'menuitem-row-total-cell' : '',
      isFooterTotal
        ? isZero
          ? 'menuitem-cell-zero'
          : 'bom-charcoal-text fw-bold'
        : isZero
        ? 'menuitem-cell-zero'
        : emphasize
        ? 'menuitem-cell-active-net'
        : 'menuitem-cell-active',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <>
      <td className={`${cellClass(zeroQty)} menuitem-group-start`}>
        {formatQty(m.qty)}
      </td>
      <td className={cellClass(zeroGross)}>
        ₱{formatMoney(m.grossAmount)}
      </td>
      <td className={cellClass(zeroDisc)}>
        ₱{formatMoney(m.itemDiscount)}
      </td>
      <td className={cellClass(zeroNet, true)}>
        ₱{formatMoney(m.netSales)}
      </td>
    </>
  );
}
