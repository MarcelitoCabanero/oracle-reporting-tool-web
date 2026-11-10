import * as XLSX from 'xlsx';

export interface TargetCategoryMaster {
  CategoryID: number;
  CategoryCode: string;
  CategoryName: string;
  QtyUOM: string;
  DefaultUnitPrice: number;
  DefaultMixPct: number;
  SortOrder: number;
  IsActive: boolean;
}

export interface TargetCategoryMapping {
  MapID: number;
  CategoryCode: string;
  MatchType: string;
  MatchValue: string;
  Priority: number;
  IsActive: boolean;
}

export interface CalendarMonthSummary {
  TargetYear: number;
  TargetQuarter?: number;
  TargetMonth: number;
  MonthName: string;
  TotalDays: number;
  WeekdayDays: number;
  WeekendHdDays: number;
  HolidayWeekdayCount: number;
  HolidayWeekendCount: number;
  HolidayRemarks?: string;
}

export interface CalendarHolidayItem {
  HolidayID: number;
  HolidayDate: string;
  HolidayName: string;
  HolidayType: string;
  TreatAsWeekend: boolean;
  Remarks: string | null;
  IsActive: boolean;
}

export interface MonthlySuggestionRow {
  LocationID: number | null;
  LocationName: string;
  OrgLocationRef: string | null;
  TargetYear: number;
  TargetQuarter: number;
  TargetMonth: number;
  MonthName: string;
  TotalOperatingDays: number;
  WeekdayDays: number;
  WeekendHdDays: number;
  LastYearNetSales: number;
  LastYearGrossSales: number;
  LastYearOperatingDays: number;
  LastYearADS: number;
  TwoYearsAgoNetSales: number;
  HistoricalYoYGrowthPct: number;
  BasisMonthDate: string | null;
  BasisMonthNetSales: number;
  BasisMonthOperatingDays: number;
  BasisMonthADS: number;
  SuggestedTargetYoY: number;
  SuggestedTargetBasisADS: number;
  RecommendedBasis: 'YOY_TREND' | 'BASIS_ADS';
  SuggestedNetSales: number;
  SuggestedWeekdaySalesPct: number;
  SuggestedWeekendHdSalesPct: number;
  HistoricalAvgPerCheck: number;
  DefaultAvgPerCheck: number;
}

export interface CategorySuggestionRow {
  LocationName: string;
  OrgLocationRef: string | null;
  CategoryID: number;
  CategoryCode: string;
  CategoryName: string;
  QtyUOM: string;
  SortOrder: number;
  DefaultUnitPrice: number;
  DefaultMixPct: number;
  LastYearCategoryNetSales: number;
  LastYearCategoryGrossSales: number;
  LastYearCategoryQty: number;
  HistoricalEffectiveUnitPrice: number;
  SuggestedWeekdayMixPct: number;
  SuggestedWeekendHdMixPct: number;
  HistoricalOverallMixPct: number;
}

export interface EditableCategoryMix {
  categoryCode: string;
  categoryName: string;
  qtyUom: string;
  sortOrder: number;
  unitPriceDivisor: number;
  weekdayMixPct: number;    // Stored as decimal 0..1 (e.g. 0.60)
  weekendHdMixPct: number;  // Stored as decimal 0..1 (e.g. 0.60)
}

export interface EditableMonthTarget {
  targetMonth: number;
  monthName: string;
  targetNetSales: number;
  suggestedNetSales: number;
  suggestedTargetYoY: number;
  suggestedTargetBasisAds: number;
  lastYearNetSales: number;
  basisMonthAds: number;
  seasonalAdjPct: number;   // Decimal e.g. 0.05 for +5%
  lessHalfDays: number;
  totalOperatingDays: number;
  weekdayDays: number;
  weekendHdDays: number;
  holidayRemarks: string;
  weekdaySalesPct: number;   // Decimal 0..1 (e.g. 0.50)
  weekendHdSalesPct: number; // Decimal 0..1 (e.g. 0.50)
  avgPerCheckWeekday: number;
  avgPerCheckWeekendHd: number;
  historicalAvgPerCheck: number;
  categories: EditableCategoryMix[];
}

