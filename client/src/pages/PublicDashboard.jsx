import { useState, useEffect } from 'react';
import { Heading, Text, Skeleton, Stack } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import { StatsPanels, MetricCard } from '../components/DashboardStats';
import { CATEGORY_META, statusChartData, categoryChartData } from '../components/chartTokens';
import { api } from '../api';

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

  const total = stats?.total ?? 0;
  const resolved = stats?.byStatus?.resolved ?? 0;
  const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const categoriesTracked = CATEGORY_META.filter(c => (stats?.byCategory?.[c.key] ?? 0) > 0).length;

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

          <StatsPanels
            statusData={statusChartData(stats?.byStatus)}
            categoryData={categoryChartData(stats?.byCategory, stats?.uncategorized ?? 0)}
          />
        </>
      )}
    </main>
  );
}
