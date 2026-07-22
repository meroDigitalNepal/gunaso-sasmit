import { useState, useEffect } from 'react';
import { Heading, Text, Skeleton, Stack, PieChart, useLocale } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import { MetricCard, ChartPanel, WeeklyTrendPanel } from '../components/DashboardStats';
import {
  categoryChartData,
  weeklyStatusData,
  weeklyCategoryData,
  statusSeries,
  categorySeries,
} from '../components/chartTokens';
import { api } from '../api';

// Public, unauthenticated overview. Reads only aggregate counts from
// GET /api/submissions/stats — no individual submissions or citizen data.
// Row 1: headline metric tiles. Row 2: category distribution alongside the
// weekly category trend. Row 3: the weekly status trend.
export default function PublicDashboard() {
  const { t } = useLocale();
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
  const newCount = stats?.byStatus?.new ?? 0;
  const inReview = stats?.byStatus?.in_review ?? 0;
  const resolved = stats?.byStatus?.resolved ?? 0;

  return (
    // alignSelf stretch: the app shell lays pages out in a flex column, so
    // without this <main> would shrink to its content's intrinsic width and
    // leave the dashboard stranded in a narrow center column. Stretch lets
    // `.page` (max-width 960, matching the nav) actually fill the width.
    <main className="page" style={{ paddingTop: '48px', paddingBottom: '80px', alignSelf: 'stretch', width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <Heading level={2} style={{ marginBottom: '8px' }}>{t('dashboard.heading')}</Heading>
        <Text size="sm" subtle>{t('dashboard.subheading')}</Text>
      </div>

      {error && <Alert style={{ marginBottom: '20px' }}>{error}</Alert>}

      {loading ? (
        <Stack gap="16px">
          <Skeleton height="6rem" />
          <Skeleton height="18rem" />
          <Skeleton height="18rem" />
        </Stack>
      ) : !error && (
        <>
          {/* Row 1 — headline metric tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <MetricCard label={t('dashboard.metric.total')} value={total} />
            <MetricCard label={t('status.new')} value={newCount} />
            <MetricCard label={t('status.in_review')} value={inReview} />
            <MetricCard label={t('status.resolved')} value={resolved} />
          </div>

          {/* Row 2 — category distribution + weekly category activity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <ChartPanel title={t('dashboard.categoryDistribution')}>
              <PieChart size={240} data={categoryChartData(stats?.byCategory, stats?.uncategorized ?? 0, t)} />
            </ChartPanel>
            <WeeklyTrendPanel
              title={t('dashboard.weeklyCategory')}
              data={weeklyCategoryData(stats?.weekly)}
              series={categorySeries(t)}
            />
          </div>

          {/* Row 3 — weekly status activity */}
          <div style={{ marginBottom: '32px' }}>
            <WeeklyTrendPanel
              title={t('dashboard.weeklyStatus')}
              data={weeklyStatusData(stats?.weekly)}
              series={statusSeries(t)}
            />
          </div>
        </>
      )}
    </main>
  );
}
