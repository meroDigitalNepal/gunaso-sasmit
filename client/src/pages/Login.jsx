import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Heading, Text, Button } from '@mero-nepal/ui';
import Alert from '../components/Alert';
import { useAuth } from '../auth/useAuth';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  async function handleLogin() {
    setError(null);
    try {
      await login();
    } catch (err) {
      if (err?.errorCode !== 'user_cancelled') {
        setError(err?.message || 'Sign-in failed. Please try again.');
      }
    }
  }

  return (
    <main className="page" style={{ paddingTop: '80px', textAlign: 'center' }}>
      <Heading level={2} style={{ marginBottom: '8px' }}>Admin Login</Heading>
      <Text subtle style={{ marginBottom: '32px' }}>
        Sign in with your organisation account to access the dashboard.
      </Text>
      {error && <Alert style={{ marginBottom: '24px', textAlign: 'left' }}>{error}</Alert>}
      <Button onClick={handleLogin}>
        Sign in with Microsoft
      </Button>
    </main>
  );
}
