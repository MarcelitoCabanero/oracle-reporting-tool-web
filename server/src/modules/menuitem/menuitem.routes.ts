import { Router } from 'express';
import { getPool, sql } from '../../database/db.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const menuItemRouter = Router();

// Protect all Menu Item endpoints with requireAuth
menuItemRouter.use(requireAuth);

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

const STANDARD_SALES_TYPE_ORDER = ['NORMAL', 'DEL-FP', 'DEL-GRB', 'FOC'];

function sortSalesTypes(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const upperA = a.toUpperCase();
    const upperB = b.toUpperCase();
    const idxA = STANDARD_SALES_TYPE_ORDER.indexOf(upperA);
    const idxB = STANDARD_SALES_TYPE_ORDER.indexOf(upperB);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

interface DtsDetailsGroupColMeta {
  majorCol: string | null;
  familyCol: string | null;
}

let cachedGroupColMeta: DtsDetailsGroupColMeta | null = null;

async function resolveDtsDetailsGroupColumns(pool: sql.ConnectionPool): Promise<DtsDetailsGroupColMeta> {
  if (cachedGroupColMeta) {
    return cachedGroupColMeta;
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
      cols.get('MAJORGROUP') ??
      cols.get('MAJORGROUPNAME') ??
      cols.get('MAJOR_GROUP') ??
      null;

    const familyCol =
      cols.get('FAMILYGROUP') ??
      cols.get('FAMILYGROUPNAME') ??
      cols.get('FAMILY_GROUP') ??
      null;

    cachedGroupColMeta = { majorCol, familyCol };
    return cachedGroupColMeta;
  } catch {
    return { majorCol: 'MAJORGROUP', familyCol: 'FAMILYGROUP' };
  }
}

/**
 * GET /api/reports/menu-item/stores
 * Returns all active physical store locations (IsActive = 1 AND access = 'Store')
 */
menuItemRouter.get('/stores', async (_req, res) => {
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
    console.error('Error fetching active stores for Menu Item:', error);
    res.status(500).json({ error: 'Failed to retrieve store locations from database.' });
  }
});

/**
 * POST /api/reports/menu-item/by-sales-type
 * Queries dbo.dts_details for Menu Item by Sales Type (REVENUECENTERNAME)
 */
menuItemRouter.post('/by-sales-type', async (req, res) => {
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

  const trimmedLocation = locationName.trim();

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .query(`
        SELECT 
          Locationname,
          ITEMNUMBER,
          ITEMNAME,
          SUM(LINECOUNT) AS qty,
          SUM(LINETOTAL) AS AmtTotal,
          ROUND(
            SUM(
              CASE
                WHEN TRANSACTIONTYPE = 'Item Sale'
                  THEN (
                    ISNULL(LessVAT, 0) +
                    ISNULL(LessSC, 0) +
                    ISNULL(LessPWD, 0) +
                    ISNULL(lessEMP, 0) +
                    ISNULL(lessNationalAth, 0)
                  )
                ELSE 0
              END
            ),
            2
          ) AS itemDiscount, 
          SUM(netsales) AS netsales,
          REVENUECENTERNAME AS SalesType
        FROM dbo.dts_details
        WHERE businessdate BETWEEN @dateFrom AND @dateTo
          AND TRANSACTIONTYPE = 'Item Sale'
          AND ITEMNUMBER NOT IN (9801, 9802, 9803)
          AND locationname = @locationName
        GROUP BY
          Locationname,
          ITEMNUMBER,
          ITEMNAME,
          REVENUECENTERNAME
        ORDER BY
          ITEMNUMBER ASC,
          REVENUECENTERNAME ASC
      `);

    const salesTypeSet = new Set<string>();
    const rows = result.recordset.map((row) => {
      const rawSalesType = String(row.SalesType ?? '').trim();
      const salesType = rawSalesType || 'UNSPECIFIED';
      salesTypeSet.add(salesType);

      return {
        locationName: String(row.Locationname ?? trimmedLocation),
        itemNumber: String(row.ITEMNUMBER ?? ''),
        itemName: String(row.ITEMNAME ?? ''),
        qty: Number(row.qty ?? 0),
        grossAmount: Number(row.AmtTotal ?? 0),
        itemDiscount: Number(row.itemDiscount ?? 0),
        netSales: Number(row.netsales ?? 0),
        salesType,
      };
    });

    const salesTypes = sortSalesTypes(Array.from(salesTypeSet));

    const totals = rows.reduce(
      (acc, r) => {
        acc.qty += r.qty;
        acc.grossAmount += r.grossAmount;
        acc.itemDiscount += r.itemDiscount;
        acc.netSales += r.netSales;
        return acc;
      },
      { qty: 0, grossAmount: 0, itemDiscount: 0, netSales: 0 }
    );

    res.json({
      filters: {
        locationName: trimmedLocation,
        dateFrom,
        dateTo,
      },
      salesTypes,
      rows,
      totals,
    });
  } catch (error) {
    console.error('Error fetching Menu Item by Sales Type:', error);
    res.status(500).json({
      error: `Failed to retrieve Menu Item by Sales Type: ${(error as Error).message}`,
    });
  }
});

/**
 * POST /api/reports/menu-item/summary
 * Queries dbo.dts_details for Menu Item Summary + Daily Sales Trend for Graphical Report
 */
