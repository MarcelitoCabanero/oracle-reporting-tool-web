USE [OracleDB]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =========================================================================
   1. Target Category Master Table (dbo.tbl_sales_target_category)
   Stores the product categories used in Quarterly Sales Target setting,
   including default unit price divisors, UOM (PCS / BOXES), and default % share.
   ========================================================================= */
IF OBJECT_ID('dbo.tbl_sales_target_category', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_sales_target_category](
        [CategoryID] [int] IDENTITY(1,1) NOT NULL,
        [CategoryCode] [varchar](30) NOT NULL,
        [CategoryName] [varchar](100) NOT NULL,
        [QtyUOM] [varchar](20) NOT NULL CONSTRAINT [DF_st_category_QtyUOM] DEFAULT ('PCS'),
        [DefaultUnitPrice] [decimal](18, 4) NOT NULL,
        [DefaultMixPct] [decimal](9, 6) NOT NULL CONSTRAINT [DF_st_category_DefaultMixPct] DEFAULT ((0)),
        [SortOrder] [int] NOT NULL CONSTRAINT [DF_st_category_SortOrder] DEFAULT ((1)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_st_category_IsActive] DEFAULT ((1)),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_st_category_CreatedDate] DEFAULT (GETDATE()),
        [ModifiedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_st_category_ModifiedDate] DEFAULT (GETDATE()),
        CONSTRAINT [PK_tbl_sales_target_category] PRIMARY KEY CLUSTERED ([CategoryID] ASC),
        CONSTRAINT [UQ_tbl_sales_target_category_Code] UNIQUE NONCLUSTERED ([CategoryCode] ASC)
    );
END
GO

-- Seed Default Categories (matching the Excel Target Template)
MERGE INTO [dbo].[tbl_sales_target_category] AS target
USING (
    VALUES
        ('DONUT',        'DONUT',          'PCS',   26.0000,  0.600000, 1, 1),
        ('JCLUB',        'J.CLUB',         'PCS',   45.0000,  0.020000, 2, 1),
        ('JPOPS',        'J.POPS',         'BOXES', 260.0000, 0.090000, 3, 1),
        ('BEVERAGE',     'BEVERAGE',       'PCS',   119.0000, 0.210000, 4, 1),
        ('JCOOL',        'J.COOL',         'PCS',   190.0000, 0.020000, 5, 1),
        ('PASTRY_PASTA', 'PASTRY PASTA',   'PCS',   340.0000, 0.060000, 6, 1),
        ('MERCHANDISE',  'MERCHANDISE',    'PCS',   340.0000, 0.000000, 7, 1)
) AS source ([CategoryCode], [CategoryName], [QtyUOM], [DefaultUnitPrice], [DefaultMixPct], [SortOrder], [IsActive])
ON target.[CategoryCode] = source.[CategoryCode]
WHEN NOT MATCHED THEN
    INSERT ([CategoryCode], [CategoryName], [QtyUOM], [DefaultUnitPrice], [DefaultMixPct], [SortOrder], [IsActive])
    VALUES (source.[CategoryCode], source.[CategoryName], source.[QtyUOM], source.[DefaultUnitPrice], source.[DefaultMixPct], source.[SortOrder], source.[IsActive]);
GO

/* =========================================================================
   2. Target Category Mapping Table (dbo.tbl_sales_target_category_map)
   Connects Target Categories to dbo.dts_object and dbo.dts_details
   via MajorGroup, FamilyGroup, or ItemName/ItemNumber patterns.
   Lower Priority number = evaluated first.
   ========================================================================= */
