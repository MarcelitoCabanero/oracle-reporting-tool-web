import { Router } from 'express';
import { getPool, sql } from '../../database/db.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const rofRouter = Router();

// Protect all ROF endpoints with requireAuth
rofRouter.use(requireAuth);

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

/**
 * GET /api/reports/rof/stores
 * Returns all active physical store locations (access = 'Store')
 */
rofRouter.get('/stores', async (_req, res) => {
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
    console.error('Error fetching active stores for ROF:', error);
    res.status(500).json({ error: 'Failed to retrieve store locations from database.' });
  }
});

/**
 * POST /api/reports/rof/summary
 * Queries dbo.v_summary_ROF for a specific store and date range
 */
rofRouter.post('/summary', async (req, res) => {
  const { locationName, dateFrom, dateTo } = req.body ?? {};

  if (!locationName || typeof locationName !== 'string' || !locationName.trim()) {
    res.status(400).json({ error: 'Store / Location name is required.' });
    return;
  }

  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: 'Date From and Date To are required.' });
    return;
  }

  if (String(dateTo) < String(dateFrom)) {
    res.status(400).json({ error: 'Date To cannot be earlier than Date From.' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .input('locationName', sql.VarChar(100), locationName.trim())
      .query(`
        SELECT
          busidate,
          locationname,
          netsales_vat,
          vat,
          netsales,
          gc_sales,
          cash,
          noncash,
          variance,
          cash_remarks,
          noncash_remarks
        FROM dbo.v_summary_ROF
        WHERE busidate BETWEEN @dateFrom AND @dateTo
          AND locationname = @locationName
        ORDER BY busidate ASC
      `);

    const rows = result.recordset.map((row) => ({
      businessDate: formatDateOnly(row.busidate),
      locationName: String(row.locationname ?? ''),
      netSalesVat: Number(row.netsales_vat ?? 0),
      vat: Number(row.vat ?? 0),
      netSales: Number(row.netsales ?? 0),
      gcSales: Number(row.gc_sales ?? 0),
      cash: Number(row.cash ?? 0),
      nonCash: Number(row.noncash ?? 0),
      variance: Number(row.variance ?? 0),
      cashRemarks: String(row.cash_remarks ?? ''),
      nonCashRemarks: String(row.noncash_remarks ?? ''),
    }));

    res.json({
      filters: {
        locationName: locationName.trim(),
        dateFrom,
        dateTo,
      },
      rows,
    });
  } catch (error) {
    console.error('Error fetching ROF summary:', error);
    res.status(500).json({
      error: `Failed to retrieve ROF summary: ${(error as Error).message}`,
    });
  }
});

/**
 * POST /api/reports/rof/details
 * Queries dbo.dts_rof_header, dbo.dts_rof_cash, and dbo.dts_rof_noncash for a store and business date
 */
rofRouter.post('/details', async (req, res) => {
  const { locationName, businessDate } = req.body ?? {};

  if (!locationName || typeof locationName !== 'string' || !locationName.trim()) {
    res.status(400).json({ error: 'Store / Location name is required.' });
    return;
  }

  if (!businessDate) {
    res.status(400).json({ error: 'Business Date is required.' });
    return;
  }

  const trimmedLocation = locationName.trim();

  try {
    const pool = await getPool();

    const headerRes = await pool
      .request()
      .input('businessDate', sql.Date, businessDate)
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .query(`
        SELECT TOP 1 rof_id, busidate, locationname, created_at
        FROM dbo.dts_rof_header
        WHERE busidate = @businessDate
          AND locationname = @locationName
        ORDER BY rof_id DESC
      `);

    const cashRes = await pool
      .request()
      .input('businessDate', sql.Date, businessDate)
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .query(`
        SELECT
          cashiername,
          tendername,
          posamt,
          actualamt,
          mod,
          remarks
        FROM dbo.dts_rof_cash
        WHERE busidate = @businessDate
          AND locationname = @locationName
        ORDER BY cashiername ASC
      `);

    const nonCashRes = await pool
      .request()
      .input('businessDate', sql.Date, businessDate)
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .query(`
        SELECT
          tendername,
          tenderamt,
          actualtender,
          remarks
        FROM dbo.dts_rof_noncash
        WHERE busidate = @businessDate
          AND locationname = @locationName
        ORDER BY tendername ASC
      `);

    const cash = cashRes.recordset.map((row) => ({
      cashierName: String(row.cashiername ?? ''),
      tenderName: String(row.tendername ?? ''),
      posAmount: Number(row.posamt ?? 0),
      actualAmount: Number(row.actualamt ?? 0),
      mod: String(row.mod ?? ''),
      remarks: String(row.remarks ?? ''),
    }));

    const nonCash = nonCashRes.recordset.map((row) => ({
      tenderName: String(row.tendername ?? ''),
      posAmount: Number(row.tenderamt ?? 0),
      actualAmount: Number(row.actualtender ?? 0),
      remarks: String(row.remarks ?? ''),
    }));

    const headerRow = headerRes.recordset[0];
    const exists = Boolean(headerRow) || cash.length > 0 || nonCash.length > 0;

    res.json({
      exists,
      rofId: headerRow ? Number(headerRow.rof_id) : null,
      createdAt: headerRow?.created_at ?? null,
      businessDate,
      locationName: trimmedLocation,
      cash,
      nonCash,
    });
  } catch (error) {
    console.error('Error fetching ROF details:', error);
    res.status(500).json({
      error: `Failed to retrieve ROF details: ${(error as Error).message}`,
    });
  }
});
