import { Router } from 'express';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { Client } from 'basic-ftp';
import { getPool, sql } from '../../database/db.js';
import { env } from '../../config/env.js';
import { requireAuth, type AuthenticatedRequest } from '../auth/auth.middleware.js';

export const depositRouter = Router();

// Protect all Deposit Monitoring endpoints with requireAuth
depositRouter.use(requireAuth);

export type DepositApprovalStatus = 'Not Required' | 'Pending' | 'Approved' | 'Rejected';
export type PettyCashStatus = 'N/A' | 'Unreplenished' | 'Replenished';
export type DepositDeleteStatus =
  | 'None'
  | 'Pending Delete'
  | 'Delete Approved'
  | 'Delete Rejected';
export type DepositThreadCategory =
  | 'PETTY_CASH'
  | 'PETTY_CASH_REPLENISH'
  | 'OPEN_SALES'
  | 'DEPT_EXPENSE'
  | 'APPROVAL'
  | 'DELETE_REQUEST'
  | 'GENERAL';

const ALLOWED_THREAD_CATEGORIES = new Set<DepositThreadCategory>([
  'PETTY_CASH',
  'PETTY_CASH_REPLENISH',
  'OPEN_SALES',
  'DEPT_EXPENSE',
  'APPROVAL',
  'DELETE_REQUEST',
  'GENERAL',
]);

function formatDateOnly(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(value ?? '').trim();
  if (!str) return '';
  return str.includes('T') ? (str.split('T')[0] ?? str) : str;
}

/**
 * Serializes SQL Server DATETIME2 values stored in local wall-clock time (SYSDATETIME())
 * by stripping the trailing 'Z' so the browser does not add an extra +8 hour UTC offset.
 */
function formatLocalDateTime(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 19);
  }
  const str = String(value).trim();
  if (!str) return null;
  if (str.endsWith('Z')) {
    return str.slice(0, 19);
  }
  return str.length >= 19 ? str.slice(0, 19) : str;
}

function mimeFromFileName(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.webp':
      return 'image/webp';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}

function extensionFromMime(mimeType: string, fallbackName: string): string {
  const extFromName = path.extname(fallbackName).toLowerCase();
  if (extFromName && /^[.][a-z0-9]{2,5}$/.test(extFromName)) {
    return extFromName;
  }
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/bmp':
      return '.bmp';
    case 'image/webp':
      return '.webp';
    default:
      return '.jpg';
  }
}

function parseBase64DataUrl(
  dataUrl: string,
  originalName: string
): { buffer: Buffer; extension: string } {
  const trimmed = dataUrl.trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (match) {
    const mime = match[1] ?? 'image/jpeg';
    const b64 = match[2] ?? '';
    return {
      buffer: Buffer.from(b64, 'base64'),
      extension: extensionFromMime(mime, originalName),
    };
  }
  return {
    buffer: Buffer.from(trimmed, 'base64'),
    extension: extensionFromMime('image/jpeg', originalName),
  };
}

function sanitizeFtpFileToken(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

async function downloadFtpImageBuffer(fileName: string): Promise<Buffer> {
  const safeName = path.basename(fileName);
  if (!safeName || safeName === '.' || safeName === '..') {
    throw new Error('Invalid attachment filename.');
  }

  if (!env.ftp.host || !env.ftp.user || !env.ftp.password) {
    throw new Error('FTP server credentials are not configured on the server.');
  }

  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: env.ftp.host,
      user: env.ftp.user,
      password: env.ftp.password,
      secure: env.ftp.secure,
    });

    const chunks: Buffer[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
    });

    await client.downloadTo(destination, `/${safeName}`);
    return Buffer.concat(chunks);
  } finally {
    client.close();
  }
}

async function uploadFtpImageBuffer(fileName: string, buffer: Buffer): Promise<void> {
  const safeName = path.basename(fileName);
  if (!safeName || safeName === '.' || safeName === '..') {
    throw new Error('Invalid attachment filename for FTP upload.');
  }

  if (!env.ftp.host || !env.ftp.user || !env.ftp.password) {
    throw new Error('FTP server credentials are not configured on the server.');
  }

  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: env.ftp.host,
      user: env.ftp.user,
      password: env.ftp.password,
      secure: env.ftp.secure,
    });

    const source = Readable.from(buffer);
    await client.uploadFrom(source, `/${safeName}`);
  } finally {
    client.close();
  }
}

let ensureSchemaPromise: Promise<void> | null = null;

async function ensureDepositApprovalSchema(): Promise<void> {
  if (ensureSchemaPromise) {
    return ensureSchemaPromise;
  }

  ensureSchemaPromise = (async () => {
    try {
      const pool = await getPool();
      await pool.request().query(`
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
      `);
    } catch (error) {
      // Allow subsequent retries if initial connection or DDL check failed
      ensureSchemaPromise = null;
      console.warn('Deposit Monitoring schema check warning:', (error as Error).message);
    }
  })();

  return ensureSchemaPromise;
}

