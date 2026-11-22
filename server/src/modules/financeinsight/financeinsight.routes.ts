import { Router } from 'express';
import { getPool, sql } from '../../database/db.js';
import { requireAuth, type AuthenticatedRequest } from '../auth/auth.middleware.js';
import { enforceStoreScope, getScopedStores, isStoreAllowed } from '../auth/storeScope.js';

export const financeInsightRouter = Router();

financeInsightRouter.use(requireAuth);
financeInsightRouter.use(enforceStoreScope);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STORES = 500;

function num(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function parseStores(raw: unknown, allowed?: string[]): string[] {
  const requested =
    typeof raw !== 'string' || !raw.trim() || raw.trim() === 'ALL'
      ? []
      : Array.from(
          new Set(
            raw
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ).slice(0, MAX_STORES);

  // Full-access roles: pass the request through (empty = all stores).
  if (!allowed) return requested;

  // Scoped users (Area Manager): never broader than their assigned stores.
  const inScope = requested.length === 0 ? allowed : requested.filter((s) => isStoreAllowed(allowed, s));
  // An empty filter would mean "all stores", so use a sentinel that matches nothing.
  return inScope.length === 0 ? ['__NO_ACCESS__'] : inScope;
}
/** Adds @s0..@sN inputs and returns an SQL fragment ("AND col IN (...)") or '' for all stores. */
function storeFilter(request: sql.Request, stores: string[], column: string): string {
  if (stores.length === 0) return '';
  const names = stores.map((s, i) => {
    request.input(`s${i}`, sql.VarChar(100), s);
    return `@s${i}`;
  });
  return `AND ${column} IN (${names.join(',')})`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

function validateRange(query: Record<string, unknown>): { dateFrom: string; dateTo: string } | string {
  const dateFrom = String(query.dateFrom ?? '').trim();
  const dateTo = String(query.dateTo ?? '').trim();
  if (!DATE_RE.test(dateFrom) || !DATE_RE.test(dateTo)) return 'dateFrom and dateTo (YYYY-MM-DD) are required.';
  if (dateFrom > dateTo) return 'dateFrom cannot be greater than dateTo.';
  if (daysBetween(dateFrom, dateTo) > 800) return 'Date range cannot exceed 800 days.';
  return { dateFrom, dateTo };
}

interface Totals {
  netSales: number;
  guests: number;
  checks: number;
}

async function getTotals(
  pool: sql.ConnectionPool,
  dateFrom: string,
  dateTo: string,
  stores: string[],
): Promise<Totals> {
  const dsrReq = pool.request();
  dsrReq.input('dateFrom', sql.Date, dateFrom);
  dsrReq.input('dateTo', sql.Date, dateTo);
  const dsrFilter = storeFilter(dsrReq, stores, 'locationname');
  const dsr = await dsrReq.query(`
    SELECT ISNULL(SUM(netsales), 0) AS netSales, ISNULL(SUM(numguest), 0) AS guests
    FROM dbo.agg_daily_dsr
    WHERE businessdate BETWEEN @dateFrom AND @dateTo ${dsrFilter}
  `);

  const chkReq = pool.request();
  chkReq.input('dateFrom', sql.Date, dateFrom);
  chkReq.input('dateTo', sql.Date, dateTo);
  const chkFilter = storeFilter(chkReq, stores, 'locationname');
  const chk = await chkReq.query(`
    SELECT ISNULL(SUM(check_count), 0) AS checks
    FROM dbo.agg_daily_checkcount
    WHERE businessdate BETWEEN @dateFrom AND @dateTo ${chkFilter}
  `);

  return {
    netSales: num(dsr.recordset[0]?.netSales),
    guests: num(dsr.recordset[0]?.guests),
    checks: num(chk.recordset[0]?.checks),
  };
}

/** GET /api/reports/finance-insight/stores */
financeInsightRouter.get('/stores', async (req: AuthenticatedRequest, res) => {
  try {
    const stores = await getScopedStores(req.user!);
    res.json({ stores });
  } catch (error) {
    console.error('Finance Insight: failed to load stores:', error);
    res.status(500).json({ error: 'Failed to retrieve store locations.' });
  }
});

/**
 * GET /api/reports/finance-insight/overview?dateFrom&dateTo&stores=A|B
 * Daily net sales (area), per-store net sales / APC (bar), KPI totals vs previous period.
 */
financeInsightRouter.get('/overview', async (req, res) => {
  const range = validateRange(req.query);
  if (typeof range === 'string') {
    res.status(400).json({ error: range });
    return;
  }
  const { dateFrom, dateTo } = range;
  const stores = parseStores(req.query.stores, (req as AuthenticatedRequest).allowedStoreNames);

  const spanDays = daysBetween(dateFrom, dateTo) + 1;
  const prevTo = addDays(dateFrom, -1);
  const prevFrom = addDays(prevTo, -(spanDays - 1));

  try {
    const pool = await getPool();

    const dailyReq = pool.request();
    dailyReq.input('dateFrom', sql.Date, dateFrom);
    dailyReq.input('dateTo', sql.Date, dateTo);
    const dailyFilter = storeFilter(dailyReq, stores, 'locationname');
    const daily = await dailyReq.query(`
      SELECT CONVERT(VARCHAR(10), businessdate, 23) AS businessDate,
             ISNULL(SUM(netsales), 0) AS netSales
      FROM dbo.agg_daily_dsr
      WHERE businessdate BETWEEN @dateFrom AND @dateTo ${dailyFilter}
      GROUP BY businessdate
      ORDER BY businessdate
    `);

    const storeReq = pool.request();
    storeReq.input('dateFrom', sql.Date, dateFrom);
    storeReq.input('dateTo', sql.Date, dateTo);
    const storeFilterSql = storeFilter(storeReq, stores, 'd.locationname');
    const byStore = await storeReq.query(`
      SELECT d.locationname AS locationName,
             ISNULL(SUM(d.netsales), 0) AS netSales,
             ISNULL(SUM(d.numguest), 0) AS guests,
             ISNULL(MAX(c.checks), 0) AS checks
      FROM dbo.agg_daily_dsr d
      LEFT JOIN (
        SELECT locationname, SUM(check_count) AS checks
        FROM dbo.agg_daily_checkcount
        WHERE businessdate BETWEEN @dateFrom AND @dateTo
        GROUP BY locationname
      ) c ON c.locationname = d.locationname
      WHERE d.businessdate BETWEEN @dateFrom AND @dateTo ${storeFilterSql}
      GROUP BY d.locationname
      ORDER BY SUM(d.netsales) DESC
    `);

    const [current, previous] = await Promise.all([
      getTotals(pool, dateFrom, dateTo, stores),
      getTotals(pool, prevFrom, prevTo, stores),
    ]);

    res.json({
      range: { dateFrom, dateTo, prevFrom, prevTo },
      daily: daily.recordset.map((r) => ({ date: r.businessDate, netSales: num(r.netSales) })),
      byStore: byStore.recordset.map((r) => {
        const netSales = num(r.netSales);
        const checks = num(r.checks);
        const guests = num(r.guests);
        return {
          locationName: String(r.locationName),
          netSales,
          checks,
          guests,
          apc: guests > 0 ? netSales / guests : 0,
        };
      }),
      kpis: { current, previous },
    });
  } catch (error) {
    console.error('Finance Insight overview failed:', error);
    res.status(500).json({ error: 'Failed to load Finance Insight overview.' });
  }
});

/**
 * GET /api/reports/finance-insight/sales-distribution?dateFrom&dateTo&stores=
 * Reads only dbo.agg_daily_revenuecenter.
 */
financeInsightRouter.get('/sales-distribution', async (req, res) => {
  const range = validateRange(req.query);
  if (typeof range === 'string') {
    res.status(400).json({ error: range });
    return;
  }
  const { dateFrom, dateTo } = range;
  const stores = parseStores(req.query.stores, (req as AuthenticatedRequest).allowedStoreNames);

  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('dateFrom', sql.Date, dateFrom);
    request.input('dateTo', sql.Date, dateTo);
    const filter = storeFilter(request, stores, 'locationname');
    const result = await request.query(`
      SELECT locationname AS locationName,
             revenuecentername AS revenueCenter,
             ISNULL(SUM(qty), 0) AS qty,
             ISNULL(SUM(netsales), 0) AS netSales
      FROM dbo.agg_daily_revenuecenter
      WHERE businessdate BETWEEN @dateFrom AND @dateTo ${filter}
      GROUP BY locationname, revenuecentername
    `);

    const byCenter = new Map<string, { qty: number; netSales: number }>();
    const byStoreMap = new Map<
      string,
      { locationName: string; qty: number; netSales: number; byCenter: Record<string, { qty: number; netSales: number }> }
    >();

    for (const r of result.recordset) {
      const locationName = String(r.locationName);
      const revenueCenter = String(r.revenueCenter);
      const qty = num(r.qty);
      const netSales = num(r.netSales);

      const centerEntry = byCenter.get(revenueCenter) ?? { qty: 0, netSales: 0 };
      centerEntry.qty += qty;
      centerEntry.netSales += netSales;
      byCenter.set(revenueCenter, centerEntry);

      let storeEntry = byStoreMap.get(locationName);
      if (!storeEntry) {
        storeEntry = { locationName, qty: 0, netSales: 0, byCenter: {} };
        byStoreMap.set(locationName, storeEntry);
      }
      storeEntry.qty += qty;
      storeEntry.netSales += netSales;
      const cell = storeEntry.byCenter[revenueCenter] ?? { qty: 0, netSales: 0 };
      cell.qty += qty;
      cell.netSales += netSales;
      storeEntry.byCenter[revenueCenter] = cell;
    }

    const rows = Array.from(byCenter.entries())
      .map(([revenueCenter, v]) => ({ revenueCenter, qty: v.qty, netSales: v.netSales }))
      .sort((a, b) => b.netSales - a.netSales);
    const total = rows.reduce((s, r) => s + r.netSales, 0);
    const totalQty = rows.reduce((s, r) => s + r.qty, 0);
    const byStore = Array.from(byStoreMap.values())
      .sort((a, b) => b.netSales - a.netSales)
      .map((s) => ({
        ...s,
        share: total > 0 ? (s.netSales / total) * 100 : 0,
      }));

    res.json({
      total,
      totalQty,
      rows: rows.map((r) => ({ ...r, share: total > 0 ? (r.netSales / total) * 100 : 0 })),
      byStore,
    });
  } catch (error) {
    console.error('Finance Insight sales distribution failed:', error);
    res.status(500).json({ error: 'Failed to load sales distribution.' });
  }
});

/**
 * GET /api/reports/finance-insight/growth?stores=
 * Monthly rows per store for the last 24 completed months. Quarter/year/SSSG are derived on the client.
 */
financeInsightRouter.get('/growth', async (req, res) => {
  const stores = parseStores(req.query.stores, (req as AuthenticatedRequest).allowedStoreNames);

  try {
    const pool = await getPool();
    const now = new Date();
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)); // first day of current month (exclusive)
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 24, 1));
    const startStr = start.toISOString().slice(0, 10);
    const endStr = addDays(end.toISOString().slice(0, 10), -1);

    const dsrReq = pool.request();
    dsrReq.input('dateFrom', sql.Date, startStr);
    dsrReq.input('dateTo', sql.Date, endStr);
    const dsrFilter = storeFilter(dsrReq, stores, 'locationname');
    const dsr = await dsrReq.query(`
      SELECT FORMAT(businessdate, 'yyyy-MM') AS ym,
             locationname AS locationName,
             ISNULL(SUM(netsales), 0) AS netSales,
             ISNULL(SUM(numguest), 0) AS guests
      FROM dbo.agg_daily_dsr
      WHERE businessdate BETWEEN @dateFrom AND @dateTo ${dsrFilter}
      GROUP BY FORMAT(businessdate, 'yyyy-MM'), locationname
    `);

    const chkReq = pool.request();
    chkReq.input('dateFrom', sql.Date, startStr);
    chkReq.input('dateTo', sql.Date, endStr);
    const chkFilter = storeFilter(chkReq, stores, 'locationname');
    const chk = await chkReq.query(`
      SELECT FORMAT(businessdate, 'yyyy-MM') AS ym,
             locationname AS locationName,
             ISNULL(SUM(check_count), 0) AS checks
      FROM dbo.agg_daily_checkcount
      WHERE businessdate BETWEEN @dateFrom AND @dateTo ${chkFilter}
      GROUP BY FORMAT(businessdate, 'yyyy-MM'), locationname
    `);

    const checkMap = new Map<string, number>();
    for (const r of chk.recordset) checkMap.set(`${r.ym}|${r.locationName}`, num(r.checks));

    res.json({
      range: { dateFrom: startStr, dateTo: endStr },
      rows: dsr.recordset.map((r) => ({
        ym: String(r.ym),
        locationName: String(r.locationName),
        netSales: num(r.netSales),
        guests: num(r.guests),
        checks: checkMap.get(`${r.ym}|${r.locationName}`) ?? 0,
      })),
    });
  } catch (error) {
    console.error('Finance Insight growth failed:', error);
    res.status(500).json({ error: 'Failed to load growth data.' });
  }
});
