export function parseNumber(value) {
  return (
    Number(
      String(value ?? '')
        .replace(/[€$,\s]/g, '')
        .replace(/[^\d.-]/g, '')
    ) || 0
  );
}

export function formatTimestamp(iso) {
  if (!iso) return 'Not scraped yet';

  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function hostnameFromUrl(url) {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—';

  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;

  if (m === 0) return `${r}s`;
  return `${m}m ${r}s`;
}