function isApproverUser(req: AuthenticatedRequest): boolean {
  const role = (req.user?.access ?? '').trim().toLowerCase();
  return role === 'area manager' || role === 'admin';
}

function getApproverDisplayName(req: AuthenticatedRequest): string {
  const loc = (req.user?.locationName ?? '').trim();
  const uname = (req.user?.username ?? '').trim();
  if (loc && uname && loc.toLowerCase() !== uname.toLowerCase()) {
    return `${loc} (${uname})`;
  }
  return loc || uname || 'Area Manager';
}

function mapDepositRow(row: Record<string, unknown>) {
  const posAmount = Number(row.pos ?? 0);
  const depositAmount = Number(row.deposit ?? 0);
  const pettyCash = Number(row.pettycash ?? 0);
  const bir2307 = Number(row.bir2307 ?? 0);
  const openSales = Number(row.opensales ?? 0);
  const otherDepartmentExpense = Number(row.otherdeptexp ?? 0);
  const variance =
    depositAmount +
    pettyCash +
    bir2307 +
    openSales +
    otherDepartmentExpense -
    posAmount;

  const rawApproval = String(row.approval_status ?? 'Not Required').trim();
  const approvalStatus: DepositApprovalStatus =
    rawApproval === 'Pending' || rawApproval === 'Approved' || rawApproval === 'Rejected'
      ? rawApproval
      : 'Not Required';

  const rawPettyStatus = String(row.pettycash_status ?? 'N/A').trim();
  const pettyCashStatus: PettyCashStatus =
    rawPettyStatus === 'Unreplenished' || rawPettyStatus === 'Replenished'
      ? rawPettyStatus
      : pettyCash > 0
      ? 'Unreplenished'
      : 'N/A';

  const rawDeleteStatus = String(row.delete_status ?? 'None').trim();
  const deleteStatus: DepositDeleteStatus =
    rawDeleteStatus === 'Pending Delete' ||
    rawDeleteStatus === 'Delete Approved' ||
    rawDeleteStatus === 'Delete Rejected'
      ? rawDeleteStatus
      : 'None';

  return {
    depositId: Number(row.depo_id),
    locationName: String(row.locationname ?? ''),
    businessDate: formatDateOnly(row.busidate),
    depositDate: formatDateOnly(row.datedepo),
    depositReference: String(row.deporef ?? ''),
    posAmount,
    depositAmount,
    pettyCash,
    bir2307,
    openSales,
    otherDepartmentExpense,
    variance,
    filename: String(row.filename ?? ''),
    approvalStatus,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: formatLocalDateTime(row.approved_at),
    pettyCashStatus,
    pettyCashReplenishedAt: formatLocalDateTime(row.pettycash_replenished_at),
    openSalesSourceDate: row.opensales_source_date ? formatDateOnly(row.opensales_source_date) : null,
    deptExpDepartment: row.dept_exp_department ? String(row.dept_exp_department) : null,
    deptExpBorrower: row.dept_exp_borrower ? String(row.dept_exp_borrower) : null,
    deleteStatus,
    deleteReason: row.delete_reason ? String(row.delete_reason) : null,
    deleteRequestedBy: row.delete_requested_by ? String(row.delete_requested_by) : null,
    deleteRequestedAt: formatLocalDateTime(row.delete_requested_at),
    deleteApprovedBy: row.delete_approved_by ? String(row.delete_approved_by) : null,
    deleteApprovedAt: formatLocalDateTime(row.delete_approved_at),
    threadCount: Number(row.thread_count ?? 0),
    attachmentCount: Number(row.attachment_count ?? 0),
  };
}

