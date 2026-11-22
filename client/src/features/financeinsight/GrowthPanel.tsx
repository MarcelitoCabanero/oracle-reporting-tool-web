import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, HelpCircle, TrendingUp } from 'lucide-react';
import { GrowthChart, apcText, pctText } from './charts';
import {
  buildPeriods,
  buildStoreMatrix,
  monthLabel,
  type Granularity,
  type GrowthRow,
  type PeriodResult,
} from './growthUtils';

const GLOSSARY: { term: string; full: string; desc: string }[] = [
  {
    term: 'TTM',
    full: 'Trailing Twelve Months',
    desc: 'Rolling sum of the past 12 completed calendar months, smoothing out seasonal spikes.',
  },
  {
    term: 'YoY',
    full: 'Year-over-Year',
    desc: 'Percentage change compared against the exact same month/period one year earlier.',
  },
  {
    term: 'SSSG',
    full: 'Same-Store Sales Growth',
    desc: 'Organic YoY sales growth counting only branches open with sales in every month of both periods (excludes new or closed stores).',
  },
  {
    term: 'YTD',
    full: 'Year-to-Date',
    desc: 'From January 1 of the current year through the latest completed month, compared vs. the same months last year.',
  },
  {
    term: 'APC',
    full: 'Average Per Customer (Guest)',
    desc: 'Average net sales generated per guest (Net Sales ÷ numguest).',
  },
];

function Delta({ label, value, tooltip }: { label: string; value: number | null; tooltip?: string }) {
  const tone = value === null ? 'flat' : value >= 0 ? 'up' : 'down';
  return (
    <div className="fi-delta" title={tooltip}>
      <span className="fi-delta-label">
        {label}
        {tooltip && <HelpCircle size={12} className="ms-1" style={{ verticalAlign: '-1px', opacity: 0.7 }} />}
      </span>
      <span className={`fi-delta-value fi-${tone}`}>{pctText(value)}</span>
    </div>
  );
}

function heatStyle(v: number | null): React.CSSProperties {
  if (v === null) return {};
  const intensity = Math.min(Math.abs(v) / 30, 1) * 0.55 + 0.08;
  const rgb = v >= 0 ? '22, 163, 74' : '220, 38, 38';
  return { background: `rgba(${rgb}, ${intensity})` };
}

export function GrowthPanel({ rows }: { rows: GrowthRow[] }) {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const periods = useMemo(() => buildPeriods(rows, granularity), [rows, granularity]);
  const matrix = useMemo(() => buildStoreMatrix(rows), [rows]);
  const sortedStores = useMemo(
    () => [...matrix.stores].sort((a, b) => (b.ttm ?? -Infinity) - (a.ttm ?? -Infinity)),
    [matrix],
  );
  const headline: PeriodResult | undefined = useMemo(
    () => buildPeriods(rows, 'year')[0],
    [rows],
  );

  if (rows.length === 0) {
    return <div className="fi-empty">No sales history available for the selected stores.</div>;
  }

  return (
    <div>
      <div className="fi-growth-head">
        <div className="menuitem-tab-switcher" role="tablist">
          {(
            [
              ['month', 'Monthly', CalendarDays],
              ['quarter', 'Quarterly', BarChart3],
              ['year', 'Yearly', TrendingUp],
            ] as [Granularity, string, typeof CalendarDays][]
          ).map(([g, label, Icon]) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={granularity === g}
              className={`menuitem-tab-btn ${granularity === g ? 'active' : ''}`}
              onClick={() => setGranularity(g)}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <span className="fi-note">Completed months only; compared with the same period last year.</span>
      </div>

      {granularity !== 'year' ? (
        <GrowthChart periods={periods} granularity={granularity} />
      ) : (
        <div className="fi-year-grid">
          {periods.map((p) => (
            <div className="fi-year-card" key={p.label}>
              <div className="fi-kpi-label">{p.label}</div>
              <div className="fi-kpi-value">₱{p.current.netSales.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</div>
              <div className="fi-note">
                Prior: ₱{p.previous.netSales.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </div>
              <div className="fi-progress">
                <div
                  className="fi-progress-bar"
                  style={{
                    width: `${p.previous.netSales ? Math.min((p.current.netSales / p.previous.netSales) * 100, 150) / 1.5 : 0}%`,
                  }}
                />
              </div>
              <div className="fi-delta-row">
                <Delta
                  label="Net Sales"
                  value={p.netSalesGrowth}
                  tooltip="Year-over-Year Net Sales growth vs. the same period last year"
                />
                <Delta
                  label="SSSG"
                  value={p.sssg}
                  tooltip="Same-Store Sales Growth: YoY growth for branches open in every month of both periods"
                />
                <Delta
                  label="Guests"
                  value={p.guestGrowth}
                  tooltip="Year-over-Year Guest Count (numguest) growth"
                />
                <Delta
                  label="APC"
                  value={p.apcGrowth}
                  tooltip="Year-over-Year Average Per Customer (Net Sales ÷ Guests) growth"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {headline && (
        <div className="fi-delta-row fi-headline">
          <Delta
            label="TTM Net Sales YoY"
            value={headline.netSalesGrowth}
            tooltip="Trailing 12 Months Net Sales compared to the prior 12 months"
          />
          <Delta
            label={`TTM SSSG (${headline.comparableStores} comparable stores)`}
            value={headline.sssg}
            tooltip="Trailing 12 Months Same-Store Sales Growth for branches active across all 24 months"
          />
          <Delta
            label="TTM Guest Count YoY"
            value={headline.guestGrowth}
            tooltip="Trailing 12 Months total guest count (numguest) vs. the prior 12 months"
          />
          <Delta
            label="TTM APC YoY"
            value={headline.apcGrowth}
            tooltip="Trailing 12 Months Average Per Customer (Net Sales ÷ Guests) vs. the prior 12 months"
          />
        </div>
      )}

      <div className="fi-glossary" aria-label="Metric definitions">
        {GLOSSARY.map((g) => (
          <div key={g.term} className="fi-glossary-item">
            <span className="fi-glossary-badge">{g.term}</span>
            <div>
              <strong className="fi-glossary-full">{g.full}</strong>
              <span className="fi-note d-block">{g.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <h6 className="fi-subtitle">Branch growth heatmap — YoY net sales % by month</h6>
      <div className="fi-heat-wrap">
        <table className="fi-heat">
          <thead>
            <tr>
              <th>Branch</th>
              {matrix.months.map((m) => (
                <th key={m}>{monthLabel(m)}</th>
              ))}
              <th>TTM</th>
            </tr>
          </thead>
          <tbody>
            {sortedStores.map((s) => (
              <tr key={s.locationName}>
                <td>{s.locationName}</td>
                {matrix.months.map((m) => (
                  <td key={m} style={heatStyle(s.months[m])}>
                    {s.months[m] === null ? '—' : `${s.months[m]!.toFixed(0)}%`}
                  </td>
                ))}
                <td className="fw-semibold" style={heatStyle(s.ttm)}>
                  {pctText(s.ttm)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fi-note">
        {apcText}
      </div>
    </div>
  );
}
