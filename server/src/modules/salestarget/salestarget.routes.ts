import { Router } from 'express';
import { getPool, sql } from '../../database/db.js';
import { requireAuth, type AuthenticatedRequest } from '../auth/auth.middleware.js';

export const salesTargetRouter = Router();

// Protect all Sales Target endpoints with requireAuth
salesTargetRouter.use(requireAuth);

function formatDateOnly(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(value);
  return str.includes('T') ? (str.split('T')[0] ?? str) : str;
}

interface CategoryMixInput {
  categoryCode: string;
  weekdayMixPct: number;
  weekendHdMixPct: number;
  unitPriceDivisor: number;
  qtyUom?: string;
}

interface MonthlyTargetInput {
  targetMonth: number;
  targetNetSales: number;
  suggestedNetSales?: number | null;
  lastYearNetSales?: number | null;
  basisMonthAds?: number | null;
  seasonalAdjPct?: number;
  lessHalfDays?: number;
  totalOperatingDays: number;
  weekdayDays: number;
  weekendHdDays: number;
  weekdaySalesPct: number;
  weekendHdSalesPct: number;
  avgPerCheckWeekday?: number;
  avgPerCheckWeekendHd?: number;
  categories?: CategoryMixInput[];
}

interface StoreQuarterTargetInput {
  targetYear: number;
  targetQuarter: number;
  locationId?: number | null;
  locationName: string;
  orgLocationRef?: string | null;
  suggestionBasis?: string;
  basisMonthDate?: string | null;
  yoyGrowthTargetPct?: number;
  avgPerCheckDefault?: number;
  status?: string;
  remarks?: string | null;
  months: MonthlyTargetInput[];
}

/**
 * GET /api/reports/sales-target/stores
 * Returns all active physical store locations (IsActive = 1 AND access = 'Store')
 */