IF OBJECT_ID('dbo.tbl_sales_target_category_map', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_sales_target_category_map](
        [MapID] [int] IDENTITY(1,1) NOT NULL,
        [CategoryCode] [varchar](30) NOT NULL,
        [MatchType] [varchar](30) NOT NULL, -- 'FAMILYGROUP', 'MAJORGROUP', 'ITEMNAME_LIKE', 'ITEMNUMBER'
        [MatchValue] [varchar](100) NOT NULL,
        [Priority] [int] NOT NULL CONSTRAINT [DF_st_catmap_Priority] DEFAULT ((100)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_st_catmap_IsActive] DEFAULT ((1)),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_st_catmap_CreatedDate] DEFAULT (GETDATE()),
        CONSTRAINT [PK_tbl_sales_target_category_map] PRIMARY KEY CLUSTERED ([MapID] ASC),
        CONSTRAINT [FK_st_catmap_CategoryCode] FOREIGN KEY ([CategoryCode])
            REFERENCES [dbo].[tbl_sales_target_category] ([CategoryCode])
    );

    CREATE NONCLUSTERED INDEX [IX_tbl_sales_target_category_map_Lookup]
        ON [dbo].[tbl_sales_target_category_map] ([IsActive] ASC, [Priority] ASC)
        INCLUDE ([CategoryCode], [MatchType], [MatchValue]);
END
GO

-- Seed Default Category Mappings to dts_object / dts_details
DELETE FROM [dbo].[tbl_sales_target_category_map];

INSERT INTO [dbo].[tbl_sales_target_category_map] ([CategoryCode], [MatchType], [MatchValue], [Priority], [IsActive])
VALUES
    -- 1. J.POPS (inside Donut MajorGroup with FamilyGroup = 'JPops')
    ('JPOPS',        'FAMILYGROUP',   '%POP%',          10, 1),
    ('JPOPS',        'ITEMNAME_LIKE', '%J.POP%',        11, 1),
    ('JPOPS',        'ITEMNAME_LIKE', '%JPOP%',         12, 1),
    -- 2. J.CLUB (MajorGroup = 'JClub', FamilyGroup = 'J.Club' / 'Promo J.Club')
    ('JCLUB',        'MAJORGROUP',    '%JCLUB%',        20, 1),
    ('JCLUB',        'FAMILYGROUP',   '%CLUB%',         21, 1),
    ('JCLUB',        'ITEMNAME_LIKE', '%J.CLUB%',       22, 1),
    ('JCLUB',        'ITEMNAME_LIKE', '%JCLUB%',        23, 1),
    -- 3. J.COOL (FamilyGroup = 'JCool' / 'Topping JCool' / 'JCool Promo')
    ('JCOOL',        'FAMILYGROUP',   '%COOL%',         30, 1),
    ('JCOOL',        'FAMILYGROUP',   '%YOGURT%',       31, 1),
    ('JCOOL',        'MAJORGROUP',    '%COOL%',         32, 1),
    ('JCOOL',        'ITEMNAME_LIKE', '%J.COOL%',       33, 1),
    -- 4. PASTRY PASTA (MajorGroup = 'Pastries' / 'Food', FamilyGroup = 'Pasta', 'Pastries', 'Cookies', 'Pandesal', 'Turnover', 'FOOD Promo')
    ('PASTRY_PASTA', 'MAJORGROUP',    '%PASTR%',        40, 1),
    ('PASTRY_PASTA', 'FAMILYGROUP',   '%PASTR%',        41, 1),
    ('PASTRY_PASTA', 'FAMILYGROUP',   '%PASTA%',        42, 1),
    ('PASTRY_PASTA', 'FAMILYGROUP',   '%BAKERY%',       43, 1),
    ('PASTRY_PASTA', 'FAMILYGROUP',   '%TURNOVER%',     44, 1),
    ('PASTRY_PASTA', 'MAJORGROUP',    'Food',           45, 1),
    ('PASTRY_PASTA', 'FAMILYGROUP',   'FOOD Promo',     46, 1),
    -- 5. MERCHANDISE (MajorGroup = 'Merchandise', FamilyGroup = 'Hardware' / 'Merchandise')
    ('MERCHANDISE',  'MAJORGROUP',    '%MERCH%',        50, 1),
    ('MERCHANDISE',  'FAMILYGROUP',   '%MERCH%',        51, 1),
    ('MERCHANDISE',  'FAMILYGROUP',   'Hardware',       52, 1),
    -- 6. BEVERAGE (MajorGroup = 'Beverage' / 'Drip Coffee' / 'Brew Box', FamilyGroup = 'Beverage Promo' / 'Topping Bev.')
    ('BEVERAGE',     'MAJORGROUP',    '%BEVERAGE%',     60, 1),
    ('BEVERAGE',     'MAJORGROUP',    '%COFFEE%',       61, 1),
    ('BEVERAGE',     'MAJORGROUP',    '%BREW BOX%',     62, 1),
    ('BEVERAGE',     'MAJORGROUP',    '%DRINK%',        63, 1),
    ('BEVERAGE',     'FAMILYGROUP',   '%BEV%',          64, 1),
    ('BEVERAGE',     'FAMILYGROUP',   '%COFFEE%',       65, 1),
    -- 7. DONUT (MajorGroup = 'Donut', FamilyGroup = 'Donut' / 'Premium Donut' / 'Free Donut' / 'Donut Promo')
    ('DONUT',        'MAJORGROUP',    '%DONUT%',        70, 1),
    ('DONUT',        'FAMILYGROUP',   '%DONUT%',        71, 1);
