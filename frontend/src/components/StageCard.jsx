import ProgressBar from './ProgressBar';
import { formatDuration } from '../utils/format';

const STATUS_META = {
  running: { label: 'Running', tone: 'good' },
  processing: { label: 'Running', tone: 'good' },
  'loading-rows': { label: 'Running', tone: 'good' },
  done: { label: 'Done', tone: 'neutral' },
  error: { label: 'Error', tone: 'bad' }
};

export default function StageCard({ title, description, progress, checked, formatEntry }) {
  if (!checked) {
    return (
      <div className="stage-card">
        <div className="stage-card-header">
          <h3>{title}</h3>
        </div>
        <p className="stage-card-desc">{description}</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="stage-card idle">
        <div className="stage-card-header">
          <h3>{title}</h3>
          <span className="stage-status-badge tone-neutral">Never run</span>
        </div>
        <p className="stage-card-desc">{description}</p>
      </div>
    );
  }

  const { status, percent = 0, currentCompany, currentItem, elapsedSeconds, message, recent = [] } = progress;
  const statusMeta = STATUS_META[status] ?? { label: status, tone: 'neutral' };
  const current = currentCompany ?? currentItem;

  return (
    <div className="stage-card">
      <div className="stage-card-header">
        <h3>{title}</h3>
        <span className={`stage-status-badge tone-${statusMeta.tone}`}>{statusMeta.label}</span>
      </div>
      <p className="stage-card-desc">{description}</p>

      {(status === 'running' || status === 'processing' || status === 'loading-rows') && (
        <>
          <ProgressBar percent={percent} />
          <div className="progress-meta-row">
            <span>{percent}%</span>
            {elapsedSeconds != null && <span>Elapsed {formatDuration(elapsedSeconds)}</span>}
            {current && <span>Now: {current}</span>}
          </div>
        </>
      )}

      {status === 'error' && <p className="stage-error-msg">{message}</p>}

      {recent.length > 0 && (
        <ul className="stage-feed">
          {recent.slice(0, 8).map((entry, i) => (
            <li key={i}>{formatEntry ? formatEntry(entry) : JSON.stringify(entry)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
