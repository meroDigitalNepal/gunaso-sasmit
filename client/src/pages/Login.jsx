import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  async function handleLogin() {
    try {
      await login();
    } catch {
      // User closed the popup — no action needed
    }
  }

  return (
    <main className="page" style={{ paddingTop: '80px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Admin Login</h1>
      <p className="text-secondary" style={{ marginBottom: '32px' }}>
        Sign in with your organisation account to access the dashboard.
      </p>
      <button className="btn btn-primary" onClick={handleLogin}>
        Sign in with Microsoft
      </button>
    </main>
  );
}
