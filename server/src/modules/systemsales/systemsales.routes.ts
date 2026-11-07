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

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

/**
 * GET /api/reports/system-sales/void-transactions
 * Audits voided transactions (FCRINVNUM appearing > 1 in FCR_INVOICE_DATA)
 * Query params: locationName, dateFrom, dateTo
 */
systemSalesRouter.get('/void-transactions', async (req, res) => {
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
    const reqSql = pool.request();
    reqSql.input('locationName', sql.VarChar(50), strLocation);
    reqSql.input('dateFrom', sql.Date, strDateFrom);
    reqSql.input('dateTo', sql.Date, strDateTo);

    const queryResult = await reqSql.query(`
      SELECT 
        locationid,
        locationame,
        Businessdate,
        Transdatetime,
        GrossSale,
        FCRINVNUM,
        checknum,
        posname
      FROM dbo.FCR_INVOICE_DATA
      WHERE fcrinvnum IN (
          SELECT fcrinvnum
          FROM dbo.FCR_INVOICE_DATA
          WHERE businessdate BETWEEN @dateFrom AND @dateTo
            AND locationame = @locationName
            AND FCRINVNUM <> ''
          GROUP BY fcrinvnum
          HAVING COUNT(*) > 1
      )
        AND businessdate BETWEEN @dateFrom AND @dateTo
        AND locationame = @locationName
        AND FCRINVNUM <> ''
      ORDER BY fcrinvnum, Transdatetime ASC
    `);

    // Group rows by fcrinvnum
    const grouped = new Map<string, any[]>();
    for (const row of queryResult.recordset) {
      const inv = String(row.FCRINVNUM ?? '').trim();
      if (!inv) continue;
      const list = grouped.get(inv) || [];
      list.push(row);
      grouped.set(inv, list);
    }

    const items: Array<{
      fcrInvNum: string;
      checkNum: string;
      posName: string;
      businessDate: string;
      startTime: string;
      voidTime: string;
      intervalSeconds: number;
      intervalFormatted: string;
      voidAmount: number;
      transactionCount: number;
      records: Array<{
        transdatetime: string;
        grossSale: number;
        posname: string;
        checknum: string;
      }>;
    }> = [];

    let totalIntervalSeconds = 0;
    let totalVoidAmount = 0;

    for (const [invNum, rows] of grouped.entries()) {
      // Sort rows by Transdatetime ascending
      rows.sort((a, b) => new Date(a.Transdatetime).getTime() - new Date(b.Transdatetime).getTime());

      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];

      const startDt = new Date(firstRow.Transdatetime);
      const voidDt = new Date(lastRow.Transdatetime);

      const diffMs = Math.max(0, voidDt.getTime() - startDt.getTime());
      const intervalSec = Math.round(diffMs / 1000);
      totalIntervalSeconds += intervalSec;

      const voidAmt = Math.max(...rows.map((r) => Math.abs(toNumber(r.GrossSale))));
      totalVoidAmount += voidAmt;

      const bDateStr = firstRow.Businessdate
        ? (new Date(firstRow.Businessdate).toISOString().split('T')[0] ?? '')
        : '';

      const formatIsoTime = (d: Date) =>
        isNaN(d.getTime()) ? '' : d.toISOString().replace('T', ' ').substring(0, 19);

      items.push({
        fcrInvNum: invNum,
        checkNum: String(firstRow.checknum ?? lastRow.checknum ?? '-').trim(),
        posName: String(firstRow.posname ?? lastRow.posname ?? '-').trim(),
        businessDate: bDateStr,
        startTime: formatIsoTime(startDt),
        voidTime: formatIsoTime(voidDt),
        intervalSeconds: intervalSec,
        intervalFormatted: formatDuration(intervalSec),
        voidAmount: voidAmt,
        transactionCount: rows.length,
        records: rows.map((r) => ({
          transdatetime: r.Transdatetime ? formatIsoTime(new Date(r.Transdatetime)) : '',
          grossSale: toNumber(r.GrossSale),
          posname: String(r.posname ?? '').trim(),
          checknum: String(r.checknum ?? '').trim(),
        })),
      });
    }

    // Sort items by businessDate desc, then startTime desc
    items.sort((a, b) => b.startTime.localeCompare(a.startTime));

    const avgIntervalSeconds =
      items.length > 0 ? Math.round(totalIntervalSeconds / items.length) : 0;

    res.json({
      locationName: strLocation,
      dateFrom: strDateFrom,
      dateTo: strDateTo,
      summary: {
        totalVoidCount: items.length,
        totalVoidAmount,
        avgIntervalSeconds,
        avgIntervalFormatted: formatDuration(avgIntervalSeconds),
      },
      items,
    });
  } catch (error) {
    console.error('Failed to generate Void Transactions report:', error);
    res.status(500).json({ message: 'Failed to retrieve void transactions from database.' });
  }
});

