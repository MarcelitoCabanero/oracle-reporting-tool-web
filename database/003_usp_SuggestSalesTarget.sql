USE [OracleDB]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =========================================================================
   Stored Procedure: dbo.usp_SuggestSalesTarget
   Description:
     Generates Quarterly Sales Target suggestions per store and month:
     - Result Set 1: Calendar Breakdown (Total Days, Weekdays, Weekends/HD,
       and Holiday Remarks) for the 3 months of @TargetQuarter in @TargetYear.
     - Result Set 2: Store Monthly Sales Target Suggestions comparing:
       a) Same Quarter Last Year (e.g. 2026 vs 2025) + YoY Growth Trend
          (comparing @TargetYear-1 vs @TargetYear-2),
       b) Basis Month ADS * Target Month Operating Days,
       c) Historical Weekday vs. Weekend/HD Sales % Split,
       d) Historical Average Check vs. Default Average Check (470.00).
     - Result Set 3: Store Category Mix % (Weekday vs. Weekend/HD) and
       Historical Effective Unit Price vs. Default Unit Price Divisor.
   ========================================================================= */
CREATE OR ALTER PROCEDURE [dbo].[usp_SuggestSalesTarget]
    @TargetYear     INT,
    @TargetQuarter  TINYINT,
    @LocationName   VARCHAR(50)    = NULL,       -- NULL or 'ALL' = all active stores
    @BasisMonthDate DATE           = NULL,       -- Optional basis month (defaults to latest completed month)
    @YoYGrowthPct   DECIMAL(9, 6)  = 0.050000,   -- Default +5.0% YoY growth
    @AvgPerCheck    DECIMAL(18, 4) = 470.0000    -- Default 470.00 per check
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

    -- 1. Quarter Date Ranges (Target Year, Last Year, 2 Years Ago)
    DECLARE @StartMonth TINYINT = ((@TargetQuarter - 1) * 3) + 1;
    DECLARE @EndMonth   TINYINT = @StartMonth + 2;

    DECLARE @TargetStartDate DATE = DATEFROMPARTS(@TargetYear, @StartMonth, 1);
    DECLARE @TargetEndDate   DATE = EOMONTH(DATEFROMPARTS(@TargetYear, @EndMonth, 1));

    DECLARE @LYYear          INT  = @TargetYear - 1;
    DECLARE @LYStartDate     DATE = DATEFROMPARTS(@LYYear, @StartMonth, 1);
    DECLARE @LYEndDate       DATE = EOMONTH(DATEFROMPARTS(@LYYear, @EndMonth, 1));

    DECLARE @L2YYear         INT  = @TargetYear - 2;
    DECLARE @L2YStartDate    DATE = DATEFROMPARTS(@L2YYear, @StartMonth, 1);
    DECLARE @L2YEndDate      DATE = EOMONTH(DATEFROMPARTS(@L2YYear, @EndMonth, 1));

    -- 2. Resolve @BasisMonthDate if not supplied (most recent month with DSR data prior to TargetQuarter)
    IF @BasisMonthDate IS NULL
    BEGIN
        DECLARE @MaxDsrDate DATE;
        SELECT @MaxDsrDate = MAX(businessdate)
        FROM [dbo].[agg_daily_dsr]
        WHERE businessdate < @TargetStartDate;

        IF @MaxDsrDate IS NULL
            SELECT @MaxDsrDate = MAX(businessdate) FROM [dbo].[agg_daily_dsr];

        IF @MaxDsrDate IS NOT NULL
            SET @BasisMonthDate = DATEFROMPARTS(YEAR(@MaxDsrDate), MONTH(@MaxDsrDate), 1);
        ELSE
            SET @BasisMonthDate = DATEADD(MONTH, -1, @TargetStartDate);
    END
    ELSE
    BEGIN
        SET @BasisMonthDate = DATEFROMPARTS(YEAR(@BasisMonthDate), MONTH(@BasisMonthDate), 1);
    END

    DECLARE @BasisMonthEnd DATE = EOMONTH(@BasisMonthDate);

    /* =====================================================================
       STEP A: Build Calendar Table for Target Quarter & Last Year Quarter
       Note: ((DATEDIFF(DAY, '19000101', d) % 7) + 1) yields 1=Mon .. 6=Sat, 7=Sun
       independent of session @@DATEFIRST settings.
       ===================================================================== */
    CREATE TABLE #QuarterCalendar (
        CalDate        DATE        NOT NULL PRIMARY KEY,
        CalYear        INT         NOT NULL,
        CalMonth       TINYINT     NOT NULL,
        DayOfWeekIso   TINYINT     NOT NULL, -- 1=Mon..7=Sun
        IsWeekend      BIT         NOT NULL,
        IsHoliday      BIT         NOT NULL,
        HolidayName    VARCHAR(150) NULL,
        IsWeekendOrHd  BIT         NOT NULL
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
    INSERT INTO #QuarterCalendar (
        CalDate, CalYear, CalMonth, DayOfWeekIso, IsWeekend, IsHoliday, HolidayName, IsWeekendOrHd
    )
    SELECT
        d.CalDate,
        YEAR(d.CalDate) AS CalYear,
        MONTH(d.CalDate) AS CalMonth,
        CAST(((DATEDIFF(DAY, '19000101', d.CalDate) % 7) + 1) AS TINYINT) AS DayOfWeekIso,
        CASE WHEN ((DATEDIFF(DAY, '19000101', d.CalDate) % 7) + 1) IN (6, 7) THEN 1 ELSE 0 END AS IsWeekend,
        CASE WHEN h.HolidayID IS NOT NULL AND h.TreatAsWeekend = 1 THEN 1 ELSE 0 END AS IsHoliday,
        h.HolidayName,
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

    -- Summarize Target Quarter Calendar per Month
    CREATE TABLE #TargetMonthCalendar (
        TargetMonth          TINYINT      NOT NULL PRIMARY KEY,
        MonthName            VARCHAR(30)  NOT NULL,
        TotalDays            TINYINT      NOT NULL,
        WeekdayDays          TINYINT      NOT NULL,
        WeekendHdDays        TINYINT      NOT NULL,
        HolidayWeekdayCount  TINYINT      NOT NULL,
        HolidayWeekendCount  TINYINT      NOT NULL,
        HolidayRemarks       VARCHAR(500) NULL
    );

    INSERT INTO #TargetMonthCalendar (
        TargetMonth, MonthName, TotalDays, WeekdayDays, WeekendHdDays,
        HolidayWeekdayCount, HolidayWeekendCount, HolidayRemarks
    )
    SELECT
        c.CalMonth AS TargetMonth,
        DATENAME(MONTH, DATEFROMPARTS(@TargetYear, c.CalMonth, 1)) AS MonthName,
        COUNT(*) AS TotalDays,
        SUM(CASE WHEN c.IsWeekendOrHd = 0 THEN 1 ELSE 0 END) AS WeekdayDays,
        SUM(CASE WHEN c.IsWeekendOrHd = 1 THEN 1 ELSE 0 END) AS WeekendHdDays,
        SUM(CASE WHEN c.IsHoliday = 1 AND c.IsWeekend = 0 THEN 1 ELSE 0 END) AS HolidayWeekdayCount,
        SUM(CASE WHEN c.IsHoliday = 1 AND c.IsWeekend = 1 THEN 1 ELSE 0 END) AS HolidayWeekendCount,
        STUFF((
            SELECT ', ' + FORMAT(h2.CalDate, 'MMM d') + ' (' + h2.HolidayName + ')'
            FROM #QuarterCalendar h2
            WHERE h2.CalYear = @TargetYear
              AND h2.CalMonth = c.CalMonth
              AND h2.IsHoliday = 1
            ORDER BY h2.CalDate
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS HolidayRemarks
    FROM #QuarterCalendar c
    WHERE c.CalYear = @TargetYear
    GROUP BY c.CalMonth;

    /* =====================================================================
       RESULT SET 1: Target Quarter Calendar Breakdown
       ===================================================================== */
    SELECT
        @TargetYear AS TargetYear,
        @TargetQuarter AS TargetQuarter,
        TargetMonth,
        MonthName,
        TotalDays,
        WeekdayDays,
        WeekendHdDays,
        HolidayWeekdayCount,
        HolidayWeekendCount,
        ISNULL(HolidayRemarks, '') AS HolidayRemarks
    FROM #TargetMonthCalendar
    ORDER BY TargetMonth ASC;

    /* =====================================================================
       STEP B: Active Stores List & Store Monthly DSR Aggregations
       ===================================================================== */
    CREATE TABLE #ActiveStores (
        LocationID     INT          NULL,
        LocationName   VARCHAR(50) NOT NULL PRIMARY KEY,
        OrgLocationRef VARCHAR(50) NULL
    );

    INSERT INTO #ActiveStores (LocationID, LocationName, OrgLocationRef)
    SELECT
        MIN(LOCATIONID) AS LocationID,
        LOCATIONNAME,
        MAX(ORGLOCATIONREF) AS OrgLocationRef
    FROM [dbo].[dts_location]
    WHERE IsActive = 1
      AND access = 'Store'
      AND (@LocationName IS NULL OR LOCATIONNAME = @LocationName)
    GROUP BY LOCATIONNAME;

    -- Last Year Same Quarter Monthly Actuals (from agg_daily_dsr)
    SELECT
        dsr.locationname AS LocationName,
        MONTH(dsr.businessdate) AS CalMonth,
        SUM(ISNULL(dsr.netsales, 0)) AS LY_NetSales,
        SUM(ISNULL(dsr.gross_sales, 0)) AS LY_GrossSales,
        COUNT(DISTINCT dsr.businessdate) AS LY_OperatingDays,
        SUM(ISNULL(dsr.numguest, 0)) AS LY_GuestCount,
        SUM(CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 0 THEN ISNULL(dsr.netsales, 0) ELSE 0 END) AS LY_WeekdayNetSales,
        SUM(CASE WHEN ISNULL(cal.IsWeekendOrHd, 0) = 1 THEN ISNULL(dsr.netsales, 0) ELSE 0 END) AS LY_WeekendHdNetSales
    INTO #LYMonthlyActuals
    FROM [dbo].[agg_daily_dsr] dsr
    INNER JOIN #ActiveStores s
        ON s.LocationName = dsr.locationname
    LEFT JOIN #QuarterCalendar cal
        ON cal.CalDate = dsr.businessdate
    WHERE dsr.businessdate BETWEEN @LYStartDate AND @LYEndDate
    GROUP BY dsr.locationname, MONTH(dsr.businessdate);

    -- 2 Years Ago Same Quarter Monthly Actuals (for historical YoY growth rate calculation)
    SELECT
        dsr.locationname AS LocationName,
        MONTH(dsr.businessdate) AS CalMonth,
        SUM(ISNULL(dsr.netsales, 0)) AS L2Y_NetSales
    INTO #L2YMonthlyActuals
    FROM [dbo].[agg_daily_dsr] dsr
    INNER JOIN #ActiveStores s
        ON s.LocationName = dsr.locationname
    WHERE dsr.businessdate BETWEEN @L2YStartDate AND @L2YEndDate
    GROUP BY dsr.locationname, MONTH(dsr.businessdate);

    -- Basis Month Actuals per Store (uses @BasisMonthDate if the store has data in that month;
    -- otherwise falls back to the store's most recent completed month in agg_daily_dsr)
    ;WITH StoreBasisWindow AS (
        SELECT
            s.LocationName,
            COALESCE(
                CASE WHEN EXISTS (
                    SELECT 1 FROM [dbo].[agg_daily_dsr] d1
                    WHERE d1.locationname = s.LocationName
                      AND d1.businessdate BETWEEN @BasisMonthDate AND @BasisMonthEnd
                ) THEN @BasisMonthDate END,
                (
                    SELECT DATEFROMPARTS(YEAR(MAX(d2.businessdate)), MONTH(MAX(d2.businessdate)), 1)
                    FROM [dbo].[agg_daily_dsr] d2
                    WHERE d2.locationname = s.LocationName
                      AND d2.businessdate < @TargetStartDate
                ),
                (
                    SELECT DATEFROMPARTS(YEAR(MIN(d3.businessdate)), MONTH(MIN(d3.businessdate)), 1)
                    FROM [dbo].[agg_daily_dsr] d3
                    WHERE d3.locationname = s.LocationName
                ),
                @BasisMonthDate
            ) AS EffectiveBasisStart
        FROM #ActiveStores s
    )
    SELECT
        sbw.LocationName,
        sbw.EffectiveBasisStart AS StoreBasisMonthDate,
        EOMONTH(sbw.EffectiveBasisStart) AS StoreBasisMonthEnd,
        SUM(ISNULL(dsr.netsales, 0)) AS Basis_NetSales,
        SUM(ISNULL(dsr.gross_sales, 0)) AS Basis_GrossSales,
        COUNT(DISTINCT dsr.businessdate) AS Basis_OperatingDays,
        SUM(ISNULL(dsr.numguest, 0)) AS Basis_GuestCount,
        SUM(CASE
            WHEN ((DATEDIFF(DAY, '19000101', dsr.businessdate) % 7) + 1) IN (6, 7)
              OR h.HolidayID IS NOT NULL
            THEN 0
            ELSE ISNULL(dsr.netsales, 0)
        END) AS Basis_WeekdayNetSales,
        SUM(CASE
            WHEN ((DATEDIFF(DAY, '19000101', dsr.businessdate) % 7) + 1) IN (6, 7)
              OR h.HolidayID IS NOT NULL
            THEN ISNULL(dsr.netsales, 0)
            ELSE 0
        END) AS Basis_WeekendHdNetSales
    INTO #BasisMonthActuals
    FROM StoreBasisWindow sbw
    LEFT JOIN [dbo].[agg_daily_dsr] dsr
        ON dsr.locationname = sbw.LocationName
       AND dsr.businessdate BETWEEN sbw.EffectiveBasisStart AND EOMONTH(sbw.EffectiveBasisStart)
    LEFT JOIN [dbo].[tbl_sales_calendar_holiday] h
        ON h.HolidayDate = dsr.businessdate
       AND h.IsActive = 1
       AND h.TreatAsWeekend = 1
    GROUP BY sbw.LocationName, sbw.EffectiveBasisStart;

    /* =====================================================================
       RESULT SET 2: Store Monthly Sales Target Suggestions
       ===================================================================== */
    SELECT
        s.LocationID,
        s.LocationName,
        s.OrgLocationRef,
        @TargetYear AS TargetYear,
        @TargetQuarter AS TargetQuarter,
        tm.TargetMonth,
        tm.MonthName,
        tm.TotalDays AS TotalOperatingDays,
        tm.WeekdayDays,
        tm.WeekendHdDays,
        -- Last Year Actuals (Same Month Last Year)
        CAST(ISNULL(ly.LY_NetSales, 0) AS DECIMAL(18, 4)) AS LastYearNetSales,
        CAST(ISNULL(ly.LY_GrossSales, 0) AS DECIMAL(18, 4)) AS LastYearGrossSales,
        ISNULL(ly.LY_OperatingDays, 0) AS LastYearOperatingDays,
        CAST(
            CASE WHEN ISNULL(ly.LY_OperatingDays, 0) > 0
                 THEN ly.LY_NetSales / ly.LY_OperatingDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS LastYearADS,
        -- Historical YoY Trend % (Last Year vs 2 Years Ago)
        CAST(ISNULL(l2y.L2Y_NetSales, 0) AS DECIMAL(18, 4)) AS TwoYearsAgoNetSales,
        CAST(
            CASE WHEN ISNULL(l2y.L2Y_NetSales, 0) > 0 AND ISNULL(ly.LY_NetSales, 0) > 0
                 THEN (ly.LY_NetSales - l2y.L2Y_NetSales) / l2y.L2Y_NetSales
                 ELSE @YoYGrowthPct
            END AS DECIMAL(9, 6)
        ) AS HistoricalYoYGrowthPct,
        -- Basis Month Metrics
        ISNULL(bm.StoreBasisMonthDate, @BasisMonthDate) AS BasisMonthDate,
        CAST(ISNULL(bm.Basis_NetSales, 0) AS DECIMAL(18, 4)) AS BasisMonthNetSales,
        ISNULL(bm.Basis_OperatingDays, 0) AS BasisMonthOperatingDays,
        CAST(
            CASE WHEN ISNULL(bm.Basis_OperatingDays, 0) > 0
                 THEN bm.Basis_NetSales / bm.Basis_OperatingDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS BasisMonthADS,
        -- Suggested Targets:
        -- 1) YoY Trend Suggestion = LY_NetSales * (1 + @YoYGrowthPct)
        CAST(
            CASE WHEN ISNULL(ly.LY_NetSales, 0) > 0
                 THEN ly.LY_NetSales * (1.0 + @YoYGrowthPct)
                 WHEN ISNULL(bm.Basis_OperatingDays, 0) > 0
                 THEN (bm.Basis_NetSales / bm.Basis_OperatingDays) * tm.TotalDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS SuggestedTargetYoY,
        -- 2) Basis Month ADS Suggestion = BasisMonthADS * TotalOperatingDays
        CAST(
            CASE WHEN ISNULL(bm.Basis_OperatingDays, 0) > 0
                 THEN (bm.Basis_NetSales / bm.Basis_OperatingDays) * tm.TotalDays
                 WHEN ISNULL(ly.LY_NetSales, 0) > 0
                 THEN ly.LY_NetSales * (1.0 + @YoYGrowthPct)
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS SuggestedTargetBasisADS,
        -- Recommended Primary Suggestion (YoY if LY exists, else Basis Month ADS)
        CASE WHEN ISNULL(ly.LY_NetSales, 0) > 0 THEN 'YOY_TREND' ELSE 'BASIS_ADS' END AS RecommendedBasis,
        CAST(
            CASE WHEN ISNULL(ly.LY_NetSales, 0) > 0
                 THEN ly.LY_NetSales * (1.0 + @YoYGrowthPct)
                 WHEN ISNULL(bm.Basis_OperatingDays, 0) > 0
                 THEN (bm.Basis_NetSales / bm.Basis_OperatingDays) * tm.TotalDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS SuggestedNetSales,
        -- Suggested Weekday vs. Weekend/HD Sales % Split
        CAST(
            CASE WHEN ISNULL(ly.LY_NetSales, 0) > 0
                 THEN ly.LY_WeekdayNetSales / ly.LY_NetSales
                 WHEN ISNULL(bm.Basis_NetSales, 0) > 0
                 THEN bm.Basis_WeekdayNetSales / bm.Basis_NetSales
                 ELSE CAST(tm.WeekdayDays AS DECIMAL(9, 6)) / NULLIF(tm.TotalDays, 0)
            END AS DECIMAL(9, 6)
        ) AS SuggestedWeekdaySalesPct,
        CAST(
            CASE WHEN ISNULL(ly.LY_NetSales, 0) > 0
                 THEN ly.LY_WeekendHdNetSales / ly.LY_NetSales
                 WHEN ISNULL(bm.Basis_NetSales, 0) > 0
                 THEN bm.Basis_WeekendHdNetSales / bm.Basis_NetSales
                 ELSE CAST(tm.WeekendHdDays AS DECIMAL(9, 6)) / NULLIF(tm.TotalDays, 0)
            END AS DECIMAL(9, 6)
        ) AS SuggestedWeekendHdSalesPct,
        -- Historical Average Check vs. Default 470.00
        CAST(
            CASE WHEN ISNULL(ly.LY_GuestCount, 0) > 0
                 THEN ly.LY_NetSales / ly.LY_GuestCount
                 WHEN ISNULL(bm.Basis_GuestCount, 0) > 0
                 THEN bm.Basis_NetSales / bm.Basis_GuestCount
                 ELSE @AvgPerCheck
            END AS DECIMAL(18, 4)
        ) AS HistoricalAvgPerCheck,
        @AvgPerCheck AS DefaultAvgPerCheck
    FROM #ActiveStores s
    CROSS JOIN #TargetMonthCalendar tm
    LEFT JOIN #LYMonthlyActuals ly
        ON ly.LocationName = s.LocationName
       AND ly.CalMonth = tm.TargetMonth
    LEFT JOIN #L2YMonthlyActuals l2y
        ON l2y.LocationName = s.LocationName
       AND l2y.CalMonth = tm.TargetMonth
    LEFT JOIN #BasisMonthActuals bm
        ON bm.LocationName = s.LocationName
    ORDER BY s.LocationName ASC, tm.TargetMonth ASC;

    /* =====================================================================
       STEP C: Category Mix % Suggestions (from dbo.dts_details + dbo.dts_object)
       First aggregate dts_details by LocationName, IsWeekendOrHd, ITEMNUMBER, ITEMNAME
       for Last Year Same Quarter so pattern matching runs on a small summary set.
       ===================================================================== */
    SELECT
        d.locationname AS LocationName,
        ISNULL(cal.IsWeekendOrHd, 0) AS IsWeekendOrHd,
        d.ITEMNUMBER,
        MAX(d.ITEMNAME) AS ITEMNAME,
        MAX(d.MAJORGROUPNAME) AS MajorGroupName,
        MAX(d.FAMILYGROUPNAME) AS FamilyGroupName,
        SUM(ISNULL(d.netsales, 0)) AS NetSales,
        SUM(ISNULL(d.LINETOTAL, 0)) AS GrossSales,
        SUM(ISNULL(d.LINECOUNT, 0)) AS QtySold
    INTO #ItemLevelSummary
    FROM [dbo].[dts_details] d
    INNER JOIN #ActiveStores s
        ON s.LocationName = d.locationname
    LEFT JOIN #QuarterCalendar cal
        ON cal.CalDate = d.businessdate
    WHERE d.businessdate BETWEEN @LYStartDate AND @LYEndDate
      AND d.TRANSACTIONTYPE = 'Item Sale'
      AND d.ITEMNUMBER NOT IN (9801, 9802, 9803)
    GROUP BY
        d.locationname,
        ISNULL(cal.IsWeekendOrHd, 0),
        d.ITEMNUMBER;

    -- For new stores with no Last Year Same Quarter data, fallback to Basis Month transactions
    INSERT INTO #ItemLevelSummary (
        LocationName, IsWeekendOrHd, ITEMNUMBER, ITEMNAME,
        MajorGroupName, FamilyGroupName, NetSales, GrossSales, QtySold
    )
    SELECT
        d.locationname AS LocationName,
        CASE
            WHEN ((DATEDIFF(DAY, '19000101', d.businessdate) % 7) + 1) IN (6, 7) THEN 1
            WHEN h.HolidayID IS NOT NULL THEN 1
            ELSE 0
        END AS IsWeekendOrHd,
        d.ITEMNUMBER,
        MAX(d.ITEMNAME) AS ITEMNAME,
        MAX(d.MAJORGROUPNAME) AS MajorGroupName,
        MAX(d.FAMILYGROUPNAME) AS FamilyGroupName,
        SUM(ISNULL(d.netsales, 0)) AS NetSales,
        SUM(ISNULL(d.LINETOTAL, 0)) AS GrossSales,
        SUM(ISNULL(d.LINECOUNT, 0)) AS QtySold
    FROM [dbo].[dts_details] d
    INNER JOIN #BasisMonthActuals bm
        ON bm.LocationName = d.locationname
       AND d.businessdate BETWEEN bm.StoreBasisMonthDate AND bm.StoreBasisMonthEnd
    LEFT JOIN [dbo].[tbl_sales_calendar_holiday] h
        ON h.HolidayDate = d.businessdate
       AND h.IsActive = 1
       AND h.TreatAsWeekend = 1
    WHERE d.TRANSACTIONTYPE = 'Item Sale'
      AND d.ITEMNUMBER NOT IN (9801, 9802, 9803)
      AND NOT EXISTS (
          SELECT 1 FROM #ItemLevelSummary existing
          WHERE existing.LocationName = d.locationname
      )
    GROUP BY
        d.locationname,
        CASE
            WHEN ((DATEDIFF(DAY, '19000101', d.businessdate) % 7) + 1) IN (6, 7) THEN 1
            WHEN h.HolidayID IS NOT NULL THEN 1
            ELSE 0
        END,
        d.ITEMNUMBER;

    -- Map each summarized item to Target Category via dbo.dts_object & tbl_sales_target_category_map
    SELECT
        ils.LocationName,
        ISNULL(mapped.CategoryCode, 'DONUT') AS CategoryCode,
        SUM(CASE WHEN ils.IsWeekendOrHd = 0 THEN ils.NetSales ELSE 0 END) AS WeekdayNetSales,
        SUM(CASE WHEN ils.IsWeekendOrHd = 1 THEN ils.NetSales ELSE 0 END) AS WeekendHdNetSales,
        SUM(ils.NetSales) AS TotalCategoryNetSales,
        SUM(ils.GrossSales) AS TotalCategoryGrossSales,
        SUM(ils.QtySold) AS TotalCategoryQty
    INTO #StoreCategoryActuals
    FROM #ItemLevelSummary ils
    LEFT JOIN [dbo].[dts_object] obj
        ON ils.ITEMNUMBER = obj.itemnumber
    OUTER APPLY (
        SELECT TOP 1 m.CategoryCode
        FROM [dbo].[tbl_sales_target_category_map] m
        WHERE m.IsActive = 1
          AND (
              (m.MatchType = 'FAMILYGROUP'   AND ISNULL(ils.FamilyGroupName, ISNULL(obj.familygroup, '')) LIKE m.MatchValue)
           OR (m.MatchType = 'MAJORGROUP'    AND ISNULL(ils.MajorGroupName, ISNULL(obj.majorgroup, ''))   LIKE m.MatchValue)
           OR (m.MatchType = 'ITEMNAME_LIKE' AND ISNULL(ils.ITEMNAME, ISNULL(obj.itemname, ''))           LIKE m.MatchValue)
           OR (m.MatchType = 'ITEMNUMBER'    AND CAST(ils.ITEMNUMBER AS VARCHAR(50)) = m.MatchValue)
          )
        ORDER BY m.Priority ASC, m.MapID ASC
    ) mapped
    GROUP BY
        ils.LocationName,
        ISNULL(mapped.CategoryCode, 'DONUT');

    -- Totals per store for % mix denominator
    SELECT
        LocationName,
        SUM(WeekdayNetSales) AS StoreWeekdayTotal,
        SUM(WeekendHdNetSales) AS StoreWeekendHdTotal,
        SUM(TotalCategoryNetSales) AS StoreTotalNetSales
    INTO #StoreCategoryTotals
    FROM #StoreCategoryActuals
    GROUP BY LocationName;

    /* =====================================================================
       RESULT SET 3: Store Category Mix & Unit Price Divisor Suggestions
       ===================================================================== */
    SELECT
        s.LocationName,
        s.OrgLocationRef,
        c.CategoryID,
        c.CategoryCode,
        c.CategoryName,
        c.QtyUOM,
        c.SortOrder,
        c.DefaultUnitPrice,
        c.DefaultMixPct,
        -- Historical Actuals from Same Quarter Last Year
        CAST(ISNULL(sca.TotalCategoryNetSales, 0) AS DECIMAL(18, 4)) AS LastYearCategoryNetSales,
        CAST(ISNULL(sca.TotalCategoryGrossSales, 0) AS DECIMAL(18, 4)) AS LastYearCategoryGrossSales,
        CAST(ISNULL(sca.TotalCategoryQty, 0) AS DECIMAL(18, 4)) AS LastYearCategoryQty,
        -- Historical Effective Unit Price (NetSales / Qty)
        CAST(
            CASE WHEN ISNULL(sca.TotalCategoryQty, 0) > 0
                 THEN sca.TotalCategoryNetSales / sca.TotalCategoryQty
                 ELSE c.DefaultUnitPrice
            END AS DECIMAL(18, 4)
        ) AS HistoricalEffectiveUnitPrice,
        -- Suggested Weekday Mix % (falls back to DefaultMixPct if store has no history)
        CAST(
            CASE WHEN ISNULL(sct.StoreWeekdayTotal, 0) > 0
                 THEN ISNULL(sca.WeekdayNetSales, 0) / sct.StoreWeekdayTotal
                 ELSE c.DefaultMixPct
            END AS DECIMAL(9, 6)
        ) AS SuggestedWeekdayMixPct,
        -- Suggested Weekend/HD Mix % (falls back to DefaultMixPct if store has no history)
        CAST(
            CASE WHEN ISNULL(sct.StoreWeekendHdTotal, 0) > 0
                 THEN ISNULL(sca.WeekendHdNetSales, 0) / sct.StoreWeekendHdTotal
                 ELSE c.DefaultMixPct
            END AS DECIMAL(9, 6)
        ) AS SuggestedWeekendHdMixPct,
        -- Overall Historical Mix %
        CAST(
            CASE WHEN ISNULL(sct.StoreTotalNetSales, 0) > 0
                 THEN ISNULL(sca.TotalCategoryNetSales, 0) / sct.StoreTotalNetSales
                 ELSE c.DefaultMixPct
            END AS DECIMAL(9, 6)
        ) AS HistoricalOverallMixPct
    FROM #ActiveStores s
    CROSS JOIN [dbo].[tbl_sales_target_category] c
    LEFT JOIN #StoreCategoryActuals sca
        ON sca.LocationName = s.LocationName
       AND sca.CategoryCode = c.CategoryCode
    LEFT JOIN #StoreCategoryTotals sct
        ON sct.LocationName = s.LocationName
    WHERE c.IsActive = 1
    ORDER BY s.LocationName ASC, c.SortOrder ASC;

    -- Cleanup temp tables
    DROP TABLE IF EXISTS #StoreCategoryTotals;
    DROP TABLE IF EXISTS #StoreCategoryActuals;
    DROP TABLE IF EXISTS #ItemLevelSummary;
    DROP TABLE IF EXISTS #BasisMonthActuals;
    DROP TABLE IF EXISTS #L2YMonthlyActuals;
    DROP TABLE IF EXISTS #LYMonthlyActuals;
    DROP TABLE IF EXISTS #ActiveStores;
    DROP TABLE IF EXISTS #TargetMonthCalendar;
    DROP TABLE IF EXISTS #QuarterCalendar;
END
GO
