import { useMemo, useState } from 'react';
import { parseNumber } from '../utils/format';

function sortRows(rows, sortKey, sortDir, columns) {
  if (!sortKey) return rows;

  const column = columns.find(col => col.key === sortKey);
  const type = column?.sortType ?? 'string';

  const sorted = [...rows].sort((a, b) => {
    if (type === 'number') {
      return parseNumber(a[sortKey]) - parseNumber(b[sortKey]);
    }
    return String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''));
  });

  return sortDir === 'desc' ? sorted.reverse() : sorted;
}

export default function DataTable({
  columns,
  rows,
  searchPlaceholder,
  emptyMessage,
  defaultSortKey = 'number'
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(row => row.name?.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(
    () => sortRows(filtered, sortKey, sortDir, columns),
    [filtered, sortKey, sortDir, columns]
  );

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="data-table-wrap">
      <div className="table-toolbar">
        <div className="search-box">
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
            placeholder={searchPlaceholder ?? 'Search by company name…'}
          />
        </div>
        <span className="row-count">
          {sorted.length} {sorted.length === 1 ? 'company' : 'companies'}
        </span>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={col.align === 'right' ? 'align-right' : undefined}
                  onClick={() => handleSort(col.key)}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span className="th-inner">
                    {col.label}
                    <span className={`sort-icon ${sortKey === col.key ? 'active' : ''}`}>
                      {sortKey === col.key && sortDir === 'desc' ? '▾' : '▴'}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty-cell">
                  {emptyMessage ?? 'No companies match this filter.'}
                </td>
              </tr>
            )}
            {sorted.map((row, i) => (
              <tr key={`${row.number}-${row.name}-${i}`}>
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={col.align === 'right' ? 'align-right' : undefined}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
