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

/* =========================================================================
   OPENXML (.XLSX) STYLE ENGINE USING BUILT-IN XLSX.CFB
   ========================================================================= */

/**
 * Style indices defined in our custom OpenXML styles.xml palette:
 *  0: Default
 *  1: Title Banner (Navy #1E293B fill, White 13pt Bold, Left/Center)
 *  2: Brand Subtitle Banner (Orange #EA580C fill, White 10pt Bold, Left/Center)
 *  3: Meta Label (Slate #F1F5F9 fill, #475569 9.5pt Bold, Left, Thin border)
 *  4: Meta Value Text (White fill, #0F172A 9.5pt Bold, Left, Thin border)
 *  5: Meta Value Money (Soft Blue #EFF6FF fill, #1E3A8A 10pt Bold, Right, ₱#,##0.00, Thin border)
 *  6: Meta Value Pct (Soft Blue #EFF6FF fill, #1E3A8A 10pt Bold, Right, 0.00%, Thin border)
 *  7: Table Header Dark (#1E293B fill, White 9.5pt Bold, Center, Thin border, Wrap)
 *  8: Table Header Left (#1E293B fill, White 9.5pt Bold, Left, Thin border, Wrap)
 *  9: Month Header Blue (#1D4ED8 fill, White 10pt Bold, Center, Thin border)
 * 10: Subheader Weekday (#DBEAFE fill, #1E3A8A 9pt Bold, Center, Thin border)
 * 11: Subheader Weekend/HD (#FEF3C7 fill, #92400E 9pt Bold, Center, Thin border)
 * 12: Subheader Quarter (#E0E7FF fill, #312E81 9pt Bold, Center, Thin border)
 * 13: Section Divider Banner (#E2E8F0 fill, #0F172A 9.5pt Bold, Left, Medium Top/Bottom border)
 * 14: Data Text Left (White fill, #1E293B 9.5pt Regular, Left, Thin border)
 * 15: Data Text Bold Left (White fill, #0F172A 9.5pt Bold, Left, Thin border)
 * 16: Data Text Center (White fill, #475569 9pt Regular, Center, Thin border)
 * 17: Data Money WD (White fill, #0F172A 9.5pt Regular, Right, ₱#,##0.00, Thin border)
 * 18: Data Money WE (#FFFBEB Amber fill, #0F172A 9.5pt Regular, Right, ₱#,##0.00, Thin border)
 * 19: Data Money Bold WD (White fill, #0F172A 9.5pt Bold, Right, ₱#,##0.00, Thin border)
 * 20: Data Money Bold WE (#FFFBEB Amber fill, #92400E 9.5pt Bold, Right, ₱#,##0.00, Thin border)
 * 21: Data Money Highlight (#EFF6FF Blue fill, #1D4ED8 10pt Bold, Right, ₱#,##0.00, Thin border)
 * 22: Data Money Qtr (#F5F3FF Indigo fill, #312E81 9.5pt Bold, Right, ₱#,##0.00, Thin border)
 * 23: Data Pct WD (White fill, #1E293B 9.5pt Regular, Right, 0.00%, Thin border)
 * 24: Data Pct WE (#FFFBEB Amber fill, #92400E 9.5pt Regular, Right, 0.00%, Thin border)
 * 25: Data Qty 1-Dec WD (White fill, #0F172A 9.5pt Semibold, Right, #,##0.0, Thin border)
 * 26: Data Qty 1-Dec WE (#FFFBEB Amber fill, #92400E 9.5pt Semibold, Right, #,##0.0, Thin border)
 * 27: Data Int WD (White fill, #0F172A 9.5pt Regular, Center, #,##0, Thin border)
 * 28: Data Int WE (#FFFBEB Amber fill, #92400E 9.5pt Bold, Center, #,##0, Thin border)
 * 29: Data Int Right (White fill, #0F172A 9.5pt Bold, Right, #,##0, Thin border)
 * 30: Data Int Qtr (#F5F3FF Indigo fill, #312E81 9.5pt Bold, Right, #,##0, Thin border)
 * 31: Total Row Label (#E2E8F0 fill, #0F172A 9.5pt Bold, Left, Double Bottom border)
 * 32: Total Row Center (#E2E8F0 fill, #475569 9pt Bold, Center, Double Bottom border)
 * 33: Total Row Money (#E2E8F0 fill, #1D4ED8 10pt Bold, Right, ₱#,##0.00, Double Bottom border)
 * 34: Total Row Money WE (#FDE68A fill, #92400E 10pt Bold, Right, ₱#,##0.00, Double Bottom border)
 * 35: Total Row Qty (#E2E8F0 fill, #0F172A 10pt Bold, Right, #,##0, Double Bottom border)
 * 36: Total Row Pct (#E2E8F0 fill, #0F172A 9.5pt Bold, Right, 0.00%, Double Bottom border)
 * 37: Badge Green Pct (#DCFCE7 fill, #166534 9.5pt Bold, Center, 0.0%, Thin border)
 * 38: Badge Amber Pct (#FEF9C3 fill, #854D0E 9.5pt Bold, Center, 0.0%, Thin border)
 * 39: Badge Red Pct (#FEE2E2 fill, #991B1B 9.5pt Bold, Center, 0.0%, Thin border)
 * 40: Variance Money Pos (White fill, #15803D 9.5pt Bold, Right, +₱#,##0.00, Thin border)
 * 41: Variance Money Neg (White fill, #B91C1C 9.5pt Bold, Right, -₱#,##0.00, Thin border)
 * 42: Variance Qty Pos (White fill, #15803D 9.5pt Bold, Right, +#,##0, Thin border)
 * 43: Variance Qty Neg (White fill, #B91C1C 9.5pt Bold, Right, -#,##0, Thin border)
 * 44: YoY Pct Pos (White fill, #15803D 9.5pt Bold, Center, +0.00%, Thin border)
 * 45: YoY Pct Neg (White fill, #B91C1C 9.5pt Bold, Center, -0.00%, Thin border)
 * 46: Muted Ref Row Left (#F8FAFC fill, #64748B 8.5pt Italic, Left, Thin border)
 * 47: Muted Ref Money (#F8FAFC fill, #64748B 8.5pt Italic, Right, ₱#,##0.00, Thin border)
 */
const S = {
  DEFAULT: 0,
  TITLE_NAVY: 1,
  SUBTITLE_ORANGE: 2,
  META_LABEL: 3,
  META_TEXT: 4,
  META_MONEY: 5,
  META_PCT: 6,
  TH_CENTER: 7,
  TH_LEFT: 8,
  TH_MONTH: 9,
  TH_WD: 10,
  TH_WE: 11,
  TH_QTR: 12,
  SECTION: 13,
  TD_LEFT: 14,
  TD_BOLD_LEFT: 15,
  TD_CENTER: 16,
  TD_MONEY_WD: 17,
  TD_MONEY_WE: 18,
  TD_MONEY_BOLD_WD: 19,
  TD_MONEY_BOLD_WE: 20,
  TD_MONEY_HIGHLIGHT: 21,
  TD_MONEY_QTR: 22,
  TD_PCT_WD: 23,
  TD_PCT_WE: 24,
  TD_QTY_WD: 25,
  TD_QTY_WE: 26,
  TD_INT_WD: 27,
  TD_INT_WE: 28,
  TD_INT_RIGHT: 29,
  TD_INT_QTR: 30,
  TOT_LEFT: 31,
  TOT_CENTER: 32,
  TOT_MONEY: 33,
  TOT_MONEY_WE: 34,
  TOT_QTY: 35,
  TOT_PCT: 36,
  ACHV_GREEN: 37,
  ACHV_AMBER: 38,
  ACHV_RED: 39,
  VAR_MONEY_POS: 40,
  VAR_MONEY_NEG: 41,
  VAR_QTY_POS: 42,
  VAR_QTY_NEG: 43,
  YOY_PCT_POS: 44,
  YOY_PCT_NEG: 45,
  REF_LEFT: 46,
  REF_MONEY: 47,
} as const;