GO

/* =========================================================================
   3. Sales Calendar & Holiday Table (dbo.tbl_sales_calendar_holiday)
   Stores holidays so that any month's Weekday vs. Weekend+Holiday (WEEKENDS/HD)
   day counts are automatically computed (matching the "CALENDAR" tab in Excel).
   ========================================================================= */
IF OBJECT_ID('dbo.tbl_sales_calendar_holiday', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_sales_calendar_holiday](
        [HolidayID] [int] IDENTITY(1,1) NOT NULL,
        [HolidayDate] [date] NOT NULL,
        [HolidayName] [varchar](150) NOT NULL,
        [HolidayType] [varchar](30) NOT NULL CONSTRAINT [DF_st_holiday_Type] DEFAULT ('REGULAR'), -- 'REGULAR', 'SPECIAL', 'COMPANY'
        [TreatAsWeekend] [bit] NOT NULL CONSTRAINT [DF_st_holiday_TreatAsWeekend] DEFAULT ((1)),
        [Remarks] [varchar](255) NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_st_holiday_IsActive] DEFAULT ((1)),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_st_holiday_CreatedDate] DEFAULT (GETDATE()),
        CONSTRAINT [PK_tbl_sales_calendar_holiday] PRIMARY KEY CLUSTERED ([HolidayID] ASC),
        CONSTRAINT [UQ_tbl_sales_calendar_holiday_Date] UNIQUE NONCLUSTERED ([HolidayDate] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_tbl_sales_calendar_holiday_Date]
        ON [dbo].[tbl_sales_calendar_holiday] ([HolidayDate] ASC, [IsActive] ASC)
        INCLUDE ([HolidayName], [HolidayType], [TreatAsWeekend]);
END
GO