async function fetchDepositThreadPayload(pool: sql.ConnectionPool, depoId: number) {
  const depoResult = await pool
    .request()
    .input('depoId', sql.Int, depoId)
    .query(`
      SELECT
        d.depo_id,
        d.locationname,
        d.busidate,
        d.datedepo,
        d.deporef,
        ISNULL(d.pos, 0) AS pos,
        ISNULL(d.deposit, 0) AS deposit,
        ISNULL(d.pettycash, 0) AS pettycash,
        ISNULL(d.bir2307, 0) AS bir2307,
        ISNULL(d.opensales, 0) AS opensales,
        ISNULL(d.otherdeptexp, 0) AS otherdeptexp,
        ISNULL(d.filename, '') AS filename,
        ISNULL(d.approval_status, 'Not Required') AS approval_status,
        d.approved_by,
        d.approved_at,
        ISNULL(d.pettycash_status, 'N/A') AS pettycash_status,
        d.pettycash_replenished_at,
        d.opensales_source_date,
        d.dept_exp_department,
        d.dept_exp_borrower,
        ISNULL(d.delete_status, 'None') AS delete_status,
        d.delete_reason,
        d.delete_requested_by,
        d.delete_requested_at,
        d.delete_approved_by,
        d.delete_approved_at,
        (SELECT COUNT(1) FROM dbo.dts_depo_threads t WHERE t.depo_id = d.depo_id) AS thread_count,
        (SELECT COUNT(1) FROM dbo.dts_depo_attachments a WHERE a.depo_id = d.depo_id) AS attachment_count
      FROM dbo.dts_depo d
      WHERE d.depo_id = @depoId
    `);

  if (depoResult.recordset.length === 0) {
    return null;
  }

  const deposit = mapDepositRow(depoResult.recordset[0]);

  const [threadsResult, attachmentsResult] = await Promise.all([
    pool
      .request()
      .input('depoId', sql.Int, depoId)
      .query(`
        SELECT
          thread_id,
          depo_id,
          category,
          author_name,
          author_role,
          message,
          created_at
        FROM dbo.dts_depo_threads
        WHERE depo_id = @depoId
        ORDER BY created_at ASC, thread_id ASC
      `),
    pool
      .request()
      .input('depoId', sql.Int, depoId)
      .query(`
        SELECT
          attachment_id,
          depo_id,
          thread_id,
          category,
          filename,
          uploaded_by,
          uploaded_at
        FROM dbo.dts_depo_attachments
        WHERE depo_id = @depoId
        ORDER BY uploaded_at ASC, attachment_id ASC
      `),
  ]);

  const allAttachments = attachmentsResult.recordset.map((att) => ({
    attachmentId: Number(att.attachment_id),
    depositId: Number(att.depo_id),
    threadId: att.thread_id !== null && att.thread_id !== undefined ? Number(att.thread_id) : null,
    category: String(att.category ?? 'GENERAL') as DepositThreadCategory,
    filename: String(att.filename ?? ''),
    uploadedBy: String(att.uploaded_by ?? ''),
    uploadedAt: formatLocalDateTime(att.uploaded_at),
  }));

  const attachmentsByThread = new Map<number, typeof allAttachments>();
  const unlinkedAttachments: typeof allAttachments = [];

  for (const att of allAttachments) {
    if (att.threadId !== null) {
      const list = attachmentsByThread.get(att.threadId) ?? [];
      list.push(att);
      attachmentsByThread.set(att.threadId, list);
    } else {
      unlinkedAttachments.push(att);
    }
  }

  const threads = threadsResult.recordset.map((t) => {
    const threadId = Number(t.thread_id);
    return {
      threadId,
      depositId: Number(t.depo_id),
      category: String(t.category ?? 'GENERAL') as DepositThreadCategory,
      authorName: String(t.author_name ?? ''),
      authorRole: String(t.author_role ?? ''),
      message: String(t.message ?? ''),
      createdAt: formatLocalDateTime(t.created_at),
      attachments: attachmentsByThread.get(threadId) ?? [],
    };
  });

  return {
    deposit,
    threads,
    unlinkedAttachments,
    allAttachments,
  };
}

/**
 * GET /api/reports/deposit/stores
 * Returns all active physical store locations (access = 'Store')
 */
depositRouter.get('/stores', async (_req, res) => {
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
    console.error('Error fetching active stores for Deposit Monitoring:', error);
    res.status(500).json({ error: 'Failed to retrieve store locations from database.' });
  }
});

/**
 * POST /api/reports/deposit/list
 * Queries dbo.dts_depo for a specific store (or 'ALL_PENDING' / 'ALL'), date range, and optional keyword
 */
