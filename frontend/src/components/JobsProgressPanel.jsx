import ProgressBar from './ProgressBar';
import { formatDuration } from '../utils/format';

export default function JobsProgressPanel({ progress }) {
  const {
    totalCompanies = 0,
    processed = 0,
    careersPagesFound = 0,
    jobsFound = 0,
    currentCompany,
    percent = 0,
    elapsedSeconds = 0,
    etaSeconds,
    recent = []
  } = progress;

  const careersRate = processed > 0 ? Math.round((careersPagesFound / processed) * 100) : 0;

  return (
    <div className="progress-panel">
      <div className="progress-header">
        <div>
          <p className="progress-phase">Scanning company career pages…</p>
          <h2 className="progress-title">
            {processed.toLocaleString()} / {totalCompanies.toLocaleString()} companies scanned
          </h2>
        </div>
        <div className="progress-percent">{percent}%</div>
      </div>

      <ProgressBar percent={percent} />

      <div className="progress-meta-row">
        <span>Elapsed {formatDuration(elapsedSeconds)}</span>
        {etaSeconds != null && <span>ETA {formatDuration(etaSeconds)}</span>}
        <span>{careersRate}% have a careers page</span>
      </div>

      {currentCompany && (
        <p className="progress-current">
          Checking <strong>{currentCompany}</strong>…
        </p>
      )}

      <div className="progress-stats">
        <div className="progress-stat tone-neutral">
          <span className="progress-stat-value">{careersPagesFound.toLocaleString()}</span>
          <span className="progress-stat-label">Careers pages found</span>
        </div>
        <div className="progress-stat tone-good">
          <span className="progress-stat-value">{jobsFound.toLocaleString()}</span>
          <span className="progress-stat-label">Matching jobs</span>
        </div>
      </div>

      {recent.length > 0 && (
        <ul className="progress-feed">
          {recent.map((entry, i) => (
            <li key={i}>
              <span className={`feed-dot ${entry.jobsFound ? 'bucket-goodStartups' : entry.careersFound ? 'bucket-lessThan1000' : 'bucket-failed'}`} />
              <span className="feed-name">{entry.name}</span>
              <span className="feed-bucket">
                {entry.jobsFound
                  ? `${entry.jobsFound} match${entry.jobsFound === 1 ? '' : 'es'}`
                  : entry.careersFound
                  ? 'careers page, no match'
                  : 'no careers page'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