salesTargetRouter.get('/stores', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT LOCATIONID, LOCATIONNAME, ORGLOCATIONREF
      FROM dbo.dts_location
      WHERE IsActive = 1 AND access = 'Store'
      ORDER BY LOCATIONNAME ASC
    `);

    res.json({ stores: result.recordset });
  } catch (error) {
    console.error('Error fetching active stores for Sales Target:', error);
    res.status(500).json({ error: 'Failed to retrieve store locations from database.' });
  }
});

/**
 * GET /api/reports/sales-target/categories
 * Returns target categories (with default unit prices, UOM, and default mix %) and their item mappings
 */
salesTargetRouter.get('/categories', async (_req, res) => {
  try {
    const pool = await getPool();
    const [catRes, mapRes] = await Promise.all([
      pool.request().query(`
        SELECT
          CategoryID,
          CategoryCode,
          CategoryName,
          QtyUOM,
          DefaultUnitPrice,
          DefaultMixPct,
          SortOrder,
          IsActive
        FROM dbo.tbl_sales_target_category
        ORDER BY SortOrder ASC, CategoryID ASC
      `),
      pool.request().query(`
        SELECT
          MapID,
          CategoryCode,
          MatchType,
          MatchValue,
          Priority,
          IsActive
        FROM dbo.tbl_sales_target_category_map
        ORDER BY Priority ASC, MapID ASC
      `),
    ]);

    res.json({
      categories: catRes.recordset,
      mappings: mapRes.recordset,
    });
  } catch (error) {
    console.error('Error fetching Sales Target categories:', error);
    res.status(500).json({ error: 'Failed to retrieve sales target categories.' });
  }
});

/**
 * PUT /api/reports/sales-target/categories
 * Updates default unit prices, default mix %, or UOM for target categories
 */
salesTargetRouter.put('/categories', async (req, res) => {
  const { categories } = req.body ?? {};
  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400).json({ error: 'categories array is required.' });
    return;
  }

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const cat of categories) {
        const code = String(cat.categoryCode ?? cat.CategoryCode ?? '').trim();
        if (!code) continue;

        const unitPrice = Number(cat.defaultUnitPrice ?? cat.DefaultUnitPrice ?? 0);
        const defaultMixPct = Number(cat.defaultMixPct ?? cat.DefaultMixPct ?? 0);
        const qtyUom = String(cat.qtyUom ?? cat.QtyUOM ?? 'PCS').trim();
        const isActive = cat.isActive ?? cat.IsActive ?? true;

        await new sql.Request(transaction)
          .input('CategoryCode', sql.VarChar(30), code)
          .input('DefaultUnitPrice', sql.Decimal(18, 4), unitPrice)
          .input('DefaultMixPct', sql.Decimal(9, 6), defaultMixPct)
          .input('QtyUOM', sql.VarChar(20), qtyUom)
          .input('IsActive', sql.Bit, isActive ? 1 : 0)
          .query(`
            UPDATE dbo.tbl_sales_target_category
            SET DefaultUnitPrice = @DefaultUnitPrice,
                DefaultMixPct = @DefaultMixPct,
                QtyUOM = @QtyUOM,
                IsActive = @IsActive,
                ModifiedDate = GETDATE()
            WHERE CategoryCode = @CategoryCode
          `);
      }

      await transaction.commit();
      res.json({ message: 'Target categories updated successfully.' });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (error) {
    console.error('Error updating Sales Target categories:', error);
    res.status(500).json({ error: 'Failed to update sales target categories.' });
  }
});

/**
 * GET /api/reports/sales-target/calendar
 * Returns holidays for the specified year (and optional quarter) and monthly Weekday vs. Weekend/HD breakdown
 */
salesTargetRouter.get('/calendar', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const quarter = req.query.quarter ? Number(req.query.quarter) : null;

  const startMonth = quarter && quarter >= 1 && quarter <= 4 ? (quarter - 1) * 3 + 1 : 1;
  const endMonth = quarter && quarter >= 1 && quarter <= 4 ? startMonth + 2 : 12;

  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endDateObj = new Date(Date.UTC(year, endMonth, 0));
  const endDate = formatDateOnly(endDateObj)!;

  try {
    const pool = await getPool();
    const [holidaysRes, monthlyRes] = await Promise.all([
      pool
        .request()
        .input('startDate', sql.Date, startDate)
        .input('endDate', sql.Date, endDate)
        .query(`
          SELECT
            HolidayID,
            HolidayDate,
            HolidayName,
            HolidayType,
            TreatAsWeekend,
            Remarks,
            IsActive
          FROM dbo.tbl_sales_calendar_holiday
          WHERE HolidayDate BETWEEN @startDate AND @endDate
          ORDER BY HolidayDate ASC
        `),
      pool
        .request()
        .input('startDate', sql.Date, startDate)
        .input('endDate', sql.Date, endDate)
        .input('year', sql.Int, year)
        .query(`
          ;WITH DateSeq AS (
            SELECT CAST(@startDate AS DATE) AS CalDate
            UNION ALL
            SELECT DATEADD(DAY, 1, CalDate)
            FROM DateSeq
            WHERE CalDate < CAST(@endDate AS DATE)
          ),
          CalMarked AS (
            SELECT
              d.CalDate,
              MONTH(d.CalDate) AS TargetMonth,
              CASE WHEN ((DATEDIFF(DAY, '19000101', d.CalDate) % 7) + 1) IN (6, 7) THEN 1 ELSE 0 END AS IsWeekend,
              CASE WHEN h.HolidayID IS NOT NULL AND h.TreatAsWeekend = 1 THEN 1 ELSE 0 END AS IsHoliday,
              h.HolidayName,
              CASE
                WHEN ((DATEDIFF(DAY, '19000101', d.CalDate) % 7) + 1) IN (6, 7) THEN 1
                WHEN h.HolidayID IS NOT NULL AND h.TreatAsWeekend = 1 THEN 1
                ELSE 0
              END AS IsWeekendOrHd
            FROM DateSeq d
            LEFT JOIN dbo.tbl_sales_calendar_holiday h
              ON h.HolidayDate = d.CalDate AND h.IsActive = 1
          )
          SELECT
            @year AS TargetYear,
            c.TargetMonth,
            DATENAME(MONTH, DATEFROMPARTS(@year, c.TargetMonth, 1)) AS MonthName,
            COUNT(*) AS TotalDays,
            SUM(CASE WHEN c.IsWeekendOrHd = 0 THEN 1 ELSE 0 END) AS WeekdayDays,
            SUM(CASE WHEN c.IsWeekendOrHd = 1 THEN 1 ELSE 0 END) AS WeekendHdDays,
            SUM(CASE WHEN c.IsHoliday = 1 AND c.IsWeekend = 0 THEN 1 ELSE 0 END) AS HolidayWeekdayCount,
            SUM(CASE WHEN c.IsHoliday = 1 AND c.IsWeekend = 1 THEN 1 ELSE 0 END) AS HolidayWeekendCount
          FROM CalMarked c
          GROUP BY c.TargetMonth
          ORDER BY c.TargetMonth ASC
          OPTION (MAXRECURSION 400);
        `),
    ]);

    res.json({
      year,
      quarter,
      monthlySummary: monthlyRes.recordset,
      holidays: holidaysRes.recordset.map((h) => ({
        ...h,
        HolidayDate: formatDateOnly(h.HolidayDate),
      })),
    });
  } catch (error) {
    console.error('Error fetching Sales Target calendar:', error);
    res.status(500).json({ error: 'Failed to retrieve sales target calendar.' });
  }
});

/**
 * POST /api/reports/sales-target/calendar/holidays
 * Upserts a holiday entry in dbo.tbl_sales_calendar_holiday
 */
salesTargetRouter.post('/calendar/holidays', async (req, res) => {
  const { holidayDate, holidayName, holidayType, treatAsWeekend, remarks, isActive } = req.body ?? {};

  if (!holidayDate || !holidayName || !String(holidayName).trim()) {
    res.status(400).json({ error: 'holidayDate and holidayName are required.' });
    return;
  }

  try {
    const pool = await getPool();
    await pool
      .request()
      .input('HolidayDate', sql.Date, holidayDate)
      .input('HolidayName', sql.VarChar(150), String(holidayName).trim())
      .input('HolidayType', sql.VarChar(30), String(holidayType ?? 'REGULAR').trim().toUpperCase())
      .input('TreatAsWeekend', sql.Bit, treatAsWeekend === false ? 0 : 1)
      .input('Remarks', sql.VarChar(255), remarks ? String(remarks).trim() : null)
      .input('IsActive', sql.Bit, isActive === false ? 0 : 1)
      .query(`
        MERGE INTO dbo.tbl_sales_calendar_holiday AS target
        USING (SELECT @HolidayDate AS HolidayDate) AS source
        ON target.HolidayDate = source.HolidayDate
        WHEN MATCHED THEN
          UPDATE SET
            HolidayName = @HolidayName,
            HolidayType = @HolidayType,
            TreatAsWeekend = @TreatAsWeekend,
            Remarks = @Remarks,
            IsActive = @IsActive
        WHEN NOT MATCHED THEN
          INSERT (HolidayDate, HolidayName, HolidayType, TreatAsWeekend, Remarks, IsActive)
          VALUES (@HolidayDate, @HolidayName, @HolidayType, @TreatAsWeekend, @Remarks, @IsActive);
      `);

    res.json({ message: 'Holiday saved successfully.' });
  } catch (error) {
    console.error('Error saving holiday:', error);
    res.status(500).json({ error: 'Failed to save holiday.' });
  }
});

/**
 * POST /api/reports/sales-target/suggest
 * Executes dbo.usp_SuggestSalesTarget to suggest quarterly targets based on
 * Last Year Same Quarter (YoY trend) and Basis Month ADS, plus Category Mix %.
 */
salesTargetRouter.post('/suggest', async (req, res) => {
  const {
    targetYear,
    targetQuarter,
    locationName = 'ALL',
    basisMonthDate = null,
    yoyGrowthPct = 0.05,
    avgPerCheck = 470.0,
  } = req.body ?? {};

  const yearNum = Number(targetYear);
  const qtrNum = Number(targetQuarter);

  if (!yearNum || yearNum < 2000 || yearNum > 2100) {
    res.status(400).json({ error: 'Valid targetYear is required.' });
    return;
  }

  if (![1, 2, 3, 4].includes(qtrNum)) {
    res.status(400).json({ error: 'targetQuarter must be 1, 2, 3, or 4.' });
    return;
  }

  try {
    const pool = await getPool();
    const request = pool
      .request()
      .input('TargetYear', sql.Int, yearNum)
      .input('TargetQuarter', sql.TinyInt, qtrNum)
      .input('LocationName', sql.VarChar(50), locationName ? String(locationName).trim() : 'ALL')
      .input('BasisMonthDate', sql.Date, basisMonthDate || null)
      .input('YoYGrowthPct', sql.Decimal(9, 6), Number(yoyGrowthPct ?? 0.05))
      .input('AvgPerCheck', sql.Decimal(18, 4), Number(avgPerCheck ?? 470.0));

    const result = await request.execute('dbo.usp_SuggestSalesTarget');
    const recordsets = result.recordsets as sql.IRecordSet<Record<string, unknown>>[];

    const calendarBreakdown = recordsets[0] ?? [];
    const monthlySuggestions = (recordsets[1] ?? []).map((row) => ({
      ...row,
      BasisMonthDate: formatDateOnly(row.BasisMonthDate),
    }));
    const categorySuggestions = recordsets[2] ?? [];

    res.json({
      targetYear: yearNum,
      targetQuarter: qtrNum,
      yoyGrowthPct: Number(yoyGrowthPct ?? 0.05),
      avgPerCheck: Number(avgPerCheck ?? 470.0),
      calendar: calendarBreakdown,
      monthlySuggestions,
      categorySuggestions,
    });
  } catch (error) {
    console.error('Error executing usp_SuggestSalesTarget:', error);
    res.status(500).json({ error: 'Failed to generate sales target suggestions.' });
  }
});

/**
 * GET /api/reports/sales-target
 * Retrieves saved Quarterly Sales Targets from dbo.vw_sales_target_detailed
 */
salesTargetRouter.get('/', async (req, res) => {
  const yearNum = Number(req.query.year) || new Date().getFullYear();
  const qtrNum = Number(req.query.quarter) || 1;
  const locationName = req.query.locationName ? String(req.query.locationName).trim() : null;

  if (![1, 2, 3, 4].includes(qtrNum)) {
    res.status(400).json({ error: 'quarter must be 1, 2, 3, or 4.' });
    return;
  }

  try {
    const pool = await getPool();
    const request = pool
      .request()
      .input('TargetYear', sql.Int, yearNum)
      .input('TargetQuarter', sql.TinyInt, qtrNum);

    let locationFilter = '';
    if (locationName && locationName.toUpperCase() !== 'ALL') {
      request.input('LocationName', sql.VarChar(50), locationName);
      locationFilter = 'AND LocationName = @LocationName';
    }

    const result = await request.query(`
      SELECT *
      FROM dbo.vw_sales_target_detailed
      WHERE TargetYear = @TargetYear
        AND TargetQuarter = @TargetQuarter
        ${locationFilter}
      ORDER BY LocationName ASC, TargetMonth ASC, CategorySortOrder ASC
    `);

    // Group flat view rows into structured store -> months -> categories cards
    const storeMap = new Map<string, Record<string, unknown>>();

    for (const row of result.recordset) {
      const locKey = String(row.LocationName);
      if (!storeMap.has(locKey)) {
        storeMap.set(locKey, {
          targetId: row.TargetID,
          targetYear: row.TargetYear,
          targetQuarter: row.TargetQuarter,
          locationId: row.LocationID,
          locationName: row.LocationName,
          orgLocationRef: row.OrgLocationRef,
          suggestionBasis: row.SuggestionBasis,
          basisMonthDate: formatDateOnly(row.BasisMonthDate),
          yoyGrowthTargetPct: row.YoYGrowthTargetPct,
          avgPerCheckDefault: row.AvgPerCheckDefault,
          status: row.Status,
          monthsMap: new Map<number, Record<string, unknown>>(),
        });
      }

      const storeObj = storeMap.get(locKey)!;
      const monthsMap = storeObj.monthsMap as Map<number, Record<string, unknown>>;
      const monthNum = Number(row.TargetMonth);

      if (!monthsMap.has(monthNum)) {
        monthsMap.set(monthNum, {
          monthlyTargetId: row.MonthlyTargetID,
          targetMonth: monthNum,
          monthName: row.MonthName,
          targetNetSales: row.TargetNetSales,
          suggestedNetSales: row.SuggestedNetSales,
          lastYearNetSales: row.LastYearNetSales,
          basisMonthAds: row.BasisMonthADS,
          seasonalAdjPct: row.SeasonalAdjPct,
          lessHalfDays: row.LessHalfDays,
          totalOperatingDays: row.TotalOperatingDays,
          weekdayDays: row.WeekdayDays,
          weekendHdDays: row.WeekendHdDays,
          weekdaySalesPct: row.WeekdaySalesPct,
          weekendHdSalesPct: row.WeekendHdSalesPct,
          monthlyAds: row.MonthlyADS,
          dailyTargetSalesWeekday: row.DailyTargetSalesWeekday,
          dailyTargetSalesWeekendHd: row.DailyTargetSalesWeekendHd,
          avgPerCheckWeekday: row.AvgPerCheckWeekday,
          avgPerCheckWeekendHd: row.AvgPerCheckWeekendHd,
          dailyCustomerCountWeekday: row.DailyCustomerCountWeekday,
          dailyCustomerCountWeekendHd: row.DailyCustomerCountWeekendHd,
          monthlyCustomerCount: row.MonthlyCustomerCount,
          categories: [] as Record<string, unknown>[],
        });
      }

      if (row.CategoryCode) {
        const monthObj = monthsMap.get(monthNum)!;
        const categories = monthObj.categories as Record<string, unknown>[];
        categories.push({
          mixId: row.MixID,
          categoryCode: row.CategoryCode,
          categoryName: row.CategoryName,
          sortOrder: row.CategorySortOrder,
          qtyUom: row.QtyUOM,
          unitPriceDivisor: row.UnitPriceDivisor,
          weekdayMixPct: row.WeekdayMixPct,
          weekendHdMixPct: row.WeekendHdMixPct,
          dailyCategorySalesWeekday: row.DailyCategorySalesWeekday,
          dailyCategorySalesWeekendHd: row.DailyCategorySalesWeekendHd,
          dailyCategoryQtyWeekday: row.DailyCategoryQtyWeekday,
          dailyCategoryQtyWeekendHd: row.DailyCategoryQtyWeekendHd,
          monthlyCategorySales: row.MonthlyCategorySales,
          monthlyCategoryQty: row.MonthlyCategoryQty,
        });
      }
    }

    const targets = Array.from(storeMap.values()).map((storeObj) => {
      const monthsMap = storeObj.monthsMap as Map<number, Record<string, unknown>>;
      const months = Array.from(monthsMap.values());
      const { monthsMap: _omitted, ...rest } = storeObj;
      return {
        ...rest,
        months,
      };
    });

    res.json({
      targetYear: yearNum,
      targetQuarter: qtrNum,
      targets,
    });
  } catch (error) {
    console.error('Error fetching saved Sales Targets:', error);
    res.status(500).json({ error: 'Failed to retrieve saved sales targets.' });
  }
});

/**
 * POST /api/reports/sales-target
 * Saves / upserts one or more store quarterly sales targets
 * (Header -> 3 Monthly rows -> Category Mix rows) inside a transaction.
 */
salesTargetRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const payload = req.body ?? {};
  const rawTargets: StoreQuarterTargetInput[] = Array.isArray(payload.targets)
    ? payload.targets
    : payload.locationName
      ? [payload as StoreQuarterTargetInput]
      : [];

  if (rawTargets.length === 0) {
    res.status(400).json({ error: 'At least one store target payload is required.' });
    return;
  }

  const createdBy = req.user?.username ?? 'system';

  try {
    const pool = await getPool();

    // Load default categories in case a monthly payload omits explicit categories
    const defaultCatsRes = await pool.request().query(`
      SELECT CategoryCode, QtyUOM, DefaultUnitPrice, DefaultMixPct
      FROM dbo.tbl_sales_target_category
      WHERE IsActive = 1
      ORDER BY SortOrder ASC
    `);
    const defaultCategories = defaultCatsRes.recordset;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const savedTargetIds: number[] = [];

      for (const storeTarget of rawTargets) {
        const targetYear = Number(storeTarget.targetYear);
        const targetQuarter = Number(storeTarget.targetQuarter);
        const locationName = String(storeTarget.locationName ?? '').trim();

        if (!targetYear || ![1, 2, 3, 4].includes(targetQuarter) || !locationName) {
          throw new Error('Each target must include valid targetYear, targetQuarter (1-4), and locationName.');
        }

        const avgCheckDefault = Number(storeTarget.avgPerCheckDefault ?? 470.0);

        // 1. Upsert Header
        const headerRes = await new sql.Request(transaction)
          .input('TargetYear', sql.Int, targetYear)
          .input('TargetQuarter', sql.TinyInt, targetQuarter)
          .input('LocationID', sql.Int, storeTarget.locationId ?? null)
          .input('LocationName', sql.VarChar(50), locationName)
          .input('OrgLocationRef', sql.VarChar(50), storeTarget.orgLocationRef ?? null)
          .input('SuggestionBasis', sql.VarChar(30), storeTarget.suggestionBasis ?? 'YOY_TREND')
          .input('BasisMonthDate', sql.Date, storeTarget.basisMonthDate || null)
          .input('YoYGrowthTargetPct', sql.Decimal(9, 6), Number(storeTarget.yoyGrowthTargetPct ?? 0.05))
          .input('AvgPerCheckDefault', sql.Decimal(18, 4), avgCheckDefault)
          .input('Status', sql.VarChar(20), storeTarget.status ?? 'APPROVED')
          .input('Remarks', sql.VarChar(500), storeTarget.remarks ?? null)
          .input('CreatedBy', sql.VarChar(50), createdBy)
          .query(`
            MERGE INTO dbo.tbl_sales_target_header AS target
            USING (
              SELECT
                @TargetYear AS TargetYear,
                @TargetQuarter AS TargetQuarter,
                @LocationName AS LocationName
            ) AS source
            ON target.TargetYear = source.TargetYear
               AND target.TargetQuarter = source.TargetQuarter
               AND target.LocationName = source.LocationName
            WHEN MATCHED THEN
              UPDATE SET
                LocationID = COALESCE(@LocationID, target.LocationID),
                OrgLocationRef = COALESCE(@OrgLocationRef, target.OrgLocationRef),
                SuggestionBasis = @SuggestionBasis,
                BasisMonthDate = @BasisMonthDate,
                YoYGrowthTargetPct = @YoYGrowthTargetPct,
                AvgPerCheckDefault = @AvgPerCheckDefault,
                Status = @Status,
                Remarks = @Remarks,
                ModifiedDate = GETDATE()
            WHEN NOT MATCHED THEN
              INSERT (
                TargetYear, TargetQuarter, LocationID, LocationName, OrgLocationRef,
                SuggestionBasis, BasisMonthDate, YoYGrowthTargetPct, AvgPerCheckDefault,
                Status, Remarks, CreatedBy
              )
              VALUES (
                @TargetYear, @TargetQuarter, @LocationID, @LocationName, @OrgLocationRef,
                @SuggestionBasis, @BasisMonthDate, @YoYGrowthTargetPct, @AvgPerCheckDefault,
                @Status, @Remarks, @CreatedBy
              )
            OUTPUT INSERTED.TargetID;
          `);

        const targetId = Number(headerRes.recordset[0]?.TargetID);
        savedTargetIds.push(targetId);

        // 2. Upsert Monthly Breakdowns
        for (const m of storeTarget.months ?? []) {
          const monthRes = await new sql.Request(transaction)
            .input('TargetID', sql.Int, targetId)
            .input('TargetMonth', sql.TinyInt, Number(m.targetMonth))
            .input('TargetNetSales', sql.Decimal(18, 4), Number(m.targetNetSales ?? 0))
            .input('SuggestedNetSales', sql.Decimal(18, 4), m.suggestedNetSales != null ? Number(m.suggestedNetSales) : null)
            .input('LastYearNetSales', sql.Decimal(18, 4), m.lastYearNetSales != null ? Number(m.lastYearNetSales) : null)
            .input('BasisMonthADS', sql.Decimal(18, 4), m.basisMonthAds != null ? Number(m.basisMonthAds) : null)
            .input('SeasonalAdjPct', sql.Decimal(9, 6), Number(m.seasonalAdjPct ?? 0))
            .input('LessHalfDays', sql.Decimal(9, 2), Number(m.lessHalfDays ?? 0))
            .input('TotalOperatingDays', sql.TinyInt, Number(m.totalOperatingDays))
            .input('WeekdayDays', sql.TinyInt, Number(m.weekdayDays))
            .input('WeekendHdDays', sql.TinyInt, Number(m.weekendHdDays))
            .input('WeekdaySalesPct', sql.Decimal(9, 6), Number(m.weekdaySalesPct ?? 0.5))
            .input('WeekendHdSalesPct', sql.Decimal(9, 6), Number(m.weekendHdSalesPct ?? 0.5))
            .input('AvgPerCheckWeekday', sql.Decimal(18, 4), Number(m.avgPerCheckWeekday ?? avgCheckDefault))
            .input('AvgPerCheckWeekendHd', sql.Decimal(18, 4), Number(m.avgPerCheckWeekendHd ?? avgCheckDefault))
            .query(`
              MERGE INTO dbo.tbl_sales_target_monthly AS target
              USING (
                SELECT @TargetID AS TargetID, @TargetMonth AS TargetMonth
              ) AS source
              ON target.TargetID = source.TargetID AND target.TargetMonth = source.TargetMonth
              WHEN MATCHED THEN
                UPDATE SET
                  TargetNetSales = @TargetNetSales,
                  SuggestedNetSales = @SuggestedNetSales,
                  LastYearNetSales = @LastYearNetSales,
                  BasisMonthADS = @BasisMonthADS,
                  SeasonalAdjPct = @SeasonalAdjPct,
                  LessHalfDays = @LessHalfDays,
                  TotalOperatingDays = @TotalOperatingDays,
                  WeekdayDays = @WeekdayDays,
                  WeekendHdDays = @WeekendHdDays,
                  WeekdaySalesPct = @WeekdaySalesPct,
                  WeekendHdSalesPct = @WeekendHdSalesPct,
                  AvgPerCheckWeekday = @AvgPerCheckWeekday,
                  AvgPerCheckWeekendHd = @AvgPerCheckWeekendHd,
                  ModifiedDate = GETDATE()
              WHEN NOT MATCHED THEN
                INSERT (
                  TargetID, TargetMonth, TargetNetSales, SuggestedNetSales, LastYearNetSales,
                  BasisMonthADS, SeasonalAdjPct, LessHalfDays, TotalOperatingDays,
                  WeekdayDays, WeekendHdDays, WeekdaySalesPct, WeekendHdSalesPct,
                  AvgPerCheckWeekday, AvgPerCheckWeekendHd
                )
                VALUES (
                  @TargetID, @TargetMonth, @TargetNetSales, @SuggestedNetSales, @LastYearNetSales,
                  @BasisMonthADS, @SeasonalAdjPct, @LessHalfDays, @TotalOperatingDays,
                  @WeekdayDays, @WeekendHdDays, @WeekdaySalesPct, @WeekendHdSalesPct,
                  @AvgPerCheckWeekday, @AvgPerCheckWeekendHd
                )
              OUTPUT INSERTED.MonthlyTargetID;
            `);

          const monthlyTargetId = Number(monthRes.recordset[0]?.MonthlyTargetID);

          // 3. Upsert Category Mix Rows
          const categoriesToSave: CategoryMixInput[] =
            Array.isArray(m.categories) && m.categories.length > 0
              ? m.categories
              : defaultCategories.map((dc) => ({
                  categoryCode: String(dc.CategoryCode),
                  weekdayMixPct: Number(dc.DefaultMixPct),
                  weekendHdMixPct: Number(dc.DefaultMixPct),
                  unitPriceDivisor: Number(dc.DefaultUnitPrice),
                  qtyUom: String(dc.QtyUOM),
                }));

          for (const cat of categoriesToSave) {
            await new sql.Request(transaction)
              .input('MonthlyTargetID', sql.Int, monthlyTargetId)
              .input('CategoryCode', sql.VarChar(30), String(cat.categoryCode).trim())
              .input('WeekdayMixPct', sql.Decimal(9, 6), Number(cat.weekdayMixPct ?? 0))
              .input('WeekendHdMixPct', sql.Decimal(9, 6), Number(cat.weekendHdMixPct ?? 0))
              .input('UnitPriceDivisor', sql.Decimal(18, 4), Number(cat.unitPriceDivisor ?? 1))
              .input('QtyUOM', sql.VarChar(20), String(cat.qtyUom ?? 'PCS'))
              .query(`
                MERGE INTO dbo.tbl_sales_target_category_mix AS target
                USING (
                  SELECT @MonthlyTargetID AS MonthlyTargetID, @CategoryCode AS CategoryCode
                ) AS source
                ON target.MonthlyTargetID = source.MonthlyTargetID
                   AND target.CategoryCode = source.CategoryCode
                WHEN MATCHED THEN
                  UPDATE SET
                    WeekdayMixPct = @WeekdayMixPct,
                    WeekendHdMixPct = @WeekendHdMixPct,
                    UnitPriceDivisor = @UnitPriceDivisor,
                    QtyUOM = @QtyUOM
                WHEN NOT MATCHED THEN
                  INSERT (MonthlyTargetID, CategoryCode, WeekdayMixPct, WeekendHdMixPct, UnitPriceDivisor, QtyUOM)
                  VALUES (@MonthlyTargetID, @CategoryCode, @WeekdayMixPct, @WeekendHdMixPct, @UnitPriceDivisor, @QtyUOM);
              `);
          }
        }
      }

      await transaction.commit();
      res.json({
        message: 'Sales targets saved successfully.',
        savedTargetIds,
      });
    } catch (innerError) {
      await transaction.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error('Error saving Sales Targets:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to save sales targets.',
    });
  }
});

/**
 * POST /api/reports/sales-target/analytics
 * Executes dbo.usp_GetSalesTargetAnalytics to compare Target vs. Actual
 * (Sales PHP & Qty PCS/BOXES, Weekday vs. Weekend/HD, Customer Count, and YoY growth).
 */
salesTargetRouter.post('/analytics', async (req, res) => {
  const { targetYear, targetQuarter, locationName = 'ALL' } = req.body ?? {};

  const yearNum = Number(targetYear);
  const qtrNum = Number(targetQuarter);

  if (!yearNum || yearNum < 2000 || yearNum > 2100) {
    res.status(400).json({ error: 'Valid targetYear is required.' });
    return;
  }

  if (![1, 2, 3, 4].includes(qtrNum)) {
    res.status(400).json({ error: 'targetQuarter must be 1, 2, 3, or 4.' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('TargetYear', sql.Int, yearNum)
      .input('TargetQuarter', sql.TinyInt, qtrNum)
      .input('LocationName', sql.VarChar(50), locationName ? String(locationName).trim() : 'ALL')
      .execute('dbo.usp_GetSalesTargetAnalytics');

    const recordsets = result.recordsets as sql.IRecordSet<Record<string, unknown>>[];

    res.json({
      targetYear: yearNum,
      targetQuarter: qtrNum,
      summary: recordsets[0] ?? [],
      weekdayWeekendBreakdown: recordsets[1] ?? [],
      categoryBreakdown: recordsets[2] ?? [],
    });
  } catch (error) {
    console.error('Error executing usp_GetSalesTargetAnalytics:', error);
    res.status(500).json({ error: 'Failed to retrieve sales target analytics.' });
  }
});
