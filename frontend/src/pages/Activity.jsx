import StageCard from '../components/StageCard';
import useProgress from '../hooks/useProgress';

const PERSON_LABELS = { naoufal: 'Naoufal', seif: 'Seif' };

const STAGES = [
  {
    key: 'scrape',
    path: '/api/scrape-progress',
    title: '1. Scrape unicorns.lt',
    description: 'Loads every startup row and captures the website URL for each qualifying company.',
    formatEntry: e => `${e.name} — ${e.bucket}${e.website ? ` (${e.website})` : ''}`
  },
  {
    key: 'jobs',
    path: '/api/jobs-progress',
    title: '2. Scan career pages',
    description: 'Visits each qualifying company\'s site and matches its careers page against the keyword list.',
    formatEntry: e => `${e.name} — ${e.jobsFound ? `${e.jobsFound} match(es)` : e.careersFound ? 'careers page, no match' : 'no careers page'}`
  },
  {
    key: 'external-jobs',
    path: '/api/external-jobs-progress',
    title: '3. Scan job boards',
    description: 'Searches CVbankas, CV.lt and Užimtumo tarnyba with the same keyword list.',
    formatEntry: null
  },
  {
    key: 'generate',
    path: '/api/generate-progress',
    title: '4. Generate CVs',
    description: 'For every match, compares requirements to the real skill list and tailors a CV per person.',
    formatEntry: e =>
      `${e.company} / ${e.jobTitle} (${PERSON_LABELS[e.personId] ?? e.personId}) — ` +
      (e.skipped ? 'skipped (already done)' : `${e.cvType}${e.addedSkills?.length ? `, added: ${e.addedSkills.join(', ')}` : ''}`)
  },
  {
    key: 'apply',
    path: '/api/apply-progress',
    title: '5. Send applications',
    description: 'Generates a cover letter and sends it with the CV attached, for jobs with a known application email.',
    formatEntry: null
  },
  {
    key: 'inbox',
    path: '/api/inbox-progress',
    title: '6. Check inbox for replies',
    description: 'Checks each sent application\'s email thread and classifies any reply (confirmation / rejection / needs attention).',
    formatEntry: null
  }
];

function StageWithData({ stage }) {
  const { progress, checked } = useProgress(stage.path);
  return (
    <StageCard
      title={stage.title}
      description={stage.description}
      progress={progress}
      checked={checked}
      formatEntry={stage.formatEntry}
    />
  );
}

export default function Activity() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>Activity</h1>
          <p className="subtitle">
            Every stage of the pipeline, in order — what's running right now and what happened last time.
          </p>
        </div>
      </header>

      <div className="stage-grid">
        {STAGES.map(stage => (
          <StageWithData key={stage.key} stage={stage} />
        ))}
      </div>
    </div>
  );
}
