USE [OracleDB]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =========================================================================
   Stored Procedure: dbo.usp_GetSalesTargetAnalytics
   Description:
     Provides analytical reporting for Quarterly Sales Targets:
     - Result Set 1: Store & Monthly Target vs. Actual (Net & Gross Sales),
       Achievement %, Variance, Remaining Run-Rate ADS, Customer Count &
       Average Check comparison, and YoY (Current Year vs. Last Year) Growth.
     - Result Set 2: Weekday vs. Weekend/Holiday (WEEKENDS/HD) Target vs.
       Actual Sales & Customer Count Breakdown.
     - Result Set 3: Category-level Target vs. Actual for BOTH Sales (PHP)
       and Quantity (PCS / BOXES), plus Planned Mix % vs. Actual Mix %.
   ========================================================================= */
CREATE OR ALTER PROCEDURE [dbo].[usp_GetSalesTargetAnalytics]
    @TargetYear    INT,
    @TargetQuarter TINYINT,
    @LocationName  VARCHAR(50) = NULL -- NULL or 'ALL' = all active/targeted stores
AS
BEGIN
    SET NOCOUNT ON;

    IF @TargetQuarter NOT IN (1, 2, 3, 4)
    BEGIN
        RAISERROR('Invalid @TargetQuarter. Must be 1, 2, 3, or 4.', 16, 1);
        RETURN;
    END

    IF @LocationName = 'ALL' OR LTRIM(RTRIM(@LocationName)) = ''
        SET @LocationName = NULL;

    DECLARE @StartMonth TINYINT = ((@TargetQuarter - 1) * 3) + 1;
    DECLARE @EndMonth   TINYINT = @StartMonth + 2;

    DECLARE @TargetStartDate DATE = DATEFROMPARTS(@TargetYear, @StartMonth, 1);
    DECLARE @TargetEndDate   DATE = EOMONTH(DATEFROMPARTS(@TargetYear, @EndMonth, 1));

    DECLARE @LYYear          INT  = @TargetYear - 1;
    DECLARE @LYStartDate     DATE = DATEFROMPARTS(@LYYear, @StartMonth, 1);
    DECLARE @LYEndDate       DATE = EOMONTH(DATEFROMPARTS(@LYYear, @EndMonth, 1));

    /* =====================================================================
       STEP 1: Build Calendar Lookup for Target Quarter & Last Year Quarter
       ===================================================================== */
    CREATE TABLE #AnalyticsCalendar (
        CalDate       DATE    NOT NULL PRIMARY KEY,
        CalYear       INT     NOT NULL,
        CalMonth      TINYINT NOT NULL,
        IsWeekendOrHd BIT     NOT NULL
    );

    ;WITH DateSeq AS (
        SELECT @TargetStartDate AS CalDate
        UNION ALL
        SELECT DATEADD(DAY, 1, CalDate)
        FROM DateSeq
        WHERE CalDate < @TargetEndDate
    ),
    LYDateSeq AS (
        SELECT @LYStartDate AS CalDate
        UNION ALL
        SELECT DATEADD(DAY, 1, CalDate)
        FROM LYDateSeq
        WHERE CalDate < @LYEndDate
    ),
    AllDates AS (
        SELECT CalDate FROM DateSeq
        UNION ALL
        SELECT CalDate FROM LYDateSeq
    )
    INSERT INTO #AnalyticsCalendar (CalDate, CalYear, CalMonth, IsWeekendOrHd)
    SELECT
        d.CalDate,
        YEAR(d.CalDate) AS CalYear,
        MONTH(d.CalDate) AS CalMonth,
        CASE
            WHEN ((DATEDIFF(DAY, '19000101', d.CalDate) % 7) + 1) IN (6, 7) THEN 1
            WHEN h.HolidayID IS NOT NULL AND h.TreatAsWeekend = 1 THEN 1
            ELSE 0
        END AS IsWeekendOrHd
    FROM AllDates d
    LEFT JOIN [dbo].[tbl_sales_calendar_holiday] h
        ON h.HolidayDate = d.CalDate
       AND h.IsActive = 1
    OPTION (MAXRECURSION 400);

    -- Default Calendar Day Counts per Month in Target Quarter
    SELECT
        CalMonth AS TargetMonth,
        DATENAME(MONTH, DATEFROMPARTS(@TargetYear, CalMonth, 1)) AS MonthName,
        COUNT(*) AS TotalDays,
        SUM(CASE WHEN IsWeekendOrHd = 0 THEN 1 ELSE 0 END) AS WeekdayDays,
        SUM(CASE WHEN IsWeekendOrHd = 1 THEN 1 ELSE 0 END) AS WeekendHdDays
    INTO #DefaultMonthDays
    FROM #AnalyticsCalendar
    WHERE CalYear = @TargetYear
    GROUP BY CalMonth;

    /* =====================================================================
       STEP 2: Resolve Stores in Scope (Stores with Targets OR Active Stores)
       ===================================================================== */
    CREATE TABLE #ScopeStores (
        LocationID     INT         NULL,
        LocationName   VARCHAR(50) NOT NULL PRIMARY KEY,
        OrgLocationRef VARCHAR(50) NULL
    );

    INSERT INTO #ScopeStores (LocationID, LocationName, OrgLocationRef)
    SELECT
        MIN(LocationID) AS LocationID,
        LocationName,
        MAX(OrgLocationRef) AS OrgLocationRef
    FROM (
        SELECT LOCATIONID AS LocationID, LOCATIONNAME AS LocationName, ORGLOCATIONREF AS OrgLocationRef
        FROM [dbo].[dts_location]
        WHERE IsActive = 1 AND access = 'Store'
        UNION ALL
        SELECT LocationID, LocationName, OrgLocationRef
        FROM [dbo].[tbl_sales_target_header]
        WHERE TargetYear = @TargetYear AND TargetQuarter = @TargetQuarter
    ) src
    WHERE (@LocationName IS NULL OR src.LocationName = @LocationName)
    GROUP BY LocationName;

    /* =====================================================================
       STEP 3: Aggregate Current Year & Last Year DSR Actuals
       ===================================================================== */
    SELECT
        dsr.locationname AS LocationName,
        MONTH(dsr.businessdate) AS TargetMonth,
        SUM(ISNULL(dsr.netsales, 0)) AS ActualNetSales,
        SUM(ISNULL(dsr.gross_sales, 0)) AS ActualGrossSales,
        COUNT(DISTINCT dsr.businessdate) AS ActualOperatingDays,
        SUM(ISNULL(dsr.numguest, 0)) AS ActualGuestCount,
        -- Weekday Actuals
        COUNT(DISTINCT CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 0 THEN dsr.businessdate END) AS ActualWeekdayDays,
        SUM(CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 0 THEN ISNULL(dsr.netsales, 0) ELSE 0 END) AS ActualWeekdayNetSales,
        SUM(CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 0 THEN ISNULL(dsr.gross_sales, 0) ELSE 0 END) AS ActualWeekdayGrossSales,
        SUM(CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 0 THEN ISNULL(dsr.numguest, 0) ELSE 0 END) AS ActualWeekdayGuests,
        -- Weekend/HD Actuals
        COUNT(DISTINCT CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 1 THEN dsr.businessdate END) AS ActualWeekendHdDays,
        SUM(CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 1 THEN ISNULL(dsr.netsales, 0) ELSE 0 END) AS ActualWeekendHdNetSales,
        SUM(CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 1 THEN ISNULL(dsr.gross_sales, 0) ELSE 0 END) AS ActualWeekendHdGrossSales,
        SUM(CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 1 THEN ISNULL(dsr.numguest, 0) ELSE 0 END) AS ActualWeekendHdGuests
    INTO #CYMonthlyActuals
    FROM [dbo].[agg_daily_dsr] dsr
    INNER JOIN #ScopeStores s
        ON s.LocationName = dsr.locationname
    LEFT JOIN #AnalyticsCalendar cal
        ON cal.CalDate = dsr.businessdate
    WHERE dsr.businessdate BETWEEN @TargetStartDate AND @TargetEndDate
    GROUP BY dsr.locationname, MONTH(dsr.businessdate);

    SELECT
        dsr.locationname AS LocationName,
        MONTH(dsr.businessdate) AS TargetMonth,
        SUM(ISNULL(dsr.netsales, 0)) AS LYNetSales,
        SUM(ISNULL(dsr.gross_sales, 0)) AS LYGrossSales,
        COUNT(DISTINCT dsr.businessdate) AS LYOperatingDays,
        SUM(ISNULL(dsr.numguest, 0)) AS LYGuestCount
    INTO #LYMonthlyActuals
    FROM [dbo].[agg_daily_dsr] dsr
    INNER JOIN #ScopeStores s
        ON s.LocationName = dsr.locationname
    WHERE dsr.businessdate BETWEEN @LYStartDate AND @LYEndDate
    GROUP BY dsr.locationname, MONTH(dsr.businessdate);

    /* =====================================================================
       RESULT SET 1: Store & Monthly Target vs. Actual Summary + YoY
       ===================================================================== */
    SELECT
        s.LocationID,
        s.LocationName,
        s.OrgLocationRef,
        h.TargetID,
        ISNULL(h.Status, 'UNSET') AS TargetStatus,
        @TargetYear AS TargetYear,
        @TargetQuarter AS TargetQuarter,
        dmd.TargetMonth,
        dmd.MonthName,
        ISNULL(m.TotalOperatingDays, dmd.TotalDays) AS TotalOperatingDays,
        ISNULL(m.WeekdayDays, dmd.WeekdayDays) AS TargetWeekdayDays,
        ISNULL(m.WeekendHdDays, dmd.WeekendHdDays) AS TargetWeekendHdDays,
        -- Target Sales & ADS
        CAST(ISNULL(m.TargetNetSales, 0) AS DECIMAL(18, 4)) AS TargetNetSales,
        CAST(ISNULL(m.SuggestedNetSales, 0) AS DECIMAL(18, 4)) AS SuggestedNetSales,
        CAST(
            CASE WHEN ISNULL(m.TotalOperatingDays, dmd.TotalDays) > 0
                 THEN ISNULL(m.TargetNetSales, 0) / ISNULL(m.TotalOperatingDays, dmd.TotalDays)
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS TargetADS,
        -- Actual Sales & ADS
        CAST(ISNULL(cy.ActualNetSales, 0) AS DECIMAL(18, 4)) AS ActualNetSales,
        CAST(ISNULL(cy.ActualGrossSales, 0) AS DECIMAL(18, 4)) AS ActualGrossSales,
        ISNULL(cy.ActualOperatingDays, 0) AS ActualOperatingDays,
        CAST(
            CASE WHEN ISNULL(cy.ActualOperatingDays, 0) > 0
                 THEN cy.ActualNetSales / cy.ActualOperatingDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS ActualADS,
        -- Variance & Achievement %
        CAST(ISNULL(cy.ActualNetSales, 0) - ISNULL(m.TargetNetSales, 0) AS DECIMAL(18, 4)) AS VarianceNetSales,
        CAST(
            CASE WHEN ISNULL(m.TargetNetSales, 0) > 0
                 THEN (ISNULL(cy.ActualNetSales, 0) / m.TargetNetSales) * 100.0
                 ELSE 0
            END AS DECIMAL(9, 2)
        ) AS AchievementPct,
        -- Remaining Target & Required Daily Run Rate
        CAST(
            CASE WHEN ISNULL(m.TargetNetSales, 0) > ISNULL(cy.ActualNetSales, 0)
                 THEN m.TargetNetSales - ISNULL(cy.ActualNetSales, 0)
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS RemainingTargetSales,
        CASE WHEN ISNULL(m.TotalOperatingDays, dmd.TotalDays) > ISNULL(cy.ActualOperatingDays, 0)
             THEN ISNULL(m.TotalOperatingDays, dmd.TotalDays) - ISNULL(cy.ActualOperatingDays, 0)
             ELSE 0
        END AS RemainingOperatingDays,
        CAST(
            CASE WHEN (ISNULL(m.TotalOperatingDays, dmd.TotalDays) - ISNULL(cy.ActualOperatingDays, 0)) > 0
                  AND ISNULL(m.TargetNetSales, 0) > ISNULL(cy.ActualNetSales, 0)
                 THEN (m.TargetNetSales - ISNULL(cy.ActualNetSales, 0))
                      / (ISNULL(m.TotalOperatingDays, dmd.TotalDays) - ISNULL(cy.ActualOperatingDays, 0))
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS RequiredDailyRunRate,
        -- Last Year Same Month & YoY Comparison
        CAST(ISNULL(ly.LYNetSales, ISNULL(m.LastYearNetSales, 0)) AS DECIMAL(18, 4)) AS LastYearNetSales,
        CAST(ISNULL(ly.LYGrossSales, 0) AS DECIMAL(18, 4)) AS LastYearGrossSales,
        CAST(
            CASE WHEN ISNULL(ly.LYOperatingDays, 0) > 0
                 THEN ly.LYNetSales / ly.LYOperatingDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS LastYearADS,
        CAST(
            ISNULL(cy.ActualNetSales, 0) - ISNULL(ly.LYNetSales, ISNULL(m.LastYearNetSales, 0))
            AS DECIMAL(18, 4)
        ) AS YoYVarianceNetSales,
        CAST(
            CASE WHEN ISNULL(ly.LYNetSales, ISNULL(m.LastYearNetSales, 0)) > 0
                 THEN ((ISNULL(cy.ActualNetSales, 0) - ISNULL(ly.LYNetSales, ISNULL(m.LastYearNetSales, 0)))
                       / ISNULL(ly.LYNetSales, ISNULL(m.LastYearNetSales, 0))) * 100.0
                 ELSE 0
            END AS DECIMAL(9, 2)
        ) AS YoYGrowthPct,
        -- Customer Count & Average Check (Default 470.00)
        CAST(ISNULL(m.AvgPerCheckWeekday, 470.0000) AS DECIMAL(18, 4)) AS TargetAvgCheck,
        CAST(
            CASE WHEN ISNULL(m.AvgPerCheckWeekday, 470.0000) > 0
                 THEN ISNULL(m.TargetNetSales, 0) / ISNULL(m.AvgPerCheckWeekday, 470.0000)
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS TargetCustomerCount,
        CAST(ISNULL(cy.ActualGuestCount, 0) AS DECIMAL(18, 4)) AS ActualCustomerCount,
        CAST(
            CASE WHEN ISNULL(cy.ActualGuestCount, 0) > 0
                 THEN cy.ActualNetSales / cy.ActualGuestCount
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS ActualAvgCheck
    FROM #ScopeStores s
    CROSS JOIN #DefaultMonthDays dmd
    LEFT JOIN [dbo].[tbl_sales_target_header] h
        ON h.LocationName = s.LocationName
       AND h.TargetYear = @TargetYear
       AND h.TargetQuarter = @TargetQuarter
    LEFT JOIN [dbo].[tbl_sales_target_monthly] m
        ON m.TargetID = h.TargetID
       AND m.TargetMonth = dmd.TargetMonth
    LEFT JOIN #CYMonthlyActuals cy
        ON cy.LocationName = s.LocationName
       AND cy.TargetMonth = dmd.TargetMonth
    LEFT JOIN #LYMonthlyActuals ly
        ON ly.LocationName = s.LocationName
       AND ly.TargetMonth = dmd.TargetMonth
    ORDER BY s.LocationName ASC, dmd.TargetMonth ASC;

    /* =====================================================================
       RESULT SET 2: Weekday vs. Weekend/HD Breakdown (Target vs. Actual)
       ===================================================================== */
    SELECT
        s.LocationName,
        s.OrgLocationRef,
        dmd.TargetMonth,
        dmd.MonthName,
        -- Planned Days & Split %
        ISNULL(m.WeekdayDays, dmd.WeekdayDays) AS TargetWeekdayDays,
        ISNULL(m.WeekendHdDays, dmd.WeekendHdDays) AS TargetWeekendHdDays,
        CAST(ISNULL(m.WeekdaySalesPct, 0.500000) AS DECIMAL(9, 6)) AS TargetWeekdaySalesPct,
        CAST(ISNULL(m.WeekendHdSalesPct, 0.500000) AS DECIMAL(9, 6)) AS TargetWeekendHdSalesPct,
        -- Target Monthly & Daily Sales (Weekday vs. Weekend/HD)
        CAST(ISNULL(m.TargetNetSales, 0) * ISNULL(m.WeekdaySalesPct, 0.500000) AS DECIMAL(18, 4)) AS TargetMonthlySalesWeekday,
        CAST(ISNULL(m.TargetNetSales, 0) * ISNULL(m.WeekendHdSalesPct, 0.500000) AS DECIMAL(18, 4)) AS TargetMonthlySalesWeekendHd,
        CAST(
            CASE WHEN ISNULL(m.WeekdayDays, dmd.WeekdayDays) > 0
                 THEN (ISNULL(m.TargetNetSales, 0) * ISNULL(m.WeekdaySalesPct, 0.500000)) / ISNULL(m.WeekdayDays, dmd.WeekdayDays)
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS TargetDailySalesWeekday,
        CAST(
            CASE WHEN ISNULL(m.WeekendHdDays, dmd.WeekendHdDays) > 0
                 THEN (ISNULL(m.TargetNetSales, 0) * ISNULL(m.WeekendHdSalesPct, 0.500000)) / ISNULL(m.WeekendHdDays, dmd.WeekendHdDays)
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS TargetDailySalesWeekendHd,
        -- Actual Days, Monthly & Daily Sales (Weekday vs. Weekend/HD)
        ISNULL(cy.ActualWeekdayDays, 0) AS ActualWeekdayDays,
        ISNULL(cy.ActualWeekendHdDays, 0) AS ActualWeekendHdDays,
        CAST(ISNULL(cy.ActualWeekdayNetSales, 0) AS DECIMAL(18, 4)) AS ActualMonthlySalesWeekday,
        CAST(ISNULL(cy.ActualWeekendHdNetSales, 0) AS DECIMAL(18, 4)) AS ActualMonthlySalesWeekendHd,
        CAST(
            CASE WHEN ISNULL(cy.ActualWeekdayDays, 0) > 0
                 THEN cy.ActualWeekdayNetSales / cy.ActualWeekdayDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS ActualDailySalesWeekday,
        CAST(
            CASE WHEN ISNULL(cy.ActualWeekendHdDays, 0) > 0
                 THEN cy.ActualWeekendHdNetSales / cy.ActualWeekendHdDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS ActualDailySalesWeekendHd,
        -- Actual Split %
        CAST(
            CASE WHEN ISNULL(cy.ActualNetSales, 0) > 0
                 THEN cy.ActualWeekdayNetSales / cy.ActualNetSales
                 ELSE 0
            END AS DECIMAL(9, 6)
        ) AS ActualWeekdaySalesPct,
        CAST(
            CASE WHEN ISNULL(cy.ActualNetSales, 0) > 0
                 THEN cy.ActualWeekendHdNetSales / cy.ActualNetSales
                 ELSE 0
            END AS DECIMAL(9, 6)
        ) AS ActualWeekendHdSalesPct
    FROM #ScopeStores s
    CROSS JOIN #DefaultMonthDays dmd
    LEFT JOIN [dbo].[tbl_sales_target_header] h
        ON h.LocationName = s.LocationName
       AND h.TargetYear = @TargetYear
       AND h.TargetQuarter = @TargetQuarter
    LEFT JOIN [dbo].[tbl_sales_target_monthly] m
        ON m.TargetID = h.TargetID
       AND m.TargetMonth = dmd.TargetMonth
    LEFT JOIN #CYMonthlyActuals cy
        ON cy.LocationName = s.LocationName
       AND cy.TargetMonth = dmd.TargetMonth
    ORDER BY s.LocationName ASC, dmd.TargetMonth ASC;

    /* =====================================================================
       STEP 4: Category Target vs. Actual (Sales & Qty)
       First aggregate dts_details for Current Quarter by Store, Month,
       IsWeekendOrHd, and ITEMNUMBER before mapping to categories.
       ===================================================================== */
    SELECT
        d.locationname AS LocationName,
        MONTH(d.businessdate) AS TargetMonth,
        ISNULL(cal.IsWeekendOrHd, 0) AS IsWeekendOrHd,
        d.ITEMNUMBER,
        MAX(d.ITEMNAME) AS ITEMNAME,
        MAX(d.MAJORGROUPNAME) AS MajorGroupName,
        MAX(d.FAMILYGROUPNAME) AS FamilyGroupName,
        SUM(ISNULL(d.netsales, 0)) AS NetSales,
        SUM(ISNULL(d.LINETOTAL, 0)) AS GrossSales,
        SUM(ISNULL(d.LINECOUNT, 0)) AS QtySold
    INTO #CYItemSummary
    FROM [dbo].[dts_details] d
    INNER JOIN #ScopeStores s
        ON s.LocationName = d.locationname
    LEFT JOIN #AnalyticsCalendar cal
        ON cal.CalDate = d.businessdate
    WHERE d.businessdate BETWEEN @TargetStartDate AND @TargetEndDate
      AND d.TRANSACTIONTYPE = 'Item Sale'
      AND d.ITEMNUMBER NOT IN (9801, 9802, 9803)
    GROUP BY
        d.locationname,
        MONTH(d.businessdate),
        ISNULL(cal.IsWeekendOrHd, 0),
        d.ITEMNUMBER;

    SELECT
        cis.LocationName,
        cis.TargetMonth,
        ISNULL(mapped.CategoryCode, 'DONUT') AS CategoryCode,
        SUM(CASE WHEN cis.IsWeekendOrHd = 0 THEN cis.NetSales ELSE 0 END) AS ActualWeekdayCategorySales,
        SUM(CASE WHEN cis.IsWeekendOrHd = 1 THEN cis.NetSales ELSE 0 END) AS ActualWeekendHdCategorySales,
        SUM(cis.NetSales) AS ActualCategoryNetSales,
        SUM(cis.GrossSales) AS ActualCategoryGrossSales,
        SUM(CASE WHEN cis.IsWeekendOrHd = 0 THEN cis.QtySold ELSE 0 END) AS ActualWeekdayCategoryQty,
        SUM(CASE WHEN cis.IsWeekendOrHd = 1 THEN cis.QtySold ELSE 0 END) AS ActualWeekendHdCategoryQty,
        SUM(cis.QtySold) AS ActualCategoryQty
    INTO #CYCategoryActuals
    FROM #CYItemSummary cis
    LEFT JOIN [dbo].[dts_object] obj
        ON cis.ITEMNUMBER = obj.itemnumber
    OUTER APPLY (
        SELECT TOP 1 mp.CategoryCode
        FROM [dbo].[tbl_sales_target_category_map] mp
        WHERE mp.IsActive = 1
          AND (
              (mp.MatchType = 'FAMILYGROUP'   AND ISNULL(cis.FamilyGroupName, ISNULL(obj.familygroup, '')) LIKE mp.MatchValue)
           OR (mp.MatchType = 'MAJORGROUP'    AND ISNULL(cis.MajorGroupName, ISNULL(obj.majorgroup, ''))   LIKE mp.MatchValue)
           OR (mp.MatchType = 'ITEMNAME_LIKE' AND ISNULL(cis.ITEMNAME, ISNULL(obj.itemname, ''))           LIKE mp.MatchValue)
           OR (mp.MatchType = 'ITEMNUMBER'    AND CAST(cis.ITEMNUMBER AS VARCHAR(50)) = mp.MatchValue)
          )
        ORDER BY mp.Priority ASC, mp.MapID ASC
    ) mapped
    GROUP BY
        cis.LocationName,
        cis.TargetMonth,
        ISNULL(mapped.CategoryCode, 'DONUT');

    /* =====================================================================
       RESULT SET 3: Category Target vs. Actual (Sales PHP & Qty PCS/BOXES)
       ===================================================================== */
    SELECT
        s.LocationName,
        s.OrgLocationRef,
        dmd.TargetMonth,
        dmd.MonthName,
        c.CategoryCode,
        c.CategoryName,
        c.SortOrder AS CategorySortOrder,
        ISNULL(vt.QtyUOM, c.QtyUOM) AS QtyUOM,
        CAST(ISNULL(vt.UnitPriceDivisor, c.DefaultUnitPrice) AS DECIMAL(18, 4)) AS UnitPriceDivisor,
        CAST(ISNULL(vt.WeekdayMixPct, c.DefaultMixPct) AS DECIMAL(9, 6)) AS TargetWeekdayMixPct,
        CAST(ISNULL(vt.WeekendHdMixPct, c.DefaultMixPct) AS DECIMAL(9, 6)) AS TargetWeekendHdMixPct,
        -- Monthly Category Sales: Target vs. Actual
        CAST(ISNULL(vt.MonthlyCategorySales, 0) AS DECIMAL(18, 4)) AS TargetCategorySales,
        CAST(ISNULL(ca.ActualCategoryNetSales, 0) AS DECIMAL(18, 4)) AS ActualCategoryNetSales,
        CAST(ISNULL(ca.ActualCategoryGrossSales, 0) AS DECIMAL(18, 4)) AS ActualCategoryGrossSales,
        CAST(ISNULL(ca.ActualCategoryNetSales, 0) - ISNULL(vt.MonthlyCategorySales, 0) AS DECIMAL(18, 4)) AS VarianceCategorySales,
        CAST(
            CASE WHEN ISNULL(vt.MonthlyCategorySales, 0) > 0
                 THEN (ISNULL(ca.ActualCategoryNetSales, 0) / vt.MonthlyCategorySales) * 100.0
                 ELSE 0
            END AS DECIMAL(9, 2)
        ) AS CategorySalesAchievementPct,
        -- Monthly Category Quantity (PCS / BOXES): Target vs. Actual
        CAST(ISNULL(vt.MonthlyCategoryQty, 0) AS DECIMAL(18, 4)) AS TargetCategoryQty,
        CAST(ISNULL(ca.ActualCategoryQty, 0) AS DECIMAL(18, 4)) AS ActualCategoryQty,
        CAST(ISNULL(ca.ActualCategoryQty, 0) - ISNULL(vt.MonthlyCategoryQty, 0) AS DECIMAL(18, 4)) AS VarianceCategoryQty,
        CAST(
            CASE WHEN ISNULL(vt.MonthlyCategoryQty, 0) > 0
                 THEN (ISNULL(ca.ActualCategoryQty, 0) / vt.MonthlyCategoryQty) * 100.0
                 ELSE 0
            END AS DECIMAL(9, 2)
        ) AS CategoryQtyAchievementPct,
        -- Daily Category Breakdown (Weekday vs. Weekend/HD)
        CAST(ISNULL(vt.DailyCategorySalesWeekday, 0) AS DECIMAL(18, 4)) AS DailyTargetSalesWeekday,
        CAST(ISNULL(vt.DailyCategorySalesWeekendHd, 0) AS DECIMAL(18, 4)) AS DailyTargetSalesWeekendHd,
        CAST(ISNULL(vt.DailyCategoryQtyWeekday, 0) AS DECIMAL(18, 4)) AS DailyTargetQtyWeekday,
        CAST(ISNULL(vt.DailyCategoryQtyWeekendHd, 0) AS DECIMAL(18, 4)) AS DailyTargetQtyWeekendHd,
        -- Actual Category Share % of Total Store Sales
        CAST(
            CASE WHEN ISNULL(cy.ActualNetSales, 0) > 0
                 THEN ISNULL(ca.ActualCategoryNetSales, 0) / cy.ActualNetSales
                 ELSE 0
            END AS DECIMAL(9, 6)
        ) AS ActualCategoryMixPct
    FROM #ScopeStores s
    CROSS JOIN #DefaultMonthDays dmd
    CROSS JOIN [dbo].[tbl_sales_target_category] c
    LEFT JOIN [dbo].[vw_sales_target_detailed] vt
        ON vt.LocationName = s.LocationName
       AND vt.TargetYear = @TargetYear
       AND vt.TargetQuarter = @TargetQuarter
       AND vt.TargetMonth = dmd.TargetMonth
       AND vt.CategoryCode = c.CategoryCode
    LEFT JOIN #CYCategoryActuals ca
        ON ca.LocationName = s.LocationName
       AND ca.TargetMonth = dmd.TargetMonth
       AND ca.CategoryCode = c.CategoryCode
    LEFT JOIN #CYMonthlyActuals cy
        ON cy.LocationName = s.LocationName
       AND cy.TargetMonth = dmd.TargetMonth
    WHERE c.IsActive = 1
    ORDER BY s.LocationName ASC, dmd.TargetMonth ASC, c.SortOrder ASC;

    -- Cleanup temp tables
    DROP TABLE IF EXISTS #CYCategoryActuals;
    DROP TABLE IF EXISTS #CYItemSummary;
    DROP TABLE IF EXISTS #LYMonthlyActuals;
    DROP TABLE IF EXISTS #CYMonthlyActuals;
    DROP TABLE IF EXISTS #ScopeStores;
    DROP TABLE IF EXISTS #DefaultMonthDays;
    DROP TABLE IF EXISTS #AnalyticsCalendar;
END
GO
