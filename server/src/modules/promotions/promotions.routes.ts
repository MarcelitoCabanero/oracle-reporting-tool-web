import { Router } from 'express';
import { getPool, sql } from '../../database/db.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const promotionsRouter = Router();

// Protect all Promotions endpoints with requireAuth
promotionsRouter.use(requireAuth);

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

interface DtsDetailsMeta {
  majorCol: string | null;
  familyCol: string | null;
  hasGuestCheckId: boolean;
  hasFcrInvNum: boolean;
  hasTransDatetime: boolean;
  hasRevenueCenterName: boolean;
  hasNetSales: boolean;
}

let cachedDtsMeta: DtsDetailsMeta | null = null;

async function resolveDtsDetailsMeta(pool: sql.ConnectionPool): Promise<DtsDetailsMeta> {
  if (cachedDtsMeta) {
    return cachedDtsMeta;
  }

  try {
    const colRes = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'dts_details'
    `);

    const cols = new Map<string, string>();
    for (const row of colRes.recordset) {
      const name = String(row.COLUMN_NAME ?? '');
      cols.set(name.toUpperCase(), name);
    }

    const majorCol =
      cols.get('MAJORGROUPNAME') ??
      cols.get('MAJORGROUP') ??
      cols.get('MAJOR_GROUP') ??
      null;

    const familyCol =
      cols.get('FAMILYGROUPNAME') ??
      cols.get('FAMILYGROUP') ??
      cols.get('FAMILY_GROUP') ??
      null;

    cachedDtsMeta = {
      majorCol,
      familyCol,
      hasGuestCheckId: cols.has('GUESTCHECKID'),
      hasFcrInvNum: cols.has('FCRINVNUM'),
      hasTransDatetime: cols.has('TRANSDATETIME'),
      hasRevenueCenterName: cols.has('REVENUECENTERNAME'),
      hasNetSales: cols.has('NETSALES'),
    };
    return cachedDtsMeta;
  } catch {
    return {
      majorCol: 'MAJORGROUPNAME',
      familyCol: 'FAMILYGROUPNAME',
      hasGuestCheckId: true,
      hasFcrInvNum: true,
      hasTransDatetime: true,
      hasRevenueCenterName: true,
      hasNetSales: true,
    };
  }
}

interface DtsObjectMeta {
  itemNumCol: string;
  itemNameCol: string;
  majorCol: string;
  familyCol: string | null;
}

let cachedDtsObjectMeta: DtsObjectMeta | null = null;

async function resolveDtsObjectMeta(pool: sql.ConnectionPool): Promise<DtsObjectMeta> {
  if (cachedDtsObjectMeta) {
    return cachedDtsObjectMeta;
  }

  try {
    const colRes = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'dts_object'
    `);

    const cols = new Map<string, string>();
    for (const row of colRes.recordset) {
      const name = String(row.COLUMN_NAME ?? '');
      cols.set(name.toUpperCase(), name);
    }

    const itemNumCol =
      cols.get('ITEMNUMBER') ??
      cols.get('OBJECTNUMBER') ??
      cols.get('ITEMCODE') ??
      cols.get('ITEM_NUMBER') ??
      'itemnumber';

    const itemNameCol =
      cols.get('ITEMNAME') ??
      cols.get('OBJECTNAME') ??
      cols.get('NAME') ??
      cols.get('DESCRIPTION') ??
      cols.get('ITEM_NAME') ??
      'itemname';

    const majorCol =
      cols.get('MAJORGROUP') ??
      cols.get('MAJORGROUPNAME') ??
      cols.get('MAJOR_GROUP') ??
      'majorgroup';

    const familyCol =
      cols.get('FAMILYGROUP') ??
      cols.get('FAMILYGROUPNAME') ??
      cols.get('FAMILY_GROUP') ??
      null;

    cachedDtsObjectMeta = { itemNumCol, itemNameCol, majorCol, familyCol };
    return cachedDtsObjectMeta;
  } catch {
    return {
      itemNumCol: 'itemnumber',
      itemNameCol: 'itemname',
      majorCol: 'majorgroup',
      familyCol: 'familygroup',
    };
  }
}

/**
 * GET /api/reports/promotions/stores
 * Returns all active physical store locations (IsActive = 1 AND access = 'Store')
 */
promotionsRouter.get('/stores', async (_req, res) => {
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
    console.error('Error fetching active stores for Promotions:', error);
    res.status(500).json({ error: 'Failed to retrieve store locations from database.' });
  }
});

/**
 * GET /api/reports/promotions/catalog
 * Queries dbo.dts_object WHERE majorgroup = 'Promotion'
 * so the user can filter by promotion name/item before or after generating the report.
 */
