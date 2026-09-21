import { useMemo, useState } from 'react';
import JobCard from '../components/JobCard';
import JobsProgressPanel from '../components/JobsProgressPanel';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import WebsiteCell from '../components/WebsiteCell';
import useProgress from '../hooks/useProgress';
import useApiData from '../hooks/useApiData';
import { formatTimestamp } from '../utils/format';

const EMPTY_DATA = {
  scrapedAt: null,
  companiesScanned: 0,
  companiesQualifying: 0,
  careersPagesFound: 0,
  jobsFound: 0,
  jobs: [],
  companies: []
};

const STAT_META = [
  { key: 'companiesQualifying', label: 'Companies qualifying' },
  { key: 'companiesScanned', label: 'Companies scanned' },
  { key: 'careersPagesFound', label: 'Careers pages found' },
  { key: 'jobsFound', label: 'Matching jobs' }
];

const COVERAGE_COLUMNS = [
  { key: 'name', label: 'Company', sortType: 'string' },
  { key: 'status', label: 'Status', sortType: 'string', render: row => <StatusBadge status={row.status} /> },
  { key: 'jobsFound', label: 'Jobs found', sortType: 'number', align: 'right' },
  {
    key: 'website',
    label: 'Website',
    sortType: 'string',
    render: row => <WebsiteCell url={row.website} />
  },
  {
    key: 'careersUrl',
    label: 'Careers page',
    sortType: 'string',
    render: row => <WebsiteCell url={row.careersUrl} label={row.careersUrl ? 'View' : null} />
  }
];

export default function Jobs() {
  const [view, setView] = useState('matches');
  const [search, setSearch] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('all');
  const { progress, isActive } = useProgress('/api/jobs-progress');
  const { data: fetched, loading } = useApiData('/api/jobs-data');
  const data = fetched ?? EMPTY_DATA;
  const companies = data.companies ?? [];

  const keywords = useMemo(() => {
    const set = new Set(data.jobs.map(j => j.matchedKeyword));
    return ['all', ...Array.from(set).sort()];
  }, [data.jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.jobs.filter(job => {
      if (keywordFilter !== 'all' && job.matchedKeyword !== keywordFilter) return false;
      if (!q) return true;
      return (
        job.company.toLowerCase().includes(q) ||
        job.title.toLowerCase().includes(q) ||
        job.matchedKeyword.toLowerCase().includes(q)
      );
    });
  }, [data.jobs, search, keywordFilter]);

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
          <p className="eyebrow">Entry-level IT &amp; QA</p>
          <h1>Matched Job Openings</h1>
          <p className="subtitle">
            Careers pages of scraped startups, scanned for entry-level IT / QA title keywords.
          </p>
        </div>
        <div className="scrape-meta">
          <span className="meta-label">Last scanned</span>
          <span className="meta-value">{formatTimestamp(data.scrapedAt)}</span>
        </div>
      </header>

      {isActive && <JobsProgressPanel progress={progress} />}

      <div className="summary-grid">
        {STAT_META.map(({ key, label }) => (
          <div key={key} className="summary-card tone-neutral">
            <span className="summary-value">{(data[key] ?? 0).toLocaleString()}</span>
            <span className="summary-label">{label}</span>
          </div>
        ))}
      </div>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={view === 'matches'}
          className={`tab-btn ${view === 'matches' ? 'active' : ''}`}
          onClick={() => setView('matches')}
        >
          <span className="tab-label">Matches</span>
          <span className="tab-count">{data.jobs.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={view === 'coverage'}
          className={`tab-btn ${view === 'coverage' ? 'active' : ''}`}
          onClick={() => setView('coverage')}
        >
          <span className="tab-label">Coverage</span>
          <span className="tab-count">{companies.length}</span>
        </button>
      </nav>
      <p className="tab-hint">
        {view === 'matches'
          ? 'Job postings whose title matched an entry-level IT/QA keyword.'
          : 'Every qualifying company and what the scan found for it — use this to confirm nothing was silently skipped.'}
      </p>

      {view === 'coverage' ? (
        <DataTable
          columns={COVERAGE_COLUMNS}
          rows={companies}
          defaultSortKey="name"
          searchPlaceholder="Search by company name…"
          emptyMessage='No data yet — run "npm run scrape:jobs" from the project root.'
        />
      ) : (
        <>
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
                placeholder="Search by company, title or keyword…"
              />
            </div>

            <select
              className="keyword-select"
              value={keywordFilter}
              onChange={e => setKeywordFilter(e.target.value)}
            >
              {keywords.map(k => (
                <option key={k} value={k}>
                  {k === 'all' ? 'All keywords' : k}
                </option>
              ))}
            </select>

            <span className="row-count">
              {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="jobs-empty">
              {data.jobsFound === 0
                ? 'No data yet — run "npm run scrape:jobs" from the project root.'
                : 'No jobs match this filter.'}
            </div>
          ) : (
            <div className="jobs-grid">
              {filtered.map((job, i) => (
                <JobCard key={`${job.applyUrl}-${i}`} job={job} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
