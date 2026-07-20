/*
 * Shared, non-component chart tokens used by both the admin Control Room
 * (DashboardStats) and the public Dashboard (PublicDashboard). Kept in their
 * own module so the component files only export components — this keeps
 * react-refresh happy and the styling consistent across both views.
 */

// Status colors mirror the Badge variants used in the submissions table
// (new → primary, in_review → warning, resolved → success).
export const STATUS_META = [
  { key: 'new', label: 'New', color: 'var(--mero-colors-primary)' },
  { key: 'in_review', label: 'In Review', color: 'var(--mero-colors-warning)' },
  { key: 'resolved', label: 'Resolved', color: 'var(--mero-colors-success)' },
];

export const CATEGORY_META = [
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'health', label: 'Health' },
  { key: 'education', label: 'Education' },
  { key: 'security', label: 'Security' },
  { key: 'other', label: 'Other' },
];

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
export function statusChartData(byStatus) {
  return STATUS_META.map(s => ({ label: s.label, color: s.color, value: byStatus?.[s.key] ?? 0 }));
}

export function categoryChartData(byCategory, uncategorized = 0) {
  const data = CATEGORY_META.map(c => ({ label: c.label, value: byCategory?.[c.key] ?? 0 }));
  if (uncategorized > 0) {
    data.push({ label: 'Uncategorized', value: uncategorized });
  }
  return data;
}
