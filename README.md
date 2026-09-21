# Unicorn Scrapper

Scrapes the startup table from [unicorns.lt](https://unicorns.lt/en/startups) and displays the
filtered results in a React dashboard. No backend — the scraper writes a JSON file that the
frontend imports directly.

## 1. Scrape the data

```bash
npm install
npm run scrape
```

This launches headless Chromium, paginates through the full startups table, and for every company
that has 5+ employees and paid taxes > €0, opens its modal and captures its website URL. Results
are written to `frontend/src/data/scraped-data.json` as three buckets:

- **perfectMatches** — ≥5 employees, ≥ €1,000 taxes paid
- **lessThan1000** — ≥5 employees, €0.01–€999.99 taxes paid
- **failedCompanies** — did not meet the mandatory filters (with a reason)

Run with a visible browser for debugging: `HEADFUL=1 npm run scrape`.

## 2. View the dashboard

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL. Tables are searchable and sortable by column; company names in the
first two tabs link out to the scraped website.
