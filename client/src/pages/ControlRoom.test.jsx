import { test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const listSubmissions = vi.fn();
vi.mock('../api', () => ({ api: { listSubmissions: (...a) => listSubmissions(...a) } }));

const { default: ControlRoom } = await import('./ControlRoom');

const DAY = 24 * 60 * 60 * 1000;
// Single time base so derived created/updated diffs are exact multiples.
const now = Date.now();
const daysAgo = n => new Date(now - n * DAY).toISOString();

function renderControlRoom() {
  return render(
    <MemoryRouter>
      <ControlRoom />
    </MemoryRouter>,
  );
}

test('shows admin operational metrics including the longest-running open gunaso', async () => {
  listSubmissions.mockResolvedValue([
    { id: 'a', trackingId: 'A', title: 'Old pothole', status: 'in_review', category: 'infrastructure', createdAt: daysAgo(30), updatedAt: daysAgo(30) },
    { id: 'b', trackingId: 'B', title: 'New noise', status: 'new', category: null, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    { id: 'c', trackingId: 'C', title: 'Fixed light', status: 'resolved', category: 'infrastructure', createdAt: daysAgo(10), updatedAt: daysAgo(6) },
  ]);

  renderControlRoom();

  // Longest-running open gunaso is the oldest non-resolved one.
  const longest = (await screen.findByText('Longest-running open gunaso')).parentElement;
  expect(within(longest).getByText('Old pothole')).toBeInTheDocument();
  expect(within(longest).getByText(/open for 30 days/i)).toBeInTheDocument();

  // Open = new + in_review (2 of 3); resolved rate = 1/3.
  const openCard = screen.getByText('Open').parentElement;
  expect(within(openCard).getByText('2')).toBeInTheDocument();

  const rateCard = screen.getByText('Resolved rate').parentElement;
  expect(within(rateCard).getByText('33%')).toBeInTheDocument();
});

test('renders an empty state without admin metrics when there are no submissions', async () => {
  listSubmissions.mockResolvedValue([]);

  renderControlRoom();

  expect(await screen.findByText('No submissions found.')).toBeInTheDocument();
  expect(screen.queryByText('Longest-running open gunaso')).not.toBeInTheDocument();
});
