USE [OracleDB];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================================
   005_deposit_monitoring_approvals_threads.sql
   Shared HQDB Schema for Deposit Monitoring:
   - New columns on dbo.dts_depo (Approval Tracking, Backtracking, Delete Requests)
   - Table dbo.dts_depo_threads (Backtracking & Remarks Timeline)
   - Table dbo.dts_depo_attachments (Category Supporting Documents on FTP)
   ============================================================================ */

-- 1A. Add new columns to dbo.dts_depo if they do not exist
IF OBJECT_ID(N'dbo.dts_depo', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.dts_depo', 'approval_status') IS NULL
        ALTER TABLE dbo.dts_depo ADD approval_status VARCHAR(30) NOT NULL CONSTRAINT DF_dts_depo_approval_status DEFAULT ('Not Required');

    IF COL_LENGTH('dbo.dts_depo', 'approved_by') IS NULL
        ALTER TABLE dbo.dts_depo ADD approved_by VARCHAR(100) NULL;

    IF COL_LENGTH('dbo.dts_depo', 'approved_at') IS NULL
        ALTER TABLE dbo.dts_depo ADD approved_at DATETIME2 NULL;

    IF COL_LENGTH('dbo.dts_depo', 'pettycash_status') IS NULL
        ALTER TABLE dbo.dts_depo ADD pettycash_status VARCHAR(30) NOT NULL CONSTRAINT DF_dts_depo_pettycash_status DEFAULT ('N/A');

    IF COL_LENGTH('dbo.dts_depo', 'pettycash_replenished_at') IS NULL
        ALTER TABLE dbo.dts_depo ADD pettycash_replenished_at DATETIME2 NULL;

    IF COL_LENGTH('dbo.dts_depo', 'opensales_source_date') IS NULL
        ALTER TABLE dbo.dts_depo ADD opensales_source_date DATE NULL;

    IF COL_LENGTH('dbo.dts_depo', 'dept_exp_department') IS NULL
        ALTER TABLE dbo.dts_depo ADD dept_exp_department VARCHAR(100) NULL;

    IF COL_LENGTH('dbo.dts_depo', 'dept_exp_borrower') IS NULL
        ALTER TABLE dbo.dts_depo ADD dept_exp_borrower VARCHAR(100) NULL;

    IF COL_LENGTH('dbo.dts_depo', 'delete_status') IS NULL
        ALTER TABLE dbo.dts_depo ADD delete_status VARCHAR(30) NOT NULL CONSTRAINT DF_dts_depo_delete_status DEFAULT ('None');

    IF COL_LENGTH('dbo.dts_depo', 'delete_reason') IS NULL
        ALTER TABLE dbo.dts_depo ADD delete_reason NVARCHAR(500) NULL;

    IF COL_LENGTH('dbo.dts_depo', 'delete_requested_by') IS NULL
        ALTER TABLE dbo.dts_depo ADD delete_requested_by VARCHAR(100) NULL;

    IF COL_LENGTH('dbo.dts_depo', 'delete_requested_at') IS NULL
        ALTER TABLE dbo.dts_depo ADD delete_requested_at DATETIME2 NULL;

    IF COL_LENGTH('dbo.dts_depo', 'delete_approved_by') IS NULL
        ALTER TABLE dbo.dts_depo ADD delete_approved_by VARCHAR(100) NULL;

    IF COL_LENGTH('dbo.dts_depo', 'delete_approved_at') IS NULL
        ALTER TABLE dbo.dts_depo ADD delete_approved_at DATETIME2 NULL;
END;
GO

-- 1B. Create dbo.dts_depo_threads (Backtracking & Remarks Timeline)
IF OBJECT_ID(N'dbo.dts_depo_threads', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.dts_depo_threads (
        thread_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_dts_depo_threads PRIMARY KEY,
        depo_id INT NOT NULL,
        category VARCHAR(40) NOT NULL,
        author_name VARCHAR(100) NOT NULL,
        author_role VARCHAR(50) NOT NULL,
        message NVARCHAR(1000) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_dts_depo_threads_created_at DEFAULT (SYSDATETIME())
    );

    CREATE NONCLUSTERED INDEX IX_dts_depo_threads_depo_id_created_at
        ON dbo.dts_depo_threads (depo_id ASC, created_at ASC, thread_id ASC);
END;
GO

-- 1C. Create dbo.dts_depo_attachments (Category Supporting Documents on FTP)
IF OBJECT_ID(N'dbo.dts_depo_attachments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.dts_depo_attachments (
        attachment_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_dts_depo_attachments PRIMARY KEY,
        depo_id INT NOT NULL,
        thread_id INT NULL,
        category VARCHAR(40) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        uploaded_by VARCHAR(100) NOT NULL,
        uploaded_at DATETIME2 NOT NULL CONSTRAINT DF_dts_depo_attachments_uploaded_at DEFAULT (SYSDATETIME())
    );

    CREATE NONCLUSTERED INDEX IX_dts_depo_attachments_depo_id_thread_id
        ON dbo.dts_depo_attachments (depo_id ASC, thread_id ASC);
END;
GO
