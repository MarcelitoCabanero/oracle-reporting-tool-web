import type { StoreSearchOption } from '../../components/common/StoreSearchSelect';

export interface OverviewResponse {
  range: { dateFrom: string; dateTo: string; prevFrom: string; prevTo: string };
  daily: { date: string; netSales: number }[];
  byStore: { locationName: string; netSales: number; checks: number; guests: number; apc: number }[];
  kpis: {
    current: { netSales: number; guests: number; checks: number };
    previous: { netSales: number; guests: number; checks: number };
  };
}

export interface DistributionStoreRow {
  locationName: string;
  qty: number;
  netSales: number;
  share: number;
  byCenter: Record<string, { qty: number; netSales: number }>;
}

export interface DistributionResponse {
  total: number;
  totalQty: number;
  rows: { revenueCenter: string; qty: number; netSales: number; share: number }[];
  byStore: DistributionStoreRow[];
}

export interface GrowthResponse {
  range: { dateFrom: string; dateTo: string };
  rows: import('./growthUtils').GrowthRow[];
}

const BASE = '/api/reports/finance-insight';

async function get<T>(path: string, token: string | null, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

/** stores = [] means ALL stores */
function qs(params: Record<string, string>, stores: string[]): string {
  const p = new URLSearchParams(params);
  if (stores.length > 0) p.set('stores', stores.join('|'));
  return `?${p.toString()}`;
}

export const financeInsightApi = {
  stores: (token: string | null) => get<{ stores: StoreSearchOption[] }>('/stores', token),
  overview: (token: string | null, dateFrom: string, dateTo: string, stores: string[], signal?: AbortSignal) =>
    get<OverviewResponse>(`/overview${qs({ dateFrom, dateTo }, stores)}`, token, signal),
  distribution: (token: string | null, dateFrom: string, dateTo: string, stores: string[], signal?: AbortSignal) =>
    get<DistributionResponse>(`/sales-distribution${qs({ dateFrom, dateTo }, stores)}`, token, signal),
  growth: (token: string | null, stores: string[], signal?: AbortSignal) =>
    get<GrowthResponse>(`/growth${qs({}, stores)}`, token, signal),
};
