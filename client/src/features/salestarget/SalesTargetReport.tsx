import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Store as StoreIcon,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  StoreSearchSelect,
  type StoreSearchOption,
} from '../../components/common/StoreSearchSelect';
import {
  computeMonthMetrics,
  exportAnalyticsToExcel,
  exportWorksheetToExcel,
  type AnalyticsCategoryRow,
  type AnalyticsSummaryRow,
  type AnalyticsWeekdayWeekendRow,
  type CalendarHolidayItem,
  type CalendarMonthSummary,
  type CategorySuggestionRow,
  type EditableCategoryMix,
  type EditableMonthTarget,
  type EditableStoreQuarterTarget,
  type MonthlySuggestionRow,
  type TargetCategoryMapping,
  type TargetCategoryMaster,
} from './salesTargetExportUtils';

type SalesTargetTab = 'worksheet' | 'analytics' | 'settings';
type MixSourceMode = 'default' | 'historical';
type SuggestionBasisOption = 'AUTO' | 'YOY_TREND' | 'BASIS_ADS';

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQty(value: number, decimals = 1): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function formatPct(decimalVal: number, decimals = 2): string {
  return `${(Number(decimalVal || 0) * 100).toFixed(decimals)}%`;
}

function getQuarterMonths(quarter: number): Array<{ month: number; name: string }> {
  switch (quarter) {
    case 1:
      return [
        { month: 1, name: 'January' },
        { month: 2, name: 'February' },
        { month: 3, name: 'March' },
      ];
    case 2:
      return [
        { month: 4, name: 'April' },
        { month: 5, name: 'May' },
        { month: 6, name: 'June' },
      ];
    case 3:
      return [
        { month: 7, name: 'July' },
        { month: 8, name: 'August' },
        { month: 9, name: 'September' },
      ];
    case 4:
    default:
      return [
        { month: 10, name: 'October' },
        { month: 11, name: 'November' },
        { month: 12, name: 'December' },
      ];
  }
}