export interface EditableStoreQuarterTarget {
  targetId?: number;
  targetYear: number;
  targetQuarter: number;
  locationId: number | null;
  locationName: string;
  orgLocationRef: string | null;
  suggestionBasis: 'YOY_TREND' | 'BASIS_ADS' | 'CUSTOM';
  basisMonthDate: string | null;
  yoyGrowthTargetPct: number;
  avgPerCheckDefault: number;
  status: string;
  remarks: string;
  months: EditableMonthTarget[];
}

export interface AnalyticsSummaryRow {
  LocationID: number | null;
  LocationName: string;
  OrgLocationRef: string | null;
  TargetID: number | null;
  TargetStatus: string;
  TargetYear: number;
  TargetQuarter: number;
  TargetMonth: number;
  MonthName: string;
  TotalOperatingDays: number;
  TargetWeekdayDays: number;
  TargetWeekendHdDays: number;
  TargetNetSales: number;
  SuggestedNetSales: number;
  TargetADS: number;
  ActualNetSales: number;
  ActualGrossSales: number;
  ActualOperatingDays: number;
  ActualADS: number;
  VarianceNetSales: number;
  AchievementPct: number;
  RemainingTargetSales: number;
  RemainingOperatingDays: number;
  RequiredDailyRunRate: number;
  LastYearNetSales: number;
  LastYearGrossSales: number;
  LastYearADS: number;
  YoYVarianceNetSales: number;
  YoYGrowthPct: number;
  TargetAvgCheck: number;
  TargetCustomerCount: number;
  ActualCustomerCount: number;
  ActualAvgCheck: number;
}

export interface AnalyticsWeekdayWeekendRow {
  LocationName: string;
  OrgLocationRef: string | null;
  TargetMonth: number;
  MonthName: string;
  TargetWeekdayDays: number;
  TargetWeekendHdDays: number;
  TargetWeekdaySalesPct: number;
  TargetWeekendHdSalesPct: number;
  TargetMonthlySalesWeekday: number;
  TargetMonthlySalesWeekendHd: number;
  TargetDailySalesWeekday: number;
  TargetDailySalesWeekendHd: number;
  ActualWeekdayDays: number;
  ActualWeekendHdDays: number;
  ActualMonthlySalesWeekday: number;
  ActualMonthlySalesWeekendHd: number;
  ActualDailySalesWeekday: number;
  ActualDailySalesWeekendHd: number;
  ActualWeekdaySalesPct: number;
  ActualWeekendHdSalesPct: number;
}

export interface AnalyticsCategoryRow {
  LocationName: string;
  OrgLocationRef: string | null;
  TargetMonth: number;
  MonthName: string;
  CategoryCode: string;
  CategoryName: string;
  CategorySortOrder: number;
  QtyUOM: string;
  UnitPriceDivisor: number;
  TargetWeekdayMixPct: number;
  TargetWeekendHdMixPct: number;
  TargetCategorySales: number;
  ActualCategoryNetSales: number;
  ActualCategoryGrossSales: number;
  VarianceCategorySales: number;
  CategorySalesAchievementPct: number;
  TargetCategoryQty: number;
  ActualCategoryQty: number;
  VarianceCategoryQty: number;
  CategoryQtyAchievementPct: number;
  DailyTargetSalesWeekday: number;
  DailyTargetSalesWeekendHd: number;
  DailyTargetQtyWeekday: number;
  DailyTargetQtyWeekendHd: number;
  ActualCategoryMixPct: number;
}

