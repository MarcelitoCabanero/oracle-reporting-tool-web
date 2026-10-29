import { Router } from 'express';
import path from 'node:path';
import { Writable } from 'node:stream';
import { Client } from 'basic-ftp';
import { getPool, sql } from '../../database/db.js';
import { env } from '../../config/env.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const depositRouter = Router();

// Protect all Deposit Monitoring endpoints with requireAuth
depositRouter.use(requireAuth);

function formatDateOnly(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(value ?? '');
  return str.includes('T') ? (str.split('T')[0] ?? str) : str;
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
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
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
 * Queries dbo.dts_depo for a specific store, date range, and optional keyword
 */
depositRouter.post('/list', async (req, res) => {
  const { locationName, dateFrom, dateTo, keyword } = req.body ?? {};

  if (!locationName || typeof locationName !== 'string' || !locationName.trim()) {
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

  const trimmedLocation = locationName.trim();
  const trimmedKeyword = typeof keyword === 'string' ? keyword.trim() : '';

  try {
    const pool = await getPool();
    const request = pool
      .request()
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .input('keyword', sql.VarChar(100), trimmedKeyword)
      .input('keywordLike', sql.VarChar(120), `%${trimmedKeyword}%`);

    const result = await request.query(`
      SELECT
        depo_id,
        locationname,
        busidate,
        datedepo,
        deporef,
        ISNULL(pos, 0) AS pos,
        ISNULL(deposit, 0) AS deposit,
        ISNULL(pettycash, 0) AS pettycash,
        ISNULL(bir2307, 0) AS bir2307,
        ISNULL(opensales, 0) AS opensales,
        ISNULL(otherdeptexp, 0) AS otherdeptexp,
        ISNULL(filename, '') AS filename
      FROM dbo.dts_depo
      WHERE locationname = @locationName
        AND busidate BETWEEN @dateFrom AND @dateTo
        AND (
          @keyword = ''
          OR CAST(depo_id AS VARCHAR(50)) LIKE @keywordLike
          OR ISNULL(deporef, '') LIKE @keywordLike
          OR ISNULL(filename, '') LIKE @keywordLike
          OR CAST(ISNULL(deposit, 0) AS VARCHAR(50)) LIKE @keywordLike
        )
      ORDER BY busidate DESC, depo_id DESC
    `);

    const rows = result.recordset.map((row) => {
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
      };
    });

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
 * POST /api/reports/deposit/attachment
 * Downloads the deposit slip attachment image from FTP and returns a base64 Data URL
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
