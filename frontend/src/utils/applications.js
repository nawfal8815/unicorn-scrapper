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
