import { useState } from 'react';
import { hostnameFromUrl } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { fetchPdfBlob, apiPost, ApiError } from '../lib/api';
import ApplicationTimeline from './ApplicationTimeline';
import { getExperienceTier, TIER_META } from '../utils/experienceTier';

const COMPANY_TYPE_META = {
  perfectMatches: { label: 'Perfect match', tone: 'good' },
  lessThan1000: { label: 'Under €1,000', tone: 'warn' },
  goodStartups: { label: 'Good startup', tone: 'good' }
};

const PERSON_LABELS = { naoufal: 'Naoufal', seif: 'Seif' };

function PersonApplicationRow({ jobId, personId, application, showLabel, allowManualApply }) {
  const [cvState, setCvState] = useState('idle'); // idle | loading | error
  const [manualApplyState, setManualApplyState] = useState('idle'); // idle | saving | error
  const [manuallyApplied, setManuallyApplied] = useState(Boolean(application.manuallyApplied));
  const { getIdToken, user } = useAuth();

  async function handleViewCv() {
    if (!jobId) return;
    setCvState('loading');
    try {
      const token = user ? await getIdToken() : null;
      const path = user
        ? `/api/applications/${jobId}/cv-pdf`
        : `/api/applications/${jobId}/${personId}/cv-pdf`;
      const blob = await fetchPdfBlob(path, token);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setCvState('idle');
    } catch (err) {
      setCvState('error');
      console.error('Failed to load generated CV:', err instanceof ApiError ? err.message : err);
    }
  }

  async function handleManualApplyToggle(e) {
    const next = e.target.checked;
    setManuallyApplied(next);
    setManualApplyState('saving');
    try {
      const token = await getIdToken();
      await apiPost(`/api/applications/${jobId}/manual-apply`, token, { applied: next });
      setManualApplyState('idle');
    } catch (err) {
      setManuallyApplied(!next);
      setManualApplyState('error');
      console.error('Failed to update manual apply status:', err instanceof ApiError ? err.message : err);
    }
  }

  return (
    <div className="job-application-row">
      {showLabel && <span className="job-application-person">{PERSON_LABELS[personId] ?? personId}</span>}
      <ApplicationTimeline application={{ ...application, manuallyApplied }} />
      <div className="job-cv-row">
        <button type="button" className="job-cv-btn" onClick={handleViewCv} disabled={cvState === 'loading'}>
          {cvState === 'loading' ? 'Building…' : 'View generated CV'}
        </button>
        {cvState === 'error' && <span className="job-cv-error">Couldn't load CV, try again.</span>}
      </div>
      {allowManualApply && (
        <label className="job-manual-apply">
          <input
            type="checkbox"
            checked={manuallyApplied}
            onChange={handleManualApplyToggle}
            disabled={manualApplyState === 'saving'}
          />
          I applied to this myself
          {manualApplyState === 'error' && <span className="job-cv-error"> — couldn't save, try again</span>}
        </label>
      )}
    </div>
  );
}

export default function JobCard({ job, application, applicationsByPerson }) {
  const [expanded, setExpanded] = useState(false);
  const requirements = job.requirements ?? [];
  const visibleRequirements = expanded ? requirements : requirements.slice(0, 3);
  const companyType = COMPANY_TYPE_META[job.companyType];
  const tier = getExperienceTier(job);
  const tierMeta = TIER_META[tier];

  const personRows = applicationsByPerson
    ? Object.entries(applicationsByPerson).filter(([, app]) => app?.cvGenerated)
    : application?.cvGenerated
      ? [[null, application]]
      : [];

  return (
    <article className="job-card">
      <div className="job-card-top">
        <span className="job-company">
          {job.company}
          {companyType && (
            <span className={`company-type-badge tone-${companyType.tone}`}>
              {companyType.label}
            </span>
          )}
        </span>
        <span className="job-badges">
          <span className={`tier-badge tone-${tierMeta.tone}`}>{tierMeta.label}</span>
          <span className="job-keyword-badge">{job.matchedKeyword}</span>
        </span>
      </div>

      <h3 className="job-title">{job.title}</h3>
      {job.subtitle && <p className="job-subtitle">{job.subtitle}</p>}

      {requirements.length > 0 ? (
        <ul className="job-requirements">
          {visibleRequirements.map((req, i) => (
            <li key={i}>{req}</li>
          ))}
        </ul>
      ) : (
        <p className="job-no-requirements">No requirements extracted for this posting.</p>
      )}

      {requirements.length > 3 && (
        <button className="job-expand-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `+${requirements.length - 3} more`}
        </button>
      )}

      {personRows.map(([personId, app]) => (
        <PersonApplicationRow
          key={personId ?? 'self'}
          jobId={job.id}
          personId={personId}
          application={app}
          showLabel={Boolean(applicationsByPerson)}
          allowManualApply={!applicationsByPerson}
        />
      ))}

      <div className="job-card-footer">
        <a
          className="job-careers-link"
          href={job.careersUrl ?? job.applyUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          {hostnameFromUrl(job.careersUrl ?? job.applyUrl)}
        </a>
        <a className="job-apply-btn" href={job.applyUrl} target="_blank" rel="noreferrer noopener">
          Apply
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 17 17 7M7 7h10v10"
            />
          </svg>
        </a>
      </div>
    </article>
  );
}