menuItemRouter.post('/summary', async (req, res) => {
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

  const trimmedLocation = locationName.trim();

  try {
    const pool = await getPool();
    const groupMeta = await resolveDtsDetailsGroupColumns(pool);

    const hasDirectMajor = Boolean(groupMeta.majorCol);
    const hasDirectFamily = Boolean(groupMeta.familyCol);
    const needsObjectJoin = !hasDirectMajor || !hasDirectFamily;

    const majorSelectExpr = hasDirectMajor
      ? `d.[${groupMeta.majorCol}]`
      : `o.majorgroup`;
    const familySelectExpr = hasDirectFamily
      ? `d.[${groupMeta.familyCol}]`
      : `o.familygroup`;

    const joinClause = needsObjectJoin
      ? `LEFT JOIN dbo.dts_object o ON CAST(d.ITEMNUMBER AS VARCHAR(50)) = CAST(o.itemnumber AS VARCHAR(50))`
      : '';

    const summaryRequest = pool
      .request()
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo);

    const trendRequest = pool
      .request()
      .input('locationName', sql.VarChar(100), trimmedLocation)
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo);

    const [summaryRes, trendRes] = await Promise.all([
      summaryRequest.query(`
        SELECT
          d.Locationname,
          d.ITEMNUMBER,
          d.ITEMNAME,
          ${majorSelectExpr} AS MajorGroup,
          ${familySelectExpr} AS FamilyGroup,
          SUM(d.LINECOUNT) AS qty,
          SUM(d.LINETOTAL) AS AmtTotal,
          ROUND(
            SUM(
              CASE
                WHEN d.TRANSACTIONTYPE = 'Item Sale'
                  THEN (
                    ISNULL(d.LessVAT, 0) +
                    ISNULL(d.LessSC, 0) +
                    ISNULL(d.LessPWD, 0) +
                    ISNULL(d.lessEMP, 0) +
                    ISNULL(d.lessNationalAth, 0)
                  )
                ELSE 0
              END
            ),
            2
          ) AS itemDiscount,
          SUM(d.netsales) AS netsales
        FROM dbo.dts_details d
        ${joinClause}
        WHERE d.businessdate BETWEEN @dateFrom AND @dateTo
          AND d.TRANSACTIONTYPE = 'Item Sale'
          AND d.ITEMNUMBER NOT IN (9801, 9802, 9803)
          AND d.locationname = @locationName
        GROUP BY
          d.Locationname,
          d.ITEMNUMBER,
          d.ITEMNAME,
          ${majorSelectExpr},
          ${familySelectExpr}
        ORDER BY
          d.ITEMNUMBER ASC
      `),
      trendRequest.query(`
        SELECT
          businessdate,
          SUM(LINECOUNT) AS qty,
          SUM(LINETOTAL) AS AmtTotal,
          ROUND(
            SUM(
              CASE
                WHEN TRANSACTIONTYPE = 'Item Sale'
                  THEN (
                    ISNULL(LessVAT, 0) +
                    ISNULL(LessSC, 0) +
                    ISNULL(LessPWD, 0) +
                    ISNULL(lessEMP, 0) +
                    ISNULL(lessNationalAth, 0)
                  )
                ELSE 0
              END
            ),
            2
          ) AS itemDiscount,
          SUM(netsales) AS netsales
        FROM dbo.dts_details
        WHERE businessdate BETWEEN @dateFrom AND @dateTo
          AND TRANSACTIONTYPE = 'Item Sale'
          AND ITEMNUMBER NOT IN (9801, 9802, 9803)
          AND locationname = @locationName
        GROUP BY businessdate
        ORDER BY businessdate ASC
      `),
    ]);

    const majorGroupSet = new Set<string>();
    const familyGroupSet = new Set<string>();

    const rows = summaryRes.recordset.map((row) => {
      const majorGroup = String(row.MajorGroup ?? '').trim() || 'Uncategorized';
      const familyGroup = String(row.FamilyGroup ?? '').trim() || 'Uncategorized';
      majorGroupSet.add(majorGroup);
      familyGroupSet.add(familyGroup);

      return {
        locationName: String(row.Locationname ?? trimmedLocation),
        itemNumber: String(row.ITEMNUMBER ?? ''),
        itemName: String(row.ITEMNAME ?? ''),
        majorGroup,
        familyGroup,
        qty: Number(row.qty ?? 0),
        grossAmount: Number(row.AmtTotal ?? 0),
        itemDiscount: Number(row.itemDiscount ?? 0),
        netSales: Number(row.netsales ?? 0),
      };
    });

    const dailyTrend = trendRes.recordset.map((row) => ({
      businessDate: formatDateOnly(row.businessdate),
      qty: Number(row.qty ?? 0),
      grossAmount: Number(row.AmtTotal ?? 0),
      itemDiscount: Number(row.itemDiscount ?? 0),
      netSales: Number(row.netsales ?? 0),
    }));

    const majorGroups = Array.from(majorGroupSet).sort((a, b) => a.localeCompare(b));
    const familyGroups = Array.from(familyGroupSet).sort((a, b) => a.localeCompare(b));

    const totals = rows.reduce(
      (acc, r) => {
        acc.qty += r.qty;
        acc.grossAmount += r.grossAmount;
        acc.itemDiscount += r.itemDiscount;
        acc.netSales += r.netSales;
        return acc;
      },
      { qty: 0, grossAmount: 0, itemDiscount: 0, netSales: 0 }
    );

    res.json({
      filters: {
        locationName: trimmedLocation,
        dateFrom,
        dateTo,
      },
      majorGroups,
      familyGroups,
      rows,
      dailyTrend,
      totals,
    });
  } catch (error) {
    console.error('Error fetching Menu Item Summary:', error);
    res.status(500).json({
      error: `Failed to retrieve Menu Item Summary: ${(error as Error).message}`,
    });
  }
});
