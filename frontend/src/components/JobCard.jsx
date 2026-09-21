import { useState } from 'react';
import { hostnameFromUrl } from '../utils/format';

export default function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false);
  const requirements = job.requirements ?? [];
  const visibleRequirements = expanded ? requirements : requirements.slice(0, 3);

  return (
    <article className="job-card">
      <div className="job-card-top">
        <span className="job-company">{job.company}</span>
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
