// The /api/applications response is either { scope: 'self', applications: { [jobId]: app } }
// for signed-in Naoufal/Seif, or { scope: 'all', applications: { [`${jobId}_${personId}`]: app } }
// for guests. This resolves either shape into the props JobCard expects for one job.
export function jobApplicationProps(applicationsData, jobId) {
  if (!applicationsData || !jobId) return {};

  const { scope, applications } = applicationsData;

  if (scope === 'self') {
    return { application: applications[jobId] };
  }

  if (scope === 'all') {
    const byPerson = {};
    for (const [key, app] of Object.entries(applications)) {
      if (key.startsWith(`${jobId}_`)) {
        byPerson[app.personId] = app;
      }
    }
    return { applicationsByPerson: byPerson };
  }

  return {};
}

// A job counts as applied to if any of the three independent apply mechanisms succeeded.
export function isApplied(application) {
  return Boolean(application?.applied || application?.cvbankasApplied || application?.manuallyApplied);
}

function anyApplied(entryProps) {
  if (entryProps.application) return isApplied(entryProps.application);
  if (entryProps.applicationsByPerson) return Object.values(entryProps.applicationsByPerson).some(isApplied);
  return false;
}

// Job-board listings (CVbankas/CV.lt/Uzimtumo tarnyba) get fully replaced by each day's
// scrape - a listing that's gone simply isn't in today's array. That's fine for jobs
// nobody applied to (nothing left to act on), but a job that WAS applied to should stay
// visible as history even after it's delisted, since the application record itself
// (company/title/etc.) already lives on permanently in the `applications` collection -
// this just reconstructs a job-shaped object from it for jobs no longer in the live scrape.
// Sorts not-applied first, then applied-and-still-live, then delisted history last.
export function buildJobBoardEntries(source, liveJobs, applicationsData) {
  const seenIds = new Set();
  const entries = [];

  for (const job of liveJobs) {
    const props = jobApplicationProps(applicationsData, job.id);
    entries.push({ job, ...props, isHistory: false, isApplied: anyApplied(props) });
    seenIds.add(job.id);
  }

  if (applicationsData?.applications) {
    const { scope, applications } = applicationsData;
    const historyByJobId = new Map();

    for (const [key, app] of Object.entries(applications)) {
      if (app.source !== source) continue;
      const jobId = scope === 'self' ? key : key.slice(0, key.lastIndexOf('_'));
      if (seenIds.has(jobId)) continue;
      if (!isApplied(app)) continue;
      if (!historyByJobId.has(jobId)) historyByJobId.set(jobId, []);
      historyByJobId.get(jobId).push(app);
    }

    for (const [jobId, apps] of historyByJobId) {
      const first = apps[0];
      const job = {
        id: jobId,
        title: first.jobTitle,
        subtitle: first.subtitle ?? null,
        company: first.company,
        applyUrl: first.applyUrl,
        requirements: first.requirements ?? [],
        source
      };
      const props =
        scope === 'self'
          ? { application: first }
          : { applicationsByPerson: Object.fromEntries(apps.map(a => [a.personId, a])) };
      entries.push({ job, ...props, isHistory: true, isApplied: true });
    }
  }

  entries.sort((a, b) => rank(a) - rank(b));
  return entries;
}

function rank(entry) {
  if (entry.isHistory) return 2;
  if (entry.isApplied) return 1;
  return 0;
}
