# Baltic Job Radar

A pipeline that scans the Lithuanian/Baltic job market every night, matches openings against a
real candidate profile, tailors a CV per match, and — once fully wired — applies on the
candidate's behalf and tracks every reply. It started as a scraper for one job board and has
grown into an end-to-end job-search automation system for two people, built to eventually be
generic enough for anyone.

---

## What it actually does, end to end

Every night (and on demand), a fully automated pipeline runs on GitHub Actions and works through
these stages in order:

### 1. Discover companies — `scraper/scrape.js`
Scrapes the full startup table from [unicorns.lt](https://unicorns.lt/en/startups), paginating
through every row, and for each company that clears the filter bar, opens its detail modal to
capture its real website URL. Companies land in one of four buckets:

- **Perfect matches** — 5+ employees, ≥ €1,000 taxes paid
- **Under €1,000** — 5+ employees, taxes paid but under €1,000
- **Good startups** — under 5 employees but > €1,000 taxes paid (small but clearly real)
- **Failed filters** — everything else, kept and shown (not hidden) so nothing silently vanishes

### 2. Find open roles — `scraper/job-scraper.js`
For every qualifying company, visits its website, finds (or guesses, via a fallback path list)
its careers page, and scans every link on it against a real IT/QA job-title vocabulary (not a
handful of keywords — a full list sourced from an actual entry-level job-titles reference). Also
extracts, per company, a direct application email if one is visible on the page (a `mailto:` link
or a plain address), for the cases where applying doesn't go through a form.

### 3. Scan the wider market — `scraper/external-jobs-scraper.js`
Runs the same keyword matching directly against three more sources: **CVbankas.lt**, **CV.lt**,
and **Užimtumo tarnyba** (the Lithuanian public employment service). Same matching logic, same
requirement extraction, so results from every source are directly comparable.

### 4. Understand what each job actually needs — `scraper/ai.js`
For every match, an AI call (OpenAI, `gpt-4o-mini`) reads the posting and extracts a short,
concrete list of requirements — not the full posting text, just what actually matters for
deciding whether to apply and what to emphasize.

### 5. Tag experience level — `frontend/src/utils/experienceTier.js`
Every job is tagged, client-side, into a tier from its title/subtitle/requirements text: **entry
level** (no experience stated, or explicitly entry-level), **under 2 years**, or **2+ years**.
Purely a filtering aid — every job still gets a CV generated and gets applied to regardless of
tier.

### 6. Build a tailored CV — `cv-builder/generate.js` + `cv-builder/tailor.js`
For every match, one AI call compares the job's requirements against the candidate's *actual*
skill list and identifies only the genuinely missing ones — never invents overlap that isn't
there. Those get added to a fresh copy of the candidate's CV (rendered from structured JSON, not
hand-edited), so the candidate can see exactly what to brush up on before an interview. Jobs with
no extractable requirements fall back to one cached "standard" CV instead of guessing. Every CV
is rendered on demand as a PDF (`backend/cv/render.js` + `pdf.js`) — nothing is pre-rendered and
stored, so there's no stale-file problem.

### 7. Apply — `cv-builder/apply.js`
For jobs where a real application email was found, generates a cover letter (`cv-builder/coverletter.js`)
and sends it with the tailored CV attached, via Gmail (OAuth-connected, no passwords stored
anywhere). The cover-letter prompt is deliberately strict: it is only allowed to claim experience
that's actually in the candidate's real skill list — this was tightened after an early version
started implying hands-on experience with tools the candidate had never used, which is exactly
the failure mode a job-search tool cannot afford.

### 8. Watch for replies — `cv-builder/inbox.js` + `cv-builder/classify-reply.js`
Every sent application's email thread gets checked for a reply. When one arrives, an AI call
classifies it as a plain confirmation (no action needed), a rejection (worth a polite
feedback-seeking follow-up), or something that needs a human — an interview request, a question,
anything ambiguous. A notification is written either way, and confirmations don't get surfaced as
noise.

### 9. Show it all in one place — the dashboard
A React frontend shows scraped companies, matched jobs, external-board matches, and a per-job
timeline (**CV ready → Applied → Contacts found → Email sent → Reply**) for each person. Two real
Google accounts can sign in; anyone else can **continue as a guest** and get the same read-only
view of both people's progress, jobs, and generated CVs — no login required, nothing writable
exposed.

