/*
 * Shared, non-component chart tokens used by both the admin Control Room
 * (DashboardStats) and the public Dashboard (PublicDashboard). Kept in their
 * own module so the component files only export components — this keeps
 * react-refresh happy and the styling consistent across both views.
 */

// Status colors mirror the Badge variants used in the submissions table
// (new → primary, in_review → warning, resolved → success). `token` is the i18n
// key; `label` is the English fallback used when no `t` is passed (e.g. the
// not-yet-localized Control Room).
export const STATUS_META = [
  { key: 'new', token: 'status.new', label: 'New', color: 'var(--mero-colors-primary)' },
  { key: 'in_review', token: 'status.in_review', label: 'In Review', color: 'var(--mero-colors-warning)' },
  { key: 'resolved', token: 'status.resolved', label: 'Resolved', color: 'var(--mero-colors-success)' },
];

export const CATEGORY_META = [
  { key: 'infrastructure', token: 'category.infrastructure', label: 'Infrastructure' },
  { key: 'health', token: 'category.health', label: 'Health' },
  { key: 'education', token: 'category.education', label: 'Education' },
  { key: 'security', token: 'category.security', label: 'Security' },
  { key: 'other', token: 'category.other', label: 'Other' },
];

// Resolve a meta row's label through `t` when provided, else the English
// fallback — lets localized callers (public Dashboard) translate while
// untranslated ones (Control Room) keep working unchanged.
const metaLabel = (meta, t) => (t ? t(meta.token) : meta.label);

export const panelStyle = {
  border: '1px solid var(--mero-colors-border)',
  borderRadius: 'var(--mero-radii-md)',
  background: 'var(--mero-colors-surface-raised)',
  padding: '20px',
};

export const panelTitleStyle = {
  fontSize: 'var(--mero-typography-size-sm)',
  fontWeight: 'var(--mero-typography-weight-medium)',
  color: 'var(--mero-colors-text-subtle)',
  marginBottom: '18px',
};

// Shape status/category counts into the { label, value, color? } rows the
// @mero-nepal/ui PieChart/BarChart expect. Used by both dashboards so the
// admin (from the full submission list) and public (from /stats aggregates)
// views render identical charts.
export function statusChartData(byStatus, t) {
  return STATUS_META.map(s => ({ label: metaLabel(s, t), color: s.color, value: byStatus?.[s.key] ?? 0 }));
}

export function categoryChartData(byCategory, uncategorized = 0, t) {
  const data = CATEGORY_META.map(c => ({ label: metaLabel(c, t), value: byCategory?.[c.key] ?? 0 }));
  if (uncategorized > 0) {
    data.push({ label: t ? t('dashboard.uncategorized') : 'Uncategorized', value: uncategorized });
  }
  return data;
}

// Short x-axis label for a weekly bucket: the week-start date as "Jul 7".
// weekStart is a UTC-midnight ISO string; format in UTC (not the viewer's
// timezone) so the label lands on the intended Monday everywhere. Fixed
// locale keeps it stable regardless of the app's active UI language — the
// weekly charts are compact and a numeric month/day reads cleanly in any.
function weekLabel(weekStart) {
  return new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Turn the /stats `weekly` buckets into rows a @mero-nepal/ui LineChart can
// plot: one row per week, one numeric field per status/category key, plus a
// `label` (the default xKey). Paired with statusSeries/categorySeries below.
export function weeklyStatusData(weekly = []) {
  return weekly.map(w => ({
    label: weekLabel(w.weekStart),
    ...Object.fromEntries(STATUS_META.map(s => [s.key, w.byStatus?.[s.key] ?? 0])),
  }));
}

export function weeklyCategoryData(weekly = []) {
  return weekly.map(w => ({
    label: weekLabel(w.weekStart),
    ...Object.fromEntries(CATEGORY_META.map(c => [c.key, w.byCategory?.[c.key] ?? 0])),
  }));
}

// Series definitions (one line each) for the weekly charts. Status lines reuse
// the shared status colors; category lines let the chart auto-assign from its
// palette. `t` localizes the legend/tooltip names.
export function statusSeries(t) {
  return STATUS_META.map(s => ({ key: s.key, name: metaLabel(s, t), color: s.color }));
}

export function categorySeries(t) {
  return CATEGORY_META.map(c => ({ key: c.key, name: metaLabel(c, t) }));
}
