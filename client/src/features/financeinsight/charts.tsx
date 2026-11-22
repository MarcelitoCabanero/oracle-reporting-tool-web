import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DistributionResponse, OverviewResponse } from './financeInsightApi';
import type { Granularity, PeriodResult } from './growthUtils';

export const peso = (v: number) =>
  `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const int = (v: number) => Number(v || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 });
export const compact = (v: number) =>
  Number(v || 0).toLocaleString('en-PH', { notation: 'compact', maximumFractionDigits: 1 });
export const pctText = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
export const apcText =
  'APC = net sales ÷ guest count. “—” means no comparable prior-year data.';

const PIE_COLORS = [
  'var(--fi-c1)',
  'var(--fi-c2)',
  'var(--fi-c3)',
  'var(--fi-c4)',
  'var(--fi-c5)',
  'var(--fi-c6)',
  'var(--fi-c7)',
];

const tooltipStyle = {
  background: 'var(--fi-tooltip-bg)',
  border: '1px solid var(--fi-grid)',
  borderRadius: 8,
  color: 'var(--fi-text)',
  fontSize: 12,
};

export function NetSalesAreaChart({ data }: { data: OverviewResponse['daily'] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fiAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--fi-c1)" stopOpacity={0.45} />
            <stop offset="95%" stopColor="var(--fi-c1)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--fi-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: 'var(--fi-muted)', fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis tick={{ fill: 'var(--fi-muted)', fontSize: 11 }} tickFormatter={compact} width={56} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [peso(Number(v)), 'Net Sales']} />
        <Area type="monotone" dataKey="netSales" stroke="var(--fi-c1)" strokeWidth={2} fill="url(#fiAreaFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BranchBarChart({ data }: { data: OverviewResponse['byStore'] }) {
  const height = Math.max(240, data.length * 26 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--fi-grid)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fill: 'var(--fi-muted)', fontSize: 11 }} tickFormatter={compact} />
        <YAxis type="category" dataKey="locationName" width={110} tick={{ fill: 'var(--fi-muted)', fontSize: 11 }} interval={0} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [peso(Number(v)), 'Net Sales']} cursor={{ fill: 'var(--fi-grid)', opacity: 0.4 }} />
        <Bar dataKey="netSales" fill="var(--fi-c2)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SalesDistributionPie({ data }: { data: DistributionResponse['rows'] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="netSales" nameKey="revenueCenter" innerRadius={55} outerRadius={100} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="var(--fi-card)" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [peso(Number(v)), String(n)]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export const distributionColor = (i: number) => PIE_COLORS[i % PIE_COLORS.length];

export function BranchRevenueCenterStackedChart({
  byStore,
  centers,
  mode,
}: {
  byStore: DistributionResponse['byStore'];
  centers: string[];
  mode: 'sales' | 'qty';
}) {
  const data = byStore.map((s) => {
    const row: Record<string, string | number> = { locationName: s.locationName };
    for (const rc of centers) {
      row[rc] = mode === 'qty' ? (s.byCenter[rc]?.qty ?? 0) : (s.byCenter[rc]?.netSales ?? 0);
    }
    return row;
  });
  const height = Math.max(380, data.length * 30 + 32);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--fi-grid)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 'auto']}
          tick={{ fill: 'var(--fi-muted)', fontSize: 11 }}
          tickFormatter={(v: number) => compact(v)}
        />
        <YAxis
          type="category"
          dataKey="locationName"
          width={110}
          tick={{ fill: 'var(--fi-muted)', fontSize: 11 }}
          interval={0}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, name) =>
            mode === 'qty' ? [int(Number(v)), String(name)] : [peso(Number(v)), String(name)]
          }
          cursor={{ fill: 'var(--fi-grid)', opacity: 0.35 }}
        />
        {centers.map((rc, i) => (
          <Bar
            key={rc}
            dataKey={rc}
            stackId="rc"
            fill={PIE_COLORS[i % PIE_COLORS.length]}
            radius={i === centers.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Monthly: columns + YoY line + last-year overlay. Quarterly: grouped columns. */
export function GrowthChart({ periods, granularity }: { periods: PeriodResult[]; granularity: Granularity }) {
  const data = periods.map((p) => ({
    label: p.label,
    current: p.current.netSales,
    previous: p.previous.netSales,
    yoy: p.netSalesGrowth,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: granularity === 'month' ? 0 : 16 }}>
        <CartesianGrid stroke="var(--fi-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--fi-muted)', fontSize: 11 }} interval={0} />
        <YAxis yAxisId="left" tick={{ fill: 'var(--fi-muted)', fontSize: 11 }} tickFormatter={compact} width={56} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: 'var(--fi-muted)', fontSize: 11 }}
          tickFormatter={(v: number) => `${v}%`}
          width={48}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, name) =>
            name === 'YoY %' ? [v === null ? '—' : `${Number(v).toFixed(1)}%`, name] : [peso(Number(v)), String(name)]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="current" name="Current" fill="var(--fi-c1)" radius={[4, 4, 0, 0]} />
        {granularity === 'month' ? (
          <Line yAxisId="left" dataKey="previous" name="Same month last year" stroke="var(--fi-muted)" strokeDasharray="4 4" dot={false} />
        ) : (
          <Bar yAxisId="left" dataKey="previous" name="Same period last year" fill="var(--fi-c-prev)" radius={[4, 4, 0, 0]} />
        )}
        <Line yAxisId="right" dataKey="yoy" name="YoY %" stroke="var(--fi-c3)" strokeWidth={2} dot connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
