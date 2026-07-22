import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Toggle auth per test via a hoisted, mutable flag the mocks read.
const auth = vi.hoisted(() => ({ isAuthenticated: false }));

// Importing App pulls in AuthProvider, which constructs a real MSAL client at
// module load — stub the browser SDK so that doesn't throw under jsdom.
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: class {
    getAllAccounts() { return []; }
    acquireTokenSilent() { return Promise.resolve({ accessToken: 'test' }); }
  },
  LogLevel: { Error: 0, Warning: 1, Info: 2, Verbose: 3 },
}));

vi.mock('@azure/msal-react', () => ({
  MsalProvider: ({ children }) => children,
  useIsAuthenticated: () => auth.isAuthenticated,
  useMsal: () => ({
    instance: { loginPopup: vi.fn(), logoutPopup: vi.fn() },
    accounts: auth.isAuthenticated ? [{ name: 'Test Admin' }] : [],
  }),
  AuthenticatedTemplate: ({ children }) => (auth.isAuthenticated ? children : null),
  UnauthenticatedTemplate: ({ children }) => (auth.isAuthenticated ? null : children),
}));

// Keep pages from hitting the network; AuthProvider also imports setTokenGetter.
vi.mock('./api', () => ({
  setTokenGetter: vi.fn(),
  api: {
    getStats: vi.fn().mockResolvedValue({
      total: 0,
      byStatus: { new: 0, in_review: 0, resolved: 0 },
      byCategory: { infrastructure: 0, health: 0, education: 0, security: 0, other: 0 },
      uncategorized: 0,
    }),
    listSubmissions: vi.fn().mockResolvedValue([]),
  },
}));

// Imported after the mocks are registered (vi.mock is hoisted above them).
const { AppRoutes, Nav } = await import('./App');
// DisplayProvider supplies the theme + locale context (as main.jsx does), which
// the footer (useDisplaySettings) and every t()-using component now require.
const { DisplayProvider } = await import('./display/DisplaySettings');

function renderAt(path) {
  return render(
    <DisplayProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </DisplayProvider>,
  );
}

function renderNav() {
  return render(
    <DisplayProvider>
      <MemoryRouter>
        <Nav />
      </MemoryRouter>
    </DisplayProvider>,
  );
}

beforeEach(() => {
  auth.isAuthenticated = false;
});

describe('navigation', () => {
  test('order is Submit, Track, Dashboard, Admin when logged out', () => {
    const { container } = renderNav();
    const items = Array.from(container.querySelectorAll('.nav-links li')).map(li => li.textContent.trim());
    expect(items).toEqual(['Submit', 'Track', 'Dashboard', 'Admin']);
  });

  test('shows the Control Room link only when authenticated', () => {
    auth.isAuthenticated = true;
    const { container } = renderNav();
    const items = Array.from(container.querySelectorAll('.nav-links li')).map(li => li.textContent.trim());
    expect(items).toContain('Control Room');
    expect(items).not.toContain('Admin');
  });
});

describe('route access', () => {
  test('/dashboard is public — no auth required', async () => {
    renderAt('/dashboard');
    expect(await screen.findByText(/a public overview of citizen submissions/i)).toBeInTheDocument();
  });

  test('/control-room redirects an unauthenticated visitor to the login page', async () => {
    renderAt('/control-room');
    expect(await screen.findByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^control room$/i })).not.toBeInTheDocument();
  });

  test('/control-room renders the control room for an authenticated staff user', async () => {
    auth.isAuthenticated = true;
    renderAt('/control-room');
    expect(await screen.findByRole('heading', { name: /^control room$/i })).toBeInTheDocument();
  });
});
