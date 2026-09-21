import { useState } from 'react';
import { hostnameFromUrl } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { fetchPdfBlob, ApiError } from '../lib/api';

const COMPANY_TYPE_META = {
  perfectMatches: { label: 'Perfect match', tone: 'good' },
  lessThan1000: { label: 'Under €1,000', tone: 'warn' },
  goodStartups: { label: 'Good startup', tone: 'good' }
};

export default function JobCard({ job, application }) {
  const [expanded, setExpanded] = useState(false);
  const [cvState, setCvState] = useState('idle'); // idle | loading | error
  const { getIdToken } = useAuth();
  const requirements = job.requirements ?? [];
  const visibleRequirements = expanded ? requirements : requirements.slice(0, 3);
  const companyType = COMPANY_TYPE_META[job.companyType];

  async function handleViewCv() {
    if (!job.id) return;
    setCvState('loading');
    try {
      const token = await getIdToken();
      const blob = await fetchPdfBlob(`/api/applications/${job.id}/cv-pdf`, token);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setCvState('idle');
    } catch (err) {
      setCvState('error');
      console.error('Failed to load generated CV:', err instanceof ApiError ? err.message : err);
    }
  }

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
        <span className="job-keyword-badge">{job.matchedKeyword}</span>
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

      {application?.cvGenerated && (
        <div className="job-application-row">
          <span className={`application-status-badge ${application.applied ? 'tone-good' : 'tone-neutral'}`}>
            {application.applied ? 'Applied' : 'CV ready'}
          </span>
          <button
            type="button"
            className="job-cv-btn"
            onClick={handleViewCv}
            disabled={cvState === 'loading' || !job.id}
          >
            {cvState === 'loading' ? 'Building…' : 'View generated CV'}
          </button>
          {cvState === 'error' && <span className="job-cv-error">Couldn't load CV, try again.</span>}
        </div>
      )}

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
