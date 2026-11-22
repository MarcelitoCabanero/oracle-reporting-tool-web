/*
  006_finance_insight_aggregates.sql
  Finance Insight dashboard aggregates.

  Creates:
    dbo.agg_daily_revenuecenter  - daily net sales / qty per store per revenue center (from dbo.dts_details)
    dbo.agg_daily_checkcount     - daily valid check count per store (from dbo.FCR_INVOICE_DATA)
    dbo.usp_Load_agg_daily_revenuecenter @DateFrom, @DateTo
    dbo.usp_Load_agg_daily_checkcount    @DateFrom, @DateTo

  Check count rule: DISTINCT FCRINVNUM <> '' per store/day, EXCLUDING invoice numbers that
  appear on more than one row in the range (voided / reprinted), matching the System Sales void audit.
  NOTE: FCR_INVOICE_DATA store column is spelled `locationame` (sic).

  Backfill example (24 months, run in monthly chunks to protect the server):
    EXEC dbo.usp_Load_agg_daily_revenuecenter '2025-01-01', '2025-01-31';
    EXEC dbo.usp_Load_agg_daily_checkcount    '2025-01-01', '2025-01-31';
  Schedule a nightly SQL Agent job reloading the last 3 days (yesterday + 2 days of late corrections).
*/

IF OBJECT_ID('dbo.agg_daily_revenuecenter', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.agg_daily_revenuecenter (
    businessdate      DATE          NOT NULL,
    locationname      VARCHAR(100)  NOT NULL,
    revenuecentername VARCHAR(100)  NOT NULL,
    qty               DECIMAL(18,2) NOT NULL DEFAULT 0,
    netsales          DECIMAL(18,2) NOT NULL DEFAULT 0,
    loaded_at         DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_agg_daily_revenuecenter PRIMARY KEY CLUSTERED (businessdate, locationname, revenuecentername)
  );
  CREATE NONCLUSTERED INDEX IX_agg_daily_revenuecenter_loc
    ON dbo.agg_daily_revenuecenter (locationname, businessdate) INCLUDE (revenuecentername, qty, netsales);
END
GO

IF OBJECT_ID('dbo.agg_daily_checkcount', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.agg_daily_checkcount (
    businessdate DATE         NOT NULL,
    locationname VARCHAR(100) NOT NULL,
    check_count  INT          NOT NULL DEFAULT 0,
    loaded_at    DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_agg_daily_checkcount PRIMARY KEY CLUSTERED (businessdate, locationname)
  );
  CREATE NONCLUSTERED INDEX IX_agg_daily_checkcount_loc
    ON dbo.agg_daily_checkcount (locationname, businessdate) INCLUDE (check_count);
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Load_agg_daily_revenuecenter
  @DateFrom DATE,
  @DateTo   DATE
AS
BEGIN
  SET NOCOUNT ON;
  IF @DateTo < @DateFrom THROW 50001, 'DateTo cannot be earlier than DateFrom.', 1;

  BEGIN TRAN;
    DELETE FROM dbo.agg_daily_revenuecenter
    WHERE businessdate BETWEEN @DateFrom AND @DateTo;

    INSERT INTO dbo.agg_daily_revenuecenter (businessdate, locationname, revenuecentername, qty, netsales)
    SELECT
      businessdate,
      locationname,
      ISNULL(NULLIF(LTRIM(RTRIM(REVENUECENTERNAME)), ''), 'UNSPECIFIED'),
      SUM(LINECOUNT),
      SUM(netsales)
    FROM dbo.dts_details
    WHERE businessdate BETWEEN @DateFrom AND @DateTo
      AND TRANSACTIONTYPE = 'Item Sale'
      AND ITEMNUMBER NOT IN (9801, 9802, 9803)
    GROUP BY
      businessdate,
      locationname,
      ISNULL(NULLIF(LTRIM(RTRIM(REVENUECENTERNAME)), ''), 'UNSPECIFIED');
  COMMIT;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Load_agg_daily_checkcount
  @DateFrom DATE,
  @DateTo   DATE
AS
BEGIN
  SET NOCOUNT ON;
  IF @DateTo < @DateFrom THROW 50001, 'DateTo cannot be earlier than DateFrom.', 1;

  BEGIN TRAN;
    DELETE FROM dbo.agg_daily_checkcount
    WHERE businessdate BETWEEN @DateFrom AND @DateTo;

    INSERT INTO dbo.agg_daily_checkcount (businessdate, locationname, check_count)
    SELECT businessdate, locationame, COUNT(*)
    FROM (
      SELECT Businessdate AS businessdate, locationame, FCRINVNUM
      FROM dbo.FCR_INVOICE_DATA
      WHERE Businessdate BETWEEN @DateFrom AND @DateTo
        AND FCRINVNUM <> ''
      GROUP BY Businessdate, locationame, FCRINVNUM
      HAVING COUNT(*) = 1
    ) valid
    GROUP BY businessdate, locationame;
  COMMIT;
END
GO
