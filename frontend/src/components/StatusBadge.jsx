const STATUS_META = {
  matched: { label: 'Matched', tone: 'good' },
  'careers-page-no-match': { label: 'No match', tone: 'neutral' },
  'no-careers-page': { label: 'No careers page', tone: 'warn' },
  'no-website': { label: 'No website', tone: 'bad' },
  'website-unreachable': { label: 'Unreachable', tone: 'bad' },
  'timed-out': { label: 'Timed out', tone: 'bad' },
  error: { label: 'Error', tone: 'bad' }
};

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'neutral' };
  return <span className={`status-badge tone-${meta.tone}`}>{meta.label}</span>;
}