depositRouter.post('/list', async (req, res) => {
  await ensureDepositApprovalSchema();

  const { locationName, dateFrom, dateTo, keyword, onlyActionable } = req.body ?? {};

  const trimmedLocation = typeof locationName === 'string' ? locationName.trim() : '';
  const isAllStores = trimmedLocation === 'ALL' || trimmedLocation === 'ALL_PENDING';
  const actionableOnly = Boolean(onlyActionable) || trimmedLocation === 'ALL_PENDING';

  if (!trimmedLocation) {
    res.status(400).json({ error: 'Store / Location name is required.' });
    return;
  }

  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: 'Start Date and End Date are required.' });
    return;
  }

  if (String(dateTo) < String(dateFrom)) {
    res.status(400).json({ error: 'End Date cannot be earlier than Start Date.' });
    return;
  }

  const trimmedKeyword = typeof keyword === 'string' ? keyword.trim() : '';

  try {
    const pool = await getPool();
    const request = pool
      .request()
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .input('isAllStores', sql.Bit, isAllStores ? 1 : 0)
      .input('actionableOnly', sql.Bit, actionableOnly ? 1 : 0)
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .input('keyword', sql.VarChar(100), trimmedKeyword)
      .input('keywordLike', sql.VarChar(120), `%${trimmedKeyword}%`);

    const result = await request.query(`
      SELECT
        d.depo_id,
        d.locationname,
        d.busidate,
        d.datedepo,
        d.deporef,
        ISNULL(d.pos, 0) AS pos,
        ISNULL(d.deposit, 0) AS deposit,
        ISNULL(d.pettycash, 0) AS pettycash,
        ISNULL(d.bir2307, 0) AS bir2307,
        ISNULL(d.opensales, 0) AS opensales,
        ISNULL(d.otherdeptexp, 0) AS otherdeptexp,
        ISNULL(d.filename, '') AS filename,
        ISNULL(d.approval_status, 'Not Required') AS approval_status,
        d.approved_by,
        d.approved_at,
        ISNULL(d.pettycash_status, 'N/A') AS pettycash_status,
        d.pettycash_replenished_at,
        d.opensales_source_date,
        d.dept_exp_department,
        d.dept_exp_borrower,
        ISNULL(d.delete_status, 'None') AS delete_status,
        d.delete_reason,
        d.delete_requested_by,
        d.delete_requested_at,
        d.delete_approved_by,
        d.delete_approved_at,
        ISNULL(tc.thread_count, 0) AS thread_count,
        ISNULL(ac.attachment_count, 0) AS attachment_count
      FROM dbo.dts_depo d
      OUTER APPLY (
        SELECT COUNT(1) AS thread_count
        FROM dbo.dts_depo_threads t
        WHERE t.depo_id = d.depo_id
      ) tc
      OUTER APPLY (
        SELECT COUNT(1) AS attachment_count
        FROM dbo.dts_depo_attachments a
        WHERE a.depo_id = d.depo_id
      ) ac
      WHERE (@isAllStores = 1 OR d.locationname = @locationName)
        AND d.busidate BETWEEN @dateFrom AND @dateTo
        AND (
          @actionableOnly = 0
          OR ISNULL(d.approval_status, 'Not Required') = 'Pending'
          OR ISNULL(d.delete_status, 'None') = 'Pending Delete'
        )
        AND (
          @keyword = ''
          OR CAST(d.depo_id AS VARCHAR(50)) LIKE @keywordLike
          OR ISNULL(d.deporef, '') LIKE @keywordLike
          OR ISNULL(d.filename, '') LIKE @keywordLike
          OR ISNULL(d.locationname, '') LIKE @keywordLike
          OR CAST(ISNULL(d.deposit, 0) AS VARCHAR(50)) LIKE @keywordLike
        )
      ORDER BY d.busidate DESC, d.depo_id DESC
    `);

    const rows = result.recordset.map((row) => mapDepositRow(row));

    res.json({
      filters: {
        locationName: trimmedLocation,
        dateFrom,
        dateTo,
        keyword: trimmedKeyword,
      },
      rows,
    });
  } catch (error) {
    console.error('Error fetching Deposit Monitoring records:', error);
    res.status(500).json({
      error: `Failed to retrieve Deposit Monitoring records: ${(error as Error).message}`,
    });
  }
});

/**
 * GET /api/reports/deposit/notifications
 * Returns actionable Pending Deduction Approvals, Pending Delete Requests,
 * and Recent Petty Cash Replenishments / Store Thread Updates.
 */