-- Seed common Philippine Holidays for 2025 & 2026
MERGE INTO [dbo].[tbl_sales_calendar_holiday] AS target
USING (
    VALUES
        ('2025-01-01', 'New Year''s Day',             'REGULAR', 1, 'Jan 1'),
        ('2025-01-29', 'Chinese New Year',            'SPECIAL', 1, 'Jan 29'),
        ('2025-04-09', 'Araw ng Kagitingan',          'REGULAR', 1, 'Apr 9'),
        ('2025-04-17', 'Maundy Thursday',             'REGULAR', 1, 'Holy Week'),
        ('2025-04-18', 'Good Friday',                 'REGULAR', 1, 'Holy Week'),
        ('2025-04-19', 'Black Saturday',              'SPECIAL', 1, 'Holy Week'),
        ('2025-05-01', 'Labor Day',                   'REGULAR', 1, 'May 1'),
        ('2025-06-12', 'Independence Day',            'REGULAR', 1, 'Jun 12'),
        ('2025-08-21', 'Ninoy Aquino Day',            'SPECIAL', 1, 'Aug 21'),
        ('2025-08-25', 'National Heroes Day',         'REGULAR', 1, 'Aug 25'),
        ('2025-11-01', 'All Saints'' Day',            'SPECIAL', 1, 'Nov 1'),
        ('2025-11-30', 'Bonifacio Day',               'REGULAR', 1, 'Nov 30'),
        ('2025-12-08', 'Feast of Immaculate Conception','SPECIAL', 1, 'Dec 8'),
        ('2025-12-24', 'Christmas Eve',               'SPECIAL', 1, 'Dec 24'),
        ('2025-12-25', 'Christmas Day',               'REGULAR', 1, 'Dec 25'),
        ('2025-12-30', 'Rizal Day',                   'REGULAR', 1, 'Dec 30'),
        ('2025-12-31', 'Last Day of the Year',        'SPECIAL', 1, 'Dec 31'),
        ('2026-01-01', 'New Year''s Day',             'REGULAR', 1, 'Jan 1'),
        ('2026-02-17', 'Chinese New Year',            'SPECIAL', 1, 'Feb 17'),
        ('2026-04-02', 'Maundy Thursday',             'REGULAR', 1, 'Holy Week'),
        ('2026-04-03', 'Good Friday',                 'REGULAR', 1, 'Holy Week'),
        ('2026-04-04', 'Black Saturday',              'SPECIAL', 1, 'Holy Week'),
        ('2026-04-09', 'Araw ng Kagitingan',          'REGULAR', 1, 'Apr 9'),
        ('2026-05-01', 'Labor Day',                   'REGULAR', 1, 'May 1'),
        ('2026-06-12', 'Independence Day',            'REGULAR', 1, 'Jun 12'),
        ('2026-08-21', 'Ninoy Aquino Day',            'SPECIAL', 1, 'Aug 21'),
        ('2026-08-31', 'National Heroes Day',         'REGULAR', 1, 'Aug 31'),
        ('2026-11-01', 'All Saints'' Day',            'SPECIAL', 1, 'Nov 1'),
        ('2026-11-30', 'Bonifacio Day',               'REGULAR', 1, 'Nov 30'),
        ('2026-12-08', 'Feast of Immaculate Conception','SPECIAL', 1, 'Dec 8'),
        ('2026-12-24', 'Christmas Eve',               'SPECIAL', 1, 'Dec 24'),
        ('2026-12-25', 'Christmas Day',               'REGULAR', 1, 'Dec 25'),
        ('2026-12-30', 'Rizal Day',                   'REGULAR', 1, 'Dec 30'),
        ('2026-12-31', 'Last Day of the Year',        'SPECIAL', 1, 'Dec 31')
) AS source ([HolidayDate], [HolidayName], [HolidayType], [TreatAsWeekend], [Remarks])
ON target.[HolidayDate] = CAST(source.[HolidayDate] AS DATE)
WHEN NOT MATCHED THEN
    INSERT ([HolidayDate], [HolidayName], [HolidayType], [TreatAsWeekend], [Remarks])
    VALUES (CAST(source.[HolidayDate] AS DATE), source.[HolidayName], source.[HolidayType], source.[TreatAsWeekend], source.[Remarks]);
GO

/* =========================================================================
   4. Quarterly Sales Target Header Table (dbo.tbl_sales_target_header)
   One record per Store + TargetYear + TargetQuarter.
   Links to dbo.dts_location via LocationID / LocationName / OrgLocationRef.
   ========================================================================= */