promotionsRouter.get('/catalog', async (_req, res) => {
  try {
    const pool = await getPool();
    const objMeta = await resolveDtsObjectMeta(pool);
    const familySelect = objMeta.familyCol
      ? `[${objMeta.familyCol}] AS familyGroup`
      : `'Promotion' AS familyGroup`;

    const result = await pool.request().query(`
      SELECT DISTINCT
        CAST([${objMeta.itemNumCol}] AS VARCHAR(50)) AS itemNumber,
        [${objMeta.itemNameCol}] AS itemName,
        [${objMeta.majorCol}] AS majorGroup,
        ${familySelect}
      FROM dbo.dts_object
      WHERE [${objMeta.majorCol}] = 'Promotion'
      ORDER BY [${objMeta.itemNameCol}] ASC
    `);

    const catalog = result.recordset
      .map((r) => ({
        itemNumber: String(r.itemNumber ?? '').trim(),
        itemName: String(r.itemName ?? '').trim(),
        majorGroup: String(r.majorGroup ?? 'Promotion').trim(),
        familyGroup: String(r.familyGroup ?? 'Promotion').trim(),
      }))
      .filter((item) => item.itemNumber || item.itemName);

    res.json({ promotions: catalog });
  } catch (error) {
    console.error('Error fetching promotion catalog from dts_object:', error);
    res.status(500).json({
      error: `Failed to retrieve promotion catalog from dts_object: ${(error as Error).message}`,
    });
  }
});

/**
 * POST /api/reports/promotions/summary
 * Queries dbo.dts_details for all Promotion items (MAJORGROUPNAME = 'Promotion', TRANSACTIONTYPE = 'Item Sale')
 * Supports single store or ALL stores ('ALL'), optional promo itemNumber/itemName filter from dts_object,
 * and business date range.
 */
