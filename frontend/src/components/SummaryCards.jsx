const CARD_META = [
  { key: 'totalRows', label: 'Companies scraped', tone: 'neutral' },
  { key: 'perfectMatches', label: 'Perfect matches', tone: 'good' },
  { key: 'lessThan1000', label: 'Under €1,000 taxes', tone: 'warn' },
  { key: 'goodStartups', label: 'Good startups', tone: 'good' },
  { key: 'failedFilters', label: 'Failed filters', tone: 'bad' }
];

export default function SummaryCards({ totalRows, summary }) {
  const values = { totalRows, ...summary };

  return (
    <div className="summary-grid">
      {CARD_META.map(({ key, label, tone }) => (
        <div key={key} className={`summary-card tone-${tone}`}>
          <span className="summary-value">{(values[key] ?? 0).toLocaleString()}</span>
          <span className="summary-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