IF OBJECT_ID('dbo.tbl_sales_target_header', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_sales_target_header](
        [TargetID] [int] IDENTITY(1,1) NOT NULL,
        [TargetYear] [int] NOT NULL,
        [TargetQuarter] [tinyint] NOT NULL, -- 1, 2, 3, 4
        [LocationID] [int] NULL,            -- Links to dbo.dts_location.LOCATIONID
        [LocationName] [varchar](50) NOT NULL, -- Links to dbo.dts_location.LOCATIONNAME
        [OrgLocationRef] [varchar](50) NULL,   -- Store code e.g. ATC, DCT, SML
        [SuggestionBasis] [varchar](30) NOT NULL CONSTRAINT [DF_st_header_SuggestionBasis] DEFAULT ('YOY_TREND'),
        [BasisMonthDate] [date] NULL,          -- Optional basis month e.g. '2026-01-01'
        [YoYGrowthTargetPct] [decimal](9, 6) NOT NULL CONSTRAINT [DF_st_header_YoYGrowth] DEFAULT ((0.050000)),
        [AvgPerCheckDefault] [decimal](18, 4) NOT NULL CONSTRAINT [DF_st_header_AvgPerCheck] DEFAULT ((470.0000)),
        [Status] [varchar](20) NOT NULL CONSTRAINT [DF_st_header_Status] DEFAULT ('APPROVED'), -- 'DRAFT', 'APPROVED', 'LOCKED'
        [Remarks] [varchar](500) NULL,
        [CreatedBy] [varchar](50) NULL,
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_st_header_CreatedDate] DEFAULT (GETDATE()),
        [ModifiedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_st_header_ModifiedDate] DEFAULT (GETDATE()),
        CONSTRAINT [PK_tbl_sales_target_header] PRIMARY KEY CLUSTERED ([TargetID] ASC),
        CONSTRAINT [UQ_tbl_sales_target_header_StoreQtr] UNIQUE NONCLUSTERED ([TargetYear] ASC, [TargetQuarter] ASC, [LocationName] ASC),
        CONSTRAINT [CK_tbl_sales_target_header_Quarter] CHECK ([TargetQuarter] IN (1, 2, 3, 4))
    );

    CREATE NONCLUSTERED INDEX [IX_tbl_sales_target_header_YearQtr]
        ON [dbo].[tbl_sales_target_header] ([TargetYear] ASC, [TargetQuarter] ASC)
        INCLUDE ([LocationID], [LocationName], [OrgLocationRef], [AvgPerCheckDefault], [Status]);
END
GO

/* =========================================================================
   5. Monthly Sales Target Breakdown Table (dbo.tbl_sales_target_monthly)
   3 rows per TargetID (the 3 months of the quarter).
   Stores Monthly Target Sales, Weekday vs. Weekend/HD day counts & % split,
   and Average Per Check (default 470.00).
   ========================================================================= */
IF OBJECT_ID('dbo.tbl_sales_target_monthly', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_sales_target_monthly](
        [MonthlyTargetID] [int] IDENTITY(1,1) NOT NULL,
        [TargetID] [int] NOT NULL,
        [TargetMonth] [tinyint] NOT NULL, -- 1..12
        [TargetNetSales] [decimal](18, 4) NOT NULL CONSTRAINT [DF_st_monthly_TargetNetSales] DEFAULT ((0)),
        [SuggestedNetSales] [decimal](18, 4) NULL,
        [LastYearNetSales] [decimal](18, 4) NULL,
        [BasisMonthADS] [decimal](18, 4) NULL,
        [SeasonalAdjPct] [decimal](9, 6) NOT NULL CONSTRAINT [DF_st_monthly_SeasonalAdjPct] DEFAULT ((0)),
        [LessHalfDays] [decimal](9, 2) NOT NULL CONSTRAINT [DF_st_monthly_LessHalfDays] DEFAULT ((0)),
        [TotalOperatingDays] [tinyint] NOT NULL,
        [WeekdayDays] [tinyint] NOT NULL,
        [WeekendHdDays] [tinyint] NOT NULL,
        [WeekdaySalesPct] [decimal](9, 6) NOT NULL CONSTRAINT [DF_st_monthly_WeekdaySalesPct] DEFAULT ((0.500000)),
        [WeekendHdSalesPct] [decimal](9, 6) NOT NULL CONSTRAINT [DF_st_monthly_WeekendHdSalesPct] DEFAULT ((0.500000)),
        [AvgPerCheckWeekday] [decimal](18, 4) NOT NULL CONSTRAINT [DF_st_monthly_AvgCheckWD] DEFAULT ((470.0000)),
        [AvgPerCheckWeekendHd] [decimal](18, 4) NOT NULL CONSTRAINT [DF_st_monthly_AvgCheckWE] DEFAULT ((470.0000)),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_st_monthly_CreatedDate] DEFAULT (GETDATE()),
        [ModifiedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_st_monthly_ModifiedDate] DEFAULT (GETDATE()),
        CONSTRAINT [PK_tbl_sales_target_monthly] PRIMARY KEY CLUSTERED ([MonthlyTargetID] ASC),
        CONSTRAINT [UQ_tbl_sales_target_monthly_Month] UNIQUE NONCLUSTERED ([TargetID] ASC, [TargetMonth] ASC),
        CONSTRAINT [FK_tbl_sales_target_monthly_Header] FOREIGN KEY ([TargetID])
            REFERENCES [dbo].[tbl_sales_target_header] ([TargetID]) ON DELETE CASCADE,
        CONSTRAINT [CK_tbl_sales_target_monthly_Month] CHECK ([TargetMonth] BETWEEN 1 AND 12)
    );

    CREATE NONCLUSTERED INDEX [IX_tbl_sales_target_monthly_TargetID]
        ON [dbo].[tbl_sales_target_monthly] ([TargetID] ASC, [TargetMonth] ASC)
        INCLUDE ([TargetNetSales], [TotalOperatingDays], [WeekdayDays], [WeekendHdDays], [WeekdaySalesPct], [WeekendHdSalesPct], [AvgPerCheckWeekday], [AvgPerCheckWeekendHd]);
