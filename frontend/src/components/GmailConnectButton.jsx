import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';

export default function GmailConnectButton() {
  const { getIdToken } = useAuth();
  const [status, setStatus] = useState(null); // { connected, email }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getIdToken();
        const data = await apiFetch('/api/gmail/status', token);
        if (!cancelled) setStatus(data);
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError && err.status === 403)) {
          console.error('Failed to load Gmail status:', err);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  async function handleConnect() {
    setBusy(true);
    try {
      const token = await getIdToken();
      const { url } = await apiFetch('/api/gmail/connect-url', token);
      window.location.assign(url);
    } catch (err) {
      setBusy(false);
      console.error('Failed to start Gmail connect flow:', err);
    }
  }

  if (!status) return null;

  return (
    <div className="gmail-connect">
      {status.connected ? (
        <span className="gmail-connect-status connected" title={status.email}>
          Gmail connected
        </span>
      ) : (
        <button type="button" className="gmail-connect-btn" onClick={handleConnect} disabled={busy}>
          {busy ? 'Redirecting…' : 'Connect Gmail'}
        </button>
      )}
    </div>
  );
}
