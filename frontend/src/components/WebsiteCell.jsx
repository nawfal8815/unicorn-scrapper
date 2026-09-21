import { hostnameFromUrl } from '../utils/format';

export default function WebsiteCell({ url, label }) {
  if (!url) return <span className="muted">—</span>;

  return (
    <a className="website-link" href={url} target="_blank" rel="noreferrer noopener">
      {label ?? hostnameFromUrl(url)}
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
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
  );
}
