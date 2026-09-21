import ProgressBar from './ProgressBar';
import { formatDuration, hostnameFromUrl } from '../utils/format';

const BUCKET_LABELS = {
  perfectMatches: 'Perfect match',
  lessThan1000: 'Under €1,000',
  goodStartups: 'Good startup',
  failed: 'Failed filters'
};

export default function ScrapeProgressPanel({ progress }) {
  const {
    status,
    totalRows = 0,
    processed = 0,
    counts = {},
    currentCompany,
    percent = 0,
    elapsedSeconds = 0,
    etaSeconds,
    recent = []
  } = progress;

  const isLoadingRows = status === 'loading-rows';
  const passed =
    (counts.perfectMatches ?? 0) + (counts.lessThan1000 ?? 0) + (counts.goodStartups ?? 0);
  const passRate = processed > 0 ? Math.round((passed / processed) * 100) : 0;

  return (
    <div className="progress-panel">
      <div className="progress-header">
        <div>
          <p className="progress-phase">
            {isLoadingRows ? 'Loading startup table…' : 'Scanning companies…'}
          </p>
          <h2 className="progress-title">
            {isLoadingRows
              ? `${totalRows.toLocaleString()} rows loaded`
              : `${processed.toLocaleString()} / ${totalRows.toLocaleString()} rows checked`}
          </h2>
        </div>
        <div className="progress-percent">{isLoadingRows ? '…' : `${percent}%`}</div>
      </div>

      <ProgressBar percent={percent} indeterminate={isLoadingRows} />

      <div className="progress-meta-row">
        <span>Elapsed {formatDuration(elapsedSeconds)}</span>
        {!isLoadingRows && etaSeconds != null && <span>ETA {formatDuration(etaSeconds)}</span>}
        {!isLoadingRows && <span>{passRate}% passing so far</span>}
      </div>

      {currentCompany && (
        <p className="progress-current">
          Checking <strong>{currentCompany}</strong>…
        </p>
      )}

      {!isLoadingRows && (
        <div className="progress-stats">
          <div className="progress-stat tone-good">
            <span className="progress-stat-value">{(counts.perfectMatches ?? 0).toLocaleString()}</span>
            <span className="progress-stat-label">Perfect matches</span>
          </div>
          <div className="progress-stat tone-warn">
            <span className="progress-stat-value">{(counts.lessThan1000 ?? 0).toLocaleString()}</span>
            <span className="progress-stat-label">Under €1,000</span>
          </div>
          <div className="progress-stat tone-good">
            <span className="progress-stat-value">{(counts.goodStartups ?? 0).toLocaleString()}</span>
            <span className="progress-stat-label">Good startups</span>
          </div>
          <div className="progress-stat tone-bad">
            <span className="progress-stat-value">{(counts.failedFilters ?? 0).toLocaleString()}</span>
            <span className="progress-stat-label">Failed filters</span>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <ul className="progress-feed">
          {recent.map((entry, i) => (
            <li key={i}>
              <span className={`feed-dot bucket-${entry.bucket}`} />
              <span className="feed-name">{entry.name}</span>
              <span className="feed-bucket">{BUCKET_LABELS[entry.bucket] ?? entry.bucket}</span>
              {entry.website && (
                <span className="feed-website">{hostnameFromUrl(entry.website)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