promotionsRouter.post('/summary', async (req, res) => {
  const { locationName, dateFrom, dateTo, itemNumber, promoName } = req.body ?? {};

  if (!locationName || typeof locationName !== 'string' || !locationName.trim()) {
    res.status(400).json({ error: 'Store / Location selection is required.' });
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

  const trimmedLocation = locationName.trim();
  const isAllStores = trimmedLocation.toUpperCase() === 'ALL';
  const trimmedItemNumber =
    typeof itemNumber === 'string' && itemNumber.trim() && itemNumber.trim().toUpperCase() !== 'ALL'
      ? itemNumber.trim()
      : '';
  const trimmedPromoName =
    typeof promoName === 'string' && promoName.trim() ? promoName.trim() : '';

  try {
    const pool = await getPool();
    const meta = await resolveDtsDetailsMeta(pool);

    const hasDirectMajor = Boolean(meta.majorCol);
    const hasDirectFamily = Boolean(meta.familyCol);
    const needsObjectJoin = !hasDirectMajor || !hasDirectFamily;

    const majorExpr = hasDirectMajor ? `d.[${meta.majorCol}]` : `o.majorgroup`;
    const familyExpr = hasDirectFamily ? `d.[${meta.familyCol}]` : `o.familygroup`;
    const joinClause = needsObjectJoin
      ? `LEFT JOIN dbo.dts_object o ON CAST(d.ITEMNUMBER AS VARCHAR(50)) = CAST(o.itemnumber AS VARCHAR(50))`
      : '';

    const checkCountExpr = meta.hasGuestCheckId
      ? `COUNT(DISTINCT d.GUESTCHECKID)`
      : meta.hasFcrInvNum
      ? `COUNT(DISTINCT d.FCRINVNUM)`
      : `COUNT(*)`;

    const netSalesExpr = meta.hasNetSales
      ? `SUM(ISNULL(d.netsales, d.linetotal))`
      : `SUM(d.linetotal)`;

    const locationWhereClause = isAllStores ? '' : 'AND d.locationname = @locationName';
    const promoFilterClause = trimmedItemNumber
      ? 'AND CAST(d.Itemnumber AS VARCHAR(50)) = @itemNumber'
      : trimmedPromoName
      ? 'AND d.ITEMNAME = @promoName'
      : '';

    const summaryReq = pool
      .request()
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .input('itemNumber', sql.VarChar(50), trimmedItemNumber)
      .input('promoName', sql.VarChar(255), trimmedPromoName);

    const trendReq = pool
      .request()
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .input('itemNumber', sql.VarChar(50), trimmedItemNumber)
      .input('promoName', sql.VarChar(255), trimmedPromoName);

    const [summaryRes, trendRes] = await Promise.all([
      summaryReq.query(`
        SELECT
          d.locationname AS locationName,
          d.Itemnumber AS itemNumber,
          d.ITEMNAME AS itemName,
          ${familyExpr} AS familyGroup,
          SUM(d.LINECOUNT) AS qty,
          SUM(d.linetotal) AS amt,
          ${netSalesExpr} AS netSales,
          ${checkCountExpr} AS checkCount
        FROM dbo.dts_details d
        ${joinClause}
        WHERE ${majorExpr} = 'Promotion'
          AND d.TRANSACTIONTYPE = 'Item Sale'
          AND d.businessdate BETWEEN @dateFrom AND @dateTo
          ${locationWhereClause}
          ${promoFilterClause}
        GROUP BY
          d.locationname,
          d.Itemnumber,
          d.ITEMNAME,
          ${familyExpr}
        ORDER BY
          SUM(d.linetotal) DESC,
          SUM(d.LINECOUNT) DESC,
          d.locationname ASC
      `),
      trendReq.query(`
        SELECT
          d.businessdate AS businessDate,
          SUM(d.LINECOUNT) AS qty,
          SUM(d.linetotal) AS amt,
          ${netSalesExpr} AS netSales,
          ${checkCountExpr} AS checkCount
        FROM dbo.dts_details d
        ${joinClause}
        WHERE ${majorExpr} = 'Promotion'
          AND d.TRANSACTIONTYPE = 'Item Sale'
          AND d.businessdate BETWEEN @dateFrom AND @dateTo
          ${locationWhereClause}
          ${promoFilterClause}
        GROUP BY d.businessdate
        ORDER BY d.businessdate ASC
      `),
    ]);

    const rows = summaryRes.recordset.map((r) => ({
      locationName: String(r.locationName ?? '').trim(),
      itemNumber: String(r.itemNumber ?? '').trim(),
      itemName: String(r.itemName ?? '').trim(),
      familyGroup: String(r.familyGroup ?? '').trim() || 'Promotion',
      qty: Number(r.qty ?? 0),
      amt: Number(r.amt ?? 0),
      netSales: Number(r.netSales ?? 0),
      checkCount: Number(r.checkCount ?? 0),
    }));

    const dailyTrend = trendRes.recordset.map((r) => ({
      businessDate: formatDateOnly(r.businessDate),
      qty: Number(r.qty ?? 0),
      amt: Number(r.amt ?? 0),
      netSales: Number(r.netSales ?? 0),
      checkCount: Number(r.checkCount ?? 0),
    }));

    const storeSet = new Set<string>();
    const promoSet = new Set<string>();
    let totalQty = 0;
    let totalAmt = 0;
    let totalNetSales = 0;
    let totalChecks = 0;

    for (const r of rows) {
      if (r.locationName) storeSet.add(r.locationName);
      if (r.itemNumber) promoSet.add(r.itemNumber);
      totalQty += r.qty;
      totalAmt += r.amt;
      totalNetSales += r.netSales;
      totalChecks += r.checkCount;
    }

    res.json({
      filters: {
        locationName: isAllStores ? 'ALL' : trimmedLocation,
        dateFrom,
        dateTo,
        itemNumber: trimmedItemNumber || null,
        promoName: trimmedPromoName || null,
      },
      totals: {
        qty: totalQty,
        amt: totalAmt,
        netSales: totalNetSales,
        checkCount: totalChecks,
        activeStoreCount: storeSet.size,
        uniquePromoCount: promoSet.size,
      },
      rows,
      dailyTrend,
    });
  } catch (error) {
    console.error('Error fetching Promotions summary:', error);
    res.status(500).json({
      error: `Failed to retrieve Promotion summary: ${(error as Error).message}`,
    });
  }
});

/**
 * POST /api/reports/promotions/check-details
 * Drill-down into guest checks / receipts where a specific promotion item was sold.
 * Returns Target Promotion, Bundled (zero-price component), and Co-Sold items on those receipts.
 */
promotionsRouter.post('/check-details', async (req, res) => {
  const { locationName, itemNumber, itemName, dateFrom, dateTo } = req.body ?? {};

  if (!itemNumber || String(itemNumber).trim() === '') {
    res.status(400).json({ error: 'Promotion Item Number is required for check details.' });
    return;
  }

  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: 'Date From and Date To are required.' });
    return;
  }

  const trimmedItemNumber = String(itemNumber).trim();
  const trimmedLocation = typeof locationName === 'string' ? locationName.trim() : 'ALL';
  const isAllStores = !trimmedLocation || trimmedLocation.toUpperCase() === 'ALL';

  try {
    const pool = await getPool();
    const meta = await resolveDtsDetailsMeta(pool);

    const hasDirectMajor = Boolean(meta.majorCol);
    const hasDirectFamily = Boolean(meta.familyCol);
    const needsObjectJoin = !hasDirectMajor || !hasDirectFamily;

    const majorExpr = hasDirectMajor ? `d.[${meta.majorCol}]` : `o.majorgroup`;
    const familyExpr = hasDirectFamily ? `d.[${meta.familyCol}]` : `o.familygroup`;
    const joinClause = needsObjectJoin
      ? `LEFT JOIN dbo.dts_object o ON CAST(d.ITEMNUMBER AS VARCHAR(50)) = CAST(o.itemnumber AS VARCHAR(50))`
      : '';

    const checkKeyCol = meta.hasGuestCheckId ? 'GUESTCHECKID' : 'FCRINVNUM';
    const locationFilterPromo = isAllStores ? '' : 'AND p.locationname = @locationName';

    const pairedReq = pool
      .request()
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .input('itemNumber', sql.VarChar(50), trimmedItemNumber)
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo);

    // Paired, Bundled, and Co-Sold items across ALL checks that contained this promotion item
    const pairedQuery = `
      ;WITH PromoChecks AS (
        SELECT DISTINCT
          p.locationname,
          p.businessdate,
          p.${checkKeyCol} AS checkKey
        FROM dbo.dts_details p
        WHERE p.businessdate BETWEEN @dateFrom AND @dateTo
          AND p.TRANSACTIONTYPE = 'Item Sale'
          AND CAST(p.ITEMNUMBER AS VARCHAR(50)) = @itemNumber
          ${locationFilterPromo}
          AND p.${checkKeyCol} IS NOT NULL
      )
      SELECT
        CAST(d.ITEMNUMBER AS VARCHAR(50)) AS itemNumber,
        d.ITEMNAME AS itemName,
        ${majorExpr} AS majorGroup,
        ${familyExpr} AS familyGroup,
        COUNT(DISTINCT CONCAT(d.locationname, '|', CONVERT(VARCHAR(10), d.businessdate, 120), '|', CAST(d.${checkKeyCol} AS VARCHAR(100)))) AS checkFrequency,
        SUM(d.LINECOUNT) AS totalQty,
        SUM(d.linetotal) AS totalAmt
      FROM dbo.dts_details d
      INNER JOIN PromoChecks pc
        ON d.locationname = pc.locationname
        AND d.businessdate = pc.businessdate
        AND d.${checkKeyCol} = pc.checkKey
      ${joinClause}
      WHERE d.TRANSACTIONTYPE = 'Item Sale'
        AND d.businessdate BETWEEN @dateFrom AND @dateTo
      GROUP BY
        CAST(d.ITEMNUMBER AS VARCHAR(50)),
        d.ITEMNAME,
        ${majorExpr},
        ${familyExpr}
      ORDER BY
        CASE
          WHEN CAST(d.ITEMNUMBER AS VARCHAR(50)) = @itemNumber THEN 0
          WHEN ABS(SUM(ISNULL(d.linetotal, 0))) < 0.005 THEN 1
          ELSE 2
        END ASC,
        checkFrequency DESC,
        SUM(d.LINECOUNT) DESC
    `;

    const pairedRes = await pairedReq.query(pairedQuery);

    const pairedItems = pairedRes.recordset.map((r) => {
      const code = String(r.itemNumber ?? '').trim();
      const totalQty = Number(r.totalQty ?? 0);
      const totalAmt = Number(r.totalAmt ?? 0);
      const isSelectedPromo = code === trimmedItemNumber;
      const isZeroPriceBundleItem = !isSelectedPromo && Math.abs(totalAmt) < 0.005;
      return {
        itemNumber: code,
        itemName: String(r.itemName ?? '').trim(),
        majorGroup: String(r.majorGroup ?? '').trim() || 'Uncategorized',
        familyGroup: String(r.familyGroup ?? '').trim() || 'Uncategorized',
        checkFrequency: Number(r.checkFrequency ?? 0),
        totalQty,
        totalAmt,
        isSelectedPromo,
        isZeroPriceBundleItem,
      };
    });

    const targetPromoRow = pairedItems.find((p) => p.isSelectedPromo);

    res.json({
      promo: {
        itemNumber: trimmedItemNumber,
        itemName:
          typeof itemName === 'string' && itemName.trim()
            ? itemName.trim()
            : targetPromoRow?.itemName ?? '',
        locationName: isAllStores ? 'ALL' : trimmedLocation,
        dateFrom,
        dateTo,
        totalChecksMatched: targetPromoRow?.checkFrequency ?? 0,
        totalPromoQty: targetPromoRow?.totalQty ?? 0,
        totalPromoAmt: targetPromoRow?.totalAmt ?? 0,
      },
      pairedItems,
    });
  } catch (error) {
    console.error('Error fetching Promotion check details:', error);
    res.status(500).json({
      error: `Failed to retrieve Promotion check details: ${(error as Error).message}`,
    });
  }
});
