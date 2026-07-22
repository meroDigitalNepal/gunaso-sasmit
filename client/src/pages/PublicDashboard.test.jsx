import { test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getStats = vi.fn();
vi.mock('../api', () => ({ api: { getStats: (...a) => getStats(...a) } }));

const { default: PublicDashboard } = await import('./PublicDashboard');
// PublicDashboard now reads strings via useLocale, which needs a LocaleProvider.
// DisplayProvider supplies it (with the default 'en' locale) as main.jsx does.
const { DisplayProvider } = await import('../display/DisplaySettings');

function renderDashboard() {
  return render(
    <DisplayProvider>
      <MemoryRouter>
        <PublicDashboard />
      </MemoryRouter>
    </DisplayProvider>,
  );
}

test('renders headline metrics computed from the public stats endpoint', async () => {
  getStats.mockResolvedValue({
    total: 8,
    byStatus: { new: 4, in_review: 1, resolved: 3 },
    byCategory: { infrastructure: 3, health: 2, education: 0, security: 0, other: 0 },
    uncategorized: 1,
  });

  renderDashboard();

  // Metric cards: value sits next to its label inside the same card.
  const totalCard = (await screen.findByText('Total submissions')).parentElement;
  expect(within(totalCard).getByText('8')).toBeInTheDocument();

  const categoriesCard = screen.getByText('Categories tracked').parentElement;
  // Only categories with at least one submission count (infrastructure, health).
  expect(within(categoriesCard).getByText('2')).toBeInTheDocument();

  // "Resolved" also appears in the status legend; the metric card renders
  // first in DOM order, so take the first match.
  const resolvedCard = screen.getAllByText('Resolved')[0].parentElement;
  expect(within(resolvedCard).getByText('3')).toBeInTheDocument();

  // 3 of 8 resolved → 38%.
  const rateCard = screen.getByText('Resolved rate').parentElement;
  expect(within(rateCard).getByText('38%')).toBeInTheDocument();

  expect(screen.getByText('Status distribution')).toBeInTheDocument();
  expect(screen.getByText('Category distribution')).toBeInTheDocument();
  expect(getStats).toHaveBeenCalledOnce();
});

test('does not render Submit/Track call-to-action buttons', async () => {
  getStats.mockResolvedValue({
    total: 1,
    byStatus: { new: 1, in_review: 0, resolved: 0 },
    byCategory: { infrastructure: 0, health: 0, education: 0, security: 0, other: 0 },
    uncategorized: 1,
  });

  renderDashboard();
  await screen.findByText('Total submissions');

  expect(screen.queryByText(/submit a request/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/track a request/i)).not.toBeInTheDocument();
});

test('surfaces an error when the stats request fails', async () => {
  getStats.mockRejectedValue(new Error('boom'));

  renderDashboard();

  expect(await screen.findByText('boom')).toBeInTheDocument();
  expect(screen.queryByText('Total submissions')).not.toBeInTheDocument();
});
