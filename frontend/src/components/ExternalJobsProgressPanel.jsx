import ProgressBar from './ProgressBar';
import { formatDuration } from '../utils/format';

const STAGE_LABELS = {
  cvbankas: 'Scanning CVbankas.lt…',
  cvlt: 'Scanning CV.lt…',
  uzt: 'Scanning Užimtumo tarnyba…',
  requirements: 'Extracting requirements with AI…'
};

export default function ExternalJobsProgressPanel({ progress }) {
  const {
    stage,
    stageProgress = { current: 0, total: 0 },
    totalMatches = 0,
    currentItem,
    percent = 0,
    elapsedSeconds = 0,
    etaSeconds
  } = progress;

  return (
    <div className="progress-panel">
      <div className="progress-header">
        <div>
          <p className="progress-phase">{STAGE_LABELS[stage] ?? 'Working…'}</p>
          <h2 className="progress-title">
            {stageProgress.total > 0
              ? `${stageProgress.current} / ${stageProgress.total}`
              : 'Starting…'}
          </h2>
        </div>
        <div className="progress-percent">{percent}%</div>
      </div>

      <ProgressBar percent={percent} />

      <div className="progress-meta-row">
        <span>Elapsed {formatDuration(elapsedSeconds)}</span>
        {etaSeconds != null && <span>ETA {formatDuration(etaSeconds)}</span>}
        <span>{totalMatches} matches so far</span>
      </div>

      {currentItem && (
        <p className="progress-current">
          Current: <strong>{currentItem}</strong>
        </p>
      )}
    </div>
  );
}
