import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import Login from '../pages/Login';

export default function AuthGate({ children }) {
  const { user, initializing, getIdToken, guestMode } = useAuth();
  const [status, setStatus] = useState('checking'); // checking | authorized | denied | error

  useEffect(() => {
    if (initializing) return;

    if (guestMode) {
      setStatus('authorized');
      return;
    }

    if (!user) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('checking');

    (async () => {
      try {
        const token = await getIdToken();
        await apiFetch('/api/me', token);
        if (!cancelled) setStatus('authorized');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setStatus('denied');
        } else {
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, initializing, getIdToken, guestMode]);

  if (initializing || status === 'checking') {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
      </div>
    );
  }

  if (!guestMode && (!user || status === 'idle')) {
    return <Login />;
  }

  if (status === 'denied') {
    return <Login deniedEmail={user.email} />;
  }

  if (status === 'error') {
    return (
      <div className="auth-loading">
        <p>Couldn't reach the backend. Is it running?</p>
      </div>
    );
  }

  return children;
}