---

## Architecture

```
scraper/        Playwright-based scraping (unicorns.lt, job boards, career pages)
cv-builder/     CV tailoring, cover letters, sending, inbox monitoring, reply classification
backend/        Express API — auth, guest-readable data, on-demand CV PDF builds, Gmail OAuth
frontend/       React + Vite dashboard, guest mode, notifications, tier filters
.github/workflows/  CI (tests/build) + Deploy (backend+frontend to the VPS) + Daily Scrape (the pipeline above, on a schedule)
```

**Why it's split this way:**
- **Firestore is the only shared state.** Every stage reads/writes Firestore, nothing talks to
  another stage directly. This means any stage can run anywhere (a laptop, a CI runner, a VPS)
  without the others knowing or caring.
- **Scraping runs on GitHub Actions, not the always-on server.** Playwright + Chromium is heavy
  and the VPS is meant to stay light (it just serves the frontend and a small API). GitHub
  Actions runners are also x86_64, which matters because the VPS turned out to be ARM64 —
  Playwright's Chromium doesn't support that combination at all, so this wasn't just a nice-to-have.
- **CVs are never pre-rendered and stored.** The backend renders a CV to PDF live, on request,
  from the JSON that's actually stored (either a tailored one or the base profile). There is
  nothing to go stale.
- **Guest access is a real, separate auth path** (`optionalAuth` middleware), not the same
  authenticated path with a public flag. Read endpoints work identically with or without a token;
  write endpoints (Gmail connect, etc.) always require one.

---

## Running it

```bash
npm install                 # root deps: scraper + cv-builder
cd backend && npm install   # backend deps (separate package.json/node_modules)
cd ../frontend && npm install
```

You'll need `backend/firebase-service-account.json` (Firebase Console → Project settings →
Service accounts) and a `.env` at the root with `OPENAI_API_KEY`, plus `backend/.env` with
Firebase/Gmail OAuth config — see `.env.example`-style values referenced throughout `scraper/`
and `backend/`.

```bash
npm run scrape            # unicorns.lt
npm run scrape:jobs       # career pages
npm run scrape:external   # CVbankas / CV.lt / Užimtumo tarnyba
npm run cv:generate       # tailor + queue CVs for every match
```

Or let the whole thing run itself: the **Daily Scrape** GitHub Actions workflow runs all of the
above (plus apply + inbox-check) every night at 22:00 UTC, and can be triggered manually with
`gh workflow run "Daily Scrape"`.

---

## Where this is going

Right now this runs for exactly two people (Naoufal and Seif), one country (Lithuania), and one
field (IT/QA), with a fixed keyword list sourced from a PDF. None of that is meant to be
permanent — the architecture is already built to generalize:

- **Multi-user.** Every piece of state that matters — applications, generated CVs, Gmail
  connections, notifications — is already keyed by a `personId`, not hardcoded to one person.
  Adding a third person today is a config change, not a rewrite. The next step is opening that up
  properly: anyone should be able to bring their own CV, their own keyword list, and their own
  Gmail connection, and get their own fully independent pipeline running end to end — discovery,
  tailoring, applying, monitoring — without touching anyone else's data or process.
- **Multi-country.** The scraping layer is currently pointed at Lithuanian sources because that's
  where this started, but nothing about the pipeline shape (discover → match → tailor → apply →
  monitor) is Lithuania-specific. Supporting another country is a new set of source scrapers
  plugged into the same downstream pipeline, not a new pipeline.
- **User-configured search criteria.** The long-term goal is a setup where a user simply tells
  the system what they're looking for — job titles/fields, locations (including remote), and a
  target salary range — and the system takes it from there: search sources, matching logic, CV
  tailoring, and outreach all driven by that configuration instead of hardcoded keyword lists.
- **Always on, for you specifically.** The end state is a system that runs 24/7 per user, quietly
  finding and pursuing opportunities that match what that person actually wants, surfacing only
  what needs a human decision (an interview request, a rejection worth a feedback ask) and
  handling the repetitive parts — discovery, tailoring, first contact, triage — on its own.

None of this requires re-architecting what's already built. It requires generalizing
configuration that's currently hardcoded (keywords, one country's sources, two fixed people) into
something each user controls for themselves.