export function SalesTargetReport() {
  const { token } = useAuth();

  // Primary navigation tab
  const [activeTab, setActiveTab] = useState<SalesTargetTab>('worksheet');

  // Master data state
  const [stores, setStores] = useState<StoreSearchOption[]>([]);
  const [categoryMaster, setCategoryMaster] = useState<TargetCategoryMaster[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<TargetCategoryMapping[]>([]);

  // Shared Quarter / Store Filter state
  const [targetYear, setTargetYear] = useState<number>(2026);
  const [targetQuarter, setTargetQuarter] = useState<number>(1);
  const [selectedStore, setSelectedStore] = useState<string>('');

  // Suggestion Engine parameters
  const [yoyGrowthPctInput, setYoyGrowthPctInput] = useState<number>(5.0); // 5.0%
  const [avgPerCheckInput, setAvgPerCheckInput] = useState<number>(470.0); // Default 470
  const [basisOption, setBasisOption] = useState<SuggestionBasisOption>('AUTO');
  const [mixSourceMode, setMixSourceMode] = useState<MixSourceMode>('default');
  const [basisMonthDateInput, setBasisMonthDateInput] = useState<string>('');

  // Worksheet state
  const [worksheetTarget, setWorksheetTarget] = useState<EditableStoreQuarterTarget | null>(null);
  const [worksheetLoading, setWorksheetLoading] = useState<boolean>(false);
  const [savingTarget, setSavingTarget] = useState<boolean>(false);
  const [batchGenerating, setBatchGenerating] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info' | 'warning' | 'danger';
    message: string;
  } | null>(null);

  // Analytics state
  const [analyticsStore, setAnalyticsStore] = useState<string>('ALL');
  const [analyticsMonthFilter, setAnalyticsMonthFilter] = useState<number>(0); // 0 = All 3 months
  const [analyticsSalesMetric, setAnalyticsSalesMetric] = useState<'net' | 'gross'>('net');
  const [analyticsCategoryMode, setAnalyticsCategoryMode] = useState<'sales' | 'qty'>('sales');
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummaryRow[]>([]);
  const [analyticsWeekdayWeekend, setAnalyticsWeekdayWeekend] = useState<AnalyticsWeekdayWeekendRow[]>([]);
  const [analyticsCategories, setAnalyticsCategories] = useState<AnalyticsCategoryRow[]>([]);

  // Calendar & Category Settings state
  const [calendarSummary, setCalendarSummary] = useState<CalendarMonthSummary[]>([]);
  const [holidays, setHolidays] = useState<CalendarHolidayItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState<boolean>(false);
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [newHolidayName, setNewHolidayName] = useState<string>('');
  const [newHolidayType, setNewHolidayType] = useState<string>('REGULAR');
  const [newHolidayRemarks, setNewHolidayRemarks] = useState<string>('');
  const [savingCategories, setSavingCategories] = useState<boolean>(false);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // 1. Load Active Stores & Category Master on mount
  const fetchInitialData = useCallback(async () => {
    try {
      const [storesRes, catsRes] = await Promise.all([
        fetch('/api/reports/sales-target/stores', { headers: authHeaders }),
        fetch('/api/reports/sales-target/categories', { headers: authHeaders }),
      ]);

      if (storesRes.ok) {
        const data = (await storesRes.json()) as { stores?: StoreSearchOption[] };
        const storeList = data.stores ?? [];
        setStores(storeList);
        if (storeList.length > 0 && !selectedStore) {
          setSelectedStore(storeList[0].LOCATIONNAME);
        }
      }

      if (catsRes.ok) {
        const data = (await catsRes.json()) as {
          categories?: TargetCategoryMaster[];
          mappings?: TargetCategoryMapping[];
        };
        setCategoryMaster(data.categories ?? []);
        setCategoryMappings(data.mappings ?? []);
      }
    } catch (err) {
      console.error('Failed to load initial Sales Target metadata:', err);
    }
  }, [authHeaders, selectedStore]);

  useEffect(() => {
    void fetchInitialData();
  }, [fetchInitialData]);

  // Helper to build a default empty worksheet if no saved target exists yet
  const buildBlankWorksheet = useCallback(
    (
      locName: string,
      year: number,
      quarter: number,
      calMonths?: CalendarMonthSummary[]
    ): EditableStoreQuarterTarget => {
      const storeMeta = stores.find((s) => s.LOCATIONNAME === locName);
      const qMonths = getQuarterMonths(quarter);

      const defaultCats: EditableCategoryMix[] =
        categoryMaster.length > 0
          ? categoryMaster
              .filter((c) => c.IsActive)
              .map((c) => ({
                categoryCode: c.CategoryCode,
                categoryName: c.CategoryName,
                qtyUom: c.QtyUOM,
                sortOrder: c.SortOrder,
                unitPriceDivisor: Number(c.DefaultUnitPrice),
                weekdayMixPct: Number(c.DefaultMixPct),
                weekendHdMixPct: Number(c.DefaultMixPct),
              }))
          : [
              { categoryCode: 'DONUT', categoryName: 'DONUT', qtyUom: 'PCS', sortOrder: 1, unitPriceDivisor: 26, weekdayMixPct: 0.6, weekendHdMixPct: 0.6 },
              { categoryCode: 'JCLUB', categoryName: 'J.CLUB', qtyUom: 'PCS', sortOrder: 2, unitPriceDivisor: 45, weekdayMixPct: 0.02, weekendHdMixPct: 0.02 },
              { categoryCode: 'JPOPS', categoryName: 'J.POPS', qtyUom: 'BOXES', sortOrder: 3, unitPriceDivisor: 260, weekdayMixPct: 0.09, weekendHdMixPct: 0.09 },
              { categoryCode: 'BEVERAGE', categoryName: 'BEVERAGE', qtyUom: 'PCS', sortOrder: 4, unitPriceDivisor: 119, weekdayMixPct: 0.21, weekendHdMixPct: 0.21 },
              { categoryCode: 'JCOOL', categoryName: 'J.COOL', qtyUom: 'PCS', sortOrder: 5, unitPriceDivisor: 190, weekdayMixPct: 0.02, weekendHdMixPct: 0.02 },
              { categoryCode: 'PASTRY_PASTA', categoryName: 'PASTRY PASTA', qtyUom: 'PCS', sortOrder: 6, unitPriceDivisor: 340, weekdayMixPct: 0.06, weekendHdMixPct: 0.06 },
              { categoryCode: 'MERCHANDISE', categoryName: 'MERCHANDISE', qtyUom: 'PCS', sortOrder: 7, unitPriceDivisor: 340, weekdayMixPct: 0, weekendHdMixPct: 0 },
            ];

      const months: EditableMonthTarget[] = qMonths.map((qm) => {
        const cal = calMonths?.find((c) => Number(c.TargetMonth) === qm.month);
        const totalDays = cal ? Number(cal.TotalDays) : 30;
        const weekdayDays = cal ? Number(cal.WeekdayDays) : 21;
        const weekendHdDays = cal ? Number(cal.WeekendHdDays) : 9;

        return {
          targetMonth: qm.month,
          monthName: qm.name,
          targetNetSales: 0,
          suggestedNetSales: 0,
          suggestedTargetYoY: 0,
          suggestedTargetBasisAds: 0,
          lastYearNetSales: 0,
          basisMonthAds: 0,
          seasonalAdjPct: 0,
          lessHalfDays: 0,
          totalOperatingDays: totalDays,
          weekdayDays,
          weekendHdDays,
          holidayRemarks: cal?.HolidayRemarks ?? '',
          weekdaySalesPct: 0.5,
          weekendHdSalesPct: 0.5,
          avgPerCheckWeekday: avgPerCheckInput,
          avgPerCheckWeekendHd: avgPerCheckInput,
          historicalAvgPerCheck: avgPerCheckInput,
          categories: defaultCats.map((c) => ({ ...c })),
        };
      });

      return {
        targetYear: year,
        targetQuarter: quarter,
        locationId: storeMeta?.LOCATIONID ?? null,
        locationName: locName,
        orgLocationRef: storeMeta?.ORGLOCATIONREF ?? null,
        suggestionBasis: 'YOY_TREND',
        basisMonthDate: basisMonthDateInput || null,
        yoyGrowthTargetPct: yoyGrowthPctInput / 100,
        avgPerCheckDefault: avgPerCheckInput,
        status: 'DRAFT',
        remarks: '',
        months,
      };
    },
    [avgPerCheckInput, basisMonthDateInput, categoryMaster, stores, yoyGrowthPctInput]
  );

  // 2. Load Saved Target OR Suggest Target for Selected Store + Year + Quarter
  const loadSavedOrSuggest = useCallback(
    async (mode: 'load-or-suggest' | 'force-suggest') => {
      if (!selectedStore) return;
      setWorksheetLoading(true);
      setStatusBanner(null);

      try {
        // First check if a saved target already exists when mode === 'load-or-suggest'
        if (mode === 'load-or-suggest') {
          const savedRes = await fetch(
            `/api/reports/sales-target?year=${targetYear}&quarter=${targetQuarter}&locationName=${encodeURIComponent(selectedStore)}`,
            { headers: authHeaders }
          );
          if (savedRes.ok) {
            const savedData = await savedRes.json();
            const existing = savedData.targets?.[0];
            if (existing && Array.isArray(existing.months) && existing.months.length > 0) {
              const mappedMonths: EditableMonthTarget[] = existing.months.map((m: Record<string, unknown>) => ({
                targetMonth: Number(m.targetMonth),
                monthName: String(m.monthName),
                targetNetSales: Number(m.targetNetSales ?? 0),
                suggestedNetSales: Number(m.suggestedNetSales ?? m.targetNetSales ?? 0),
                suggestedTargetYoY: Number(m.lastYearNetSales ?? 0) * (1 + Number(existing.yoyGrowthTargetPct ?? 0.05)),
                suggestedTargetBasisAds: Number(m.basisMonthAds ?? 0) * Number(m.totalOperatingDays ?? 30),
                lastYearNetSales: Number(m.lastYearNetSales ?? 0),
                basisMonthAds: Number(m.basisMonthAds ?? 0),
                seasonalAdjPct: Number(m.seasonalAdjPct ?? 0),
                lessHalfDays: Number(m.lessHalfDays ?? 0),
                totalOperatingDays: Number(m.totalOperatingDays ?? 30),
                weekdayDays: Number(m.weekdayDays ?? 21),
                weekendHdDays: Number(m.weekendHdDays ?? 9),
                holidayRemarks: '',
                weekdaySalesPct: Number(m.weekdaySalesPct ?? 0.5),
                weekendHdSalesPct: Number(m.weekendHdSalesPct ?? 0.5),
                avgPerCheckWeekday: Number(m.avgPerCheckWeekday ?? 470),
                avgPerCheckWeekendHd: Number(m.avgPerCheckWeekendHd ?? 470),
                historicalAvgPerCheck: Number(m.avgPerCheckWeekday ?? 470),
                categories: Array.isArray(m.categories)
                  ? m.categories.map((c: Record<string, unknown>) => ({
                      categoryCode: String(c.categoryCode),
                      categoryName: String(c.categoryName),
                      qtyUom: String(c.qtyUom ?? 'PCS'),
                      sortOrder: Number(c.sortOrder ?? 1),
                      unitPriceDivisor: Number(c.unitPriceDivisor ?? 26),
                      weekdayMixPct: Number(c.weekdayMixPct ?? 0),
                      weekendHdMixPct: Number(c.weekendHdMixPct ?? 0),
                    }))
                  : [],
              }));

              setWorksheetTarget({
                targetId: Number(existing.targetId),
                targetYear: Number(existing.targetYear),
                targetQuarter: Number(existing.targetQuarter),
                locationId: existing.locationId ? Number(existing.locationId) : null,
                locationName: String(existing.locationName),
                orgLocationRef: existing.orgLocationRef ? String(existing.orgLocationRef) : null,
                suggestionBasis: (existing.suggestionBasis as 'YOY_TREND' | 'BASIS_ADS' | 'CUSTOM') ?? 'YOY_TREND',
                basisMonthDate: existing.basisMonthDate ? String(existing.basisMonthDate) : null,
                yoyGrowthTargetPct: Number(existing.yoyGrowthTargetPct ?? 0.05),
                avgPerCheckDefault: Number(existing.avgPerCheckDefault ?? 470),
                status: String(existing.status ?? 'APPROVED'),
                remarks: '',
                months: mappedMonths,
              });

              setStatusBanner({
                type: 'info',
                message: `Loaded saved Q${targetQuarter} ${targetYear} target for ${selectedStore}. Click "Suggest Target from Trend" anytime to recalculate from historical sales.`,
              });
              setWorksheetLoading(false);
              return;
            }
          }
        }

        // Otherwise call POST /api/reports/sales-target/suggest
        const suggestRes = await fetch('/api/reports/sales-target/suggest', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            targetYear,
            targetQuarter,
            locationName: selectedStore,
            basisMonthDate: basisMonthDateInput || null,
            yoyGrowthPct: yoyGrowthPctInput / 100,
            avgPerCheck: avgPerCheckInput,
          }),
        });

        if (!suggestRes.ok) {
          throw new Error('Failed to fetch sales target suggestions.');
        }

        const suggestData = (await suggestRes.json()) as {
          calendar: CalendarMonthSummary[];
          monthlySuggestions: MonthlySuggestionRow[];
          categorySuggestions: CategorySuggestionRow[];
        };

        const storeMonthly = suggestData.monthlySuggestions.filter(
          (r) => r.LocationName === selectedStore
        );
        const storeCats = suggestData.categorySuggestions.filter(
          (r) => r.LocationName === selectedStore
        );

        if (storeMonthly.length === 0) {
          setWorksheetTarget(
            buildBlankWorksheet(selectedStore, targetYear, targetQuarter, suggestData.calendar)
          );
          setStatusBanner({
            type: 'warning',
            message: `No historical DSR data found for ${selectedStore}; initialized blank Q${targetQuarter} ${targetYear} worksheet with default template settings.`,
          });
          return;
        }

        const firstRow = storeMonthly[0];
        const resolvedBasis: 'YOY_TREND' | 'BASIS_ADS' =
          basisOption === 'AUTO'
            ? firstRow.RecommendedBasis
            : basisOption === 'BASIS_ADS'
              ? 'BASIS_ADS'
              : 'YOY_TREND';

        const months: EditableMonthTarget[] = storeMonthly.map((mRow) => {
          const calInfo = suggestData.calendar.find(
            (c) => Number(c.TargetMonth) === Number(mRow.TargetMonth)
          );

          const chosenTarget =
            resolvedBasis === 'BASIS_ADS'
              ? Number(mRow.SuggestedTargetBasisADS || mRow.SuggestedNetSales || 0)
              : Number(mRow.SuggestedTargetYoY || mRow.SuggestedNetSales || 0);

          const wdPct = Number(mRow.SuggestedWeekdaySalesPct ?? 0.5);
          const wePct = Number((1 - wdPct).toFixed(6));

          const cats: EditableCategoryMix[] = storeCats.map((cRow) => ({
            categoryCode: cRow.CategoryCode,
            categoryName: cRow.CategoryName,
            qtyUom: cRow.QtyUOM,
            sortOrder: Number(cRow.SortOrder),
            unitPriceDivisor: Number(cRow.DefaultUnitPrice),
            weekdayMixPct:
              mixSourceMode === 'historical'
                ? Number(cRow.SuggestedWeekdayMixPct)
                : Number(cRow.DefaultMixPct),
            weekendHdMixPct:
              mixSourceMode === 'historical'
                ? Number(cRow.SuggestedWeekendHdMixPct)
                : Number(cRow.DefaultMixPct),
          }));

          return {
            targetMonth: Number(mRow.TargetMonth),
            monthName: mRow.MonthName,
            targetNetSales: Math.round(chosenTarget * 100) / 100,
            suggestedNetSales: Math.round(chosenTarget * 100) / 100,
            suggestedTargetYoY: Number(mRow.SuggestedTargetYoY ?? 0),
            suggestedTargetBasisAds: Number(mRow.SuggestedTargetBasisADS ?? 0),
            lastYearNetSales: Number(mRow.LastYearNetSales ?? 0),
            basisMonthAds: Number(mRow.BasisMonthADS ?? 0),
            seasonalAdjPct: 0,
            lessHalfDays: 0,
            totalOperatingDays: Number(mRow.TotalOperatingDays),
            weekdayDays: Number(mRow.WeekdayDays),
            weekendHdDays: Number(mRow.WeekendHdDays),
            holidayRemarks: calInfo?.HolidayRemarks ?? '',
            weekdaySalesPct: wdPct,
            weekendHdSalesPct: wePct,
            avgPerCheckWeekday: Number(avgPerCheckInput || 470),
            avgPerCheckWeekendHd: Number(avgPerCheckInput || 470),
            historicalAvgPerCheck: Number(mRow.HistoricalAvgPerCheck ?? 470),
            categories: cats,
          };
        });

        setWorksheetTarget({
          targetYear,
          targetQuarter,
          locationId: firstRow.LocationID,
          locationName: firstRow.LocationName,
          orgLocationRef: firstRow.OrgLocationRef,
          suggestionBasis: resolvedBasis,
          basisMonthDate: firstRow.BasisMonthDate,
          yoyGrowthTargetPct: yoyGrowthPctInput / 100,
          avgPerCheckDefault: avgPerCheckInput,
          status: 'APPROVED',
          remarks: '',
          months,
        });

        setStatusBanner({
          type: 'success',
          message: `Generated Q${targetQuarter} ${targetYear} target suggestion for ${selectedStore} (${
            resolvedBasis === 'YOY_TREND'
              ? `Same Quarter Last Year + ${yoyGrowthPctInput}% YoY Trend`
              : `Basis Month ADS (${firstRow.BasisMonthDate || 'Latest'})`
          }). Review and click "Save Quarter Target" to persist.`,
        });
      } catch (err) {
        console.error('Error loading/suggesting Sales Target:', err);
        setStatusBanner({
          type: 'danger',
          message: err instanceof Error ? err.message : 'Failed to load sales target data.',
        });
      } finally {
        setWorksheetLoading(false);
      }
    },
    [
      authHeaders,
      avgPerCheckInput,
      basisMonthDateInput,
      basisOption,
      buildBlankWorksheet,
      mixSourceMode,
      selectedStore,
      targetQuarter,
      targetYear,
      yoyGrowthPctInput,
    ]
  );

  // Auto-load when selectedStore, targetYear, or targetQuarter changes
  useEffect(() => {
    if (selectedStore && activeTab === 'worksheet') {
      void loadSavedOrSuggest('load-or-suggest');
    }
  }, [selectedStore, targetYear, targetQuarter, activeTab, loadSavedOrSuggest]);

  // Save current Store Quarter Target
  const handleSaveTarget = async () => {
    if (!worksheetTarget) return;
    setSavingTarget(true);
    setStatusBanner(null);

    try {
      const res = await fetch('/api/reports/sales-target', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(worksheetTarget),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save quarterly sales target.');
      }

      setStatusBanner({
        type: 'success',
        message: `Successfully saved Q${worksheetTarget.targetQuarter} ${worksheetTarget.targetYear} Sales Target for ${worksheetTarget.locationName}!`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'danger',
        message: err instanceof Error ? err.message : 'Error saving sales target.',
      });
    } finally {
      setSavingTarget(false);
    }
  };

  // Batch-Generate & Save Suggested Targets for ALL Active Stores
  const handleBatchSuggestAndSaveAllStores = async () => {
    setBatchGenerating(true);
    setStatusBanner(null);

    try {
      const suggestRes = await fetch('/api/reports/sales-target/suggest', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          targetYear,
          targetQuarter,
          locationName: 'ALL',
          basisMonthDate: basisMonthDateInput || null,
          yoyGrowthPct: yoyGrowthPctInput / 100,
          avgPerCheck: avgPerCheckInput,
        }),
      });

      if (!suggestRes.ok) {
        throw new Error('Failed to generate suggestions for all stores.');
      }

      const suggestData = (await suggestRes.json()) as {
        monthlySuggestions: MonthlySuggestionRow[];
        categorySuggestions: CategorySuggestionRow[];
      };

      const storeNames = Array.from(
        new Set(suggestData.monthlySuggestions.map((r) => r.LocationName))
      );

      const batchTargets = storeNames.map((locName) => {
        const mRows = suggestData.monthlySuggestions.filter((r) => r.LocationName === locName);
        const cRows = suggestData.categorySuggestions.filter((r) => r.LocationName === locName);
        const first = mRows[0];

        const resolvedBasis =
          basisOption === 'AUTO'
            ? first.RecommendedBasis
            : basisOption === 'BASIS_ADS'
              ? 'BASIS_ADS'
              : 'YOY_TREND';

        return {
          targetYear,
          targetQuarter,
          locationId: first.LocationID,
          locationName: first.LocationName,
          orgLocationRef: first.OrgLocationRef,
          suggestionBasis: resolvedBasis,
          basisMonthDate: first.BasisMonthDate,
          yoyGrowthTargetPct: yoyGrowthPctInput / 100,
          avgPerCheckDefault: avgPerCheckInput,
          status: 'APPROVED',
          months: mRows.map((m) => {
            const targetSales =
              resolvedBasis === 'BASIS_ADS'
                ? Number(m.SuggestedTargetBasisADS || m.SuggestedNetSales || 0)
                : Number(m.SuggestedTargetYoY || m.SuggestedNetSales || 0);
            const wdPct = Number(m.SuggestedWeekdaySalesPct ?? 0.5);
            const wePct = Number((1 - wdPct).toFixed(6));

            return {
              targetMonth: Number(m.TargetMonth),
              targetNetSales: Math.round(targetSales * 100) / 100,
              suggestedNetSales: Math.round(targetSales * 100) / 100,
              lastYearNetSales: Number(m.LastYearNetSales ?? 0),
              basisMonthAds: Number(m.BasisMonthADS ?? 0),
              seasonalAdjPct: 0,
              lessHalfDays: 0,
              totalOperatingDays: Number(m.TotalOperatingDays),
              weekdayDays: Number(m.WeekdayDays),
              weekendHdDays: Number(m.WeekendHdDays),
              weekdaySalesPct: wdPct,
              weekendHdSalesPct: wePct,
              avgPerCheckWeekday: avgPerCheckInput,
              avgPerCheckWeekendHd: avgPerCheckInput,
              categories: cRows.map((c) => ({
                categoryCode: c.CategoryCode,
                qtyUom: c.QtyUOM,
                unitPriceDivisor: Number(c.DefaultUnitPrice),
                weekdayMixPct:
                  mixSourceMode === 'historical'
                    ? Number(c.SuggestedWeekdayMixPct)
                    : Number(c.DefaultMixPct),
                weekendHdMixPct:
                  mixSourceMode === 'historical'
                    ? Number(c.SuggestedWeekendHdMixPct)
                    : Number(c.DefaultMixPct),
              })),
            };
          }),
        };
      });

      const saveRes = await fetch('/api/reports/sales-target', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ targets: batchTargets }),
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || 'Failed to batch-save store targets.');
      }

      setStatusBanner({
        type: 'success',
        message: `Generated and saved Q${targetQuarter} ${targetYear} Sales Targets for ${batchTargets.length} active stores!`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'danger',
        message: err instanceof Error ? err.message : 'Batch target generation failed.',
      });
    } finally {
      setBatchGenerating(false);
    }
  };

  // Worksheet mutation helpers
  const updateMonthField = (
    monthIndex: number,
    updater: (prev: EditableMonthTarget) => EditableMonthTarget
  ) => {
    setWorksheetTarget((prev) => {
      if (!prev) return prev;
      const nextMonths = prev.months.map((m, idx) => (idx === monthIndex ? updater(m) : m));
      return { ...prev, months: nextMonths };
    });
  };

  const updateCategoryField = (
    monthIndex: number,
    catIndex: number,
    updater: (prevCat: EditableCategoryMix) => EditableCategoryMix
  ) => {
    updateMonthField(monthIndex, (m) => ({
      ...m,
      categories: m.categories.map((c, idx) => (idx === catIndex ? updater(c) : c)),
    }));
  };

  const updateCategoryPriceAllMonths = (catIndex: number, newPrice: number) => {
    setWorksheetTarget((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        months: prev.months.map((m) => ({
          ...m,
          categories: m.categories.map((c, idx) =>
            idx === catIndex ? { ...c, unitPriceDivisor: newPrice } : c
          ),
        })),
      };
    });
  };

  // Computed metrics for the 3 months in the worksheet
  const computedMonths = useMemo(() => {
    if (!worksheetTarget) return [];
    return worksheetTarget.months.map((m) => ({
      raw: m,
      calc: computeMonthMetrics(m),
    }));
  }, [worksheetTarget]);

  const quarterWorksheetTotals = useMemo(() => {
    let totalTargetSales = 0;
    let totalLastYearSales = 0;
    let totalDays = 0;
    let totalCustomers = 0;

    for (const cm of computedMonths) {
      totalTargetSales += cm.raw.targetNetSales;
      totalLastYearSales += cm.raw.lastYearNetSales;
      totalDays += cm.raw.totalOperatingDays;
      totalCustomers += cm.calc.monthlyCustomerCount;
    }

    const quarterAds = totalDays > 0 ? totalTargetSales / totalDays : 0;
    const vsLastYearPct =
      totalLastYearSales > 0
        ? ((totalTargetSales - totalLastYearSales) / totalLastYearSales) * 100
        : 0;

    return {
      totalTargetSales,
      totalLastYearSales,
      totalDays,
      totalCustomers,
      quarterAds,
      vsLastYearPct,
    };
  }, [computedMonths]);

  // 3. Load Analytics Data
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/reports/sales-target/analytics', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          targetYear,
          targetQuarter,
          locationName: analyticsStore || 'ALL',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to load sales target analytics.');
      }

      const data = (await res.json()) as {
        summary: AnalyticsSummaryRow[];
        weekdayWeekendBreakdown: AnalyticsWeekdayWeekendRow[];
        categoryBreakdown: AnalyticsCategoryRow[];
      };

      setAnalyticsSummary(data.summary ?? []);
      setAnalyticsWeekdayWeekend(data.weekdayWeekendBreakdown ?? []);
      setAnalyticsCategories(data.categoryBreakdown ?? []);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsStore, authHeaders, targetQuarter, targetYear]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      void fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics]);

  // Filtered analytics datasets based on month filter
  const filteredAnalyticsSummary = useMemo(() => {
    if (!analyticsMonthFilter) return analyticsSummary;
    return analyticsSummary.filter((r) => Number(r.TargetMonth) === analyticsMonthFilter);
  }, [analyticsMonthFilter, analyticsSummary]);

  const filteredAnalyticsWdWe = useMemo(() => {
    if (!analyticsMonthFilter) return analyticsWeekdayWeekend;
    return analyticsWeekdayWeekend.filter((r) => Number(r.TargetMonth) === analyticsMonthFilter);
  }, [analyticsMonthFilter, analyticsWeekdayWeekend]);

  const filteredAnalyticsCategories = useMemo(() => {
    if (!analyticsMonthFilter) return analyticsCategories;
    return analyticsCategories.filter((r) => Number(r.TargetMonth) === analyticsMonthFilter);
  }, [analyticsCategories, analyticsMonthFilter]);

  // Consolidated Analytics KPIs
  const analyticsKpis = useMemo(() => {
    let targetSales = 0;
    let actualNet = 0;
    let actualGross = 0;
    let lastYearNet = 0;
    let targetCustomers = 0;
    let actualCustomers = 0;
    let totalTargetDays = 0;
    let totalActualDays = 0;

    for (const r of filteredAnalyticsSummary) {
      targetSales += Number(r.TargetNetSales || 0);
      actualNet += Number(r.ActualNetSales || 0);
      actualGross += Number(r.ActualGrossSales || 0);
      lastYearNet += Number(r.LastYearNetSales || 0);
      targetCustomers += Number(r.TargetCustomerCount || 0);
      actualCustomers += Number(r.ActualCustomerCount || 0);
      totalTargetDays += Number(r.TotalOperatingDays || 0);
      totalActualDays += Number(r.ActualOperatingDays || 0);
    }

    const primaryActual = analyticsSalesMetric === 'gross' ? actualGross : actualNet;
    const variance = primaryActual - targetSales;
    const achievementPct = targetSales > 0 ? (primaryActual / targetSales) * 100 : 0;
    const yoyGrowthPct =
      lastYearNet > 0 ? ((actualNet - lastYearNet) / lastYearNet) * 100 : 0;
    const actualAvgCheck = actualCustomers > 0 ? actualNet / actualCustomers : 0;
    const targetAds = totalTargetDays > 0 ? targetSales / totalTargetDays : 0;
    const actualAds = totalActualDays > 0 ? primaryActual / totalActualDays : 0;

    return {
      targetSales,
      actualNet,
      actualGross,
      primaryActual,
      variance,
      achievementPct,
      lastYearNet,
      yoyGrowthPct,
      targetCustomers,
      actualCustomers,
      actualAvgCheck,
      targetAds,
      actualAds,
    };
  }, [analyticsSalesMetric, filteredAnalyticsSummary]);

  // Consolidated Category Summary across filtered stores/months
  const consolidatedCategoryAnalytics = useMemo(() => {
    const map = new Map<
      string,
      {
        categoryCode: string;
        categoryName: string;
        qtyUom: string;
        sortOrder: number;
        unitPriceDivisor: number;
        targetSales: number;
        actualNetSales: number;
        actualGrossSales: number;
        targetQty: number;
        actualQty: number;
      }
    >();

    for (const r of filteredAnalyticsCategories) {
      const existing = map.get(r.CategoryCode);
      if (!existing) {
        map.set(r.CategoryCode, {
          categoryCode: r.CategoryCode,
          categoryName: r.CategoryName,
          qtyUom: r.QtyUOM,
          sortOrder: Number(r.CategorySortOrder || 1),
          unitPriceDivisor: Number(r.UnitPriceDivisor || 0),
          targetSales: Number(r.TargetCategorySales || 0),
          actualNetSales: Number(r.ActualCategoryNetSales || 0),
          actualGrossSales: Number(r.ActualCategoryGrossSales || 0),
          targetQty: Number(r.TargetCategoryQty || 0),
          actualQty: Number(r.ActualCategoryQty || 0),
        });
      } else {
        existing.targetSales += Number(r.TargetCategorySales || 0);
        existing.actualNetSales += Number(r.ActualCategoryNetSales || 0);
        existing.actualGrossSales += Number(r.ActualCategoryGrossSales || 0);
        existing.targetQty += Number(r.TargetCategoryQty || 0);
        existing.actualQty += Number(r.ActualCategoryQty || 0);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [filteredAnalyticsCategories]);

  // 4. Load Calendar & Holidays in Settings Tab
  const fetchCalendarSettings = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch(`/api/reports/sales-target/calendar?year=${targetYear}`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = (await res.json()) as {
          monthlySummary: CalendarMonthSummary[];
          holidays: CalendarHolidayItem[];
        };
        setCalendarSummary(data.monthlySummary ?? []);
        setHolidays(data.holidays ?? []);
      }
    } catch (err) {
      console.error('Error fetching calendar settings:', err);
    } finally {
      setCalendarLoading(false);
    }
  }, [authHeaders, targetYear]);

  useEffect(() => {
    if (activeTab === 'settings') {
      void fetchCalendarSettings();
    }
  }, [activeTab, fetchCalendarSettings]);

  const handleSaveHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) return;
    try {
      const res = await fetch('/api/reports/sales-target/calendar/holidays', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          holidayDate: newHolidayDate,
          holidayName: newHolidayName.trim(),
          holidayType: newHolidayType,
          treatAsWeekend: true,
          remarks: newHolidayRemarks.trim() || null,
          isActive: true,
        }),
      });
      if (res.ok) {
        setNewHolidayDate('');
        setNewHolidayName('');
        setNewHolidayRemarks('');
        await fetchCalendarSettings();
      }
    } catch (err) {
      console.error('Failed to save holiday:', err);
    }
  };

  const handleSaveCategoryMaster = async () => {
    setSavingCategories(true);
    try {
      const res = await fetch('/api/reports/sales-target/categories', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ categories: categoryMaster }),
      });
      if (res.ok) {
        setStatusBanner({
          type: 'success',
          message: 'Default category unit prices and mix percentages updated.',
        });
      }
    } catch (err) {
      console.error('Failed to save categories:', err);
    } finally {
      setSavingCategories(false);
    }
  };

  return (
    <div className="container-fluid p-0">
      {/* Top Navigation & Quarter Context Bar */}
      <div className="card border rounded-4 shadow-sm mb-3 bg-white">
        <div className="card-body p-3">
          <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span
                  className="d-inline-flex align-items-center justify-content-center rounded-3 p-2"
                  style={{ background: 'var(--brand-orange-soft)', color: 'var(--brand-orange)' }}
                >
                  <Target size={20} />
                </span>
                <div>
                  <h4 className="fw-bold mb-0 h5">Quarterly Sales Target & Trend Analytics</h4>
                  <small className="text-secondary">
                    Set quarterly store targets (Sales ₱ &amp; Category Qty PCS/BOXES), suggest from YoY/ADS trends, and track achievement
                  </small>
                </div>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="btn-group" role="group" aria-label="Sales Target Views">
              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${
                  activeTab === 'worksheet' ? 'btn-primary' : 'btn-outline-secondary'
                }`}
                onClick={() => setActiveTab('worksheet')}
              >
                <FileSpreadsheet size={16} />
                <span>Target Worksheet &amp; Suggestion</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${
                  activeTab === 'analytics' ? 'btn-primary' : 'btn-outline-secondary'
                }`}
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart3 size={16} />
                <span>Target vs. Actual Analytics</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${
                  activeTab === 'settings' ? 'btn-primary' : 'btn-outline-secondary'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings size={16} />
                <span>Calendar &amp; Category Defaults</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`alert alert-${statusBanner.type} d-flex align-items-center justify-content-between py-2 px-3 rounded-3 mb-3 shadow-sm`}
          role="alert"
        >
          <div className="d-flex align-items-center gap-2 small fw-medium">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 size={17} />
            ) : (
              <AlertCircle size={17} />
            )}
            <span>{statusBanner.message}</span>
          </div>
          <button
            type="button"
            className="btn-close btn-sm"
            aria-label="Close"
            onClick={() => setStatusBanner(null)}
          />
        </div>
      )}

      {/* ===================================================================
          TAB 1: TARGET SETTING WORKSHEET & SUGGESTION WIZARD
          =================================================================== */}
      {activeTab === 'worksheet' && (
        <>
          {/* Filter & Suggestion Engine Bar */}
          <div className="card border rounded-4 shadow-sm mb-3 bg-white">
            <div className="card-body p-3">
              <div className="row g-3 align-items-end">
                <div className="col-12 col-md-4 col-xl-3">
                  <label htmlFor="st-worksheet-store" className="form-label small fw-semibold text-secondary mb-1">
                    <StoreIcon size={14} className="me-1" />
                    Store Location
                  </label>
                  <StoreSearchSelect
                    id="st-worksheet-store"
                    stores={stores}
                    value={selectedStore}
                    onChange={setSelectedStore}
                    placeholder="Type store code (e.g. MGM, MOA)..."
                  />
                </div>

                <div className="col-6 col-md-2 col-xl-1">
                  <label htmlFor="st-year" className="form-label small fw-semibold text-secondary mb-1">
                    Target Year
                  </label>
                  <select
                    id="st-year"
                    className="form-select form-select-sm"
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-2">
                  <label htmlFor="st-quarter" className="form-label small fw-semibold text-secondary mb-1">
                    Target Quarter
                  </label>
                  <select
                    id="st-quarter"
                    className="form-select form-select-sm"
                    value={targetQuarter}
                    onChange={(e) => setTargetQuarter(Number(e.target.value))}
                  >
                    <option value={1}>Q1 (Jan – Mar)</option>
                    <option value={2}>Q2 (Apr – Jun)</option>
                    <option value={3}>Q3 (Jul – Sep)</option>
                    <option value={4}>Q4 (Oct – Dec)</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-2">
                  <label htmlFor="st-basis" className="form-label small fw-semibold text-secondary mb-1">
                    Suggestion Formula
                  </label>
                  <select
                    id="st-basis"
                    className="form-select form-select-sm"
                    value={basisOption}
                    onChange={(e) => setBasisOption(e.target.value as SuggestionBasisOption)}
                  >
                    <option value="AUTO">Auto (YoY if LY exists, else ADS)</option>
                    <option value="YOY_TREND">Same Quarter Last Year + YoY %</option>
                    <option value="BASIS_ADS">Basis Month ADS × Operating Days</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-1">
                  <label htmlFor="st-yoy-pct" className="form-label small fw-semibold text-secondary mb-1">
                    YoY Growth %
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      id="st-yoy-pct"
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={yoyGrowthPctInput}
                      onChange={(e) => setYoyGrowthPctInput(Number(e.target.value))}
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </div>

                <div className="col-6 col-md-2 col-xl-1">
                  <label htmlFor="st-avg-check" className="form-label small fw-semibold text-secondary mb-1">
                    Avg / Check
                  </label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">₱</span>
                    <input
                      id="st-avg-check"
                      type="number"
                      step="5"
                      className="form-control"
                      value={avgPerCheckInput}
                      onChange={(e) => setAvgPerCheckInput(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3 col-xl-2">
                  <label htmlFor="st-mix-mode" className="form-label small fw-semibold text-secondary mb-1">
                    Category % Mix Source
                  </label>
                  <select
                    id="st-mix-mode"
                    className="form-select form-select-sm"
                    value={mixSourceMode}
                    onChange={(e) => setMixSourceMode(e.target.value as MixSourceMode)}
                  >
                    <option value="default">Template Default (60/2/9/21/2/6)</option>
                    <option value="historical">Store Historical Actual Mix %</option>
                  </select>
                </div>

                {basisOption === 'BASIS_ADS' && (
                  <div className="col-6 col-md-3 col-xl-2">
                    <label htmlFor="st-basis-month" className="form-label small fw-semibold text-secondary mb-1">
                      Basis Month (Optional)
                    </label>
                    <input
                      id="st-basis-month"
                      type="date"
                      className="form-control form-control-sm"
                      value={basisMonthDateInput}
                      onChange={(e) => setBasisMonthDateInput(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 pt-3 border-top">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-warning d-flex align-items-center gap-2 fw-semibold px-3"
                    disabled={worksheetLoading || !selectedStore}
                    onClick={() => void loadSavedOrSuggest('force-suggest')}
                  >
                    <Sparkles size={15} />
                    <span>
                      {worksheetLoading
                        ? 'Calculating Suggestion...'
                        : `Suggest Q${targetQuarter} ${targetYear} Target from Trend`}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
                    disabled={worksheetLoading || !selectedStore}
                    onClick={() => void loadSavedOrSuggest('load-or-suggest')}
                  >
                    <RefreshCw size={14} />
                    <span>Reload Saved</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                    disabled={batchGenerating}
                    onClick={() => void handleBatchSuggestAndSaveAllStores()}
                    title="Auto-suggest and save quarterly targets for all active stores in one click"
                  >
                    <Layers size={14} />
                    <span>
                      {batchGenerating
                        ? 'Generating All Stores...'
                        : `Batch Suggest & Save All Stores`}
                    </span>
                  </button>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                  {worksheetTarget && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success d-flex align-items-center gap-2"
                      onClick={() => exportWorksheetToExcel(worksheetTarget)}
                    >
                      <Download size={14} />
                      <span>Export Excel Template (.xlsx)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm btn-success d-flex align-items-center gap-2 fw-semibold px-3"
                    disabled={savingTarget || !worksheetTarget}
                    onClick={() => void handleSaveTarget()}
                  >
                    <Save size={15} />
                    <span>{savingTarget ? 'Saving...' : 'Save Quarter Target'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quarter Summary KPI Strip */}
          {worksheetTarget && (
            <div className="row g-3 mb-3">
              <div className="col-12 col-sm-6 col-xl-3">
                <div className="card border rounded-4 shadow-sm h-100 bg-white">
                  <div className="card-body py-3 px-3">
                    <small className="text-secondary d-block mb-1">
                      Q{worksheetTarget.targetQuarter} {worksheetTarget.targetYear} Total Target Net Sales
                    </small>
                    <div className="fs-4 fw-bold text-primary">
                      ₱{formatMoney(quarterWorksheetTotals.totalTargetSales)}
                    </div>
                    <small className="text-secondary">
                      Store: <strong>{worksheetTarget.locationName}</strong> ({worksheetTarget.orgLocationRef || 'Store'})
                    </small>
                  </div>
                </div>
              </div>

              <div className="col-12 col-sm-6 col-xl-3">
                <div className="card border rounded-4 shadow-sm h-100 bg-white">
                  <div className="card-body py-3 px-3">
                    <small className="text-secondary d-block mb-1">
                      Quarter Average Daily Sales (ADS)
                    </small>
                    <div className="fs-4 fw-bold">
                      ₱{formatMoney(quarterWorksheetTotals.quarterAds)}
                    </div>
                    <small className="text-secondary">
                      Across <strong>{quarterWorksheetTotals.totalDays}</strong> operating days in Q{worksheetTarget.targetQuarter}
                    </small>
                  </div>
                </div>
              </div>

              <div className="col-12 col-sm-6 col-xl-3">
                <div className="card border rounded-4 shadow-sm h-100 bg-white">
                  <div className="card-body py-3 px-3">
                    <small className="text-secondary d-block mb-1">
                      Same Quarter Last Year ({worksheetTarget.targetYear - 1} Q{worksheetTarget.targetQuarter})
                    </small>
                    <div className="fs-4 fw-bold">
                      ₱{formatMoney(quarterWorksheetTotals.totalLastYearSales)}
                    </div>
                    <small
                      className={
                        quarterWorksheetTotals.vsLastYearPct >= 0
                          ? 'text-success fw-semibold'
                          : 'text-danger fw-semibold'
                      }
                    >
                      {quarterWorksheetTotals.totalLastYearSales > 0
                        ? `${quarterWorksheetTotals.vsLastYearPct >= 0 ? '+' : ''}${quarterWorksheetTotals.vsLastYearPct.toFixed(2)}% vs. Last Year`
                        : 'New Store / Using Basis Month ADS'}
                    </small>
                  </div>
                </div>
              </div>

              <div className="col-12 col-sm-6 col-xl-3">
                <div className="card border rounded-4 shadow-sm h-100 bg-white">
                  <div className="card-body py-3 px-3">
                    <small className="text-secondary d-block mb-1">
                      Target Quarter Customer Count (@ ₱{formatMoney(worksheetTarget.avgPerCheckDefault)})
                    </small>
                    <div className="fs-4 fw-bold">
                      {formatQty(quarterWorksheetTotals.totalCustomers, 0)} checks
                    </div>
                    <small className="text-secondary">
                      Formula: Daily Target Sales ÷ Average Per Check
                    </small>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive 3-Month Excel-Style Target Worksheet */}
          {worksheetTarget && computedMonths.length > 0 && (
            <div className="card border rounded-4 shadow-sm bg-white mb-4">
              <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                  <h5 className="h6 fw-bold mb-0">
                    Store Target Breakdown Matrix — {worksheetTarget.locationName} (Q{worksheetTarget.targetQuarter} {worksheetTarget.targetYear})
                  </h5>
                  <small className="text-secondary">
                    Edit Monthly Target Sales, Weekday/Weekend % Split, Average Per Check, or Category Mix % below — all daily Sales &amp; Qty (PCS/BOXES) update automatically.
                  </small>
                </div>
                <span className="badge text-bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2">
                  Basis: {worksheetTarget.suggestionBasis}
                </span>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                  <thead className="table-light text-center">
                    <tr>
                      <th rowSpan={2} className="text-start ps-3" style={{ minWidth: 230 }}>
                        PARTICULARS
                      </th>
                      <th rowSpan={2} style={{ minWidth: 105 }}>
                        PRICE / UOM
                      </th>
                      {computedMonths.map((cm) => (
                        <th key={cm.raw.targetMonth} colSpan={2} className="py-2 bg-primary bg-opacity-10 text-dark">
                          <div className="fw-bold text-uppercase">{cm.raw.monthName} {worksheetTarget.targetYear}</div>
                          {cm.raw.holidayRemarks && (
                            <div className="text-secondary fw-normal" style={{ fontSize: '0.7rem' }}>
                              Holidays: {cm.raw.holidayRemarks}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {computedMonths.map((cm) => (
                        <Fragment key={`subhdr-${cm.raw.targetMonth}`}>
                          <th
                            className="bg-light text-secondary fw-semibold"
                            style={{ minWidth: 135 }}
                          >
                            WEEKDAYS
                          </th>
                          <th
                            className="bg-warning bg-opacity-10 text-dark fw-semibold"
                            style={{ minWidth: 135 }}
                          >
                            WEEKENDS / HD
                          </th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {/* ROW 1: MONTHLY TARGET NET SALES (Editable) */}
                    <tr className="bg-primary bg-opacity-10">
                      <td className="fw-bold ps-3">MONTHLY TARGET NET SALES (₱)</td>
                      <td className="text-center text-secondary">PHP</td>
                      {computedMonths.map((cm, mIdx) => (
                        <td key={cm.raw.targetMonth} colSpan={2} className="p-2">
                          <div className="input-group input-group-sm mb-1">
                            <span className="input-group-text fw-bold">₱</span>
                            <input
                              type="number"
                              step="1000"
                              className="form-control fw-bold text-end"
                              value={cm.raw.targetNetSales}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateMonthField(mIdx, (prev) => ({
                                  ...prev,
                                  targetNetSales: val,
                                }));
                              }}
                            />
                          </div>
                          <div className="d-flex flex-wrap justify-content-between gap-1" style={{ fontSize: '0.71rem' }}>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none"
                              onClick={() =>
                                updateMonthField(mIdx, (prev) => ({
                                  ...prev,
                                  targetNetSales: Math.round(prev.suggestedTargetYoY * 100) / 100,
                                }))
                              }
                              title="Click to apply YoY Trend suggestion"
                            >
                              YoY: ₱{formatMoney(cm.raw.suggestedTargetYoY)}
                            </button>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none text-secondary"
                              onClick={() =>
                                updateMonthField(mIdx, (prev) => ({
                                  ...prev,
                                  targetNetSales: Math.round(prev.suggestedTargetBasisAds * 100) / 100,
                                }))
                              }
                              title="Click to apply Basis Month ADS suggestion"
                            >
                              Basis ADS: ₱{formatMoney(cm.raw.suggestedTargetBasisAds)}
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* ROW 2: LAST YEAR ACTUAL & BASIS ADS REFERENCE */}
                    <tr className="text-secondary" style={{ fontSize: '0.75rem' }}>
                      <td className="ps-3">Historical Reference (LY Sales / Basis ADS)</td>
                      <td className="text-center">Ref</td>
                      {computedMonths.map((cm) => (
                        <Fragment key={`ref-${cm.raw.targetMonth}`}>
                          <td className="text-end">
                            LY: ₱{formatMoney(cm.raw.lastYearNetSales)}
                          </td>
                          <td className="text-end">
                            Basis ADS: ₱{formatMoney(cm.raw.basisMonthAds)}
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* ROW 3: MONTHLY ADS */}
                    <tr>
                      <td className="fw-semibold ps-3">MONTHLY ADS (Target ÷ Total Days)</td>
                      <td className="text-center text-secondary">PHP / Day</td>
                      {computedMonths.map((cm) => (
                        <Fragment key={`adsrow-${cm.raw.targetMonth}`}>
                          <td className="text-end fw-bold text-primary">
                            ₱{formatMoney(cm.calc.monthlyAds)}
                          </td>
                          <td className="text-center text-secondary">
                            {cm.raw.totalOperatingDays} total days
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* ROW 4: OPERATING DAYS (WEEKDAYS vs WEEKENDS/HD) */}
                    <tr>
                      <td className="fw-semibold ps-3">NUMBER OF OPERATING DAYS</td>
                      <td className="text-center text-secondary">Days</td>
                      {computedMonths.map((cm, mIdx) => (
                        <Fragment key={`opdays-${cm.raw.targetMonth}`}>
                          <td className="p-1">
                            <input
                              type="number"
                              min={0}
                              max={31}
                              className="form-control form-control-sm text-center"
                              value={cm.raw.weekdayDays}
                              onChange={(e) => {
                                const wd = Number(e.target.value);
                                updateMonthField(mIdx, (prev) => ({
                                  ...prev,
                                  weekdayDays: wd,
                                  totalOperatingDays: wd + prev.weekendHdDays,
                                }));
                              }}
                            />
                          </td>
                          <td className="p-1 bg-warning bg-opacity-10">
                            <input
                              type="number"
                              min={0}
                              max={31}
                              className="form-control form-control-sm text-center"
                              value={cm.raw.weekendHdDays}
                              onChange={(e) => {
                                const we = Number(e.target.value);
                                updateMonthField(mIdx, (prev) => ({
                                  ...prev,
                                  weekendHdDays: we,
                                  totalOperatingDays: prev.weekdayDays + we,
                                }));
                              }}
                            />
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* ROW 5: % SALES SHARE (WEEKDAYS % vs WEEKENDS/HD %) */}
                    <tr>
                      <td className="fw-semibold ps-3">% SHARE OF MONTHLY SALES</td>
                      <td className="text-center text-secondary">% Split</td>
                      {computedMonths.map((cm, mIdx) => (
                        <Fragment key={`split-${cm.raw.targetMonth}`}>
                          <td className="p-1">
                            <div className="input-group input-group-sm">
                              <input
                                type="number"
                                step="0.5"
                                min={0}
                                max={100}
                                className="form-control text-end"
                                value={Number((cm.raw.weekdaySalesPct * 100).toFixed(2))}
                                onChange={(e) => {
                                  const pct = Math.min(100, Math.max(0, Number(e.target.value))) / 100;
                                  updateMonthField(mIdx, (prev) => ({
                                    ...prev,
                                    weekdaySalesPct: pct,
                                    weekendHdSalesPct: Number((1 - pct).toFixed(6)),
                                  }));
                                }}
                              />
                              <span className="input-group-text">%</span>
                            </div>
                          </td>
                          <td className="p-1 bg-warning bg-opacity-10">
                            <div className="input-group input-group-sm">
                              <input
                                type="number"
                                step="0.5"
                                min={0}
                                max={100}
                                className="form-control text-end"
                                value={Number((cm.raw.weekendHdSalesPct * 100).toFixed(2))}
                                onChange={(e) => {
                                  const pct = Math.min(100, Math.max(0, Number(e.target.value))) / 100;
                                  updateMonthField(mIdx, (prev) => ({
                                    ...prev,
                                    weekendHdSalesPct: pct,
                                    weekdaySalesPct: Number((1 - pct).toFixed(6)),
                                  }));
                                }}
                              />
                              <span className="input-group-text">%</span>
                            </div>
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* ROW 6: DAILY TARGET SALES (WEEKDAYS vs WEEKENDS/HD) */}
                    <tr className="table-light">
                      <td className="fw-bold ps-3">DAILY TARGET SALES (₱)</td>
                      <td className="text-center text-secondary">PHP / Day</td>
                      {computedMonths.map((cm) => (
                        <Fragment key={`ds-${cm.raw.targetMonth}`}>
                          <td className="text-end fw-bold">
                            ₱{formatMoney(cm.calc.dailyTargetSalesWeekday)}
                          </td>
                          <td className="text-end fw-bold bg-warning bg-opacity-10">
                            ₱{formatMoney(cm.calc.dailyTargetSalesWeekendHd)}
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* ROW 7: AVERAGE PER CHECK (Default 470.00) */}
                    <tr>
                      <td className="fw-semibold ps-3">AVERAGE PER CHECK (Default ₱470)</td>
                      <td className="text-center text-secondary">PHP / Check</td>
                      {computedMonths.map((cm, mIdx) => (
                        <Fragment key={`ac-${cm.raw.targetMonth}`}>
                          <td className="p-1">
                            <input
                              type="number"
                              step="5"
                              className="form-control form-control-sm text-end"
                              value={cm.raw.avgPerCheckWeekday}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateMonthField(mIdx, (prev) => ({
                                  ...prev,
                                  avgPerCheckWeekday: val,
                                }));
                              }}
                            />
                          </td>
                          <td className="p-1 bg-warning bg-opacity-10">
                            <input
                              type="number"
                              step="5"
                              className="form-control form-control-sm text-end"
                              value={cm.raw.avgPerCheckWeekendHd}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateMonthField(mIdx, (prev) => ({
                                  ...prev,
                                  avgPerCheckWeekendHd: val,
                                }));
                              }}
                            />
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* ROW 8: DAILY CUSTOMER COUNT */}
                    <tr className="table-light">
                      <td className="fw-bold ps-3">DAILY CUSTOMER COUNT (Checks)</td>
                      <td className="text-center text-secondary">Daily Checks</td>
                      {computedMonths.map((cm) => (
                        <Fragment key={`cc-${cm.raw.targetMonth}`}>
                          <td className="text-end fw-semibold">
                            {formatQty(cm.calc.dailyCustomerCountWeekday, 1)}
                          </td>
                          <td className="text-end fw-semibold bg-warning bg-opacity-10">
                            {formatQty(cm.calc.dailyCustomerCountWeekendHd, 1)}
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* SECTION HEADER: PER CATEGORY % MIX */}
                    <tr className="table-secondary">
                      <td className="fw-bold ps-3 text-uppercase">PER CATEGORY % MIX</td>
                      <td className="text-center fw-bold">UNIT PRICE (₱)</td>
                      {computedMonths.map((cm) => {
                        const wdOk = Math.abs(cm.calc.totalWeekdayMixPct - 1) < 0.005;
                        const weOk = Math.abs(cm.calc.totalWeekendHdMixPct - 1) < 0.005;
                        return (
                          <Fragment key={`mixhdr-${cm.raw.targetMonth}`}>
                            <td
                              className={`text-center fw-bold ${wdOk ? 'text-success' : 'text-danger'}`}
                            >
                              Sum: {formatPct(cm.calc.totalWeekdayMixPct, 1)}
                            </td>
                            <td
                              className={`text-center fw-bold ${weOk ? 'text-success' : 'text-danger'}`}
                            >
                              Sum: {formatPct(cm.calc.totalWeekendHdMixPct, 1)}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>

                    {computedMonths[0]?.raw.categories.map((cat0, catIdx) => (
                      <tr key={`mix-${cat0.categoryCode}`}>
                        <td className="ps-3 fw-medium">
                          {cat0.categoryName}{' '}
                          <span className="badge text-bg-light border text-secondary ms-1">
                            {cat0.qtyUom}
                          </span>
                        </td>
                        <td className="p-1">
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">₱</span>
                            <input
                              type="number"
                              step="1"
                              className="form-control text-end"
                              value={cat0.unitPriceDivisor}
                              onChange={(e) =>
                                updateCategoryPriceAllMonths(catIdx, Number(e.target.value))
                              }
                            />
                          </div>
                        </td>
                        {computedMonths.map((cm, mIdx) => {
                          const cat = cm.raw.categories[catIdx];
                          if (!cat) return null;
                          return (
                            <Fragment key={`mcell-${cm.raw.targetMonth}-${cat.categoryCode}`}>
                              <td className="p-1">
                                <div className="input-group input-group-sm">
                                  <input
                                    type="number"
                                    step="0.5"
                                    className="form-control text-end"
                                    value={Number((cat.weekdayMixPct * 100).toFixed(2))}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) / 100;
                                      updateCategoryField(mIdx, catIdx, (prev) => ({
                                        ...prev,
                                        weekdayMixPct: val,
                                      }));
                                    }}
                                  />
                                  <span className="input-group-text">%</span>
                                </div>
                              </td>
                              <td className="p-1 bg-warning bg-opacity-10">
                                <div className="input-group input-group-sm">
                                  <input
                                    type="number"
                                    step="0.5"
                                    className="form-control text-end"
                                    value={Number((cat.weekendHdMixPct * 100).toFixed(2))}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) / 100;
                                      updateCategoryField(mIdx, catIdx, (prev) => ({
                                        ...prev,
                                        weekendHdMixPct: val,
                                      }));
                                    }}
                                  />
                                  <span className="input-group-text">%</span>
                                </div>
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}

                    {/* SECTION HEADER: DAILY TARGET SALES PER CATEGORY (PHP) */}
                    <tr className="table-secondary">
                      <td colSpan={8} className="fw-bold ps-3 text-uppercase">
                        DAILY TARGET SALES PER CATEGORY (₱) — Daily Target Sales × Category %
                      </td>
                    </tr>

                    {computedMonths[0]?.calc.categories.map((cat0, catIdx) => (
                      <tr key={`csales-${cat0.categoryCode}`}>
                        <td className="ps-3">{cat0.categoryName}</td>
                        <td className="text-center text-secondary">₱{cat0.unitPriceDivisor}</td>
                        {computedMonths.map((cm) => {
                          const c = cm.calc.categories[catIdx];
                          return (
                            <Fragment key={`cscell-${cm.raw.targetMonth}-${cat0.categoryCode}`}>
                              <td className="text-end">
                                ₱{formatMoney(c?.dailySalesWeekday ?? 0)}
                              </td>
                              <td className="text-end bg-warning bg-opacity-10">
                                ₱{formatMoney(c?.dailySalesWeekendHd ?? 0)}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}

                    <tr className="table-light fw-bold">
                      <td className="ps-3">TOTAL DAILY CATEGORY SALES CHECK (₱)</td>
                      <td className="text-center text-secondary">Check</td>
                      {computedMonths.map((cm) => (
                        <Fragment key={`tcs-${cm.raw.targetMonth}`}>
                          <td className="text-end text-primary">
                            ₱{formatMoney(cm.calc.totalDailyCategorySalesWeekday)}
                          </td>
                          <td className="text-end text-primary bg-warning bg-opacity-10">
                            ₱{formatMoney(cm.calc.totalDailyCategorySalesWeekendHd)}
                          </td>
                        </Fragment>
                      ))}
                    </tr>

                    {/* SECTION HEADER: DAILY TARGET QTY PER CATEGORY (PCS / BOXES) */}
                    <tr className="table-secondary">
                      <td colSpan={8} className="fw-bold ps-3 text-uppercase">
                        DAILY TARGET QUANTITY PER CATEGORY (PCS / BOXES) — Daily Category Sales ÷ Unit Price
                      </td>
                    </tr>

                    {computedMonths[0]?.calc.categories.map((cat0, catIdx) => (
                      <tr key={`cqty-${cat0.categoryCode}`}>
                        <td className="ps-3 fw-medium">
                          {cat0.categoryName} ({cat0.qtyUom})
                        </td>
                        <td className="text-center text-secondary">{cat0.qtyUom} / Day</td>
                        {computedMonths.map((cm) => {
                          const c = cm.calc.categories[catIdx];
                          return (
                            <Fragment key={`cqcell-${cm.raw.targetMonth}-${cat0.categoryCode}`}>
                              <td className="text-end fw-semibold">
                                {formatQty(c?.dailyQtyWeekday ?? 0, 1)}
                              </td>
                              <td className="text-end fw-semibold bg-warning bg-opacity-10">
                                {formatQty(c?.dailyQtyWeekendHd ?? 0, 1)}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}

                    {/* SECTION HEADER: MONTHLY TOTAL CATEGORY TARGETS (SALES & QTY) */}
                    <tr className="table-secondary">
                      <td colSpan={8} className="fw-bold ps-3 text-uppercase">
                        MONTHLY TOTAL CATEGORY TARGETS (TOTAL SALES ₱ &amp; TOTAL QTY PCS/BOXES)
                      </td>
                    </tr>

                    {computedMonths[0]?.calc.categories.map((cat0, catIdx) => (
                      <tr key={`mcat-${cat0.categoryCode}`}>
                        <td className="ps-3 fw-medium">{cat0.categoryName} (Monthly Total)</td>
                        <td className="text-center text-secondary">Sales / {cat0.qtyUom}</td>
                        {computedMonths.map((cm) => {
                          const c = cm.calc.categories[catIdx];
                          return (
                            <Fragment key={`mcatcell-${cm.raw.targetMonth}-${cat0.categoryCode}`}>
                              <td className="text-end">
                                ₱{formatMoney(c?.monthlySales ?? 0)}
                              </td>
                              <td className="text-end fw-bold bg-light">
                                {formatQty(c?.monthlyQty ?? 0, 0)} {cat0.qtyUom}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================
          TAB 2: TARGET VS. ACTUAL & YOY ANALYTICAL REPORTS
          =================================================================== */}
      {activeTab === 'analytics' && (
        <>
          {/* Analytics Filters Bar */}
          <div className="card border rounded-4 shadow-sm mb-3 bg-white">
            <div className="card-body p-3">
              <div className="row g-3 align-items-end">
                <div className="col-12 col-md-4 col-xl-3">
                  <label htmlFor="st-analytics-store" className="form-label small fw-semibold text-secondary mb-1">
                    <StoreIcon size={14} className="me-1" />
                    Store Scope
                  </label>
                  <StoreSearchSelect
                    id="st-analytics-store"
                    stores={stores}
                    value={analyticsStore}
                    onChange={setAnalyticsStore}
                    includeAllOption
                    allOptionLabel="ALL STORES (Consolidated)"
                  />
                </div>

                <div className="col-6 col-md-2 col-xl-1">
                  <label htmlFor="st-an-year" className="form-label small fw-semibold text-secondary mb-1">
                    Year
                  </label>
                  <select
                    id="st-an-year"
                    className="form-select form-select-sm"
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-2">
                  <label htmlFor="st-an-quarter" className="form-label small fw-semibold text-secondary mb-1">
                    Quarter
                  </label>
                  <select
                    id="st-an-quarter"
                    className="form-select form-select-sm"
                    value={targetQuarter}
                    onChange={(e) => {
                      setTargetQuarter(Number(e.target.value));
                      setAnalyticsMonthFilter(0);
                    }}
                  >
                    <option value={1}>Q1 (Jan – Mar)</option>
                    <option value={2}>Q2 (Apr – Jun)</option>
                    <option value={3}>Q3 (Jul – Sep)</option>
                    <option value={4}>Q4 (Oct – Dec)</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-2">
                  <label htmlFor="st-an-month" className="form-label small fw-semibold text-secondary mb-1">
                    Month Filter
                  </label>
                  <select
                    id="st-an-month"
                    className="form-select form-select-sm"
                    value={analyticsMonthFilter}
                    onChange={(e) => setAnalyticsMonthFilter(Number(e.target.value))}
                  >
                    <option value={0}>All 3 Months (Q{targetQuarter})</option>
                    {getQuarterMonths(targetQuarter).map((m) => (
                      <option key={m.month} value={m.month}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-2">
                  <label className="form-label small fw-semibold text-secondary mb-1 d-block">
                    Sales Metric Basis
                  </label>
                  <div className="btn-group btn-group-sm w-100">
                    <button
                      type="button"
                      className={`btn ${
                        analyticsSalesMetric === 'net' ? 'btn-primary' : 'btn-outline-secondary'
                      }`}
                      onClick={() => setAnalyticsSalesMetric('net')}
                    >
                      Net Sales
                    </button>
                    <button
                      type="button"
                      className={`btn ${
                        analyticsSalesMetric === 'gross' ? 'btn-primary' : 'btn-outline-secondary'
                      }`}
                      onClick={() => setAnalyticsSalesMetric('gross')}
                    >
                      Gross Sales
                    </button>
                  </div>
                </div>

                <div className="col-12 col-md-12 col-xl-2 d-flex gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary d-flex align-items-center gap-1 px-3"
                    disabled={analyticsLoading}
                    onClick={() => void fetchAnalytics()}
                  >
                    <RefreshCw size={14} />
                    <span>{analyticsLoading ? 'Loading...' : 'Refresh'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                    disabled={filteredAnalyticsSummary.length === 0}
                    onClick={() =>
                      exportAnalyticsToExcel({
                        targetYear,
                        targetQuarter,
                        locationName: analyticsStore || 'ALL',
                        summary: filteredAnalyticsSummary,
                        weekdayWeekend: filteredAnalyticsWdWe,
                        categories: filteredAnalyticsCategories,
                      })
                    }
                  >
                    <Download size={14} />
                    <span>Export .xlsx</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Executive KPI Cards */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 shadow-sm h-100 bg-white">
                <div className="card-body py-3 px-3">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <small className="text-secondary">
                      Actual {analyticsSalesMetric === 'gross' ? 'Gross' : 'Net'} Sales vs. Target
                    </small>
                    <span
                      className={`badge ${
                        analyticsKpis.achievementPct >= 100
                          ? 'text-bg-success'
                          : analyticsKpis.achievementPct >= 85
                            ? 'text-bg-warning'
                            : 'text-bg-danger'
                      }`}
                    >
                      {analyticsKpis.achievementPct.toFixed(1)}% Achieved
                    </span>
                  </div>
                  <div className="fs-4 fw-bold">₱{formatMoney(analyticsKpis.primaryActual)}</div>
                  <small className="text-secondary d-block">
                    Target: <strong>₱{formatMoney(analyticsKpis.targetSales)}</strong> (Var:{' '}
                    <span className={analyticsKpis.variance >= 0 ? 'text-success' : 'text-danger'}>
                      {analyticsKpis.variance >= 0 ? '+' : ''}₱{formatMoney(analyticsKpis.variance)}
                    </span>
                    )
                  </small>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 shadow-sm h-100 bg-white">
                <div className="card-body py-3 px-3">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <small className="text-secondary">
                      YoY Trend ({targetYear} vs. {targetYear - 1})
                    </small>
                    <TrendingUp size={16} className="text-primary" />
                  </div>
                  <div
                    className={`fs-4 fw-bold ${
                      analyticsKpis.yoyGrowthPct >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {analyticsKpis.yoyGrowthPct >= 0 ? '+' : ''}
                    {analyticsKpis.yoyGrowthPct.toFixed(2)}%
                  </div>
                  <small className="text-secondary d-block">
                    Last Year Net Sales: <strong>₱{formatMoney(analyticsKpis.lastYearNet)}</strong>
                  </small>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 shadow-sm h-100 bg-white">
                <div className="card-body py-3 px-3">
                  <small className="text-secondary d-block mb-1">
                    Average Daily Sales (Actual vs. Target ADS)
                  </small>
                  <div className="fs-4 fw-bold">₱{formatMoney(analyticsKpis.actualAds)}</div>
                  <small className="text-secondary d-block">
                    Target ADS: <strong>₱{formatMoney(analyticsKpis.targetAds)}</strong> / day
                  </small>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 shadow-sm h-100 bg-white">
                <div className="card-body py-3 px-3">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <small className="text-secondary">Actual Avg Check &amp; Guest Count</small>
                    <Users size={16} className="text-secondary" />
                  </div>
                  <div className="fs-4 fw-bold">₱{formatMoney(analyticsKpis.actualAvgCheck)}</div>
                  <small className="text-secondary d-block">
                    Actual Checks: <strong>{formatQty(analyticsKpis.actualCustomers, 0)}</strong> (Target:{' '}
                    {formatQty(analyticsKpis.targetCustomers, 0)} @ ₱470)
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* Category Performance Visual & Matrix (Both Sales ₱ & Qty PCS/BOXES) */}
          <div className="card border rounded-4 shadow-sm bg-white mb-3">
            <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <h5 className="h6 fw-bold mb-0">
                  Category Target vs. Actual Performance (Sales ₱ &amp; Quantity PCS/BOXES)
                </h5>
                <small className="text-secondary">
                  Compares planned category targets against actual POS item sales mapped from dbo.dts_details
                </small>
              </div>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={`btn ${
                    analyticsCategoryMode === 'sales' ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                  onClick={() => setAnalyticsCategoryMode('sales')}
                >
                  Category Sales (₱)
                </button>
                <button
                  type="button"
                  className={`btn ${
                    analyticsCategoryMode === 'qty' ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                  onClick={() => setAnalyticsCategoryMode('qty')}
                >
                  Category Qty (PCS / BOXES)
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '0.83rem' }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-3">Category</th>
                    <th className="text-center">UOM</th>
                    <th className="text-end">Price Divisor</th>
                    <th className="text-end">Target Sales (₱)</th>
                    <th className="text-end">Actual Net Sales (₱)</th>
                    <th className="text-end">Sales Variance (₱)</th>
                    <th className="text-center">Sales Achv %</th>
                    <th className="text-end">Target Qty</th>
                    <th className="text-end">Actual Qty</th>
                    <th className="text-end">Qty Variance</th>
                    <th className="text-center pe-3">Qty Achv %</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidatedCategoryAnalytics.map((cat) => {
                    const actualSalesVal =
                      analyticsSalesMetric === 'gross' ? cat.actualGrossSales : cat.actualNetSales;
                    const salesVar = actualSalesVal - cat.targetSales;
                    const salesAchv = cat.targetSales > 0 ? (actualSalesVal / cat.targetSales) * 100 : 0;
                    const qtyVar = cat.actualQty - cat.targetQty;
                    const qtyAchv = cat.targetQty > 0 ? (cat.actualQty / cat.targetQty) * 100 : 0;

                    return (
                      <tr key={cat.categoryCode}>
                        <td className="ps-3 fw-bold">{cat.categoryName}</td>
                        <td className="text-center">
                          <span className="badge text-bg-light border text-secondary">{cat.qtyUom}</span>
                        </td>
                        <td className="text-end">₱{formatMoney(cat.unitPriceDivisor)}</td>
                        <td className="text-end fw-semibold">₱{formatMoney(cat.targetSales)}</td>
                        <td className="text-end fw-bold text-primary">₱{formatMoney(actualSalesVal)}</td>
                        <td
                          className={`text-end fw-semibold ${
                            salesVar >= 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {salesVar >= 0 ? '+' : ''}₱{formatMoney(salesVar)}
                        </td>
                        <td className="text-center" style={{ minWidth: 120 }}>
                          <div className="d-flex align-items-center gap-2 justify-content-center">
                            <div className="progress flex-grow-1" style={{ height: 6 }}>
                              <div
                                className={`progress-bar ${
                                  salesAchv >= 100
                                    ? 'bg-success'
                                    : salesAchv >= 80
                                      ? 'bg-warning'
                                      : 'bg-danger'
                                }`}
                                style={{ width: `${Math.min(100, salesAchv)}%` }}
                              />
                            </div>
                            <span className="small fw-semibold">{salesAchv.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="text-end fw-semibold">{formatQty(cat.targetQty, 0)}</td>
                        <td className="text-end fw-bold">{formatQty(cat.actualQty, 0)}</td>
                        <td
                          className={`text-end fw-semibold ${
                            qtyVar >= 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {qtyVar >= 0 ? '+' : ''}
                          {formatQty(qtyVar, 0)}
                        </td>
                        <td className="text-center pe-3">
                          <span
                            className={`badge ${
                              qtyAchv >= 100
                                ? 'text-bg-success'
                                : qtyAchv >= 80
                                  ? 'text-bg-warning'
                                  : 'text-bg-secondary'
                            }`}
                          >
                            {qtyAchv.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Store & Monthly Target vs. Actual + YoY Summary Table */}
          <div className="card border rounded-4 shadow-sm bg-white mb-3">
            <div className="card-header bg-white border-bottom py-3">
              <h5 className="h6 fw-bold mb-0">
                Store &amp; Monthly Target vs. Actual Summary (with YoY Growth &amp; Required Run-Rate)
              </h5>
            </div>
            <div className="table-responsive" style={{ maxHeight: 440 }}>
              <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                <thead className="table-light sticky-top">
                  <tr>
                    <th className="ps-3">Store</th>
                    <th>Month</th>
                    <th className="text-center">Days (Act/Tgt)</th>
                    <th className="text-end">Target Sales (₱)</th>
                    <th className="text-end">Actual Net Sales (₱)</th>
                    <th className="text-end">Actual Gross (₱)</th>
                    <th className="text-end">Variance (₱)</th>
                    <th className="text-center">Achv %</th>
                    <th className="text-end">Target ADS</th>
                    <th className="text-end">Actual ADS</th>
                    <th className="text-end">Req. Run Rate</th>
                    <th className="text-end">Last Year Net</th>
                    <th className="text-center">YoY %</th>
                    <th className="text-end pe-3">Actual Avg Check</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyticsSummary.map((r, idx) => (
                    <tr key={`${r.LocationName}-${r.TargetMonth}-${idx}`}>
                      <td className="ps-3 fw-semibold">{r.LocationName}</td>
                      <td>{r.MonthName}</td>
                      <td className="text-center">
                        {r.ActualOperatingDays} / {r.TotalOperatingDays}
                      </td>
                      <td className="text-end fw-semibold">₱{formatMoney(r.TargetNetSales)}</td>
                      <td className="text-end fw-bold text-primary">₱{formatMoney(r.ActualNetSales)}</td>
                      <td className="text-end text-secondary">₱{formatMoney(r.ActualGrossSales)}</td>
                      <td
                        className={`text-end fw-semibold ${
                          Number(r.VarianceNetSales) >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {Number(r.VarianceNetSales) >= 0 ? '+' : ''}₱{formatMoney(r.VarianceNetSales)}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${
                            Number(r.AchievementPct) >= 100
                              ? 'text-bg-success'
                              : Number(r.AchievementPct) >= 85
                                ? 'text-bg-warning'
                                : 'text-bg-secondary'
                          }`}
                        >
                          {Number(r.AchievementPct || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-end">₱{formatMoney(r.TargetADS)}</td>
                      <td className="text-end">₱{formatMoney(r.ActualADS)}</td>
                      <td className="text-end text-warning-emphasis fw-medium">
                        ₱{formatMoney(r.RequiredDailyRunRate)}
                      </td>
                      <td className="text-end text-secondary">₱{formatMoney(r.LastYearNetSales)}</td>
                      <td
                        className={`text-center fw-semibold ${
                          Number(r.YoYGrowthPct) >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {Number(r.LastYearNetSales) > 0
                          ? `${Number(r.YoYGrowthPct) >= 0 ? '+' : ''}${Number(r.YoYGrowthPct).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="text-end pe-3">₱{formatMoney(r.ActualAvgCheck)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Weekday vs. Weekend/HD Breakdown Table */}
          <div className="card border rounded-4 shadow-sm bg-white mb-4">
            <div className="card-header bg-white border-bottom py-3">
              <h5 className="h6 fw-bold mb-0">
                Weekday vs. Weekend/Holiday (WEEKENDS/HD) Target vs. Actual Breakdown
              </h5>
            </div>
            <div className="table-responsive" style={{ maxHeight: 380 }}>
              <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                <thead className="table-light sticky-top">
                  <tr>
                    <th className="ps-3">Store</th>
                    <th>Month</th>
                    <th className="text-center">WD Days (Act/Tgt)</th>
                    <th className="text-center">WE/HD Days (Act/Tgt)</th>
                    <th className="text-end">Target Daily (WD)</th>
                    <th className="text-end">Actual Daily (WD)</th>
                    <th className="text-end">Target Daily (WE/HD)</th>
                    <th className="text-end">Actual Daily (WE/HD)</th>
                    <th className="text-center">Planned Split (WD / WE)</th>
                    <th className="text-center pe-3">Actual Split (WD / WE)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyticsWdWe.map((r, idx) => (
                    <tr key={`wdwe-${r.LocationName}-${r.TargetMonth}-${idx}`}>
                      <td className="ps-3 fw-semibold">{r.LocationName}</td>
                      <td>{r.MonthName}</td>
                      <td className="text-center">
                        {r.ActualWeekdayDays} / {r.TargetWeekdayDays}
                      </td>
                      <td className="text-center">
                        {r.ActualWeekendHdDays} / {r.TargetWeekendHdDays}
                      </td>
                      <td className="text-end">₱{formatMoney(r.TargetDailySalesWeekday)}</td>
                      <td className="text-end fw-semibold text-primary">
                        ₱{formatMoney(r.ActualDailySalesWeekday)}
                      </td>
                      <td className="text-end">₱{formatMoney(r.TargetDailySalesWeekendHd)}</td>
                      <td className="text-end fw-semibold text-primary">
                        ₱{formatMoney(r.ActualDailySalesWeekendHd)}
                      </td>
                      <td className="text-center text-secondary">
                        {formatPct(r.TargetWeekdaySalesPct, 1)} / {formatPct(r.TargetWeekendHdSalesPct, 1)}
                      </td>
                      <td className="text-center pe-3 fw-medium">
                        {formatPct(r.ActualWeekdaySalesPct, 1)} / {formatPct(r.ActualWeekendHdSalesPct, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===================================================================
          TAB 3: CALENDAR & CATEGORY DEFAULTS
          =================================================================== */}
      {activeTab === 'settings' && (
        <div className="row g-3">
          {/* Left Column: Calendar & Holiday Configuration */}
          <div className="col-12 col-xl-6">
            <div className="card border rounded-4 shadow-sm bg-white mb-3">
              <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
                <div>
                  <h5 className="h6 fw-bold mb-0">
                    <Calendar size={16} className="me-2 text-primary" />
                    {targetYear} Operating Calendar Breakdown (Weekdays vs. Weekends/HD)
                  </h5>
                  <small className="text-secondary">
                    Matches the CALENDAR sheet in the Excel template; weekday holidays automatically shift to WEEKENDS/HD.
                  </small>
                </div>
                <select
                  className="form-select form-select-sm w-auto"
                  value={targetYear}
                  onChange={(e) => setTargetYear(Number(e.target.value))}
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">Month</th>
                      <th className="text-center">Total Days</th>
                      <th className="text-center">Weekdays</th>
                      <th className="text-center bg-warning bg-opacity-10">Weekends / HD</th>
                      <th className="text-center pe-3">Holidays on Weekday</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarLoading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-secondary">
                          Loading calendar...
                        </td>
                      </tr>
                    ) : (
                      calendarSummary.map((c) => (
                        <tr key={c.TargetMonth}>
                          <td className="ps-3 fw-semibold">{c.MonthName}</td>
                          <td className="text-center">{c.TotalDays}</td>
                          <td className="text-center fw-semibold">{c.WeekdayDays}</td>
                          <td className="text-center fw-bold bg-warning bg-opacity-10">
                            {c.WeekendHdDays}
                          </td>
                          <td className="text-center pe-3 text-secondary">{c.HolidayWeekdayCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Holiday List & Add Holiday Form */}
            <div className="card border rounded-4 shadow-sm bg-white">
              <div className="card-header bg-white border-bottom py-3">
                <h6 className="fw-bold mb-0">Holiday Dates ({targetYear})</h6>
              </div>
              <div className="card-body p-3 border-bottom bg-light">
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-sm-3">
                    <label className="form-label small mb-1">Holiday Date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-sm-4">
                    <label className="form-label small mb-1">Holiday Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. National Heroes Day"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                    />
                  </div>
                  <div className="col-6 col-sm-2">
                    <label className="form-label small mb-1">Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={newHolidayType}
                      onChange={(e) => setNewHolidayType(e.target.value)}
                    >
                      <option value="REGULAR">REGULAR</option>
                      <option value="SPECIAL">SPECIAL</option>
                      <option value="COMPANY">COMPANY</option>
                    </select>
                  </div>
                  <div className="col-6 col-sm-3">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary w-100 d-flex align-items-center justify-content-center gap-1"
                      onClick={() => void handleSaveHoliday()}
                    >
                      <Plus size={14} />
                      <span>Add Holiday</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="table-responsive" style={{ maxHeight: 300 }}>
                <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">Date</th>
                      <th>Holiday Name</th>
                      <th>Type</th>
                      <th className="text-center pe-3">Counts as Weekend/HD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h) => (
                      <tr key={h.HolidayID}>
                        <td className="ps-3 fw-semibold">{h.HolidayDate}</td>
                        <td>{h.HolidayName}</td>
                        <td>
                          <span className="badge text-bg-light border text-secondary">
                            {h.HolidayType}
                          </span>
                        </td>
                        <td className="text-center pe-3">
                          {h.TreatAsWeekend ? (
                            <span className="badge text-bg-success">Yes</span>
                          ) : (
                            <span className="badge text-bg-secondary">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Target Category Master & POS Item Mapping Rules */}
          <div className="col-12 col-xl-6">
            <div className="card border rounded-4 shadow-sm bg-white mb-3">
              <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
                <div>
                  <h5 className="h6 fw-bold mb-0">
                    Target Categories, Unit Price Divisors &amp; Default % Mix
                  </h5>
                  <small className="text-secondary">
                    Used to convert Daily Category Sales (₱) into Daily Category Quantity (PCS / BOXES).
                  </small>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-success d-flex align-items-center gap-1"
                  disabled={savingCategories}
                  onClick={() => void handleSaveCategoryMaster()}
                >
                  <Save size={14} />
                  <span>{savingCategories ? 'Saving...' : 'Save Defaults'}</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">Category Code</th>
                      <th>Display Name</th>
                      <th style={{ width: 95 }}>UOM</th>
                      <th style={{ width: 130 }}>Default Unit Price</th>
                      <th className="pe-3" style={{ width: 130 }}>
                        Default Mix %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryMaster.map((c, idx) => (
                      <tr key={c.CategoryCode}>
                        <td className="ps-3 fw-semibold">{c.CategoryCode}</td>
                        <td>{c.CategoryName}</td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm text-center"
                            value={c.QtyUOM}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCategoryMaster((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, QtyUOM: val } : item))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">₱</span>
                            <input
                              type="number"
                              step="1"
                              className="form-control text-end"
                              value={c.DefaultUnitPrice}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setCategoryMaster((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, DefaultUnitPrice: val } : item
                                  )
                                );
                              }}
                            />
                          </div>
                        </td>
                        <td className="pe-3">
                          <div className="input-group input-group-sm">
                            <input
                              type="number"
                              step="1"
                              className="form-control text-end"
                              value={Number((c.DefaultMixPct * 100).toFixed(2))}
                              onChange={(e) => {
                                const val = Number(e.target.value) / 100;
                                setCategoryMaster((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, DefaultMixPct: val } : item
                                  )
                                );
                              }}
                            />
                            <span className="input-group-text">%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* POS dts_object / dts_details Mapping Table */}
            <div className="card border rounded-4 shadow-sm bg-white">
              <div className="card-header bg-white border-bottom py-3">
                <h6 className="fw-bold mb-0">
                  POS Transaction Mapping Rules (dbo.dts_object &amp; dbo.dts_details)
                </h6>
                <small className="text-secondary">
                  Priority-ordered rules connecting MajorGroup, FamilyGroup, and ItemName to Target Categories
                </small>
              </div>
              <div className="table-responsive" style={{ maxHeight: 310 }}>
                <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">Priority</th>
                      <th>Target Category</th>
                      <th>Match Field</th>
                      <th className="pe-3">Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryMappings.map((m) => (
                      <tr key={m.MapID}>
                        <td className="ps-3 text-secondary">{m.Priority}</td>
                        <td className="fw-semibold">{m.CategoryCode}</td>
                        <td>
                          <span className="badge text-bg-light border text-secondary">
                            {m.MatchType}
                          </span>
                        </td>
                        <td className="pe-3 font-monospace">{m.MatchValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