/**
 * GET /api/reports/system-sales/cancel-items
 * Audits individual item-level cancellations (Item Sale with LINETOTAL < 0)
 * Query params: locationName, dateFrom, dateTo
 */
systemSalesRouter.get('/cancel-items', async (req, res) => {
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
    const reqSql = pool.request();
    reqSql.input('locationName', sql.VarChar(50), strLocation);
    reqSql.input('dateFrom', sql.Date, strDateFrom);
    reqSql.input('dateTo', sql.Date, strDateTo);

    const queryResult = await reqSql.query(`
      SELECT 
        v.locationname,
        v.businessdate,
        v.transdatetime,
        v.FCRINVNUM,
        f.checknum,
        v.ITEMNUMBER,
        v.ITEMNAME,
        v.LINECOUNT,
        v.LINETOTAL
      FROM dbo.v_salesdetails v
      OUTER APPLY (
        SELECT TOP 1 checknum 
        FROM dbo.FCR_INVOICE_DATA f 
        WHERE v.GUESTCHECKID = f.guestcheckid AND v.locationname = f.locationame
      ) f
      WHERE v.businessdate BETWEEN @dateFrom AND @dateTo
        AND v.locationname = @locationName
        AND v.FCRINVNUM <> ''
        AND v.TRANSACTIONTYPE = 'Item Sale'
        AND v.LINETOTAL < 0
        AND v.FCRINVNUM NOT IN (
          SELECT fcrinvnum
          FROM dbo.FCR_INVOICE_DATA
          WHERE businessdate BETWEEN @dateFrom AND @dateTo
            AND locationame = @locationName
            AND FCRINVNUM <> ''
          GROUP BY fcrinvnum
          HAVING COUNT(*) > 1
        )
      ORDER BY v.GUESTCHECKID, v.transdatetime ASC
    `);

    let totalQty = 0;
    let totalAmount = 0;
    const checkSet = new Set<string>();

    const items = queryResult.recordset.map((r) => {
      const qty = Math.abs(toNumber(r.LINECOUNT));
      const amt = Math.abs(toNumber(r.LINETOTAL));
      totalQty += qty;
      totalAmount += amt;

      const inv = String(r.FCRINVNUM ?? '').trim();
      if (inv) checkSet.add(inv);

      const bDateStr = r.businessdate
        ? (new Date(r.businessdate).toISOString().split('T')[0] ?? '')
        : '';

      const tDate = r.transdatetime ? new Date(r.transdatetime) : null;
      const tDateStr =
        tDate && !isNaN(tDate.getTime())
          ? tDate.toISOString().replace('T', ' ').substring(0, 19)
          : '';

      return {
        locationName: String(r.locationname ?? '').trim(),
        businessDate: bDateStr,
        transDatetime: tDateStr,
        fcrInvNum: inv,
        checkNum: r.checknum != null ? String(r.checknum).trim() : '-',
        itemNumber: String(r.ITEMNUMBER ?? '').trim(),
        itemName: String(r.ITEMNAME ?? '').trim(),
        lineCount: qty,
        rawLineCount: toNumber(r.LINECOUNT),
        lineTotal: amt,
        rawLineTotal: toNumber(r.LINETOTAL),
      };
    });

    res.json({
      locationName: strLocation,
      dateFrom: strDateFrom,
      dateTo: strDateTo,
      summary: {
        totalCancelledQty: totalQty,
        totalCancelledAmount: totalAmount,
        rowCount: items.length,
        uniqueChecks: checkSet.size,
      },
      items,
    });
  } catch (error) {
    console.error('Failed to generate Cancel Items report:', error);
    res.status(500).json({ message: 'Failed to retrieve cancel items from database.' });
  }
});
