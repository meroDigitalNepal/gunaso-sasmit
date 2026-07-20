import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { Button, Text } from '@mero-nepal/ui';
import AuthProvider from './auth/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './auth/useAuth';
import Home from './pages/Home';
import Submit from './pages/Submit';
import Track from './pages/Track';
import PublicDashboard from './pages/PublicDashboard';
import ControlRoom from './pages/ControlRoom';
import RequestDetail from './pages/RequestDetail';
import Login from './pages/Login';

function Nav() {
  const { user, login, logout } = useAuth();

  return (
    <nav>
      <div className="nav-inner">
        <NavLink to="/" className="nav-logo" style={{ textDecoration: 'none' }}>
          Gunaso
        </NavLink>
        <ul className="nav-links">
          <li><NavLink to="/dashboard">Dashboard</NavLink></li>
          <li><NavLink to="/submit">Submit</NavLink></li>
          <li><NavLink to="/track">Track</NavLink></li>
          <AuthenticatedTemplate>
            <li><NavLink to="/control-room">Control Room</NavLink></li>
            <li>
              <Button variant="ghost" size="sm" onClick={logout}>
                {user?.name ?? 'Sign out'}
              </Button>
            </li>
          </AuthenticatedTemplate>
          <UnauthenticatedTemplate>
            <li>
              <Button variant="ghost" size="sm" onClick={login}>
                Admin Login
              </Button>
            </li>
          </UnauthenticatedTemplate>
        </ul>
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/track" element={<Track />} />
        <Route path="/track/:trackingId" element={<Track />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<PublicDashboard />} />
        <Route path="/control-room" element={<ProtectedRoute><ControlRoom /></ProtectedRoute>} />
        <Route path="/control-room/:id" element={<ProtectedRoute><RequestDetail /></ProtectedRoute>} />
      </Routes>
      <Text
        as="footer"
        subtle
        style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.8125rem', padding: '32px 24px' }}
      >
        Made by Nepaliहरु via{' '}
        <a href="https://github.com/meroDigitalNepal" target="_blank" rel="noreferrer">meroDigitalNepal</a>
      </Text>
    </>
  );
}

// BASE_URL is '/' in dev, '/gunaso/' in production builds (set via vite.config.js base)
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
