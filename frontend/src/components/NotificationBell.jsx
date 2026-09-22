import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const TYPE_META = {
  confirmation: { label: 'Confirmed', tone: 'good' },
  rejection: { label: 'Rejected', tone: 'warn' },
  'needs-attention': { label: 'Needs you', tone: 'bad' }
};

export default function NotificationBell() {
  const { getIdToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  async function load() {
    try {
      const token = await getIdToken();
      const data = await apiFetch('/api/notifications', token);
      setNotifications(data);
    } catch {
      // silent - notifications are a convenience, not critical path
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markRead(id) {
    setNotifications(ns => ns.map(n => (n.id === id ? { ...n, read: true } : n)));
    try {
      const token = await getIdToken();
      await apiFetch(`/api/notifications/${id}/read`, token);
    } catch {
      // best-effort
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button type="button" className="notif-bell-btn" onClick={() => setOpen(o => !o)} aria-label="Notifications">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
          />
        </svg>
        {unreadCount > 0 && <span className="notif-bell-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          {notifications.length === 0 ? (
            <p className="notif-empty">No notifications yet.</p>
          ) : (
            notifications.map(n => {
              const meta = TYPE_META[n.type] ?? { label: n.type, tone: 'neutral' };
              return (
                <div
                  key={n.id}
                  className={`notif-item ${n.read ? 'read' : ''}`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <span className={`notif-type tone-${meta.tone}`}>{meta.label}</span>
                  <div className="notif-body">
                    <strong>{n.company}</strong> — {n.jobTitle}
                    {n.summary && <p>{n.summary}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
