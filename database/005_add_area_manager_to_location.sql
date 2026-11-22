USE [OracleDB]
GO
/*
  Store -> Area Manager assignment.
  AreaManagerID on a Store row holds the LOCATIONID of its Area Manager (access = 'Area Manager').
  One store has exactly one Area Manager; an Area Manager can have many stores.
*/
IF COL_LENGTH('dbo.dts_location', 'AreaManagerID') IS NULL
BEGIN
    ALTER TABLE [dbo].[dts_location] ADD [AreaManagerID] [int] NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_dts_location_AreaManagerID' AND object_id = OBJECT_ID('dbo.dts_location'))
BEGIN
    CREATE INDEX IX_dts_location_AreaManagerID ON [dbo].[dts_location] ([AreaManagerID]);
END
GO

/* ---- TEMPLATE: fill in your real assignments, then run ----
-- Find Area Manager IDs:
-- SELECT LOCATIONID, LOCATIONNAME, username FROM dbo.dts_location WHERE access = 'Area Manager';

-- Assign stores to an Area Manager (replace 101 and the store names):
-- UPDATE dbo.dts_location
-- SET AreaManagerID = 101
-- WHERE access = 'Store' AND LOCATIONNAME IN ('STORE A', 'STORE B');

-- Stores still unassigned:
-- SELECT LOCATIONID, LOCATIONNAME FROM dbo.dts_location
-- WHERE access = 'Store' AND IsActive = 1 AND AreaManagerID IS NULL;
*/
