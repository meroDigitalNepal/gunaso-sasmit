import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heading, Text, Select, Badge, Skeleton, Stack } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import DashboardStats from '../components/DashboardStats';
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