export interface ComputedMonthMetrics {
  monthlyAds: number;
  dailyTargetSalesWeekday: number;
  dailyTargetSalesWeekendHd: number;
  dailyCustomerCountWeekday: number;
  dailyCustomerCountWeekendHd: number;
  monthlyCustomerCount: number;
  totalWeekdayMixPct: number;
  totalWeekendHdMixPct: number;
  categories: Array<{
    categoryCode: string;
    categoryName: string;
    qtyUom: string;
    unitPriceDivisor: number;
    weekdayMixPct: number;
    weekendHdMixPct: number;
    dailySalesWeekday: number;
    dailySalesWeekendHd: number;
    dailyQtyWeekday: number;
    dailyQtyWeekendHd: number;
    monthlySales: number;
    monthlyQty: number;
  }>;
  totalDailyCategorySalesWeekday: number;
  totalDailyCategorySalesWeekendHd: number;
  totalMonthlyCategorySales: number;
}

export function computeMonthMetrics(m: EditableMonthTarget): ComputedMonthMetrics {
  const monthlyAds = m.totalOperatingDays > 0 ? m.targetNetSales / m.totalOperatingDays : 0;
  const dailyTargetSalesWeekday =
    m.weekdayDays > 0 ? (m.targetNetSales * m.weekdaySalesPct) / m.weekdayDays : 0;
  const dailyTargetSalesWeekendHd =
    m.weekendHdDays > 0 ? (m.targetNetSales * m.weekendHdSalesPct) / m.weekendHdDays : 0;

  const dailyCustomerCountWeekday =
    m.avgPerCheckWeekday > 0 ? dailyTargetSalesWeekday / m.avgPerCheckWeekday : 0;
  const dailyCustomerCountWeekendHd =
    m.avgPerCheckWeekendHd > 0 ? dailyTargetSalesWeekendHd / m.avgPerCheckWeekendHd : 0;

  const monthlyCustomerCount =
    dailyCustomerCountWeekday * m.weekdayDays + dailyCustomerCountWeekendHd * m.weekendHdDays;

  let totalWeekdayMixPct = 0;
  let totalWeekendHdMixPct = 0;
  let totalDailyCategorySalesWeekday = 0;
  let totalDailyCategorySalesWeekendHd = 0;
  let totalMonthlyCategorySales = 0;

  const categories = m.categories.map((cat) => {
    totalWeekdayMixPct += cat.weekdayMixPct;
    totalWeekendHdMixPct += cat.weekendHdMixPct;

    const dailySalesWeekday = dailyTargetSalesWeekday * cat.weekdayMixPct;
    const dailySalesWeekendHd = dailyTargetSalesWeekendHd * cat.weekendHdMixPct;
    const dailyQtyWeekday =
      cat.unitPriceDivisor > 0 ? dailySalesWeekday / cat.unitPriceDivisor : 0;
    const dailyQtyWeekendHd =
      cat.unitPriceDivisor > 0 ? dailySalesWeekendHd / cat.unitPriceDivisor : 0;

    const monthlySales =
      dailySalesWeekday * m.weekdayDays + dailySalesWeekendHd * m.weekendHdDays;
    const monthlyQty =
      cat.unitPriceDivisor > 0 ? monthlySales / cat.unitPriceDivisor : 0;

    totalDailyCategorySalesWeekday += dailySalesWeekday;
    totalDailyCategorySalesWeekendHd += dailySalesWeekendHd;
    totalMonthlyCategorySales += monthlySales;

    return {
      categoryCode: cat.categoryCode,
      categoryName: cat.categoryName,
      qtyUom: cat.qtyUom,
      unitPriceDivisor: cat.unitPriceDivisor,
      weekdayMixPct: cat.weekdayMixPct,
      weekendHdMixPct: cat.weekendHdMixPct,
      dailySalesWeekday,
      dailySalesWeekendHd,
      dailyQtyWeekday,
      dailyQtyWeekendHd,
      monthlySales,
      monthlyQty,
    };
  });

  return {
    monthlyAds,
    dailyTargetSalesWeekday,
    dailyTargetSalesWeekendHd,
    dailyCustomerCountWeekday,
    dailyCustomerCountWeekendHd,
    monthlyCustomerCount,
    totalWeekdayMixPct,
    totalWeekendHdMixPct,
    categories,
    totalDailyCategorySalesWeekday,
    totalDailyCategorySalesWeekendHd,
    totalMonthlyCategorySales,
  };
}

