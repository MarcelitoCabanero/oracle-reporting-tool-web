import { Router } from 'express';
import { getPool, sql } from '../../database/db.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const systemSalesRouter = Router();

// Protect all System Sales endpoints with requireAuth
systemSalesRouter.use(requireAuth);

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

/**
 * GET /api/reports/system-sales/stores
 * Returns list of active physical store locations
 */
systemSalesRouter.get('/stores', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT 
        LOCATIONID, 
        LOCATIONNAME, 
        ORGLOCATIONREF
      FROM dbo.dts_location
      WHERE IsActive = 1 AND access = 'Store'
      ORDER BY LOCATIONNAME ASC
    `);

    res.json({ stores: result.recordset });
  } catch (error) {
    console.error('Failed to fetch stores for System Sales:', error);
    res.status(500).json({ error: 'Failed to retrieve store locations from database.' });
  }
});

/**
 * GET /api/reports/system-sales/summary
 * Query params:
 *   - locationName: string
 *   - dateFrom: string (YYYY-MM-DD)
 *   - dateTo: string (YYYY-MM-DD)
 */
systemSalesRouter.get('/summary', async (req, res) => {
  const { locationName, dateFrom, dateTo } = req.query;

  if (!locationName || !dateFrom || !dateTo) {
    res.status(400).json({ message: 'locationName, dateFrom, and dateTo are required' });
    return;
  }

  const strLocation = String(locationName).trim();
  const strDateFrom = String(dateFrom).trim();
  const strDateTo = String(dateTo).trim();

  if (strDateFrom > strDateTo) {
    res.status(400).json({ message: 'dateFrom cannot be greater than dateTo' });
    return;
  }

  try {
    const pool = await getPool();

    // 1. Query Sales Summary from dbo.agg_daily_dsr
    const dsrReq = pool.request();
    dsrReq.input('locationName', sql.VarChar(50), strLocation);
    dsrReq.input('dateFrom', sql.Date, strDateFrom);
    dsrReq.input('dateTo', sql.Date, strDateTo);

    const dsrRes = await dsrReq.query(`
      SELECT 
        COUNT(DISTINCT businessdate) AS daysCount,
        ISNULL(SUM(netsales), 0) AS netSales,
        ISNULL(SUM(gross_sales), 0) AS grossSales,
        ISNULL(SUM(vat_12), 0) AS taxCollected,
        ISNULL(SUM(gross_receipt), 0) AS grossReceipt,
        ISNULL(SUM(total_cash), 0) AS totalCash,
        ISNULL(SUM(total_cards), 0) AS totalCards,
        ISNULL(SUM(numguest), 0) AS numGuest,

        ISNULL(SUM(netsales_vatable), 0) AS vatableSales,
        ISNULL(SUM(netsales_vatex), 0) AS vatExemptSales,
        ISNULL(SUM(zerorated), 0) AS vatZeroRatedSales,
        ISNULL(SUM(lessvat), 0) AS lessVat,

        ISNULL(SUM(sc), 0) AS seniorCitizen,
        ISNULL(SUM(pwd), 0) AS pwd,
        ISNULL(SUM(lessemp), 0) AS employee,
        ISNULL(SUM(lessNationalAth), 0) AS nationalAthlete,
        ISNULL(SUM(lessSolo), 0) AS soloParent,
        ISNULL(SUM(lessotherDisc), 0) AS otherDiscount,

        ISNULL(SUM(gc_sales), 0) AS gcSales,
        ISNULL(SUM(gc_excess), 0) AS gcExcess,
        ISNULL(SUM(voidtotal_amt), 0) AS voidAmount,
        ISNULL(SUM(voidtotal_qty), 0) AS voidCount
      FROM dbo.agg_daily_dsr
      WHERE locationname = @locationName
        AND businessdate BETWEEN @dateFrom AND @dateTo
    `);

    const row = dsrRes.recordset[0] ?? {};

    const netSales = toNumber(row.netSales);
    const taxCollected = toNumber(row.taxCollected);
    const totalRevenue = netSales + taxCollected; // Netsales + vat_12

    const seniorCitizen = toNumber(row.seniorCitizen);
    const pwd = toNumber(row.pwd);
    const employee = toNumber(row.employee);
    const nationalAthlete = toNumber(row.nationalAthlete);
    const soloParent = toNumber(row.soloParent);
    const otherDiscount = toNumber(row.otherDiscount);
    const totalDiscount = seniorCitizen + pwd + employee + nationalAthlete + soloParent + otherDiscount;

    const summary = {
      daysCount: toNumber(row.daysCount),
      netSales,
      grossSales: toNumber(row.grossSales),
      taxCollected,
      totalRevenue,
      grossReceipt: totalRevenue, // backward compat
      totalCash: toNumber(row.totalCash),
      totalCards: toNumber(row.totalCards),
      numGuest: toNumber(row.numGuest),

      vatableSales: toNumber(row.vatableSales),
      vatExemptSales: toNumber(row.vatExemptSales),
      vatZeroRatedSales: toNumber(row.vatZeroRatedSales),
      lessVat: toNumber(row.lessVat),

      seniorCitizen,
      pwd,
      employee,
      nationalAthlete,
      soloParent,
      otherDiscount,
      totalDiscount,

      gcSales: toNumber(row.gcSales),
      gcExcess: toNumber(row.gcExcess),
      voidAmount: toNumber(row.voidAmount),
      voidCount: toNumber(row.voidCount),
    };

    // 2. Query Tender Breakdown from dbo.agg_daily_tender
    const tenderReq = pool.request();
    tenderReq.input('locationName', sql.VarChar(50), strLocation);
    tenderReq.input('dateFrom', sql.Date, strDateFrom);
    tenderReq.input('dateTo', sql.Date, strDateTo);

    const tenderRes = await tenderReq.query(`
      SELECT 
        tendername AS tenderName,
        ISNULL(SUM(tender_total), 0) AS amount
      FROM dbo.agg_daily_tender
      WHERE locationname = @locationName
        AND businessdate BETWEEN @dateFrom AND @dateTo
      GROUP BY tendername
      ORDER BY amount DESC
    `);

    let tenderTotalAmount = 0;
    const tendersRaw = tenderRes.recordset.map((t) => {
      const amount = toNumber(t.amount);
      tenderTotalAmount += amount;
      return {
        tenderName: String(t.tenderName ?? 'UNKNOWN').trim(),
        amount,
      };
    });

    const tenders = tendersRaw.map((t) => ({
      ...t,
      sharePct: tenderTotalAmount > 0 ? (t.amount / tenderTotalAmount) * 100 : 0,
    }));

    res.json({
      locationName: strLocation,
      dateFrom: strDateFrom,
      dateTo: strDateTo,
      summary,
      tenders,
      tenderTotalAmount,
    });
  } catch (error) {
    console.error('Failed to generate System Sales summary:', error);
    res.status(500).json({ message: 'Failed to generate System Sales summary' });
  }
});