depositRouter.get('/notifications', async (_req: AuthenticatedRequest, res) => {
  await ensureDepositApprovalSchema();

  try {
    const pool = await getPool();

    const [pendingApprovalsResult, pendingDeletesResult, recentUpdatesResult] = await Promise.all([
      pool.request().query(`
        SELECT TOP 100
          d.depo_id,
          d.locationname,
          d.busidate,
          d.datedepo,
          d.deporef,
          ISNULL(d.pos, 0) AS pos,
          ISNULL(d.deposit, 0) AS deposit,
          ISNULL(d.pettycash, 0) AS pettycash,
          ISNULL(d.bir2307, 0) AS bir2307,
          ISNULL(d.opensales, 0) AS opensales,
          ISNULL(d.otherdeptexp, 0) AS otherdeptexp,
          ISNULL(d.approval_status, 'Not Required') AS approval_status,
          ISNULL(d.pettycash_status, 'N/A') AS pettycash_status,
          d.opensales_source_date,
          d.dept_exp_department,
          d.dept_exp_borrower,
          (
            SELECT TOP 1 t.created_at
            FROM dbo.dts_depo_threads t
            WHERE t.depo_id = d.depo_id
            ORDER BY t.created_at DESC, t.thread_id DESC
          ) AS latest_thread_at
        FROM dbo.dts_depo d
        WHERE ISNULL(d.approval_status, 'Not Required') = 'Pending'
        ORDER BY d.busidate DESC, d.depo_id DESC
      `),
      pool.request().query(`
        SELECT TOP 100
          d.depo_id,
          d.locationname,
          d.busidate,
          d.datedepo,
          d.deporef,
          ISNULL(d.deposit, 0) AS deposit,
          ISNULL(d.delete_status, 'None') AS delete_status,
          d.delete_reason,
          d.delete_requested_by,
          d.delete_requested_at
        FROM dbo.dts_depo d
        WHERE ISNULL(d.delete_status, 'None') = 'Pending Delete'
        ORDER BY ISNULL(d.delete_requested_at, CAST(d.busidate AS DATETIME2)) DESC, d.depo_id DESC
      `),
      pool.request().query(`
        SELECT TOP 25
          t.thread_id,
          t.depo_id,
          t.category,
          t.author_name,
          t.author_role,
          t.message,
          t.created_at,
          d.locationname,
          d.busidate,
          ISNULL(d.deposit, 0) AS deposit,
          ISNULL(d.approval_status, 'Not Required') AS approval_status,
          ISNULL(d.pettycash_status, 'N/A') AS pettycash_status
        FROM dbo.dts_depo_threads t
        INNER JOIN dbo.dts_depo d ON d.depo_id = t.depo_id
        WHERE (
          t.category = 'PETTY_CASH_REPLENISH'
          OR t.author_role = 'Store'
        )
        AND t.created_at >= DATEADD(DAY, -14, SYSDATETIME())
        ORDER BY t.created_at DESC, t.thread_id DESC
      `),
    ]);

    const pendingApprovals = pendingApprovalsResult.recordset.map((r) => ({
      notificationKey: `approval-${r.depo_id}`,
      type: 'DEDUCTION_APPROVAL' as const,
      depositId: Number(r.depo_id),
      locationName: String(r.locationname ?? ''),
      businessDate: formatDateOnly(r.busidate),
      depositDate: formatDateOnly(r.datedepo),
      depositReference: String(r.deporef ?? ''),
      depositAmount: Number(r.deposit ?? 0),
      pettyCash: Number(r.pettycash ?? 0),
      pettyCashStatus: String(r.pettycash_status ?? 'N/A'),
      openSales: Number(r.opensales ?? 0),
      openSalesSourceDate: r.opensales_source_date ? formatDateOnly(r.opensales_source_date) : null,
      otherDepartmentExpense: Number(r.otherdeptexp ?? 0),
      deptExpDepartment: r.dept_exp_department ? String(r.dept_exp_department) : null,
      deptExpBorrower: r.dept_exp_borrower ? String(r.dept_exp_borrower) : null,
      timestamp: formatLocalDateTime(r.latest_thread_at) ?? `${formatDateOnly(r.busidate)}T00:00:00`,
    }));

    const pendingDeletes = pendingDeletesResult.recordset.map((r) => ({
      notificationKey: `delete-${r.depo_id}-${formatLocalDateTime(r.delete_requested_at) ?? ''}`,
      type: 'DELETE_REQUEST' as const,
      depositId: Number(r.depo_id),
      locationName: String(r.locationname ?? ''),
      businessDate: formatDateOnly(r.busidate),
      depositDate: formatDateOnly(r.datedepo),
      depositReference: String(r.deporef ?? ''),
      depositAmount: Number(r.deposit ?? 0),
      deleteReason: r.delete_reason ? String(r.delete_reason) : 'No reason specified',
      deleteRequestedBy: r.delete_requested_by ? String(r.delete_requested_by) : String(r.locationname ?? 'Store'),
      deleteRequestedAt: formatLocalDateTime(r.delete_requested_at),
      timestamp:
        formatLocalDateTime(r.delete_requested_at) ?? `${formatDateOnly(r.busidate)}T00:00:00`,
    }));

    const recentStoreUpdates = recentUpdatesResult.recordset.map((r) => ({
      notificationKey: `thread-${r.thread_id}`,
      type: 'STORE_UPDATE' as const,
      threadId: Number(r.thread_id),
      depositId: Number(r.depo_id),
      locationName: String(r.locationname ?? ''),
      businessDate: formatDateOnly(r.busidate),
      depositAmount: Number(r.deposit ?? 0),
      category: String(r.category ?? 'GENERAL') as DepositThreadCategory,
      authorName: String(r.author_name ?? ''),
      authorRole: String(r.author_role ?? ''),
      message: String(r.message ?? ''),
      createdAt: formatLocalDateTime(r.created_at),
      approvalStatus: String(r.approval_status ?? 'Not Required'),
      pettyCashStatus: String(r.pettycash_status ?? 'N/A'),
      timestamp: formatLocalDateTime(r.created_at) ?? `${formatDateOnly(r.busidate)}T00:00:00`,
    }));

    res.json({
      counts: {
        totalActionable: pendingApprovals.length + pendingDeletes.length,
        pendingApprovalCount: pendingApprovals.length,
        pendingDeleteCount: pendingDeletes.length,
        recentUpdateCount: recentStoreUpdates.length,
      },
      pendingApprovals,
      pendingDeletes,
      recentStoreUpdates,
    });
  } catch (error) {
    console.error('Error fetching Deposit Monitoring notifications:', error);
    res.status(500).json({
      error: `Failed to fetch Deposit Monitoring notifications: ${(error as Error).message}`,
    });
  }
});

