import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heading, Text, Select, Badge, Skeleton, Stack } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import DashboardStats, { MetricCard } from '../components/DashboardStats';
import { panelStyle, panelTitleStyle } from '../components/chartTokens';
import { api } from '../api';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'health', label: 'Health' },
  { value: 'education', label: 'Education' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS = { new: 'New', in_review: 'In Review', resolved: 'Resolved' };
const STATUS_VARIANTS = { new: 'primary', in_review: 'warning', resolved: 'success' };

const DAY_MS = 24 * 60 * 60 * 1000;
const dayLabel = n => `${n} ${n === 1 ? 'day' : 'days'}`;
const daysSince = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));

// Staff-only operational metrics. Unlike the public dashboard's headline
// counts, these surface workload/aging signals — how much is still open, how
// fast it's being resolved, and which gunaso has been waiting the longest.
function AdminMetrics({ submissions }) {
  const open = submissions.filter(s => s.status !== 'resolved');
  const resolved = submissions.filter(s => s.status === 'resolved');
  const resolvedRate = submissions.length ? Math.round((resolved.length / submissions.length) * 100) : 0;

  // Oldest still-open submission by creation time.
  const longestOpen = open.reduce(
    (oldest, s) => (!oldest || new Date(s.createdAt) < new Date(oldest.createdAt) ? s : oldest),
    null,
  );

  return (
    <section style={{ marginBottom: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <MetricCard label="Open" value={open.length} />
        <MetricCard label="Resolved rate" value={`${resolvedRate}%`} />
      </div>

      {longestOpen && (
        <div style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...panelTitleStyle, marginBottom: '6px' }}>Longest-running open gunaso</div>
            <Text weight="medium">{longestOpen.title}</Text>
            <Text size="sm" subtle style={{ marginTop: '4px' }}>
              Open for {dayLabel(daysSince(longestOpen.createdAt))} · <Badge variant={STATUS_VARIANTS[longestOpen.status]}>{STATUS_LABELS[longestOpen.status]}</Badge>
            </Text>
          </div>
          <Link to={`/control-room/${longestOpen.id}`} style={{ color: 'var(--mero-colors-primary)', fontSize: 'var(--mero-typography-size-sm)', whiteSpace: 'nowrap' }}>View →</Link>
        </div>
      )}
    </section>
  );
}

export default function ControlRoom() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Fetch the full set once and filter the table client-side. This keeps the
  // overview charts showing the whole picture regardless of the active filters,
  // and makes filtering the table instant.
  useEffect(() => {
    fetchSubmissions();
  }, []);

  async function fetchSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSubmissions();
      setSubmissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => submissions.filter(s =>
      (!statusFilter || s.status === statusFilter) &&
      (!categoryFilter || (categoryFilter === s.category))
    ),
    [submissions, statusFilter, categoryFilter],
  );

  return (
    <main className="page" style={{ paddingTop: '48px', paddingBottom: '80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Heading level={2} style={{ marginBottom: '8px' }}>Control Room</Heading>
        <Text size="sm" subtle>Manage and respond to citizen submissions.</Text>
      </div>

      {error && <Alert style={{ marginBottom: '20px' }}>{error}</Alert>}

      {loading ? (
        <Stack gap="12px">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="2.5rem" />)}
        </Stack>
      ) : submissions.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: '64px' }}>
          <Text size="lg" subtle>No submissions found.</Text>
        </div>
      ) : (
        <>
          <AdminMetrics submissions={submissions} />

          <DashboardStats submissions={submissions} />

          <Stack direction="row" gap="10px" wrap style={{ marginBottom: '20px' }}>
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ minWidth: '160px' }}
            />
            <Select
              options={CATEGORY_OPTIONS}
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ minWidth: '160px' }}
            />
          </Stack>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '48px' }}>
              <Text size="lg" subtle>No submissions match the selected filters.</Text>
            </div>
          ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tracking ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'var(--mero-typography-font-mono)', fontSize: 'var(--mero-typography-size-xs)', color: 'var(--mero-colors-text-subtle)' }}>{s.trackingId}</td>
                  <td style={{ fontWeight: 'var(--mero-typography-weight-medium)' }}>{s.title}</td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--mero-colors-text-subtle)' }}>{s.category || '—'}</td>
                  <td><Badge variant={STATUS_VARIANTS[s.status]}>{STATUS_LABELS[s.status]}</Badge></td>
                  <td style={{ color: 'var(--mero-colors-text-subtle)' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td><Link to={`/control-room/${s.id}`} style={{ color: 'var(--mero-colors-primary)', fontSize: 'var(--mero-typography-size-sm)' }}>View →</Link></td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}
    </main>
  );
}