function buildCustomStylesXml(): string {
  const numFmts = [
    '<numFmt numFmtId="164" formatCode="&quot;₱&quot;#,##0.00;&quot;₱&quot;-#,##0.00;&quot;₱&quot;0.00"/>',
    '<numFmt numFmtId="165" formatCode="+&quot;₱&quot;#,##0.00;-&quot;₱&quot;#,##0.00;&quot;₱&quot;0.00"/>',
    '<numFmt numFmtId="166" formatCode="#,##0.0"/>',
    '<numFmt numFmtId="167" formatCode="#,##0"/>',
    '<numFmt numFmtId="168" formatCode="0.00%"/>',
    '<numFmt numFmtId="169" formatCode="0.0%"/>',
    '<numFmt numFmtId="170" formatCode="+0.00%;-0.00%;0.00%"/>',
    '<numFmt numFmtId="171" formatCode="+#,##0;-#,##0;0"/>',
  ];

  // Fonts:
  // 0: 10pt Regular #1E293B
  // 1: 13pt Bold White #FFFFFF
  // 2: 10pt Bold White #FFFFFF
  // 3: 9.5pt Bold #0F172A
  // 4: 9.5pt Bold #475569
  // 5: 10pt Bold #1D4ED8 (Royal Blue)
  // 6: 9.5pt Bold #1E3A8A (Dark Blue)
  // 7: 9.5pt Bold #92400E (Dark Amber)
  // 8: 9.5pt Bold #312E81 (Dark Indigo)
  // 9: 9.5pt Regular #1E293B
  // 10: 9pt Regular #475569
  // 11: 9.5pt Bold #166534 (Dark Green)
  // 12: 9.5pt Bold #854D0E (Amber Badge Text)
  // 13: 9.5pt Bold #991B1B (Dark Red)
  // 14: 8.5pt Italic #64748B (Muted Reference)
  const fonts = [
    '<font><sz val="10"/><color rgb="FF1E293B"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FF0F172A"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FF475569"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FF1E3A8A"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FF92400E"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FF312E81"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><sz val="9.5"/><color rgb="FF1E293B"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><sz val="9"/><color rgb="FF475569"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FF166534"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FF854D0E"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><b/><sz val="9.5"/><color rgb="FF991B1B"/><name val="Segoe UI"/><family val="2"/></font>',
    '<font><i/><sz val="8.5"/><color rgb="FF64748B"/><name val="Segoe UI"/><family val="2"/></font>',
  ];

  // Fills:
  // 0: none
  // 1: gray125
  // 2: Navy #1E293B
  // 3: Brand Orange #EA580C
  // 4: Slate Meta #F1F5F9
  // 5: White #FFFFFF
  // 6: Soft Blue #EFF6FF
  // 7: Month Header Blue #1D4ED8
  // 8: Weekday Header #DBEAFE
  // 9: Weekend Header #FEF3C7
  // 10: Quarter Header #E0E7FF
  // 11: Section Banner #E2E8F0
  // 12: Weekend Data #FFFBEB
  // 13: Quarter Data #F5F3FF
  // 14: Total WE #FDE68A
  // 15: Badge Green #DCFCE7
  // 16: Badge Amber #FEF9C3
  // 17: Badge Red #FEE2E2
  // 18: Soft Gray #F8FAFC
  const solidFill = (hex: string) =>
    `<fill><patternFill patternType="solid"><fgColor rgb="FF${hex}"/><bgColor indexed="64"/></patternFill></fill>`;

  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    solidFill('1E293B'), // 2
    solidFill('EA580C'), // 3
    solidFill('F1F5F9'), // 4
    solidFill('FFFFFF'), // 5
    solidFill('EFF6FF'), // 6
    solidFill('1D4ED8'), // 7
    solidFill('DBEAFE'), // 8
    solidFill('FEF3C7'), // 9
    solidFill('E0E7FF'), // 10
    solidFill('E2E8F0'), // 11
    solidFill('FFFBEB'), // 12
    solidFill('F5F3FF'), // 13
    solidFill('FDE68A'), // 14
    solidFill('DCFCE7'), // 15
    solidFill('FEF9C3'), // 16
    solidFill('FEE2E2'), // 17
    solidFill('F8FAFC'), // 18
  ];

  // Borders:
  // 0: none
  // 1: Thin gray #CBD5E1 all around
  // 2: Section border (Medium Top/Bottom #94A3B8, Thin Left/Right #CBD5E1)
  // 3: Total Row border (Thin Top #64748B, Double Bottom #1E293B, Thin Left/Right #CBD5E1)
  const borders = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>',
    '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="medium"><color rgb="FF94A3B8"/></top><bottom style="medium"><color rgb="FF94A3B8"/></bottom><diagonal/></border>',
    '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FF64748B"/></top><bottom style="double"><color rgb="FF1E293B"/></bottom><diagonal/></border>',
  ];

  const xf = (
    numFmtId: number,
    fontId: number,
    fillId: number,
    borderId: number,
    hAlign: 'left' | 'center' | 'right',
    wrap = false
  ) =>
    `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${hAlign}" vertical="center"${
      wrap ? ' wrapText="1"' : ''
    }/></xf>`;

  const cellXfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', // 0: Default
    xf(0, 1, 2, 0, 'left'),            // 1: TITLE_NAVY
    xf(0, 2, 3, 0, 'left'),            // 2: SUBTITLE_ORANGE
    xf(0, 4, 4, 1, 'left'),            // 3: META_LABEL
    xf(0, 3, 5, 1, 'left'),            // 4: META_TEXT
    xf(164, 6, 6, 1, 'right'),         // 5: META_MONEY
    xf(168, 6, 6, 1, 'right'),         // 6: META_PCT
    xf(0, 2, 2, 1, 'center', true),    // 7: TH_CENTER
    xf(0, 2, 2, 1, 'left', true),      // 8: TH_LEFT
    xf(0, 2, 7, 1, 'center', true),    // 9: TH_MONTH
    xf(0, 6, 8, 1, 'center', true),    // 10: TH_WD
    xf(0, 7, 9, 1, 'center', true),    // 11: TH_WE
    xf(0, 8, 10, 1, 'center', true),   // 12: TH_QTR
    xf(0, 3, 11, 2, 'left'),           // 13: SECTION
    xf(0, 9, 5, 1, 'left'),            // 14: TD_LEFT
    xf(0, 3, 5, 1, 'left'),            // 15: TD_BOLD_LEFT
    xf(0, 10, 5, 1, 'center'),         // 16: TD_CENTER
    xf(164, 9, 5, 1, 'right'),         // 17: TD_MONEY_WD
    xf(164, 9, 12, 1, 'right'),        // 18: TD_MONEY_WE
    xf(164, 3, 5, 1, 'right'),         // 19: TD_MONEY_BOLD_WD
    xf(164, 7, 12, 1, 'right'),        // 20: TD_MONEY_BOLD_WE
    xf(164, 5, 6, 1, 'right'),         // 21: TD_MONEY_HIGHLIGHT
    xf(164, 8, 13, 1, 'right'),        // 22: TD_MONEY_QTR
    xf(168, 9, 5, 1, 'right'),         // 23: TD_PCT_WD
    xf(168, 7, 12, 1, 'right'),        // 24: TD_PCT_WE
    xf(166, 3, 5, 1, 'right'),         // 25: TD_QTY_WD
    xf(166, 7, 12, 1, 'right'),        // 26: TD_QTY_WE
    xf(167, 9, 5, 1, 'center'),        // 27: TD_INT_WD
    xf(167, 7, 12, 1, 'center'),       // 28: TD_INT_WE
    xf(167, 3, 5, 1, 'right'),         // 29: TD_INT_RIGHT
    xf(167, 8, 13, 1, 'right'),        // 30: TD_INT_QTR
    xf(0, 3, 11, 3, 'left'),           // 31: TOT_LEFT
    xf(0, 4, 11, 3, 'center'),         // 32: TOT_CENTER
    xf(164, 5, 11, 3, 'right'),        // 33: TOT_MONEY
    xf(164, 7, 14, 3, 'right'),        // 34: TOT_MONEY_WE
    xf(167, 3, 11, 3, 'right'),        // 35: TOT_QTY
    xf(168, 3, 11, 3, 'right'),        // 36: TOT_PCT
    xf(169, 11, 15, 1, 'center'),      // 37: ACHV_GREEN
    xf(169, 12, 16, 1, 'center'),      // 38: ACHV_AMBER
    xf(169, 13, 17, 1, 'center'),      // 39: ACHV_RED
    xf(165, 11, 5, 1, 'right'),        // 40: VAR_MONEY_POS
    xf(165, 13, 5, 1, 'right'),        // 41: VAR_MONEY_NEG
    xf(171, 11, 5, 1, 'right'),        // 42: VAR_QTY_POS
    xf(171, 13, 5, 1, 'right'),        // 43: VAR_QTY_NEG
    xf(170, 11, 5, 1, 'center'),       // 44: YOY_PCT_POS
    xf(170, 13, 5, 1, 'center'),       // 45: YOY_PCT_NEG
    xf(0, 14, 18, 1, 'left'),          // 46: REF_LEFT
    xf(164, 14, 18, 1, 'right'),       // 47: REF_MONEY
  ];

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>` +
    `<fonts count="${fonts.length}">${fonts.join('')}</fonts>` +
    `<fills count="${fills.length}">${fills.join('')}</fills>` +
    `<borders count="${borders.length}">${borders.join('')}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="0"/>' +
    '<tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/>' +
    '</styleSheet>'
  );
}

interface SheetStylePlan {
  /** Map from cell ref (e.g. "A1") to style index in S */
  cellStyles: Map<string, number>;
  /** Map from 1-based Excel row number to height in pt */
  rowHeights: Map<number, number>;
}

function setCellStyle(plan: SheetStylePlan, r0: number, c0: number, styleIdx: number): void {
  const ref = XLSX.utils.encode_cell({ r: r0, c: c0 });
  plan.cellStyles.set(ref, styleIdx);
}

function setRowCellsStyle(
  plan: SheetStylePlan,
  r0: number,
  cStart: number,
  cEnd: number,
  styleIdx: number
): void {
  for (let c = cStart; c <= cEnd; c++) {
    setCellStyle(plan, r0, c, styleIdx);
  }
}