/**
 * GET /api/reports/deposit/:depoId/thread
 * Returns deposit summary, chronological thread entries (dbo.dts_depo_threads),
 * and supporting FTP attachments (dbo.dts_depo_attachments)
 */
depositRouter.get('/:depoId/thread', async (req, res) => {
  await ensureDepositApprovalSchema();

  const depoId = Number(req.params.depoId);
  if (!Number.isInteger(depoId) || depoId <= 0) {
    res.status(400).json({ error: 'Valid numeric Deposit ID is required.' });
    return;
  }

  try {
    const pool = await getPool();
    const payload = await fetchDepositThreadPayload(pool, depoId);
    if (!payload) {
      res.status(404).json({ error: `Deposit #${depoId} was not found.` });
      return;
    }

    res.json(payload);
  } catch (error) {
    console.error(`Error fetching thread for deposit #${depoId}:`, error);
    res.status(500).json({
      error: `Failed to load monitoring thread for Deposit #${depoId}: ${(error as Error).message}`,
    });
  }
});

/**
 * POST /api/reports/deposit/:depoId/thread
 * Posts a follow-up remark with optional supporting image attachments uploaded to FTP
 */
depositRouter.post('/:depoId/thread', async (req: AuthenticatedRequest, res) => {
  await ensureDepositApprovalSchema();

  const depoId = Number(req.params.depoId);
  if (!Number.isInteger(depoId) || depoId <= 0) {
    res.status(400).json({ error: 'Valid numeric Deposit ID is required.' });
    return;
  }

  const { category, message, attachments } = req.body ?? {};
  const rawCategory = typeof category === 'string' ? category.trim().toUpperCase() : 'GENERAL';
  const normalizedCategory: DepositThreadCategory = ALLOWED_THREAD_CATEGORIES.has(
    rawCategory as DepositThreadCategory
  )
    ? (rawCategory as DepositThreadCategory)
    : 'GENERAL';

  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const incomingAttachments = Array.isArray(attachments) ? attachments : [];

  if (!trimmedMessage && incomingAttachments.length === 0) {
    res.status(400).json({ error: 'Please enter a remark message or attach a supporting image.' });
    return;
  }

  if (trimmedMessage.length > 1000) {
    res.status(400).json({ error: 'Remark message cannot exceed 1,000 characters.' });
    return;
  }

  const authorName = getApproverDisplayName(req);
  const authorRole = req.user?.access ?? 'Area Manager';

  try {
    const pool = await getPool();

    // Verify deposit exists first
    const existsRes = await pool
      .request()
      .input('depoId', sql.Int, depoId)
      .query('SELECT depo_id, ISNULL(pettycash, 0) AS pettycash FROM dbo.dts_depo WHERE depo_id = @depoId');

    if (existsRes.recordset.length === 0) {
      res.status(404).json({ error: `Deposit #${depoId} was not found.` });
      return;
    }

    // Upload any supporting attachments to FTP root before starting DB transaction
    const uploadedFiles: Array<{ filename: string; category: DepositThreadCategory }> = [];

    for (let i = 0; i < incomingAttachments.length; i++) {
      const item = incomingAttachments[i];
      if (!item || typeof item.dataUrl !== 'string' || !item.dataUrl.trim()) {
        continue;
      }
      const origName = typeof item.fileName === 'string' ? item.fileName : `attachment_${i + 1}.jpg`;
      const { buffer, extension } = parseBase64DataUrl(item.dataUrl, origName);
      const baseWithoutExt = sanitizeFtpFileToken(path.basename(origName, path.extname(origName))) || 'doc';
      const ts = Date.now();
      const itemCatRaw =
        typeof item.category === 'string' ? item.category.trim().toUpperCase() : normalizedCategory;
      const itemCategory: DepositThreadCategory = ALLOWED_THREAD_CATEGORIES.has(
        itemCatRaw as DepositThreadCategory
      )
        ? (itemCatRaw as DepositThreadCategory)
        : normalizedCategory;

      const generatedFileName = `DEPO_${depoId}_${itemCategory}_${ts}_${i + 1}_${baseWithoutExt}${extension}`;
      await uploadFtpImageBuffer(generatedFileName, buffer);
      uploadedFiles.push({
        filename: generatedFileName,
        category: itemCategory,
      });
    }

    const finalMessage =
      trimmedMessage ||
      `Uploaded ${uploadedFiles.length} supporting attachment(s) (${normalizedCategory}).`;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const insertThreadResult = await new sql.Request(transaction)
        .input('depoId', sql.Int, depoId)
        .input('category', sql.VarChar(40), normalizedCategory)
        .input('authorName', sql.VarChar(100), authorName.slice(0, 100))
        .input('authorRole', sql.VarChar(50), String(authorRole).slice(0, 50))
        .input('message', sql.NVarChar(1000), finalMessage)
        .query(`
          INSERT INTO dbo.dts_depo_threads (depo_id, category, author_name, author_role, message, created_at)
          OUTPUT INSERTED.thread_id
          VALUES (@depoId, @category, @authorName, @authorRole, @message, SYSDATETIME())
        `);

      const newThreadId = Number(insertThreadResult.recordset[0]?.thread_id);

      for (const uploaded of uploadedFiles) {
        await new sql.Request(transaction)
          .input('depoId', sql.Int, depoId)
          .input('threadId', sql.Int, newThreadId)
          .input('category', sql.VarChar(40), uploaded.category)
          .input('filename', sql.VarChar(255), uploaded.filename)
          .input('uploadedBy', sql.VarChar(100), authorName.slice(0, 100))
          .query(`
            INSERT INTO dbo.dts_depo_attachments (depo_id, thread_id, category, filename, uploaded_by, uploaded_at)
            VALUES (@depoId, @threadId, @category, @filename, @uploadedBy, SYSDATETIME())
          `);
      }

      if (normalizedCategory === 'PETTY_CASH_REPLENISH') {
        await new sql.Request(transaction)
          .input('depoId', sql.Int, depoId)
          .query(`
            UPDATE dbo.dts_depo
            SET pettycash_status = 'Replenished',
                pettycash_replenished_at = SYSDATETIME()
            WHERE depo_id = @depoId AND ISNULL(pettycash, 0) > 0
          `);
      }

      await transaction.commit();
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

    const updatedPayload = await fetchDepositThreadPayload(pool, depoId);
    res.json({
      message: 'Remark posted to monitoring thread.',
      ...updatedPayload,
    });
  } catch (error) {
    console.error(`Error posting remark to deposit #${depoId}:`, error);
    res.status(500).json({
      error: `Failed to post remark to monitoring thread: ${(error as Error).message}`,
    });
  }
});

