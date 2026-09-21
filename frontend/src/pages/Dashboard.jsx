import { useMemo, useState } from 'react';
import SummaryCards from '../components/SummaryCards';
import DataTable from '../components/DataTable';
import WebsiteCell from '../components/WebsiteCell';
import ScrapeProgressPanel from '../components/ScrapeProgressPanel';
import useProgress from '../hooks/useProgress';
import useApiData from '../hooks/useApiData';
import { formatTimestamp } from '../utils/format';

const EMPTY_DATA = {
  scrapedAt: null,
  sourceUrl: null,
  totalRows: 0,
  summary: { perfectMatches: 0, lessThan1000: 0, goodStartups: 0, failedFilters: 0 },
  perfectMatches: [],
  lessThan1000: [],
  goodStartups: [],
  failedCompanies: []
};

const BASE_COLUMNS = [
  { key: 'number', label: 'No', sortType: 'number' },
  { key: 'name', label: 'Company', sortType: 'string' },
  { key: 'taxesPaid', label: 'Taxes paid', sortType: 'number', align: 'right' },
  { key: 'employees', label: 'Employees', sortType: 'number', align: 'right' }
];

const WEBSITE_COLUMN = {
  key: 'website',
  label: 'Website',
  sortType: 'string',
  render: row => <WebsiteCell url={row.website} />
};

const REASON_COLUMN = {
  key: 'reason',
  label: 'Failure reason',
  sortType: 'string'
};

const TABS = [
  {
    id: 'perfect',
    label: 'Perfect matches',
    hint: '≥5 employees · ≥ €1,000 taxes paid',
    dataKey: 'perfectMatches',
    columns: [...BASE_COLUMNS, WEBSITE_COLUMN]
  },
  {
    id: 'lessThan1000',
    label: 'Under €1,000',
    hint: '≥5 employees · €0.01–€999.99 taxes paid',
    dataKey: 'lessThan1000',
    columns: [...BASE_COLUMNS, WEBSITE_COLUMN]
  },
  {
    id: 'goodStartups',
    label: 'Good startups',
    hint: '<5 employees · > €1,000 taxes paid',
    dataKey: 'goodStartups',
    columns: [...BASE_COLUMNS, WEBSITE_COLUMN]
  },
  {
    id: 'failed',
    label: 'Failed filters',
    hint: 'Did not meet the mandatory filters',
    dataKey: 'failedCompanies',
    columns: [...BASE_COLUMNS, REASON_COLUMN]
  }
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const { progress, isActive } = useProgress('/api/scrape-progress');
  const { data: fetched, loading } = useApiData('/api/scraped-data');
  const data = fetched ?? EMPTY_DATA;

  const tab = useMemo(() => TABS.find(t => t.id === activeTab), [activeTab]);
  const rows = data[tab.dataKey] ?? [];

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
          <p className="eyebrow">unicorns.lt · 2026-Q2</p>
          <h1>Lithuanian Startup Ecosystem</h1>
          {data.sourceUrl && (
            <p className="subtitle">
              Filtered from{' '}
              <a href={data.sourceUrl} target="_blank" rel="noreferrer noopener">
                {data.sourceUrl}
              </a>
            </p>
          )}
        </div>
        <div className="scrape-meta">
          <span className="meta-label">Last scraped</span>
          <span className="meta-value">{formatTimestamp(data.scrapedAt)}</span>
        </div>
      </header>

      {isActive && <ScrapeProgressPanel progress={progress} />}

      <SummaryCards totalRows={data.totalRows} summary={data.summary} />

      <nav className="tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="tab-label">{t.label}</span>
            <span className="tab-count">{(data[t.dataKey] ?? []).length}</span>
          </button>
        ))}
      </nav>
      <p className="tab-hint">{tab.hint}</p>

      <DataTable
        columns={tab.columns}
        rows={rows}
        emptyMessage={
          data.totalRows === 0
            ? 'No data yet — run "npm run scrape" from the project root.'
            : 'No companies match this filter.'
        }
      />
    </div>
  );
}
