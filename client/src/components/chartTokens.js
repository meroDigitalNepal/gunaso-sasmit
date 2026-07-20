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