/**
 * POST /api/reports/deposit/:depoId/approve-deductions
 * Area Manager / admin action to Approve or Reject deposit deductions in a single DB transaction
 */
depositRouter.post('/:depoId/approve-deductions', async (req: AuthenticatedRequest, res) => {
  await ensureDepositApprovalSchema();

  if (!isApproverUser(req)) {
    res.status(403).json({
      error: 'Only Area Managers and Admins are authorized to approve or reject deposit deductions.',
    });
    return;
  }

  const depoId = Number(req.params.depoId);
  if (!Number.isInteger(depoId) || depoId <= 0) {
    res.status(400).json({ error: 'Valid numeric Deposit ID is required.' });
    return;
  }

  const { decision, remarks } = req.body ?? {};
  if (decision !== 'Approved' && decision !== 'Rejected') {
    res.status(400).json({ error: 'Decision must be either "Approved" or "Rejected".' });
    return;
  }

  const trimmedRemarks = typeof remarks === 'string' ? remarks.trim() : '';
  if (decision === 'Rejected' && !trimmedRemarks) {
    res.status(400).json({ error: 'Remarks are required when rejecting deposit deductions.' });
    return;
  }

  const approverName = getApproverDisplayName(req);
  const authorRole = req.user?.access ?? 'Area Manager';
  const threadMessage = trimmedRemarks
    ? `Deposit Deductions ${decision} by ${approverName}.\nRemarks: ${trimmedRemarks}`
    : `Deposit Deductions ${decision} by ${approverName}.`;

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const updateResult = await new sql.Request(transaction)
        .input('depoId', sql.Int, depoId)
        .input('decision', sql.VarChar(30), decision)
        .input('approvedBy', sql.VarChar(100), approverName.slice(0, 100))
        .query(`
          UPDATE dbo.dts_depo
          SET approval_status = @decision,
              approved_by = @approvedBy,
              approved_at = SYSDATETIME()
          WHERE depo_id = @depoId
        `);

      if ((updateResult.rowsAffected[0] ?? 0) === 0) {
        await transaction.rollback();
        res.status(404).json({ error: `Deposit #${depoId} was not found.` });
        return;
      }

      await new sql.Request(transaction)
        .input('depoId', sql.Int, depoId)
        .input('category', sql.VarChar(40), 'APPROVAL')
        .input('authorName', sql.VarChar(100), approverName.slice(0, 100))
        .input('authorRole', sql.VarChar(50), String(authorRole).slice(0, 50))
        .input('message', sql.NVarChar(1000), threadMessage.slice(0, 1000))
        .query(`
          INSERT INTO dbo.dts_depo_threads (depo_id, category, author_name, author_role, message, created_at)
          VALUES (@depoId, @category, @authorName, @authorRole, @message, SYSDATETIME())
        `);

      await transaction.commit();
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

    const updatedPayload = await fetchDepositThreadPayload(pool, depoId);
    res.json({
      message: `Deposit #${depoId} deductions ${decision.toLowerCase()}.`,
      ...updatedPayload,
    });
  } catch (error) {
    console.error(`Error updating deduction approval for deposit #${depoId}:`, error);
    res.status(500).json({
      error: `Failed to update deduction approval: ${(error as Error).message}`,
    });
  }
});

