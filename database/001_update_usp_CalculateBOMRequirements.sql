USE [OracleDB]
GO
/****** Object:  StoredProcedure [dbo].[usp_CalculateBOMRequirements] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[usp_CalculateBOMRequirements]
    @LocationName VARCHAR(50),
    @StartDate DATE,
    @EndDate DATE,
    @FGItemCode VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Normalize empty string to NULL
    IF @FGItemCode = '' SET @FGItemCode = NULL;

    DROP TABLE IF EXISTS #BOM_Calculation;

    -- 1. Aggregate Sales from dts_details table over the specified date range and optional FG filter
    ;WITH SalesData AS (
        SELECT 
            CAST(ITEMNUMBER AS VARCHAR(50)) AS FGItemCode,
            SUM(linecount) AS QtySold
        FROM dbo.dts_details
        WHERE TRANSACTIONTYPE = 'Item Sale' 
          AND locationname = @LocationName
          AND businessdate BETWEEN @StartDate AND @EndDate
          AND (@FGItemCode IS NULL OR CAST(ITEMNUMBER AS VARCHAR(50)) = @FGItemCode)
        GROUP BY ITEMNUMBER
    ),
    -- 2. Recursive CTE to explode multi-level BOMs
    BOM_Calculation AS (
        -- Anchor Member: Top-Level Finished Goods
        SELECT 
            1 AS BOMLevel,
            CAST(h.FormulaCode AS VARCHAR(500)) AS BOMPath,
            h.FormulaCode AS CurrentParentCode,
            h.FGName AS CurrentParentName,
            d.RMCode,
            d.RMName,
            d.QtyNeeds,
            d.BOM_UOM,
            d.QtyDenominator,
            d.UnitConversion,
            d.Inv_UOM,
            d.IsSubAssembly,
            s.QtySold,
            d.QtyNeeds AS ParentQtyNeeds,
            d.UnitConversion AS ParentUnitConversion,
            CAST(((d.QtyNeeds / NULLIF(d.QtyDenominator, 0)) * s.QtySold) / NULLIF(d.UnitConversion, 0) AS DECIMAL(18,6)) AS QtyFromQtySold
        FROM dbo.tbl_bom_header h
        JOIN dbo.tbl_bom_detail d ON h.BOMID = d.BOMID
        JOIN SalesData s ON h.FormulaCode = s.FGItemCode

        UNION ALL

        -- Recursive Member: Sub-Assemblies
        SELECT 
            bc.BOMLevel + 1 AS BOMLevel,
            CAST(bc.BOMPath + ' -> ' + sub_h.FormulaCode AS VARCHAR(500)) AS BOMPath,
            sub_h.FormulaCode AS CurrentParentCode,
            sub_h.FGName AS CurrentParentName,
            sub_d.RMCode,
            sub_d.RMName,
            sub_d.QtyNeeds,
            sub_d.BOM_UOM,
            sub_d.QtyDenominator,
            sub_d.UnitConversion,
            sub_d.Inv_UOM,
            sub_d.IsSubAssembly,
            bc.QtySold,
            sub_d.QtyNeeds AS ParentQtyNeeds,
            sub_d.UnitConversion AS ParentUnitConversion,
            CAST(
                (
                    ((sub_d.QtyNeeds / NULLIF(sub_d.QtyDenominator, 0)) * bc.ParentQtyNeeds) 
                    / NULLIF(bc.ParentUnitConversion, 0) 
                    * bc.QtySold
                ) / NULLIF(sub_d.UnitConversion, 0) 
                AS DECIMAL(18,6)
            ) AS QtyFromQtySold
        FROM BOM_Calculation bc
        JOIN dbo.tbl_bom_header sub_h ON bc.RMCode = sub_h.FormulaCode
        JOIN dbo.tbl_bom_detail sub_d ON sub_h.BOMID = sub_d.BOMID
        WHERE bc.IsSubAssembly = 1
    )
    SELECT 
        BOMLevel,
        BOMPath,
        CurrentParentCode,
        CurrentParentName,
        RMCode,
        RMName,
        QtyNeeds,
        BOM_UOM,
        QtyDenominator,
        UnitConversion,
        Inv_UOM,
        IsSubAssembly,
        QtySold,
        QtyFromQtySold
    INTO #BOM_Calculation
    FROM BOM_Calculation;

    -- ==========================================
    -- RESULT SET 1: Detailed Recipe Breakdown
    -- ==========================================
    SELECT 
        @LocationName AS LocationName,
        BOMLevel,
        BOMPath,
        CurrentParentCode,
        CurrentParentName,
        RMCode,
        RMName,
        QtySold,
        QtyNeeds,
        BOM_UOM,
        QtyDenominator,
        UnitConversion,
        Inv_UOM,
        QtyFromQtySold,
        IsSubAssembly
    FROM #BOM_Calculation
    ORDER BY CurrentParentName, BOMLevel, RMName;

    -- ==========================================
    -- RESULT SET 2: Consolidated Purchasing List
    -- ==========================================
    SELECT 
        @LocationName AS LocationName,
        RMCode,
        RMName,
        Inv_UOM,
        CAST(SUM(QtyFromQtySold) AS DECIMAL(18,4)) AS QtyFromQtySold
    FROM #BOM_Calculation
    WHERE IsSubAssembly = 0 -- Exclude intermediate items, only keep base raw materials
    GROUP BY RMCode, RMName, Inv_UOM
    ORDER BY RMName;

    DROP TABLE IF EXISTS #BOM_Calculation;

END;
GO
