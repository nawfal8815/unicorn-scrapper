import { useMemo, useState } from 'react';
import JobCard from '../components/JobCard';
import ExternalJobsProgressPanel from '../components/ExternalJobsProgressPanel';
import useProgress from '../hooks/useProgress';
import useApiData from '../hooks/useApiData';
import { formatTimestamp } from '../utils/format';

const EMPTY_DATA = {
  scrapedAt: null,
  keywordsUsed: 0,
  aiRequirementsEnabled: false,
  totalMatches: 0,
  sources: {
    cvbankas: { jobsFound: 0, jobs: [] },
    cvlt: { jobsFound: 0, jobs: [] },
    uzt: { jobsFound: 0, jobs: [] }
  }
};

const SOURCE_TABS = [
  { id: 'cvbankas', label: 'CVbankas.lt' },
  { id: 'cvlt', label: 'CV.lt' },
  { id: 'uzt', label: 'Užimtumo tarnyba' }
];

export default function ExternalJobs() {
  const [source, setSource] = useState('cvbankas');
  const [search, setSearch] = useState('');
  const { progress, isActive } = useProgress('/api/external-jobs-progress');
  const { data: fetched, loading } = useApiData('/api/external-jobs');
  const data = fetched ?? EMPTY_DATA;

  const jobs = useMemo(() => data.sources?.[source]?.jobs ?? [], [data, source]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      job =>
        job.title.toLowerCase().includes(q) ||
        (job.company ?? '').toLowerCase().includes(q) ||
        job.matchedKeyword.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  if (loading && !fetched) {
    return (
      <div className="page">
        <div className="auth-loading">
          <div className="auth-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">CVbankas · CV.lt · Užimtumo tarnyba</p>
          <h1>Job Board Matches</h1>
          <p className="subtitle">
            Same entry-level IT/QA keywords, searched directly against Lithuania's job boards.
          </p>
        </div>
        <div className="scrape-meta">
          <span className="meta-label">Last scanned</span>
          <span className="meta-value">{formatTimestamp(data.scrapedAt)}</span>
        </div>
      </header>

      {isActive && <ExternalJobsProgressPanel progress={progress} />}

      <div className="summary-grid">
        <div className="summary-card tone-neutral">
          <span className="summary-value">{(data.keywordsUsed ?? 0).toLocaleString()}</span>
          <span className="summary-label">Keywords used</span>
        </div>
        <div className="summary-card tone-good">
          <span className="summary-value">{(data.totalMatches ?? 0).toLocaleString()}</span>
          <span className="summary-label">Total matches</span>
        </div>
        {SOURCE_TABS.map(t => (
          <div key={t.id} className="summary-card tone-neutral">
            <span className="summary-value">
              {(data.sources?.[t.id]?.jobsFound ?? 0).toLocaleString()}
            </span>
            <span className="summary-label">{t.label}</span>
          </div>
        ))}
      </div>

      <nav className="tabs" role="tablist">
        {SOURCE_TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={source === t.id}
            className={`tab-btn ${source === t.id ? 'active' : ''}`}
            onClick={() => setSource(t.id)}
          >
            <span className="tab-label">{t.label}</span>
            <span className="tab-count">{data.sources?.[t.id]?.jobsFound ?? 0}</span>
          </button>
        ))}
      </nav>

      <div className="jobs-toolbar">
        <div className="search-box jobs-search">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, company or keyword…"
          />
        </div>
        <span className="row-count">
          {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="jobs-empty">
          {data.totalMatches === 0
            ? 'No data yet — run "npm run scrape:external" from the project root.'
            : 'No jobs match this filter.'}
        </div>
      ) : (
        <div className="jobs-grid">
          {filtered.map((job, i) => (
            <JobCard key={`${job.applyUrl}-${i}`} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
