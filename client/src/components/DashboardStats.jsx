/*
 * Overview charts shown on the Control Room and the public Dashboard, built on
 * @mero-nepal/ui's chart primitives (added in 0.4.0) so they stay on the safa
 * theme. `StatsPanels` is presentational — it takes chart-ready data; the
 * default export computes that data from the full submission list for the
 * Control Room, independent of the table's active filters.
 */

import { PieChart, BarChart, LineChart } from '@mero-nepal/ui';
import {
  STATUS_META,
  CATEGORY_META,
  panelStyle,
  panelTitleStyle,
  statusChartData,
  categoryChartData,
} from './chartTokens';

// A single headline metric tile, shared by both dashboards. The min-height and
// centered layout give the tiles enough vertical presence to sit comfortably
// alongside the chart panels instead of looking cramped. `style` lets a caller
// tune sizing/flex behavior (e.g. the Control Room's resolved-rate tile).
export function MetricCard({ label, value, style }) {
  return (
    <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', minHeight: '112px', ...style }}>
      <div style={{ fontSize: '2rem', fontWeight: 'var(--mero-typography-weight-semibold)', color: 'var(--mero-colors-text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ ...panelTitleStyle, marginBottom: 0 }}>{label}</div>
    </div>
  );
}

// Status donut + category bars, given chart-ready data arrays. `t` is optional:
// localized callers (public Dashboard) pass it to translate the panel titles +
// series name; the untranslated Control Room omits it and gets English.
export function StatsPanels({ statusData, categoryData, t }) {
  const label = (key, fallback) => (t ? t(key) : fallback);
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{label('dashboard.statusDistribution', 'Status distribution')}</div>
        <PieChart donut size={220} data={statusData} />
      </div>

      <div style={panelStyle}>
        <div style={panelTitleStyle}>{label('dashboard.categoryDistribution', 'Category distribution')}</div>
        <BarChart
          data={categoryData}
          width={560}
          height={300}
          legend={false}
          series={[{ key: 'value', name: label('dashboard.seriesSubmissions', 'Submissions'), color: 'var(--mero-colors-primary)' }]}
        />
      </div>
    </section>
  );
}

// Shared shell for a single titled chart tile on the public Dashboard. Fills
// its grid cell so charts scale to the available width instead of a fixed
// column. Callers place these in whatever grid they need.
export function ChartPanel({ title, children }) {
  return (
    <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
      <div style={panelTitleStyle}>{title}</div>
      {children}
    </div>
  );
}

// A weekly trend line chart (one line per series) over the fixed 5-week window
// (2 before → 2 after today, bucketed by updated_at). Future weeks render as a
// flat zero tail rather than a gap. `title` is already localized by the caller.
export function WeeklyTrendPanel({ title, data, series }) {
  return (
    <ChartPanel title={title}>
      <LineChart data={data} series={series} width={560} height={280} legend smooth />
    </ChartPanel>
  );
}

export default function DashboardStats({ submissions }) {
  const byStatus = Object.fromEntries(
    STATUS_META.map(s => [s.key, submissions.filter(sub => sub.status === s.key).length]),
  );
  const byCategory = Object.fromEntries(
    CATEGORY_META.map(c => [c.key, submissions.filter(sub => sub.category === c.key).length]),
  );
  const uncategorized = submissions.filter(sub => !sub.category).length;

  return (
    <StatsPanels
      statusData={statusChartData(byStatus)}
      categoryData={categoryChartData(byCategory, uncategorized)}
    />
  );
}
