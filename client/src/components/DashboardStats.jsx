/*
 * Overview charts shown on the Control Room and the public Dashboard, built on
 * @mero-nepal/ui's chart primitives (added in 0.4.0) so they stay on the safa
 * theme. `StatsPanels` is presentational — it takes chart-ready data; the
 * default export computes that data from the full submission list for the
 * Control Room, independent of the table's active filters.
 */

import { PieChart, BarChart } from '@mero-nepal/ui';
import {
  STATUS_META,
  CATEGORY_META,
  panelStyle,
  panelTitleStyle,
  statusChartData,
  categoryChartData,
} from './chartTokens';

// A single headline metric tile, shared by both dashboards.
export function MetricCard({ label, value }) {
  return (
    <div style={panelStyle}>
      <div style={{ fontSize: '2rem', fontWeight: 'var(--mero-typography-weight-semibold)', color: 'var(--mero-colors-text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ ...panelTitleStyle, marginBottom: 0, marginTop: '8px' }}>{label}</div>
    </div>
  );
}

// Status donut + category bars, given chart-ready data arrays.
export function StatsPanels({ statusData, categoryData }) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Status distribution</div>
        <PieChart donut size={220} data={statusData} />
      </div>

      <div style={panelStyle}>
        <div style={panelTitleStyle}>Category distribution</div>
        <BarChart
          data={categoryData}
          width={560}
          height={300}
          legend={false}
          series={[{ key: 'value', name: 'Submissions', color: 'var(--mero-colors-primary)' }]}
        />
      </div>
    </section>
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