/**
 * Exports the Store Quarterly Sales Target Worksheet to Excel (.xlsx)
 * matching the A01_Target_per_category template layout.
 */
export function exportWorksheetToExcel(target: EditableStoreQuarterTarget): void {
  const wb = XLSX.utils.book_new();
  const computedMonths = target.months.map((m) => ({
    raw: m,
    calc: computeMonthMetrics(m),
  }));

  const m0 = computedMonths[0];
  const m1 = computedMonths[1];
  const m2 = computedMonths[2];

  const rows: Array<Array<string | number>> = [];

  rows.push([
    `STORE: ${target.locationName} (${target.orgLocationRef || ''})`,
    `YEAR: ${target.targetYear}`,
    `QUARTER: Q${target.targetQuarter}`,
    `BASIS: ${target.suggestionBasis}`,
    `DEFAULT AVG CHECK: ${target.avgPerCheckDefault}`,
    '',
    '',
    '',
  ]);
  rows.push([]);

  // Month Headers
  rows.push([
    'PARTICULARS',
    'PRICE / UOM',
    m0 ? `${m0.raw.monthName.toUpperCase()} (WEEKDAYS)` : 'MONTH 1 (WD)',
    m0 ? `${m0.raw.monthName.toUpperCase()} (WEEKENDS/HD)` : 'MONTH 1 (WE/HD)',
    m1 ? `${m1.raw.monthName.toUpperCase()} (WEEKDAYS)` : 'MONTH 2 (WD)',
    m1 ? `${m1.raw.monthName.toUpperCase()} (WEEKENDS/HD)` : 'MONTH 2 (WE/HD)',
    m2 ? `${m2.raw.monthName.toUpperCase()} (WEEKDAYS)` : 'MONTH 3 (WD)',
    m2 ? `${m2.raw.monthName.toUpperCase()} (WEEKENDS/HD)` : 'MONTH 3 (WE/HD)',
  ]);

  rows.push([
    'MONTHLY TARGET NET SALES (PHP)',
    '',
    m0 ? Math.round(m0.raw.targetNetSales * 100) / 100 : 0,
    '',
    m1 ? Math.round(m1.raw.targetNetSales * 100) / 100 : 0,
    '',
    m2 ? Math.round(m2.raw.targetNetSales * 100) / 100 : 0,
    '',
  ]);

  rows.push([
    'MONTHLY ADS (TARGET / DAYS)',
    '',
    m0 ? Math.round(m0.calc.monthlyAds * 100) / 100 : 0,
    `Days: ${m0?.raw.totalOperatingDays ?? 0}`,
    m1 ? Math.round(m1.calc.monthlyAds * 100) / 100 : 0,
    `Days: ${m1?.raw.totalOperatingDays ?? 0}`,
    m2 ? Math.round(m2.calc.monthlyAds * 100) / 100 : 0,
    `Days: ${m2?.raw.totalOperatingDays ?? 0}`,
  ]);

  rows.push([
    'NUMBER OF OPERATING DAYS',
    '',
    m0?.raw.weekdayDays ?? 0,
    m0?.raw.weekendHdDays ?? 0,
    m1?.raw.weekdayDays ?? 0,
    m1?.raw.weekendHdDays ?? 0,
    m2?.raw.weekdayDays ?? 0,
    m2?.raw.weekendHdDays ?? 0,
  ]);

  rows.push([
    'SALES SHARE % (WEEKDAY vs WEEKEND/HD)',
    '',
    m0 ? `${(m0.raw.weekdaySalesPct * 100).toFixed(2)}%` : '0%',
    m0 ? `${(m0.raw.weekendHdSalesPct * 100).toFixed(2)}%` : '0%',
    m1 ? `${(m1.raw.weekdaySalesPct * 100).toFixed(2)}%` : '0%',
    m1 ? `${(m1.raw.weekendHdSalesPct * 100).toFixed(2)}%` : '0%',
    m2 ? `${(m2.raw.weekdaySalesPct * 100).toFixed(2)}%` : '0%',
    m2 ? `${(m2.raw.weekendHdSalesPct * 100).toFixed(2)}%` : '0%',
  ]);

  rows.push([
    'DAILY TARGET SALES (PHP)',
    '',
    m0 ? Math.round(m0.calc.dailyTargetSalesWeekday * 100) / 100 : 0,
    m0 ? Math.round(m0.calc.dailyTargetSalesWeekendHd * 100) / 100 : 0,
    m1 ? Math.round(m1.calc.dailyTargetSalesWeekday * 100) / 100 : 0,
    m1 ? Math.round(m1.calc.dailyTargetSalesWeekendHd * 100) / 100 : 0,
    m2 ? Math.round(m2.calc.dailyTargetSalesWeekday * 100) / 100 : 0,
    m2 ? Math.round(m2.calc.dailyTargetSalesWeekendHd * 100) / 100 : 0,
  ]);

  rows.push([
    'AVERAGE PER CHECK',
    '',
    m0?.raw.avgPerCheckWeekday ?? 470,
    m0?.raw.avgPerCheckWeekendHd ?? 470,
    m1?.raw.avgPerCheckWeekday ?? 470,
    m1?.raw.avgPerCheckWeekendHd ?? 470,
    m2?.raw.avgPerCheckWeekday ?? 470,
    m2?.raw.avgPerCheckWeekendHd ?? 470,
  ]);

  rows.push([
    'DAILY CUSTOMER COUNT',
    '',
    m0 ? Math.round(m0.calc.dailyCustomerCountWeekday * 10) / 10 : 0,
    m0 ? Math.round(m0.calc.dailyCustomerCountWeekendHd * 10) / 10 : 0,
    m1 ? Math.round(m1.calc.dailyCustomerCountWeekday * 10) / 10 : 0,
    m1 ? Math.round(m1.calc.dailyCustomerCountWeekendHd * 10) / 10 : 0,
    m2 ? Math.round(m2.calc.dailyCustomerCountWeekday * 10) / 10 : 0,
    m2 ? Math.round(m2.calc.dailyCustomerCountWeekendHd * 10) / 10 : 0,
  ]);

  rows.push([]);
  rows.push(['PER CATEGORY % MIX', 'PRICE DIVISOR', '', '', '', '', '', '']);

  const categoryList = m0?.calc.categories ?? [];
  for (let i = 0; i < categoryList.length; i++) {
    const c0 = m0?.calc.categories[i];
    const c1 = m1?.calc.categories[i];
    const c2 = m2?.calc.categories[i];
    if (!c0) continue;

    rows.push([
      c0.categoryName,
      c0.unitPriceDivisor,
      `${(c0.weekdayMixPct * 100).toFixed(2)}%`,
      `${(c0.weekendHdMixPct * 100).toFixed(2)}%`,
      c1 ? `${(c1.weekdayMixPct * 100).toFixed(2)}%` : '0%',
      c1 ? `${(c1.weekendHdMixPct * 100).toFixed(2)}%` : '0%',
      c2 ? `${(c2.weekdayMixPct * 100).toFixed(2)}%` : '0%',
      c2 ? `${(c2.weekendHdMixPct * 100).toFixed(2)}%` : '0%',
    ]);
  }

  rows.push([]);
  rows.push(['DAILY TARGET SALES PER CATEGORY (PHP)', 'PRICE DIVISOR', '', '', '', '', '', '']);

  for (let i = 0; i < categoryList.length; i++) {
    const c0 = m0?.calc.categories[i];
    const c1 = m1?.calc.categories[i];
    const c2 = m2?.calc.categories[i];
    if (!c0) continue;

    rows.push([
      c0.categoryName,
      c0.unitPriceDivisor,
      Math.round(c0.dailySalesWeekday * 100) / 100,
      Math.round(c0.dailySalesWeekendHd * 100) / 100,
      c1 ? Math.round(c1.dailySalesWeekday * 100) / 100 : 0,
      c1 ? Math.round(c1.dailySalesWeekendHd * 100) / 100 : 0,
      c2 ? Math.round(c2.dailySalesWeekday * 100) / 100 : 0,
      c2 ? Math.round(c2.dailySalesWeekendHd * 100) / 100 : 0,
    ]);
  }

  rows.push([
    'TOTAL DAILY CATEGORY SALES',
    '',
    m0 ? Math.round(m0.calc.totalDailyCategorySalesWeekday * 100) / 100 : 0,
    m0 ? Math.round(m0.calc.totalDailyCategorySalesWeekendHd * 100) / 100 : 0,
    m1 ? Math.round(m1.calc.totalDailyCategorySalesWeekday * 100) / 100 : 0,
    m1 ? Math.round(m1.calc.totalDailyCategorySalesWeekendHd * 100) / 100 : 0,
    m2 ? Math.round(m2.calc.totalDailyCategorySalesWeekday * 100) / 100 : 0,
    m2 ? Math.round(m2.calc.totalDailyCategorySalesWeekendHd * 100) / 100 : 0,
  ]);

  rows.push([]);
  rows.push(['DAILY TARGET QTY PER CATEGORY', 'UOM', '', '', '', '', '', '']);

  for (let i = 0; i < categoryList.length; i++) {
    const c0 = m0?.calc.categories[i];
    const c1 = m1?.calc.categories[i];
    const c2 = m2?.calc.categories[i];
    if (!c0) continue;

    rows.push([
      `${c0.categoryName} (${c0.qtyUom})`,
      c0.qtyUom,
      Math.round(c0.dailyQtyWeekday * 10) / 10,
      Math.round(c0.dailyQtyWeekendHd * 10) / 10,
      c1 ? Math.round(c1.dailyQtyWeekday * 10) / 10 : 0,
      c1 ? Math.round(c1.dailyQtyWeekendHd * 10) / 10 : 0,
      c2 ? Math.round(c2.dailyQtyWeekday * 10) / 10 : 0,
      c2 ? Math.round(c2.dailyQtyWeekendHd * 10) / 10 : 0,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 36 },
    { wch: 15 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `${target.orgLocationRef || target.locationName}_Q${target.targetQuarter}`);
  XLSX.writeFile(
    wb,
    `Sales_Target_${target.locationName}_${target.targetYear}_Q${target.targetQuarter}.xlsx`
  );
}

/**
 * Exports Target vs. Actual Analytics to a multi-sheet Excel workbook (.xlsx)
 */
export function exportAnalyticsToExcel(params: {
  targetYear: number;
  targetQuarter: number;
  locationName: string;
  summary: AnalyticsSummaryRow[];
  weekdayWeekend: AnalyticsWeekdayWeekendRow[];
  categories: AnalyticsCategoryRow[];
}): void {
  const wb = XLSX.utils.book_new();

  const summarySheetData = params.summary.map((r) => ({
    Store: r.LocationName,
    Code: r.OrgLocationRef || '',
    Year: r.TargetYear,
    Quarter: `Q${r.TargetQuarter}`,
    Month: r.MonthName,
    'Operating Days': r.TotalOperatingDays,
    'Target Net Sales': Number(r.TargetNetSales || 0),
    'Actual Net Sales': Number(r.ActualNetSales || 0),
    'Actual Gross Sales': Number(r.ActualGrossSales || 0),
    'Variance (Net)': Number(r.VarianceNetSales || 0),
    'Achievement %': Number(r.AchievementPct || 0),
    'Target ADS': Number(r.TargetADS || 0),
    'Actual ADS': Number(r.ActualADS || 0),
    'Remaining Target': Number(r.RemainingTargetSales || 0),
    'Required Daily Run Rate': Number(r.RequiredDailyRunRate || 0),
    'Last Year Net Sales': Number(r.LastYearNetSales || 0),
    'YoY Growth %': Number(r.YoYGrowthPct || 0),
    'Target Avg Check': Number(r.TargetAvgCheck || 470),
    'Actual Avg Check': Number(r.ActualAvgCheck || 0),
    'Target Customer Count': Math.round(Number(r.TargetCustomerCount || 0)),
    'Actual Customer Count': Number(r.ActualCustomerCount || 0),
  }));

  const wdWeSheetData = params.weekdayWeekend.map((r) => ({
    Store: r.LocationName,
    Month: r.MonthName,
    'Target WD Days': r.TargetWeekdayDays,
    'Target WE/HD Days': r.TargetWeekendHdDays,
    'Target WD %': Number((r.TargetWeekdaySalesPct * 100).toFixed(2)),
    'Target WE/HD %': Number((r.TargetWeekendHdSalesPct * 100).toFixed(2)),
    'Target Daily Sales (WD)': Number(r.TargetDailySalesWeekday || 0),
    'Actual Daily Sales (WD)': Number(r.ActualDailySalesWeekday || 0),
    'Target Daily Sales (WE/HD)': Number(r.TargetDailySalesWeekendHd || 0),
    'Actual Daily Sales (WE/HD)': Number(r.ActualDailySalesWeekendHd || 0),
    'Actual WD %': Number((r.ActualWeekdaySalesPct * 100).toFixed(2)),
    'Actual WE/HD %': Number((r.ActualWeekendHdSalesPct * 100).toFixed(2)),
  }));

  const catSheetData = params.categories.map((r) => ({
    Store: r.LocationName,
    Month: r.MonthName,
    Category: r.CategoryName,
    UOM: r.QtyUOM,
    'Price Divisor': Number(r.UnitPriceDivisor || 0),
    'Target Sales (PHP)': Number(r.TargetCategorySales || 0),
    'Actual Net Sales (PHP)': Number(r.ActualCategoryNetSales || 0),
    'Actual Gross Sales (PHP)': Number(r.ActualCategoryGrossSales || 0),
    'Sales Variance (PHP)': Number(r.VarianceCategorySales || 0),
    'Sales Achievement %': Number(r.CategorySalesAchievementPct || 0),
    'Target Qty': Number(r.TargetCategoryQty || 0),
    'Actual Qty': Number(r.ActualCategoryQty || 0),
    'Qty Variance': Number(r.VarianceCategoryQty || 0),
    'Qty Achievement %': Number(r.CategoryQtyAchievementPct || 0),
    'Target Mix % (WD)': Number((r.TargetWeekdayMixPct * 100).toFixed(2)),
    'Actual Mix %': Number((r.ActualCategoryMixPct * 100).toFixed(2)),
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
  const wsWdWe = XLSX.utils.json_to_sheet(wdWeSheetData);
  const wsCat = XLSX.utils.json_to_sheet(catSheetData);

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & YoY');
  XLSX.utils.book_append_sheet(wb, wsWdWe, 'Weekday vs Weekend-HD');
  XLSX.utils.book_append_sheet(wb, wsCat, 'Category Sales & Qty');

  XLSX.writeFile(
    wb,
    `Sales_Target_Analytics_${params.locationName}_${params.targetYear}_Q${params.targetQuarter}.xlsx`
  );
}