END
GO

/* =========================================================================
   6. Monthly Category Mix & Price Snapshot Table (dbo.tbl_sales_target_category_mix)
   Stores the PER CATEGORY % (e.g. Donut 60%, J.Club 2%, J.Pops 9%, Beverage 21%,
   J.Cool 2%, Pastry/Pasta 6%) and unit price divisor per month so that
   both Target Category Sales and Target Category Qty (PCS/BOXES) are preserved.
   ========================================================================= */
IF OBJECT_ID('dbo.tbl_sales_target_category_mix', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[tbl_sales_target_category_mix](
        [MixID] [int] IDENTITY(1,1) NOT NULL,
        [MonthlyTargetID] [int] NOT NULL,
        [CategoryCode] [varchar](30) NOT NULL,
        [WeekdayMixPct] [decimal](9, 6) NOT NULL CONSTRAINT [DF_st_catmix_WeekdayMixPct] DEFAULT ((0)),
        [WeekendHdMixPct] [decimal](9, 6) NOT NULL CONSTRAINT [DF_st_catmix_WeekendHdMixPct] DEFAULT ((0)),
        [UnitPriceDivisor] [decimal](18, 4) NOT NULL,
        [QtyUOM] [varchar](20) NOT NULL CONSTRAINT [DF_st_catmix_QtyUOM] DEFAULT ('PCS'),
        CONSTRAINT [PK_tbl_sales_target_category_mix] PRIMARY KEY CLUSTERED ([MixID] ASC),
        CONSTRAINT [UQ_tbl_sales_target_category_mix] UNIQUE NONCLUSTERED ([MonthlyTargetID] ASC, [CategoryCode] ASC),
        CONSTRAINT [FK_tbl_sales_target_category_mix_Monthly] FOREIGN KEY ([MonthlyTargetID])
            REFERENCES [dbo].[tbl_sales_target_monthly] ([MonthlyTargetID]) ON DELETE CASCADE,
        CONSTRAINT [FK_tbl_sales_target_category_mix_Category] FOREIGN KEY ([CategoryCode])
            REFERENCES [dbo].[tbl_sales_target_category] ([CategoryCode])
    );

    CREATE NONCLUSTERED INDEX [IX_tbl_sales_target_category_mix_Monthly]
        ON [dbo].[tbl_sales_target_category_mix] ([MonthlyTargetID] ASC)
        INCLUDE ([CategoryCode], [WeekdayMixPct], [WeekendHdMixPct], [UnitPriceDivisor], [QtyUOM]);
END
GO

/* =========================================================================
   7. Detailed Computed View (dbo.vw_sales_target_detailed)
   Automatically computes all template lines:
   - Monthly ADS (TargetNetSales / TotalOperatingDays)
   - Daily Target Sales (Weekday vs. Weekend/HD)
   - Daily Target Customer Count (Daily Target Sales / AvgPerCheck)
   - Daily & Monthly Target Category Sales (Weekday vs. Weekend/HD)
   - Daily & Monthly Target Category Qty (PCS / BOXES)
   ========================================================================= */
CREATE OR ALTER VIEW [dbo].[vw_sales_target_detailed]
AS
WITH MonthlyCalc AS (
    SELECT
        h.TargetID,
        h.TargetYear,
        h.TargetQuarter,
        h.LocationID,
        h.LocationName,
        ISNULL(h.OrgLocationRef, loc.ORGLOCATIONREF) AS OrgLocationRef,
        h.SuggestionBasis,
        h.BasisMonthDate,
        h.YoYGrowthTargetPct,
        h.AvgPerCheckDefault,
        h.Status,
        m.MonthlyTargetID,
        m.TargetMonth,
        DATENAME(MONTH, DATEFROMPARTS(h.TargetYear, m.TargetMonth, 1)) AS MonthName,
        m.TargetNetSales,
        m.SuggestedNetSales,
        m.LastYearNetSales,
        m.BasisMonthADS,
        m.SeasonalAdjPct,
        m.LessHalfDays,
        m.TotalOperatingDays,
        m.WeekdayDays,
        m.WeekendHdDays,
        m.WeekdaySalesPct,
        m.WeekendHdSalesPct,
        m.AvgPerCheckWeekday,
        m.AvgPerCheckWeekendHd,
        -- Monthly ADS = TargetNetSales / TotalOperatingDays
        CAST(
            CASE WHEN m.TotalOperatingDays > 0
                 THEN m.TargetNetSales / m.TotalOperatingDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS MonthlyADS,
        -- Daily Target Sales (Weekday) = (TargetNetSales * WeekdaySalesPct) / WeekdayDays
        CAST(
            CASE WHEN m.WeekdayDays > 0
                 THEN (m.TargetNetSales * m.WeekdaySalesPct) / m.WeekdayDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS DailyTargetSalesWeekday,
        -- Daily Target Sales (Weekend/HD) = (TargetNetSales * WeekendHdSalesPct) / WeekendHdDays
        CAST(
            CASE WHEN m.WeekendHdDays > 0
                 THEN (m.TargetNetSales * m.WeekendHdSalesPct) / m.WeekendHdDays
                 ELSE 0
            END AS DECIMAL(18, 4)
        ) AS DailyTargetSalesWeekendHd
    FROM [dbo].[tbl_sales_target_header] h
    INNER JOIN [dbo].[tbl_sales_target_monthly] m
        ON h.TargetID = m.TargetID
    OUTER APPLY (
        SELECT TOP 1 l.ORGLOCATIONREF
        FROM [dbo].[dts_location] l
        WHERE l.LOCATIONNAME = h.LocationName
    ) loc
)
SELECT
    mc.TargetID,
    mc.TargetYear,
    mc.TargetQuarter,
    mc.LocationID,
    mc.LocationName,
    mc.OrgLocationRef,
    mc.SuggestionBasis,
    mc.BasisMonthDate,
    mc.YoYGrowthTargetPct,
    mc.AvgPerCheckDefault,
    mc.Status,
    mc.MonthlyTargetID,
    mc.TargetMonth,
    mc.MonthName,
    mc.TargetNetSales,
    mc.SuggestedNetSales,
    mc.LastYearNetSales,
    mc.BasisMonthADS,
    mc.SeasonalAdjPct,
    mc.LessHalfDays,
    mc.TotalOperatingDays,
    mc.WeekdayDays,
    mc.WeekendHdDays,
    mc.WeekdaySalesPct,
    mc.WeekendHdSalesPct,
    mc.MonthlyADS,
    mc.DailyTargetSalesWeekday,
    mc.DailyTargetSalesWeekendHd,
    mc.AvgPerCheckWeekday,
    mc.AvgPerCheckWeekendHd,
    -- Daily Customer Count = DailyTargetSales / AvgPerCheck
    CAST(
        CASE WHEN mc.AvgPerCheckWeekday > 0
             THEN mc.DailyTargetSalesWeekday / mc.AvgPerCheckWeekday
             ELSE 0
        END AS DECIMAL(18, 4)
    ) AS DailyCustomerCountWeekday,
    CAST(
        CASE WHEN mc.AvgPerCheckWeekendHd > 0
             THEN mc.DailyTargetSalesWeekendHd / mc.AvgPerCheckWeekendHd
             ELSE 0
        END AS DECIMAL(18, 4)
    ) AS DailyCustomerCountWeekendHd,
    -- Monthly Total Customer Count
    CAST(
        (CASE WHEN mc.AvgPerCheckWeekday > 0
              THEN (mc.DailyTargetSalesWeekday / mc.AvgPerCheckWeekday) * mc.WeekdayDays
              ELSE 0 END)
        +
        (CASE WHEN mc.AvgPerCheckWeekendHd > 0
              THEN (mc.DailyTargetSalesWeekendHd / mc.AvgPerCheckWeekendHd) * mc.WeekendHdDays
              ELSE 0 END)
        AS DECIMAL(18, 4)
    ) AS MonthlyCustomerCount,
    -- Category Details
    cm.MixID,
    cm.CategoryCode,
    c.CategoryName,
    c.SortOrder AS CategorySortOrder,
    cm.QtyUOM,
    cm.UnitPriceDivisor,
    cm.WeekdayMixPct,
    cm.WeekendHdMixPct,
    -- Daily Category Sales (Weekday & Weekend/HD)
    CAST(mc.DailyTargetSalesWeekday * cm.WeekdayMixPct AS DECIMAL(18, 4)) AS DailyCategorySalesWeekday,
    CAST(mc.DailyTargetSalesWeekendHd * cm.WeekendHdMixPct AS DECIMAL(18, 4)) AS DailyCategorySalesWeekendHd,
    -- Daily Category Qty (Weekday & Weekend/HD)
    CAST(
        CASE WHEN cm.UnitPriceDivisor > 0
             THEN (mc.DailyTargetSalesWeekday * cm.WeekdayMixPct) / cm.UnitPriceDivisor
             ELSE 0
        END AS DECIMAL(18, 4)
    ) AS DailyCategoryQtyWeekday,
    CAST(
        CASE WHEN cm.UnitPriceDivisor > 0
             THEN (mc.DailyTargetSalesWeekendHd * cm.WeekendHdMixPct) / cm.UnitPriceDivisor
             ELSE 0
        END AS DECIMAL(18, 4)
    ) AS DailyCategoryQtyWeekendHd,
    -- Monthly Category Sales Total
    CAST(
        (mc.DailyTargetSalesWeekday * cm.WeekdayMixPct * mc.WeekdayDays)
        + (mc.DailyTargetSalesWeekendHd * cm.WeekendHdMixPct * mc.WeekendHdDays)
        AS DECIMAL(18, 4)
    ) AS MonthlyCategorySales,
    -- Monthly Category Qty Total
    CAST(
        CASE WHEN cm.UnitPriceDivisor > 0
             THEN (
                 (mc.DailyTargetSalesWeekday * cm.WeekdayMixPct * mc.WeekdayDays)
                 + (mc.DailyTargetSalesWeekendHd * cm.WeekendHdMixPct * mc.WeekendHdDays)
             ) / cm.UnitPriceDivisor
             ELSE 0
        END AS DECIMAL(18, 4)
    ) AS MonthlyCategoryQty
FROM MonthlyCalc mc
LEFT JOIN [dbo].[tbl_sales_target_category_mix] cm
    ON mc.MonthlyTargetID = cm.MonthlyTargetID
LEFT JOIN [dbo].[tbl_sales_target_category] c
    ON cm.CategoryCode = c.CategoryCode;
GO
