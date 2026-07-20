import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heading, Text, Button, Skeleton, Stack } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import { Donut, Legend, CategoryBars } from '../components/DashboardStats';
import { panelStyle, panelTitleStyle, STATUS_META, CATEGORY_META } from '../components/chartTokens';
import { api } from '../api';

// A single headline metric card. Kept local to the public dashboard — the
// control room shows the full table instead of these summary tiles.
function MetricCard({ label, value }) {
  return (
    <div style={panelStyle}>
      <div style={{ fontSize: '2rem', fontWeight: 'var(--mero-typography-weight-semibold)', color: 'var(--mero-colors-text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ ...panelTitleStyle, marginBottom: 0, marginTop: '8px' }}>{label}</div>
    </div>
  );
}

// Public, unauthenticated overview. Reads only aggregate counts from
// GET /api/submissions/stats — no individual submissions or citizen data.
export default function PublicDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getStats()
      .then(data => { if (!cancelled) setStats(data); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const statusSegments = STATUS_META.map(s => ({
    ...s,
    value: stats?.byStatus?.[s.key] ?? 0,
  }));

  const categoryBars = CATEGORY_META.map(c => ({
    ...c,
    value: stats?.byCategory?.[c.key] ?? 0,
  }));
  if (stats?.uncategorized > 0) {
    categoryBars.push({ key: 'uncategorized', label: 'Uncategorized', value: stats.uncategorized });
  }
  const maxCategory = Math.max(0, ...categoryBars.map(b => b.value));
  const categoriesTracked = categoryBars.filter(b => b.key !== 'uncategorized' && b.value > 0).length;
  const resolved = stats?.byStatus?.resolved ?? 0;
  const total = stats?.total ?? 0;
  const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <main className="page" style={{ paddingTop: '48px', paddingBottom: '80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Heading level={2} style={{ marginBottom: '8px' }}>Dashboard</Heading>
        <Text size="sm" subtle>A public overview of citizen submissions and how they're being handled.</Text>
      </div>

      {error && <Alert style={{ marginBottom: '20px' }}>{error}</Alert>}

      {loading ? (
        <Stack gap="16px">
          <Skeleton height="6rem" />
          <Skeleton height="12rem" />
        </Stack>
      ) : !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <MetricCard label="Total submissions" value={total} />
            <MetricCard label="Categories tracked" value={categoriesTracked} />
            <MetricCard label="Resolved" value={resolved} />
            <MetricCard label="Resolved rate" value={`${resolvedRate}%`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <div style={panelStyle}>
              <div style={panelTitleStyle}>Status distribution</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <Donut segments={statusSegments} total={total} />
                <Legend segments={statusSegments} total={total} />
              </div>
            </div>

            <div style={panelStyle}>
              <div style={panelTitleStyle}>Category distribution</div>
              <CategoryBars bars={categoryBars} max={maxCategory} />
            </div>
          </div>

          <Stack direction="row" gap="10px" wrap>
            <Button as={Link} to="/submit">Submit a request</Button>
            <Button as={Link} to="/track" variant="secondary">Track a request</Button>
          </Stack>
        </>
      )}
    </main>
  );
}