function applyStylesAndDownloadWorkbook(
  wb: XLSX.WorkBook,
  sheetPlans: SheetStylePlan[],
  fileName: string
): void {
  const rawBytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const cfb = XLSX.CFB.read(rawBytes, { type: 'array' });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // 1. Replace /xl/styles.xml
  const stylesEntry = XLSX.CFB.find(cfb, '/xl/styles.xml');
  if (stylesEntry) {
    const encodedStyles = encoder.encode(buildCustomStylesXml());
    stylesEntry.content = encodedStyles;
    stylesEntry.size = encodedStyles.length;
  }

  // 2. Inject s="<styleIdx>" and row heights into each worksheet XML
  for (let i = 0; i < sheetPlans.length; i++) {
    const plan = sheetPlans[i];
    const sheetEntry = XLSX.CFB.find(cfb, `/xl/worksheets/sheet${i + 1}.xml`);
    if (!sheetEntry || !plan) continue;

    let xml = decoder.decode(new Uint8Array(sheetEntry.content as ArrayLike<number>));

    // Apply custom row heights on <row r="N"...>
    if (plan.rowHeights.size > 0) {
      xml = xml.replace(/<row r="(\d+)"([^>]*)>/g, (match, rStr, rest) => {
        const ht = plan.rowHeights.get(Number(rStr));
        if (!ht) return match;
        return `<row r="${rStr}"${rest} ht="${ht}" customHeight="1">`;
      });
    }

    // Apply cell style attribute s="N" on <c r="A1"...>
    if (plan.cellStyles.size > 0) {
      xml = xml.replace(/<c r="([A-Z]+\d+)"([^/>]*?)(\/?>)/g, (match, ref, attrs, close) => {
        const sIdx = plan.cellStyles.get(ref);
        if (sIdx === undefined) return match;
        const cleanedAttrs = String(attrs).replace(/\s+s="\d+"/g, '');
        return `<c r="${ref}"${cleanedAttrs} s="${sIdx}"${close}`;
      });
    }

    const encodedSheet = encoder.encode(xml);
    sheetEntry.content = encodedSheet;
    sheetEntry.size = encodedSheet.length;
  }

  const finalZipBytes = XLSX.CFB.write(cfb, { type: 'array', fileType: 'zip' }) as ArrayLike<number>;
  const blob = new Blob([new Uint8Array(finalZipBytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function padRow(cells: Array<string | number>, totalCols: number): Array<string | number> {
  const out = [...cells];
  while (out.length < totalCols) {
    out.push('');
  }
  return out;
}

/**
 * Exports the Store Quarterly Sales Target Worksheet to a richly styled Excel (.xlsx)
 * matching the A01_Target_per_category template layout with fill colors, borders, and KPIs.
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

  const totalCols = 9; // Col 0: Particulars, Col 1: Price/UOM, Cols 2-3: M1, Cols 4-5: M2, Cols 6-7: M3, Col 8: Quarter Total
  const rows: Array<Array<string | number>> = [];
  const merges: XLSX.Range[] = [];
  const plan: SheetStylePlan = {
    cellStyles: new Map(),
    rowHeights: new Map(),
  };

  // Quarter Aggregates
  const qtrTargetSales = computedMonths.reduce((s, m) => s + m.raw.targetNetSales, 0);
  const qtrLastYearSales = computedMonths.reduce((s, m) => s + m.raw.lastYearNetSales, 0);
  const qtrTotalDays = computedMonths.reduce((s, m) => s + m.raw.totalOperatingDays, 0);
  const qtrWdDays = computedMonths.reduce((s, m) => s + m.raw.weekdayDays, 0);
  const qtrWeDays = computedMonths.reduce((s, m) => s + m.raw.weekendHdDays, 0);
  const qtrAds = qtrTotalDays > 0 ? qtrTargetSales / qtrTotalDays : 0;
  const qtrCustomers = computedMonths.reduce((s, m) => s + m.calc.monthlyCustomerCount, 0);
  const qtrVsLyPct =
    qtrLastYearSales > 0 ? (qtrTargetSales - qtrLastYearSales) / qtrLastYearSales : 0;

  // Row 0: Main Title Banner
  rows.push(
    padRow(
      [
        `J.CO DONUTS & COFFEE — QUARTERLY SALES TARGET & CATEGORY WORKSHEET (Q${target.targetQuarter} ${target.targetYear})`,
      ],
      totalCols
    )
  );
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
  setRowCellsStyle(plan, 0, 0, totalCols - 1, S.TITLE_NAVY);
  plan.rowHeights.set(1, 28);

  // Row 1: Brand Subtitle Banner
  rows.push(
    padRow(
      [
        `Store: ${target.locationName} (${target.orgLocationRef || 'Store'})   |   Formula Basis: ${
          target.suggestionBasis
        }   |   YoY Target Growth: ${(target.yoyGrowthTargetPct * 100).toFixed(
          1
        )}%   |   Default Avg Check: ₱${target.avgPerCheckDefault.toFixed(
          2
        )}   |   Generated: ${new Date().toLocaleString('en-PH')}`,
      ],
      totalCols
    )
  );
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });
  setRowCellsStyle(plan, 1, 0, totalCols - 1, S.SUBTITLE_ORANGE);
  plan.rowHeights.set(2, 22);

  // Row 2: Blank spacer
  rows.push(padRow([], totalCols));
  plan.rowHeights.set(3, 10);

  // Row 3: Quarter Executive KPI Strip Header
  rows.push(
    padRow(
      [
        'QUARTER EXECUTIVE SUMMARY',
        'QTR TOTAL TARGET (₱)',
        qtrTargetSales,
        'QTR AVERAGE DAILY SALES (ADS)',
        qtrAds,
        'SAME QTR LAST YEAR (₱)',
        qtrLastYearSales,
        'VS. LAST YEAR %',
        qtrVsLyPct,
      ],
      totalCols
    )
  );
  setCellStyle(plan, 3, 0, S.META_LABEL);
  setCellStyle(plan, 3, 1, S.META_LABEL);
  setCellStyle(plan, 3, 2, S.META_MONEY);
  setCellStyle(plan, 3, 3, S.META_LABEL);
  setCellStyle(plan, 3, 4, S.META_MONEY);
  setCellStyle(plan, 3, 5, S.META_LABEL);
  setCellStyle(plan, 3, 6, S.META_MONEY);
  setCellStyle(plan, 3, 7, S.META_LABEL);
  setCellStyle(plan, 3, 8, qtrVsLyPct >= 0 ? S.YOY_PCT_POS : S.YOY_PCT_NEG);
  plan.rowHeights.set(4, 22);

  // Row 4: Blank spacer
  rows.push(padRow([], totalCols));
  plan.rowHeights.set(5, 10);

  // Row 5 & Row 6: 2-Tier Table Header
  const rHdr1 = rows.length;
  rows.push([
    'PARTICULARS',
    'PRICE / UOM',
    m0 ? `${m0.raw.monthName.toUpperCase()} ${target.targetYear}` : 'MONTH 1',
    '',
    m1 ? `${m1.raw.monthName.toUpperCase()} ${target.targetYear}` : 'MONTH 2',
    '',
    m2 ? `${m2.raw.monthName.toUpperCase()} ${target.targetYear}` : 'MONTH 3',
    '',
    `Q${target.targetQuarter} ${target.targetYear} TOTAL / AVG`,
  ]);
  const rHdr2 = rows.length;
  rows.push([
    '',
    '',
    'WEEKDAYS (WD)',
    'WEEKENDS / HD',
    'WEEKDAYS (WD)',
    'WEEKENDS / HD',
    'WEEKDAYS (WD)',
    'WEEKENDS / HD',
    'QUARTER SUMMARY',
  ]);

  merges.push(
    { s: { r: rHdr1, c: 0 }, e: { r: rHdr2, c: 0 } },
    { s: { r: rHdr1, c: 1 }, e: { r: rHdr2, c: 1 } },
    { s: { r: rHdr1, c: 2 }, e: { r: rHdr1, c: 3 } },
    { s: { r: rHdr1, c: 4 }, e: { r: rHdr1, c: 5 } },
    { s: { r: rHdr1, c: 6 }, e: { r: rHdr1, c: 7 } }
  );
  setCellStyle(plan, rHdr1, 0, S.TH_LEFT);
  setCellStyle(plan, rHdr2, 0, S.TH_LEFT);
  setCellStyle(plan, rHdr1, 1, S.TH_CENTER);
  setCellStyle(plan, rHdr2, 1, S.TH_CENTER);
  setRowCellsStyle(plan, rHdr1, 2, 7, S.TH_MONTH);
  setCellStyle(plan, rHdr1, 8, S.TH_CENTER);

  setCellStyle(plan, rHdr2, 2, S.TH_WD);
  setCellStyle(plan, rHdr2, 3, S.TH_WE);
  setCellStyle(plan, rHdr2, 4, S.TH_WD);
  setCellStyle(plan, rHdr2, 5, S.TH_WE);
  setCellStyle(plan, rHdr2, 6, S.TH_WD);
  setCellStyle(plan, rHdr2, 7, S.TH_WE);
  setCellStyle(plan, rHdr2, 8, S.TH_QTR);
  plan.rowHeights.set(rHdr1 + 1, 22);
  plan.rowHeights.set(rHdr2 + 1, 20);

  // Helper to style standard WD/WE row
  const pushMetricRow = (
    label: string,
    uom: string,
    vals: [
      string | number,
      string | number,
      string | number,
      string | number,
      string | number,
      string | number,
      string | number
    ],
    wdStyle: number,
    weStyle: number,
    qtrStyle: number,
    boldLabel = false,
    height = 20
  ) => {
    const rIdx = rows.length;
    rows.push([label, uom, ...vals]);
    setCellStyle(plan, rIdx, 0, boldLabel ? S.TD_BOLD_LEFT : S.TD_LEFT);
    setCellStyle(plan, rIdx, 1, S.TD_CENTER);
    setCellStyle(plan, rIdx, 2, wdStyle);
    setCellStyle(plan, rIdx, 3, weStyle);
    setCellStyle(plan, rIdx, 4, wdStyle);
    setCellStyle(plan, rIdx, 5, weStyle);
    setCellStyle(plan, rIdx, 6, wdStyle);
    setCellStyle(plan, rIdx, 7, weStyle);
    setCellStyle(plan, rIdx, 8, qtrStyle);
    plan.rowHeights.set(rIdx + 1, height);
  };

  const pushSectionRow = (title: string) => {
    const rIdx = rows.length;
    rows.push(padRow([title], totalCols));
    merges.push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: totalCols - 1 } });
    setRowCellsStyle(plan, rIdx, 0, totalCols - 1, S.SECTION);
    plan.rowHeights.set(rIdx + 1, 22);
  };

  // ROW: MONTHLY TARGET NET SALES (PHP) — Merged across WD+WE per month
  {
    const rIdx = rows.length;
    rows.push([
      'MONTHLY TARGET NET SALES (₱)',
      'PHP',
      m0?.raw.targetNetSales ?? 0,
      '',
      m1?.raw.targetNetSales ?? 0,
      '',
      m2?.raw.targetNetSales ?? 0,
      '',
      qtrTargetSales,
    ]);
    merges.push(
      { s: { r: rIdx, c: 2 }, e: { r: rIdx, c: 3 } },
      { s: { r: rIdx, c: 4 }, e: { r: rIdx, c: 5 } },
      { s: { r: rIdx, c: 6 }, e: { r: rIdx, c: 7 } }
    );
    setCellStyle(plan, rIdx, 0, S.TD_BOLD_LEFT);
    setCellStyle(plan, rIdx, 1, S.TD_CENTER);
    setRowCellsStyle(plan, rIdx, 2, 7, S.TD_MONEY_HIGHLIGHT);
    setCellStyle(plan, rIdx, 8, S.TD_MONEY_QTR);
    plan.rowHeights.set(rIdx + 1, 23);
  }

  // ROW: HISTORICAL REFERENCE (LAST YEAR NET SALES vs BASIS ADS)
  {
    const rIdx = rows.length;
    rows.push([
      'Historical Reference (LY Sales | Basis ADS)',
      'Ref (₱)',
      m0?.raw.lastYearNetSales ?? 0,
      m0?.raw.basisMonthAds ?? 0,
      m1?.raw.lastYearNetSales ?? 0,
      m1?.raw.basisMonthAds ?? 0,
      m2?.raw.lastYearNetSales ?? 0,
      m2?.raw.basisMonthAds ?? 0,
      qtrLastYearSales,
    ]);
    setCellStyle(plan, rIdx, 0, S.REF_LEFT);
    setCellStyle(plan, rIdx, 1, S.TD_CENTER);
    setRowCellsStyle(plan, rIdx, 2, 8, S.REF_MONEY);
    plan.rowHeights.set(rIdx + 1, 19);
  }

  // ROW: MONTHLY ADS
  {
    const rIdx = rows.length;
    rows.push([
      'MONTHLY ADS (Target ÷ Total Operating Days)',
      'PHP / Day',
      m0?.calc.monthlyAds ?? 0,
      `${m0?.raw.totalOperatingDays ?? 0} days`,
      m1?.calc.monthlyAds ?? 0,
      `${m1?.raw.totalOperatingDays ?? 0} days`,
      m2?.calc.monthlyAds ?? 0,
      `${m2?.raw.totalOperatingDays ?? 0} days`,
      qtrAds,
    ]);
    setCellStyle(plan, rIdx, 0, S.TD_BOLD_LEFT);
    setCellStyle(plan, rIdx, 1, S.TD_CENTER);
    setCellStyle(plan, rIdx, 2, S.TD_MONEY_BOLD_WD);
    setCellStyle(plan, rIdx, 3, S.TD_CENTER);
    setCellStyle(plan, rIdx, 4, S.TD_MONEY_BOLD_WD);
    setCellStyle(plan, rIdx, 5, S.TD_CENTER);
    setCellStyle(plan, rIdx, 6, S.TD_MONEY_BOLD_WD);
    setCellStyle(plan, rIdx, 7, S.TD_CENTER);
    setCellStyle(plan, rIdx, 8, S.TD_MONEY_QTR);
    plan.rowHeights.set(rIdx + 1, 20);
  }

  // ROW: NUMBER OF OPERATING DAYS
  pushMetricRow(
    'NUMBER OF OPERATING DAYS (WD vs. WE/HD)',
    'Days',
    [
      m0?.raw.weekdayDays ?? 0,
      m0?.raw.weekendHdDays ?? 0,
      m1?.raw.weekdayDays ?? 0,
      m1?.raw.weekendHdDays ?? 0,
      m2?.raw.weekdayDays ?? 0,
      m2?.raw.weekendHdDays ?? 0,
      `${qtrWdDays} WD / ${qtrWeDays} WE (${qtrTotalDays}d)`,
    ],
    S.TD_INT_WD,
    S.TD_INT_WE,
    S.TD_CENTER,
    true
  );

  // ROW: % SHARE OF MONTHLY SALES
  pushMetricRow(
    '% SHARE OF MONTHLY SALES (WD % vs. WE/HD %)',
    '% Split',
    [
      m0?.raw.weekdaySalesPct ?? 0.5,
      m0?.raw.weekendHdSalesPct ?? 0.5,
      m1?.raw.weekdaySalesPct ?? 0.5,
      m1?.raw.weekendHdSalesPct ?? 0.5,
      m2?.raw.weekdaySalesPct ?? 0.5,
      m2?.raw.weekendHdSalesPct ?? 0.5,
      1.0,
    ],
    S.TD_PCT_WD,
    S.TD_PCT_WE,
    S.TOT_PCT,
    true
  );

  // ROW: DAILY TARGET SALES (PHP)
  pushMetricRow(
    'DAILY TARGET SALES (₱ / Day)',
    'PHP / Day',
    [
      m0?.calc.dailyTargetSalesWeekday ?? 0,
      m0?.calc.dailyTargetSalesWeekendHd ?? 0,
      m1?.calc.dailyTargetSalesWeekday ?? 0,
      m1?.calc.dailyTargetSalesWeekendHd ?? 0,
      m2?.calc.dailyTargetSalesWeekday ?? 0,
      m2?.calc.dailyTargetSalesWeekendHd ?? 0,
      qtrAds,
    ],
    S.TD_MONEY_BOLD_WD,
    S.TD_MONEY_BOLD_WE,
    S.TD_MONEY_QTR,
    true
  );

  // ROW: AVERAGE PER CHECK
  pushMetricRow(
    'AVERAGE PER CHECK (Default ₱470.00)',
    'PHP / Check',
    [
      m0?.raw.avgPerCheckWeekday ?? 470,
      m0?.raw.avgPerCheckWeekendHd ?? 470,
      m1?.raw.avgPerCheckWeekday ?? 470,
      m1?.raw.avgPerCheckWeekendHd ?? 470,
      m2?.raw.avgPerCheckWeekday ?? 470,
      m2?.raw.avgPerCheckWeekendHd ?? 470,
      target.avgPerCheckDefault,
    ],
    S.TD_MONEY_WD,
    S.TD_MONEY_WE,
    S.TD_MONEY_QTR,
    false
  );

  // ROW: DAILY CUSTOMER COUNT
  pushMetricRow(
    'DAILY CUSTOMER COUNT (Daily Target ÷ Avg Check)',
    'Checks / Day',
    [
      m0?.calc.dailyCustomerCountWeekday ?? 0,
      m0?.calc.dailyCustomerCountWeekendHd ?? 0,
      m1?.calc.dailyCustomerCountWeekday ?? 0,
      m1?.calc.dailyCustomerCountWeekendHd ?? 0,
      m2?.calc.dailyCustomerCountWeekday ?? 0,
      m2?.calc.dailyCustomerCountWeekendHd ?? 0,
      Math.round(qtrCustomers),
    ],
    S.TD_QTY_WD,
    S.TD_QTY_WE,
    S.TD_INT_QTR,
    true
  );

  // SECTION 2: PER CATEGORY % MIX
  pushSectionRow('PER CATEGORY % MIX — Share of Daily Sales & Unit Price Divisor (₱)');

  const categoryList = m0?.calc.categories ?? [];
  for (let i = 0; i < categoryList.length; i++) {
    const c0 = m0?.calc.categories[i];
    const c1 = m1?.calc.categories[i];
    const c2 = m2?.calc.categories[i];
    if (!c0) continue;

    const rIdx = rows.length;
    rows.push([
      `${c0.categoryName} (${c0.qtyUom})`,
      c0.unitPriceDivisor,
      c0.weekdayMixPct,
      c0.weekendHdMixPct,
      c1?.weekdayMixPct ?? 0,
      c1?.weekendHdMixPct ?? 0,
      c2?.weekdayMixPct ?? 0,
      c2?.weekendHdMixPct ?? 0,
      c0.weekdayMixPct,
    ]);
    setCellStyle(plan, rIdx, 0, S.TD_LEFT);
    setCellStyle(plan, rIdx, 1, S.TD_MONEY_WD);
    setCellStyle(plan, rIdx, 2, S.TD_PCT_WD);
    setCellStyle(plan, rIdx, 3, S.TD_PCT_WE);
    setCellStyle(plan, rIdx, 4, S.TD_PCT_WD);
    setCellStyle(plan, rIdx, 5, S.TD_PCT_WE);
    setCellStyle(plan, rIdx, 6, S.TD_PCT_WD);
    setCellStyle(plan, rIdx, 7, S.TD_PCT_WE);
    setCellStyle(plan, rIdx, 8, S.TD_PCT_WD);
    plan.rowHeights.set(rIdx + 1, 19);
  }

  // TOTAL CATEGORY % MIX CHECK ROW
  {
    const rIdx = rows.length;
    rows.push([
      'TOTAL CATEGORY MIX % CHECK (Must Equal 100%)',
      'Check',
      m0?.calc.totalWeekdayMixPct ?? 0,
      m0?.calc.totalWeekendHdMixPct ?? 0,
      m1?.calc.totalWeekdayMixPct ?? 0,
      m1?.calc.totalWeekendHdMixPct ?? 0,
      m2?.calc.totalWeekdayMixPct ?? 0,
      m2?.calc.totalWeekendHdMixPct ?? 0,
      m0?.calc.totalWeekdayMixPct ?? 0,
    ]);
    setCellStyle(plan, rIdx, 0, S.TOT_LEFT);
    setCellStyle(plan, rIdx, 1, S.TOT_CENTER);
    setRowCellsStyle(plan, rIdx, 2, 8, S.TOT_PCT);
    plan.rowHeights.set(rIdx + 1, 21);
  }

  // SECTION 3: DAILY TARGET SALES PER CATEGORY (PHP)
  pushSectionRow('DAILY TARGET SALES PER CATEGORY (₱) — Daily Target Sales × Category Mix %');

  for (let i = 0; i < categoryList.length; i++) {
    const c0 = m0?.calc.categories[i];
    const c1 = m1?.calc.categories[i];
    const c2 = m2?.calc.categories[i];
    if (!c0) continue;

    const qtrCatSales =
      (c0.monthlySales ?? 0) + (c1?.monthlySales ?? 0) + (c2?.monthlySales ?? 0);

    const rIdx = rows.length;
    rows.push([
      c0.categoryName,
      c0.unitPriceDivisor,
      c0.dailySalesWeekday,
      c0.dailySalesWeekendHd,
      c1?.dailySalesWeekday ?? 0,
      c1?.dailySalesWeekendHd ?? 0,
      c2?.dailySalesWeekday ?? 0,
      c2?.dailySalesWeekendHd ?? 0,
      qtrCatSales,
    ]);
    setCellStyle(plan, rIdx, 0, S.TD_LEFT);
    setCellStyle(plan, rIdx, 1, S.TD_MONEY_WD);
    setCellStyle(plan, rIdx, 2, S.TD_MONEY_WD);
    setCellStyle(plan, rIdx, 3, S.TD_MONEY_WE);
    setCellStyle(plan, rIdx, 4, S.TD_MONEY_WD);
    setCellStyle(plan, rIdx, 5, S.TD_MONEY_WE);
    setCellStyle(plan, rIdx, 6, S.TD_MONEY_WD);
    setCellStyle(plan, rIdx, 7, S.TD_MONEY_WE);
    setCellStyle(plan, rIdx, 8, S.TD_MONEY_QTR);
    plan.rowHeights.set(rIdx + 1, 19);
  }

  // TOTAL DAILY CATEGORY SALES CHECK ROW
  {
    const rIdx = rows.length;
    const qtrTotalCatSales =
      (m0?.calc.totalMonthlyCategorySales ?? 0) +
      (m1?.calc.totalMonthlyCategorySales ?? 0) +
      (m2?.calc.totalMonthlyCategorySales ?? 0);

    rows.push([
      'TOTAL DAILY CATEGORY SALES CHECK (₱)',
      'Check',
      m0?.calc.totalDailyCategorySalesWeekday ?? 0,
      m0?.calc.totalDailyCategorySalesWeekendHd ?? 0,
      m1?.calc.totalDailyCategorySalesWeekday ?? 0,
      m1?.calc.totalDailyCategorySalesWeekendHd ?? 0,
      m2?.calc.totalDailyCategorySalesWeekday ?? 0,
      m2?.calc.totalDailyCategorySalesWeekendHd ?? 0,
      qtrTotalCatSales,
    ]);
    setCellStyle(plan, rIdx, 0, S.TOT_LEFT);
    setCellStyle(plan, rIdx, 1, S.TOT_CENTER);
    setCellStyle(plan, rIdx, 2, S.TOT_MONEY);
    setCellStyle(plan, rIdx, 3, S.TOT_MONEY_WE);
    setCellStyle(plan, rIdx, 4, S.TOT_MONEY);
    setCellStyle(plan, rIdx, 5, S.TOT_MONEY_WE);
    setCellStyle(plan, rIdx, 6, S.TOT_MONEY);
    setCellStyle(plan, rIdx, 7, S.TOT_MONEY_WE);
    setCellStyle(plan, rIdx, 8, S.TOT_MONEY);
    plan.rowHeights.set(rIdx + 1, 22);
  }

  // SECTION 4: DAILY TARGET QUANTITY PER CATEGORY (PCS / BOXES)
  pushSectionRow(
    'DAILY TARGET QUANTITY PER CATEGORY (PCS / BOXES) — Daily Category Sales ÷ Unit Price Divisor'
  );

  for (let i = 0; i < categoryList.length; i++) {
    const c0 = m0?.calc.categories[i];
    const c1 = m1?.calc.categories[i];
    const c2 = m2?.calc.categories[i];
    if (!c0) continue;

    const qtrCatQty =
      (c0.monthlyQty ?? 0) + (c1?.monthlyQty ?? 0) + (c2?.monthlyQty ?? 0);

    const rIdx = rows.length;
    rows.push([
      `${c0.categoryName} (${c0.qtyUom})`,
      `${c0.qtyUom} / Day`,
      c0.dailyQtyWeekday,
      c0.dailyQtyWeekendHd,
      c1?.dailyQtyWeekday ?? 0,
      c1?.dailyQtyWeekendHd ?? 0,
      c2?.dailyQtyWeekday ?? 0,
      c2?.dailyQtyWeekendHd ?? 0,
      Math.round(qtrCatQty),
    ]);
    setCellStyle(plan, rIdx, 0, S.TD_BOLD_LEFT);
    setCellStyle(plan, rIdx, 1, S.TD_CENTER);
    setCellStyle(plan, rIdx, 2, S.TD_QTY_WD);
    setCellStyle(plan, rIdx, 3, S.TD_QTY_WE);
    setCellStyle(plan, rIdx, 4, S.TD_QTY_WD);
    setCellStyle(plan, rIdx, 5, S.TD_QTY_WE);
    setCellStyle(plan, rIdx, 6, S.TD_QTY_WD);
    setCellStyle(plan, rIdx, 7, S.TD_QTY_WE);
    setCellStyle(plan, rIdx, 8, S.TD_INT_QTR);
    plan.rowHeights.set(rIdx + 1, 19);
  }

  // SECTION 5: MONTHLY TOTAL CATEGORY TARGETS (TOTAL SALES ₱ & TOTAL QTY PCS/BOXES)
  pushSectionRow(
    'MONTHLY TOTAL CATEGORY TARGETS — Left Col: Monthly Sales (₱) | Right Col: Monthly Qty (PCS/BOXES)'
  );

  for (let i = 0; i < categoryList.length; i++) {
    const c0 = m0?.calc.categories[i];
    const c1 = m1?.calc.categories[i];
    const c2 = m2?.calc.categories[i];
    if (!c0) continue;

    const qtrSales = (c0.monthlySales ?? 0) + (c1?.monthlySales ?? 0) + (c2?.monthlySales ?? 0);
    const qtrQty = Math.round(
      (c0.monthlyQty ?? 0) + (c1?.monthlyQty ?? 0) + (c2?.monthlyQty ?? 0)
    );

    const rIdx = rows.length;
    rows.push([
      `${c0.categoryName} (Monthly Total)`,
      `Sales / ${c0.qtyUom}`,
      c0.monthlySales,
      `${Math.round(c0.monthlyQty).toLocaleString('en-PH')} ${c0.qtyUom}`,
      c1?.monthlySales ?? 0,
      `${Math.round(c1?.monthlyQty ?? 0).toLocaleString('en-PH')} ${c0.qtyUom}`,
      c2?.monthlySales ?? 0,
      `${Math.round(c2?.monthlyQty ?? 0).toLocaleString('en-PH')} ${c0.qtyUom}`,
      `₱${qtrSales.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} (${qtrQty.toLocaleString('en-PH')} ${c0.qtyUom})`,
    ]);
    setCellStyle(plan, rIdx, 0, S.TD_BOLD_LEFT);
    setCellStyle(plan, rIdx, 1, S.TD_CENTER);
    setCellStyle(plan, rIdx, 2, S.TD_MONEY_WD);
    setCellStyle(plan, rIdx, 3, S.TD_BOLD_LEFT);
    setCellStyle(plan, rIdx, 4, S.TD_MONEY_WD);
    setCellStyle(plan, rIdx, 5, S.TD_BOLD_LEFT);
    setCellStyle(plan, rIdx, 6, S.TD_MONEY_WD);
    setCellStyle(plan, rIdx, 7, S.TD_BOLD_LEFT);
    setCellStyle(plan, rIdx, 8, S.TD_BOLD_LEFT);
    plan.rowHeights.set(rIdx + 1, 20);
  }

  // Monthly Total Category Sales Check Footer Row
  {
    const rIdx = rows.length;
    const qtrTotalCatSales =
      (m0?.calc.totalMonthlyCategorySales ?? 0) +
      (m1?.calc.totalMonthlyCategorySales ?? 0) +
      (m2?.calc.totalMonthlyCategorySales ?? 0);

    rows.push([
      'TOTAL MONTHLY CATEGORY SALES (₱)',
      'PHP',
      m0?.calc.totalMonthlyCategorySales ?? 0,
      '',
      m1?.calc.totalMonthlyCategorySales ?? 0,
      '',
      m2?.calc.totalMonthlyCategorySales ?? 0,
      '',
      qtrTotalCatSales,
    ]);
    setCellStyle(plan, rIdx, 0, S.TOT_LEFT);
    setCellStyle(plan, rIdx, 1, S.TOT_CENTER);
    setCellStyle(plan, rIdx, 2, S.TOT_MONEY);
    setCellStyle(plan, rIdx, 3, S.TOT_CENTER);
    setCellStyle(plan, rIdx, 4, S.TOT_MONEY);
    setCellStyle(plan, rIdx, 5, S.TOT_CENTER);
    setCellStyle(plan, rIdx, 6, S.TOT_MONEY);
    setCellStyle(plan, rIdx, 7, S.TOT_CENTER);
    setCellStyle(plan, rIdx, 8, S.TOT_MONEY);
    plan.rowHeights.set(rIdx + 1, 22);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows, { sheetStubs: true });
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 42 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 30 },
  ];

  const sheetName = `${target.orgLocationRef || target.locationName}_Q${target.targetQuarter}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const safeLoc = target.locationName.replace(/[^a-zA-Z0-9_-]/g, '_');
  applyStylesAndDownloadWorkbook(
    wb,
    [plan],
    `Sales_Target_${safeLoc}_${target.targetYear}_Q${target.targetQuarter}.xlsx`
  );
}

/**
 * Exports Target vs. Actual Analytics to a richly styled 3-sheet Excel workbook (.xlsx)
 * with Executive KPI cards, color-coded Achievement % badges, Variance formatting, and Totals.
 */
export function exportAnalyticsToExcel(params: {
  targetYear: number;
  targetQuarter: number;
  locationName: string;
  monthLabel?: string;
  salesMetric?: 'net' | 'gross';
  summary: AnalyticsSummaryRow[];
  weekdayWeekend: AnalyticsWeekdayWeekendRow[];
  categories: AnalyticsCategoryRow[];
}): void {
  const wb = XLSX.utils.book_new();
  const sheetPlans: SheetStylePlan[] = [];
  const metricLabel = params.salesMetric === 'gross' ? 'Gross Sales' : 'Net Sales';
  const periodLabel = params.monthLabel
    ? `${params.monthLabel} (Q${params.targetQuarter} ${params.targetYear})`
    : `All 3 Months — Q${params.targetQuarter} ${params.targetYear}`;
  const storeScopeLabel =
    params.locationName === 'ALL' ? 'ALL STORES (Consolidated)' : params.locationName;

  // =========================================================================
  // SHEET 1: EXECUTIVE & STORE SUMMARY
  // =========================================================================
  {
    const colsCount = 16;
    const rows: Array<Array<string | number>> = [];
    const merges: XLSX.Range[] = [];
    const plan: SheetStylePlan = { cellStyles: new Map(), rowHeights: new Map() };

    let totTgtDays = 0;
    let totActDays = 0;
    let totTargetNet = 0;
    let totActualNet = 0;
    let totActualGross = 0;
    let totRemaining = 0;
    let totLyNet = 0;
    let totTgtCust = 0;
    let totActCust = 0;

    for (const r of params.summary) {
      totTgtDays += Number(r.TotalOperatingDays || 0);
      totActDays += Number(r.ActualOperatingDays || 0);
      totTargetNet += Number(r.TargetNetSales || 0);
      totActualNet += Number(r.ActualNetSales || 0);
      totActualGross += Number(r.ActualGrossSales || 0);
      totRemaining += Number(r.RemainingTargetSales || 0);
      totLyNet += Number(r.LastYearNetSales || 0);
      totTgtCust += Number(r.TargetCustomerCount || 0);
      totActCust += Number(r.ActualCustomerCount || 0);
    }

    const totPrimaryActual = params.salesMetric === 'gross' ? totActualGross : totActualNet;
    const totVar = totPrimaryActual - totTargetNet;
    const totAchvRatio = totTargetNet > 0 ? totPrimaryActual / totTargetNet : 0;
    const totYoYRatio = totLyNet > 0 ? (totActualNet - totLyNet) / totLyNet : 0;
    const totTgtAds = totTgtDays > 0 ? totTargetNet / totTgtDays : 0;
    const totActAds = totActDays > 0 ? totPrimaryActual / totActDays : 0;
    const totActAvgCheck = totActCust > 0 ? totActualNet / totActCust : 0;

    // Row 0: Title Banner
    rows.push(
      padRow(
        [
          `J.CO DONUTS & COFFEE — QUARTERLY SALES TARGET VS. ACTUAL ANALYTICS (${periodLabel})`,
        ],
        colsCount
      )
    );
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colsCount - 1 } });
    setRowCellsStyle(plan, 0, 0, colsCount - 1, S.TITLE_NAVY);
    plan.rowHeights.set(1, 28);

    // Row 1: Subtitle Banner
    rows.push(
      padRow(
        [
          `Store Scope: ${storeScopeLabel}   |   Period: ${periodLabel}   |   Sales Metric Basis: ${metricLabel}   |   Generated: ${new Date().toLocaleString(
            'en-PH'
          )}`,
        ],
        colsCount
      )
    );
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colsCount - 1 } });
    setRowCellsStyle(plan, 1, 0, colsCount - 1, S.SUBTITLE_ORANGE);
    plan.rowHeights.set(2, 22);

    // Row 2: Spacer
    rows.push(padRow([], colsCount));
    plan.rowHeights.set(3, 10);

    // Row 3: Executive KPI Strip
    rows.push(
      padRow(
        [
          'TARGET NET SALES',
          totTargetNet,
          `ACTUAL ${metricLabel.toUpperCase()}`,
          totPrimaryActual,
          'VARIANCE (₱)',
          totVar,
          'ACHIEVEMENT %',
          totAchvRatio,
          'LAST YEAR NET SALES',
          totLyNet,
          'YOY GROWTH %',
          totYoYRatio,
          'ACTUAL ADS (₱)',
          totActAds,
          'ACTUAL AVG CHECK',
          totActAvgCheck,
        ],
        colsCount
      )
    );
    for (let c = 0; c < colsCount; c += 2) {
      setCellStyle(plan, 3, c, S.META_LABEL);
    }
    setCellStyle(plan, 3, 1, S.META_MONEY);
    setCellStyle(plan, 3, 3, S.META_MONEY);
    setCellStyle(plan, 3, 5, totVar >= 0 ? S.VAR_MONEY_POS : S.VAR_MONEY_NEG);
    setCellStyle(
      plan,
      3,
      7,
      totAchvRatio >= 1 ? S.ACHV_GREEN : totAchvRatio >= 0.85 ? S.ACHV_AMBER : S.ACHV_RED
    );
    setCellStyle(plan, 3, 9, S.META_MONEY);
    setCellStyle(plan, 3, 11, totYoYRatio >= 0 ? S.YOY_PCT_POS : S.YOY_PCT_NEG);
    setCellStyle(plan, 3, 13, S.META_MONEY);
    setCellStyle(plan, 3, 15, S.META_MONEY);
    plan.rowHeights.set(4, 24);

    // Row 4: Spacer
    rows.push(padRow([], colsCount));
    plan.rowHeights.set(5, 10);

    // Row 5: Table Header
    const rHdr = rows.length;
    rows.push([
      'Store Location',
      'Code',
      'Month',
      'Days (Act / Tgt)',
      'Target Net Sales (₱)',
      'Actual Net Sales (₱)',
      'Actual Gross Sales (₱)',
      'Variance (₱)',
      'Achievement %',
      'Target ADS (₱)',
      'Actual ADS (₱)',
      'Req. Daily Run Rate (₱)',
      'Last Year Net Sales (₱)',
      'YoY Growth %',
      'Actual Avg Check (₱)',
      'Customer Checks (Act / Tgt)',
    ]);
    setCellStyle(plan, rHdr, 0, S.TH_LEFT);
    setRowCellsStyle(plan, rHdr, 1, colsCount - 1, S.TH_CENTER);
    plan.rowHeights.set(rHdr + 1, 26);

    // Data Rows
    for (const r of params.summary) {
      const rIdx = rows.length;
      const actualPrimary =
        params.salesMetric === 'gross'
          ? Number(r.ActualGrossSales || 0)
          : Number(r.ActualNetSales || 0);
      const tgtSales = Number(r.TargetNetSales || 0);
      const variance = actualPrimary - tgtSales;
      const achvRatio = tgtSales > 0 ? actualPrimary / tgtSales : 0;
      const yoyRatio = Number(r.YoYGrowthPct || 0) / 100;

      rows.push([
        r.LocationName,
        r.OrgLocationRef || '',
        r.MonthName,
        `${r.ActualOperatingDays} / ${r.TotalOperatingDays}`,
        tgtSales,
        Number(r.ActualNetSales || 0),
        Number(r.ActualGrossSales || 0),
        variance,
        achvRatio,
        Number(r.TargetADS || 0),
        Number(r.ActualADS || 0),
        Number(r.RequiredDailyRunRate || 0),
        Number(r.LastYearNetSales || 0),
        yoyRatio,
        Number(r.ActualAvgCheck || 0),
        `${Math.round(Number(r.ActualCustomerCount || 0)).toLocaleString('en-PH')} / ${Math.round(
          Number(r.TargetCustomerCount || 0)
        ).toLocaleString('en-PH')}`,
      ]);

      setCellStyle(plan, rIdx, 0, S.TD_BOLD_LEFT);
      setCellStyle(plan, rIdx, 1, S.TD_CENTER);
      setCellStyle(plan, rIdx, 2, S.TD_LEFT);
      setCellStyle(plan, rIdx, 3, S.TD_CENTER);
      setCellStyle(plan, rIdx, 4, S.TD_MONEY_BOLD_WD);
      setCellStyle(plan, rIdx, 5, S.TD_MONEY_HIGHLIGHT);
      setCellStyle(plan, rIdx, 6, S.TD_MONEY_WD);
      setCellStyle(plan, rIdx, 7, variance >= 0 ? S.VAR_MONEY_POS : S.VAR_MONEY_NEG);
      setCellStyle(
        plan,
        rIdx,
        8,
        achvRatio >= 1 ? S.ACHV_GREEN : achvRatio >= 0.85 ? S.ACHV_AMBER : S.ACHV_RED
      );
      setCellStyle(plan, rIdx, 9, S.TD_MONEY_WD);
      setCellStyle(plan, rIdx, 10, S.TD_MONEY_BOLD_WD);
      setCellStyle(plan, rIdx, 11, S.TD_MONEY_WE);
      setCellStyle(plan, rIdx, 12, S.TD_MONEY_WD);
      setCellStyle(plan, rIdx, 13, yoyRatio >= 0 ? S.YOY_PCT_POS : S.YOY_PCT_NEG);
      setCellStyle(plan, rIdx, 14, S.TD_MONEY_WD);
      setCellStyle(plan, rIdx, 15, S.TD_CENTER);
      plan.rowHeights.set(rIdx + 1, 20);
    }

    // Grand Total Row
    if (params.summary.length > 0) {
      const rTot = rows.length;
      rows.push([
        'CONSOLIDATED TOTAL / AVERAGE',
        `${params.summary.length} Row(s)`,
        periodLabel,
        `${totActDays} / ${totTgtDays}`,
        totTargetNet,
        totActualNet,
        totActualGross,
        totVar,
        totAchvRatio,
        totTgtAds,
        totActAds,
        totRemaining > 0 ? totRemaining : 0,
        totLyNet,
        totYoYRatio,
        totActAvgCheck,
        `${Math.round(totActCust).toLocaleString('en-PH')} / ${Math.round(totTgtCust).toLocaleString(
          'en-PH'
        )}`,
      ]);
      setCellStyle(plan, rTot, 0, S.TOT_LEFT);
      setCellStyle(plan, rTot, 1, S.TOT_CENTER);
      setCellStyle(plan, rTot, 2, S.TOT_CENTER);
      setCellStyle(plan, rTot, 3, S.TOT_CENTER);
      setCellStyle(plan, rTot, 4, S.TOT_MONEY);
      setCellStyle(plan, rTot, 5, S.TOT_MONEY);
      setCellStyle(plan, rTot, 6, S.TOT_MONEY);
      setCellStyle(plan, rTot, 7, totVar >= 0 ? S.VAR_MONEY_POS : S.VAR_MONEY_NEG);
      setCellStyle(
        plan,
        rTot,
        8,
        totAchvRatio >= 1 ? S.ACHV_GREEN : totAchvRatio >= 0.85 ? S.ACHV_AMBER : S.ACHV_RED
      );
      setCellStyle(plan, rTot, 9, S.TOT_MONEY);
      setCellStyle(plan, rTot, 10, S.TOT_MONEY);
      setCellStyle(plan, rTot, 11, S.TOT_MONEY_WE);
      setCellStyle(plan, rTot, 12, S.TOT_MONEY);
      setCellStyle(plan, rTot, 13, totYoYRatio >= 0 ? S.YOY_PCT_POS : S.YOY_PCT_NEG);
      setCellStyle(plan, rTot, 14, S.TOT_MONEY);
      setCellStyle(plan, rTot, 15, S.TOT_CENTER);
      plan.rowHeights.set(rTot + 1, 23);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(rows, { sheetStubs: true });
    wsSummary['!merges'] = merges;
    wsSummary['!cols'] = [
      { wch: 24 },
      { wch: 10 },
      { wch: 14 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 17 },
      { wch: 17 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & YoY');
    sheetPlans.push(plan);
  }

  // =========================================================================
  // SHEET 2: CATEGORY SALES & QUANTITY PERFORMANCE
  // =========================================================================
  {
    const colsCount = 13;
    const rows: Array<Array<string | number>> = [];
    const merges: XLSX.Range[] = [];
    const plan: SheetStylePlan = { cellStyles: new Map(), rowHeights: new Map() };

    // Row 0: Title Banner
    rows.push(
      padRow(
        [
          `J.CO DONUTS & COFFEE — CATEGORY TARGET VS. ACTUAL PERFORMANCE (SALES ₱ & QTY PCS/BOXES)`,
        ],
        colsCount
      )
    );
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colsCount - 1 } });
    setRowCellsStyle(plan, 0, 0, colsCount - 1, S.TITLE_NAVY);
    plan.rowHeights.set(1, 28);

    // Row 1: Subtitle Banner
    rows.push(
      padRow(
        [
          `Store Scope: ${storeScopeLabel}   |   Period: ${periodLabel}   |   Sales Basis: ${metricLabel}`,
        ],
        colsCount
      )
    );
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colsCount - 1 } });
    setRowCellsStyle(plan, 1, 0, colsCount - 1, S.SUBTITLE_ORANGE);
    plan.rowHeights.set(2, 22);

    rows.push(padRow([], colsCount));
    plan.rowHeights.set(3, 10);

    // Consolidated Category Rollup Table (matches top table in UI)
    const rSec1 = rows.length;
    rows.push(
      padRow(['1. CONSOLIDATED CATEGORY SUMMARY (ACROSS SELECTED PERIOD & STORE SCOPE)'], colsCount)
    );
    merges.push({ s: { r: rSec1, c: 0 }, e: { r: rSec1, c: colsCount - 1 } });
    setRowCellsStyle(plan, rSec1, 0, colsCount - 1, S.SECTION);
    plan.rowHeights.set(rSec1 + 1, 22);

    const rHdr1 = rows.length;
    rows.push([
      'Category',
      'UOM',
      'Price Divisor (₱)',
      'Target Sales (₱)',
      'Actual Net Sales (₱)',
      'Actual Gross Sales (₱)',
      'Sales Variance (₱)',
      'Sales Achv %',
      'Target Qty',
      'Actual Qty',
      'Qty Variance',
      'Qty Achv %',
      'Actual Sales Share %',
    ]);
    setCellStyle(plan, rHdr1, 0, S.TH_LEFT);
    setRowCellsStyle(plan, rHdr1, 1, colsCount - 1, S.TH_CENTER);
    plan.rowHeights.set(rHdr1 + 1, 24);

    // Aggregate by CategoryCode
    const catRollupMap = new Map<
      string,
      {
        name: string;
        uom: string;
        sortOrder: number;
        price: number;
        tgtSales: number;
        actNet: number;
        actGross: number;
        tgtQty: number;
        actQty: number;
      }
    >();

    for (const c of params.categories) {
      const curr = catRollupMap.get(c.CategoryCode);
      if (!curr) {
        catRollupMap.set(c.CategoryCode, {
          name: c.CategoryName,
          uom: c.QtyUOM,
          sortOrder: Number(c.CategorySortOrder || 1),
          price: Number(c.UnitPriceDivisor || 0),
          tgtSales: Number(c.TargetCategorySales || 0),
          actNet: Number(c.ActualCategoryNetSales || 0),
          actGross: Number(c.ActualCategoryGrossSales || 0),
          tgtQty: Number(c.TargetCategoryQty || 0),
          actQty: Number(c.ActualCategoryQty || 0),
        });
      } else {
        curr.tgtSales += Number(c.TargetCategorySales || 0);
        curr.actNet += Number(c.ActualCategoryNetSales || 0);
        curr.actGross += Number(c.ActualCategoryGrossSales || 0);
        curr.tgtQty += Number(c.TargetCategoryQty || 0);
        curr.actQty += Number(c.ActualCategoryQty || 0);
      }
    }

    const sortedRollup = Array.from(catRollupMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    const grandTgtSales = sortedRollup.reduce((s, x) => s + x.tgtSales, 0);
    const grandActNet = sortedRollup.reduce((s, x) => s + x.actNet, 0);
    const grandActGross = sortedRollup.reduce((s, x) => s + x.actGross, 0);

    for (const item of sortedRollup) {
      const rIdx = rows.length;
      const primaryAct = params.salesMetric === 'gross' ? item.actGross : item.actNet;
      const salesVar = primaryAct - item.tgtSales;
      const salesAchvRatio = item.tgtSales > 0 ? primaryAct / item.tgtSales : 0;
      const qtyVar = Math.round(item.actQty - item.tgtQty);
      const qtyAchvRatio = item.tgtQty > 0 ? item.actQty / item.tgtQty : 0;
      const shareRatio = grandActNet > 0 ? item.actNet / grandActNet : 0;

      rows.push([
        item.name,
        item.uom,
        item.price,
        item.tgtSales,
        item.actNet,
        item.actGross,
        salesVar,
        salesAchvRatio,
        Math.round(item.tgtQty),
        Math.round(item.actQty),
        qtyVar,
        qtyAchvRatio,
        shareRatio,
      ]);

      setCellStyle(plan, rIdx, 0, S.TD_BOLD_LEFT);
      setCellStyle(plan, rIdx, 1, S.TD_CENTER);
      setCellStyle(plan, rIdx, 2, S.TD_MONEY_WD);
      setCellStyle(plan, rIdx, 3, S.TD_MONEY_BOLD_WD);
      setCellStyle(plan, rIdx, 4, S.TD_MONEY_HIGHLIGHT);
      setCellStyle(plan, rIdx, 5, S.TD_MONEY_WD);
      setCellStyle(plan, rIdx, 6, salesVar >= 0 ? S.VAR_MONEY_POS : S.VAR_MONEY_NEG);
      setCellStyle(
        plan,
        rIdx,
        7,
        salesAchvRatio >= 1
          ? S.ACHV_GREEN
          : salesAchvRatio >= 0.8
            ? S.ACHV_AMBER
            : S.ACHV_RED
      );
      setCellStyle(plan, rIdx, 8, S.TD_INT_RIGHT);
      setCellStyle(plan, rIdx, 9, S.TD_INT_RIGHT);
      setCellStyle(plan, rIdx, 10, qtyVar >= 0 ? S.VAR_QTY_POS : S.VAR_QTY_NEG);
      setCellStyle(
        plan,
        rIdx,
        11,
        qtyAchvRatio >= 1 ? S.ACHV_GREEN : qtyAchvRatio >= 0.8 ? S.ACHV_AMBER : S.ACHV_RED
      );
      setCellStyle(plan, rIdx, 12, S.TD_PCT_WD);
      plan.rowHeights.set(rIdx + 1, 20);
    }

    // Rollup Total Row
    {
      const rTot = rows.length;
      const primaryGrandAct = params.salesMetric === 'gross' ? grandActGross : grandActNet;
      const grandSalesVar = primaryGrandAct - grandTgtSales;
      const grandSalesAchv = grandTgtSales > 0 ? primaryGrandAct / grandTgtSales : 0;

      rows.push([
        'TOTAL ALL CATEGORIES',
        '',
        '',
        grandTgtSales,
        grandActNet,
        grandActGross,
        grandSalesVar,
        grandSalesAchv,
        '',
        '',
        '',
        '',
        1.0,
      ]);
      setCellStyle(plan, rTot, 0, S.TOT_LEFT);
      setCellStyle(plan, rTot, 1, S.TOT_CENTER);
      setCellStyle(plan, rTot, 2, S.TOT_CENTER);
      setCellStyle(plan, rTot, 3, S.TOT_MONEY);
      setCellStyle(plan, rTot, 4, S.TOT_MONEY);
      setCellStyle(plan, rTot, 5, S.TOT_MONEY);
      setCellStyle(plan, rTot, 6, grandSalesVar >= 0 ? S.VAR_MONEY_POS : S.VAR_MONEY_NEG);
      setCellStyle(
        plan,
        rTot,
        7,
        grandSalesAchv >= 1
          ? S.ACHV_GREEN
          : grandSalesAchv >= 0.8
            ? S.ACHV_AMBER
            : S.ACHV_RED
      );
      setRowCellsStyle(plan, rTot, 8, 11, S.TOT_CENTER);
      setCellStyle(plan, rTot, 12, S.TOT_PCT);
      plan.rowHeights.set(rTot + 1, 22);
    }

    rows.push(padRow([], colsCount));
    plan.rowHeights.set(rows.length, 12);

    // Detailed Store-Month Category Breakdown Table
    const rSec2 = rows.length;
    rows.push(
      padRow(['2. DETAILED STORE & MONTHLY CATEGORY PERFORMANCE BREAKDOWN'], colsCount)
    );
    merges.push({ s: { r: rSec2, c: 0 }, e: { r: rSec2, c: colsCount - 1 } });
    setRowCellsStyle(plan, rSec2, 0, colsCount - 1, S.SECTION);
    plan.rowHeights.set(rSec2 + 1, 22);

    const rHdr2 = rows.length;
    rows.push([
      'Store Location',
      'Month',
      'Category',
      'UOM',
      'Price Divisor (₱)',
      'Target Sales (₱)',
      'Actual Net Sales (₱)',
      'Sales Variance (₱)',
      'Sales Achv %',
      'Target Qty',
      'Actual Qty',
      'Qty Variance',
      'Qty Achv %',
    ]);
    setCellStyle(plan, rHdr2, 0, S.TH_LEFT);
    setRowCellsStyle(plan, rHdr2, 1, colsCount - 1, S.TH_CENTER);
    plan.rowHeights.set(rHdr2 + 1, 24);

    for (const r of params.categories) {
      const rIdx = rows.length;
      const salesVar = Number(r.VarianceCategorySales || 0);
      const salesAchvRatio = Number(r.CategorySalesAchievementPct || 0) / 100;
      const qtyVar = Math.round(Number(r.VarianceCategoryQty || 0));
      const qtyAchvRatio = Number(r.CategoryQtyAchievementPct || 0) / 100;

      rows.push([
        r.LocationName,
        r.MonthName,
        r.CategoryName,
        r.QtyUOM,
        Number(r.UnitPriceDivisor || 0),
        Number(r.TargetCategorySales || 0),
        Number(r.ActualCategoryNetSales || 0),
        salesVar,
        salesAchvRatio,
        Math.round(Number(r.TargetCategoryQty || 0)),
        Math.round(Number(r.ActualCategoryQty || 0)),
        qtyVar,
        qtyAchvRatio,
      ]);

      setCellStyle(plan, rIdx, 0, S.TD_LEFT);
      setCellStyle(plan, rIdx, 1, S.TD_CENTER);
      setCellStyle(plan, rIdx, 2, S.TD_BOLD_LEFT);
      setCellStyle(plan, rIdx, 3, S.TD_CENTER);
      setCellStyle(plan, rIdx, 4, S.TD_MONEY_WD);
      setCellStyle(plan, rIdx, 5, S.TD_MONEY_BOLD_WD);
      setCellStyle(plan, rIdx, 6, S.TD_MONEY_HIGHLIGHT);
      setCellStyle(plan, rIdx, 7, salesVar >= 0 ? S.VAR_MONEY_POS : S.VAR_MONEY_NEG);
      setCellStyle(
        plan,
        rIdx,
        8,
        salesAchvRatio >= 1
          ? S.ACHV_GREEN
          : salesAchvRatio >= 0.8
            ? S.ACHV_AMBER
            : S.ACHV_RED
      );
      setCellStyle(plan, rIdx, 9, S.TD_INT_RIGHT);
      setCellStyle(plan, rIdx, 10, S.TD_INT_RIGHT);
      setCellStyle(plan, rIdx, 11, qtyVar >= 0 ? S.VAR_QTY_POS : S.VAR_QTY_NEG);
      setCellStyle(
        plan,
        rIdx,
        12,
        qtyAchvRatio >= 1 ? S.ACHV_GREEN : qtyAchvRatio >= 0.8 ? S.ACHV_AMBER : S.ACHV_RED
      );
      plan.rowHeights.set(rIdx + 1, 19);
    }

    const wsCat = XLSX.utils.aoa_to_sheet(rows, { sheetStubs: true });
    wsCat['!merges'] = merges;
    wsCat['!cols'] = [
      { wch: 22 },
      { wch: 13 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 19 },
      { wch: 19 },
      { wch: 18 },
      { wch: 15 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCat, 'Category Sales & Qty');
    sheetPlans.push(plan);
  }

  // =========================================================================
  // SHEET 3: WEEKDAY VS. WEEKEND/HOLIDAY (WEEKENDS/HD) BREAKDOWN
  // =========================================================================
  {
    const colsCount = 12;
    const rows: Array<Array<string | number>> = [];
    const merges: XLSX.Range[] = [];
    const plan: SheetStylePlan = { cellStyles: new Map(), rowHeights: new Map() };

    // Row 0: Title Banner
    rows.push(
      padRow(
        [
          `J.CO DONUTS & COFFEE — WEEKDAY (WD) VS. WEEKEND / HOLIDAY (WE/HD) TARGET & ACTUAL BREAKDOWN`,
        ],
        colsCount
      )
    );
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colsCount - 1 } });
    setRowCellsStyle(plan, 0, 0, colsCount - 1, S.TITLE_NAVY);
    plan.rowHeights.set(1, 28);

    // Row 1: Subtitle Banner
    rows.push(
      padRow([`Store Scope: ${storeScopeLabel}   |   Period: ${periodLabel}`], colsCount)
    );
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colsCount - 1 } });
    setRowCellsStyle(plan, 1, 0, colsCount - 1, S.SUBTITLE_ORANGE);
    plan.rowHeights.set(2, 22);

    rows.push(padRow([], colsCount));
    plan.rowHeights.set(3, 10);

    // Row 3: Table Header
    const rHdr = rows.length;
    rows.push([
      'Store Location',
      'Month',
      'WD Days (Act / Tgt)',
      'WE/HD Days (Act / Tgt)',
      'Target Daily Sales (WD)',
      'Actual Daily Sales (WD)',
      'WD Daily Variance (₱)',
      'Target Daily Sales (WE/HD)',
      'Actual Daily Sales (WE/HD)',
      'WE/HD Daily Variance (₱)',
      'Planned Split (WD / WE)',
      'Actual Split (WD / WE)',
    ]);
    setCellStyle(plan, rHdr, 0, S.TH_LEFT);
    setCellStyle(plan, rHdr, 1, S.TH_CENTER);
    setCellStyle(plan, rHdr, 2, S.TH_WD);
    setCellStyle(plan, rHdr, 3, S.TH_WE);
    setCellStyle(plan, rHdr, 4, S.TH_WD);
    setCellStyle(plan, rHdr, 5, S.TH_WD);
    setCellStyle(plan, rHdr, 6, S.TH_WD);
    setCellStyle(plan, rHdr, 7, S.TH_WE);
    setCellStyle(plan, rHdr, 8, S.TH_WE);
    setCellStyle(plan, rHdr, 9, S.TH_WE);
    setCellStyle(plan, rHdr, 10, S.TH_CENTER);
    setCellStyle(plan, rHdr, 11, S.TH_CENTER);
    plan.rowHeights.set(rHdr + 1, 26);

    for (const r of params.weekdayWeekend) {
      const rIdx = rows.length;
      const tgtWdDaily = Number(r.TargetDailySalesWeekday || 0);
      const actWdDaily = Number(r.ActualDailySalesWeekday || 0);
      const wdDailyVar = actWdDaily - tgtWdDaily;

      const tgtWeDaily = Number(r.TargetDailySalesWeekendHd || 0);
      const actWeDaily = Number(r.ActualDailySalesWeekendHd || 0);
      const weDailyVar = actWeDaily - tgtWeDaily;

      rows.push([
        r.LocationName,
        r.MonthName,
        `${r.ActualWeekdayDays} / ${r.TargetWeekdayDays}`,
        `${r.ActualWeekendHdDays} / ${r.TargetWeekendHdDays}`,
        tgtWdDaily,
        actWdDaily,
        wdDailyVar,
        tgtWeDaily,
        actWeDaily,
        weDailyVar,
        `${(Number(r.TargetWeekdaySalesPct || 0) * 100).toFixed(1)}% / ${(
          Number(r.TargetWeekendHdSalesPct || 0) * 100
        ).toFixed(1)}%`,
        `${(Number(r.ActualWeekdaySalesPct || 0) * 100).toFixed(1)}% / ${(
          Number(r.ActualWeekendHdSalesPct || 0) * 100
        ).toFixed(1)}%`,
      ]);

      setCellStyle(plan, rIdx, 0, S.TD_BOLD_LEFT);
      setCellStyle(plan, rIdx, 1, S.TD_CENTER);
      setCellStyle(plan, rIdx, 2, S.TD_CENTER);
      setCellStyle(plan, rIdx, 3, S.TD_INT_WE);
      setCellStyle(plan, rIdx, 4, S.TD_MONEY_WD);
      setCellStyle(plan, rIdx, 5, S.TD_MONEY_BOLD_WD);
      setCellStyle(plan, rIdx, 6, wdDailyVar >= 0 ? S.VAR_MONEY_POS : S.VAR_MONEY_NEG);
      setCellStyle(plan, rIdx, 7, S.TD_MONEY_WE);
      setCellStyle(plan, rIdx, 8, S.TD_MONEY_BOLD_WE);
      setCellStyle(plan, rIdx, 9, weDailyVar >= 0 ? S.VAR_MONEY_POS : S.VAR_MONEY_NEG);
      setCellStyle(plan, rIdx, 10, S.TD_CENTER);
      setCellStyle(plan, rIdx, 11, S.TD_CENTER);
      plan.rowHeights.set(rIdx + 1, 20);
    }

    const wsWdWe = XLSX.utils.aoa_to_sheet(rows, { sheetStubs: true });
    wsWdWe['!merges'] = merges;
    wsWdWe['!cols'] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
      { wch: 20 },
      { wch: 24 },
      { wch: 24 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsWdWe, 'Weekday vs Weekend-HD');
    sheetPlans.push(plan);
  }

  const safeLoc = (params.locationName || 'ALL').replace(/[^a-zA-Z0-9_-]/g, '_');
  applyStylesAndDownloadWorkbook(
    wb,
    sheetPlans,
    `Sales_Target_Analytics_${safeLoc}_${params.targetYear}_Q${params.targetQuarter}.xlsx`
  );
}
