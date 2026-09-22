const REPLY_LABELS = {
  confirmation: 'Confirmed',
  rejection: 'Rejected',
  'needs-attention': 'Needs reply'
};

function buildSteps(application) {
  return [
    { key: 'cv', label: 'CV ready', done: Boolean(application.cvGenerated) },
    { key: 'applied', label: 'Applied', done: Boolean(application.applied) },
    { key: 'contacts', label: 'Contacts found', done: Boolean(application.contactsFound) },
    { key: 'email', label: 'Email sent', done: Boolean(application.emailSent) },
    {
      key: 'reply',
      label: application.replyStatus ? REPLY_LABELS[application.replyStatus] ?? 'Reply received' : 'Reply',
      done: Boolean(application.replyStatus),
      alert: application.replyStatus === 'needs-attention'
    }
  ];
}

export default function ApplicationTimeline({ application }) {
  if (!application?.cvGenerated) return null;

  const steps = buildSteps(application);

  return (
    <div className="app-timeline" role="list" aria-label="Application progress">
      {steps.map((step, i) => (
        <div key={step.key} className="app-timeline-step" role="listitem">
          <div className="app-timeline-node-wrap">
            <span
              className={`app-timeline-node ${step.done ? 'done' : 'pending'} ${step.alert ? 'alert' : ''}`}
              aria-hidden="true"
            />
            {i < steps.length - 1 && <span className={`app-timeline-line ${step.done ? 'done' : ''}`} aria-hidden="true" />}
          </div>
          <span className={`app-timeline-label ${step.done ? 'done' : ''} ${step.alert ? 'alert' : ''}`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
