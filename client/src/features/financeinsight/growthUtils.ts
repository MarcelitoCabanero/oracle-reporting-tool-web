export interface GrowthRow {
  ym: string;
  locationName: string;
  netSales: number;
  guests: number;
  checks: number;
}

export interface Agg {
  netSales: number;
  guests: number;
  checks: number;
}

export type Granularity = 'month' | 'quarter' | 'year';

export function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export function apc(a: Agg): number {
  return a.guests > 0 ? a.netSales / a.guests : 0;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

/** Latest completed month present in data (the server only returns completed months). */
export function latestMonth(rows: GrowthRow[]): string | null {
  let latest: string | null = null;
  for (const r of rows) if (!latest || r.ym > latest) latest = r.ym;
  return latest;
}

function sumMonths(rows: GrowthRow[], months: Set<string>, store?: string): Agg {
  const out: Agg = { netSales: 0, guests: 0, checks: 0 };
  for (const r of rows) {
    if (!months.has(r.ym)) continue;
    if (store !== undefined && r.locationName !== store) continue;
    out.netSales += r.netSales;
    out.guests += r.guests;
    out.checks += r.checks;
  }
  return out;
}

export interface PeriodResult {
  label: string;
  current: Agg;
  previous: Agg;
  netSalesGrowth: number | null;
  guestGrowth: number | null;
  apcGrowth: number | null;
  /** Same-store sales growth: only stores with sales in every month of both windows. */
  sssg: number | null;
  comparableStores: number;
}

function monthsRange(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(end, -(count - 1 - i)));
}

export function computePeriod(rows: GrowthRow[], label: string, curMonths: string[]): PeriodResult {
  const prevMonths = curMonths.map((m) => shiftMonth(m, -12));
  const curSet = new Set(curMonths);
  const prevSet = new Set(prevMonths);
  const current = sumMonths(rows, curSet);
  const previous = sumMonths(rows, prevSet);

  // Sum by month across selected stores so YoY % only compares months where both current & prior year have data
  const monthSales = new Map<string, number>();
  for (const r of rows) {
    monthSales.set(r.ym, (monthSales.get(r.ym) ?? 0) + r.netSales);
  }
  const matchedCurMonths = curMonths.filter(
    (m) => (monthSales.get(m) ?? 0) > 0 && (monthSales.get(shiftMonth(m, -12)) ?? 0) > 0,
  );
  const matchedPrevMonths = matchedCurMonths.map((m) => shiftMonth(m, -12));
  const matchedCur = sumMonths(rows, new Set(matchedCurMonths));
  const matchedPrev = sumMonths(rows, new Set(matchedPrevMonths));

  // SSSG: comparable stores have positive net sales in every matched month of both windows
  const stores = Array.from(new Set(rows.map((r) => r.locationName)));
  const byKey = new Map<string, number>();
  for (const r of rows) byKey.set(`${r.locationName}|${r.ym}`, r.netSales);
  let curComp = 0;
  let prevComp = 0;
  let comparableStores = 0;
  if (matchedCurMonths.length > 0) {
    for (const s of stores) {
      const ok = [...matchedCurMonths, ...matchedPrevMonths].every((m) => (byKey.get(`${s}|${m}`) ?? 0) > 0);
      if (!ok) continue;
      comparableStores += 1;
      for (const m of matchedCurMonths) curComp += byKey.get(`${s}|${m}`) ?? 0;
      for (const m of matchedPrevMonths) prevComp += byKey.get(`${s}|${m}`) ?? 0;
    }
  }

  return {
    label,
    current,
    previous,
    netSalesGrowth: pct(matchedCur.netSales, matchedPrev.netSales),
    guestGrowth: pct(matchedCur.guests, matchedPrev.guests),
    apcGrowth: matchedPrev.guests > 0 && matchedCur.guests > 0 ? pct(apc(matchedCur), apc(matchedPrev)) : null,
    sssg: pct(curComp, prevComp),
    comparableStores,
  };
}

/** Periods for the chart: 12 months, 4 rolling quarters, or [TTM, YTD]. */
export function buildPeriods(rows: GrowthRow[], granularity: Granularity): PeriodResult[] {
  const end = latestMonth(rows);
  if (!end) return [];
  if (granularity === 'month') {
    return monthsRange(end, 12).map((m) => computePeriod(rows, monthLabel(m), [m]));
  }
  if (granularity === 'quarter') {
    const months = monthsRange(end, 12);
    return [0, 1, 2, 3].map((q) => {
      const chunk = months.slice(q * 3, q * 3 + 3);
      return computePeriod(rows, `${monthLabel(chunk[0])} – ${monthLabel(chunk[2])}`, chunk);
    });
  }
  const ttm = computePeriod(rows, 'Trailing 12 months', monthsRange(end, 12));
  const year = end.slice(0, 4);
  const ytdMonths = monthsRange(end, 12).filter((m) => m.startsWith(year));
  return [ttm, computePeriod(rows, `YTD ${year} (through ${monthLabel(end)})`, ytdMonths)];
}

export interface StoreGrowthRow {
  locationName: string;
  months: Record<string, number | null>; // YoY % per month
  ttm: number | null;
  ttmSales: number;
}

/** Branch × month YoY growth matrix for the last 12 months. */
export function buildStoreMatrix(rows: GrowthRow[]): { months: string[]; stores: StoreGrowthRow[] } {
  const end = latestMonth(rows);
  if (!end) return { months: [], stores: [] };
  const months = monthsRange(end, 12);
  const byKey = new Map<string, number>();
  for (const r of rows) byKey.set(`${r.locationName}|${r.ym}`, r.netSales);
  const stores = Array.from(new Set(rows.map((r) => r.locationName))).sort();
  const ttmCur = new Set(months);

  const result = stores.map((s) => {
    const m: Record<string, number | null> = {};
    let matchedCur = 0;
    let matchedPrev = 0;
    for (const ym of months) {
      const curVal = byKey.get(`${s}|${ym}`) ?? 0;
      const prevVal = byKey.get(`${s}|${shiftMonth(ym, -12)}`) ?? 0;
      m[ym] = pct(curVal, prevVal);
      if (curVal > 0 && prevVal > 0) {
        matchedCur += curVal;
        matchedPrev += prevVal;
      }
    }
    const cur = sumMonths(rows, ttmCur, s).netSales;
    return { locationName: s, months: m, ttm: pct(matchedCur, matchedPrev), ttmSales: cur };
  });
  return { months, stores: result };
}