/**
 * POST /api/reports/deposit/:depoId/approve-delete
 * Area Manager / admin action to Approve or Reject a store's delete request in a single DB transaction.
 * Note: Does NOT delete the row yet; final deletion is confirmed by the store in the desktop app.
 */
depositRouter.post('/:depoId/approve-delete', async (req: AuthenticatedRequest, res) => {
  await ensureDepositApprovalSchema();

  if (!isApproverUser(req)) {
    res.status(403).json({
      error: 'Only Area Managers and Admins are authorized to approve or reject deposit delete requests.',
    });
    return;
  }

  const depoId = Number(req.params.depoId);
  if (!Number.isInteger(depoId) || depoId <= 0) {
    res.status(400).json({ error: 'Valid numeric Deposit ID is required.' });
    return;
  }

  const { decision, remarks } = req.body ?? {};
  if (decision !== 'Delete Approved' && decision !== 'Delete Rejected') {
    res.status(400).json({
      error: 'Decision must be either "Delete Approved" or "Delete Rejected".',
    });
    return;
  }

  const trimmedRemarks = typeof remarks === 'string' ? remarks.trim() : '';
  if (decision === 'Delete Rejected' && !trimmedRemarks) {
    res.status(400).json({
      error: 'Remarks are required when rejecting a deposit delete request.',
    });
    return;
  }

  const approverName = getApproverDisplayName(req);
  const authorRole = req.user?.access ?? 'Area Manager';
  const actionLabel = decision === 'Delete Approved' ? 'Approved' : 'Rejected';
  const threadMessage = trimmedRemarks
    ? `Delete Request ${actionLabel} by ${approverName}.\nRemarks: ${trimmedRemarks}`
    : `Delete Request ${actionLabel} by ${approverName}.`;

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const updateResult = await new sql.Request(transaction)
        .input('depoId', sql.Int, depoId)
        .input('decision', sql.VarChar(30), decision)
        .input('approvedBy', sql.VarChar(100), approverName.slice(0, 100))
        .query(`
          UPDATE dbo.dts_depo
          SET delete_status = @decision,
              delete_approved_by = @approvedBy,
              delete_approved_at = SYSDATETIME()
          WHERE depo_id = @depoId
        `);

      if ((updateResult.rowsAffected[0] ?? 0) === 0) {
        await transaction.rollback();
        res.status(404).json({ error: `Deposit #${depoId} was not found.` });
        return;
      }

      await new sql.Request(transaction)
        .input('depoId', sql.Int, depoId)
        .input('category', sql.VarChar(40), 'DELETE_REQUEST')
        .input('authorName', sql.VarChar(100), approverName.slice(0, 100))
        .input('authorRole', sql.VarChar(50), String(authorRole).slice(0, 50))
        .input('message', sql.NVarChar(1000), threadMessage.slice(0, 1000))
        .query(`
          INSERT INTO dbo.dts_depo_threads (depo_id, category, author_name, author_role, message, created_at)
          VALUES (@depoId, @category, @authorName, @authorRole, @message, SYSDATETIME())
        `);

      await transaction.commit();
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

    const updatedPayload = await fetchDepositThreadPayload(pool, depoId);
    res.json({
      message: `Deposit #${depoId} delete request ${actionLabel.toLowerCase()}.`,
      ...updatedPayload,
    });
  } catch (error) {
    console.error(`Error updating delete request approval for deposit #${depoId}:`, error);
    res.status(500).json({
      error: `Failed to update delete request approval: ${(error as Error).message}`,
    });
  }
});

/**
 * POST /api/reports/deposit/attachment
 * Downloads the deposit slip or category supporting attachment image from FTP and returns a base64 Data URL
 */
depositRouter.post('/attachment', async (req, res) => {
  const { filename } = req.body ?? {};

  if (!filename || typeof filename !== 'string' || !filename.trim()) {
    res.status(400).json({ error: 'Attachment filename is required.' });
    return;
  }

  const safeName = path.basename(filename.trim());

  try {
    const buffer = await downloadFtpImageBuffer(safeName);
    const mimeType = mimeFromFileName(safeName);
    const previewDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    res.json({
      success: true,
      fileName: safeName,
      mimeType,
      previewDataUrl,
    });
  } catch (error) {
    console.error('Error downloading deposit attachment from FTP:', error);
    res.status(500).json({
      error: `Unable to load attachment "${safeName}" from FTP: ${(error as Error).message}`,
    });
  }
});
