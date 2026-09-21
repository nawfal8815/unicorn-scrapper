import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';

const ACTIVE_STATUSES = new Set(['loading-rows', 'processing', 'running']);

export default function useProgress(path, { pollMs = 1000 } = {}) {
  const { getIdToken } = useAuth();
  const [progress, setProgress] = useState(null);
  const [checked, setChecked] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const token = await getIdToken();
        const data = await apiFetch(path, token);
        if (cancelled) return;

        setProgress(data);
        setChecked(true);

        if (ACTIVE_STATUSES.has(data.status)) {
          timerRef.current = setTimeout(tick, pollMs);
        }
      } catch (err) {
        if (cancelled) return;
        if (!(err instanceof ApiError) || err.status !== 404) {
          console.error('Progress poll failed:', err);
        }
        setProgress(null);
        setChecked(true);
      }
    }

    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [path, pollMs, getIdToken]);

  const isActive = Boolean(progress && ACTIVE_STATUSES.has(progress.status));

  return { progress, checked, isActive };
}
