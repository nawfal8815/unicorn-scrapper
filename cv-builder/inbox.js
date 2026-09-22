const { getDb } = require('../scraper/firestore');
const { getThread } = require('../backend/gmail/send');
const { getConnection } = require('../backend/gmail/store');
const { classifyReply } = require('./classify-reply');
const { createProgressWriter } = require('../scraper/progress');

const progress = createProgressWriter('inbox');

async function loadPendingThreads() {
  const snap = await getDb()
    .collection('applications')
    .where('emailSent', '==', true)
    .get();

  const pending = [];
  snap.forEach(doc => {
    const data = doc.data();
    if (data.gmailThreadId && !data.replyStatus) pending.push({ docId: doc.id, ...data });
  });
  return pending;
}

async function writeNotification({ personId, jobId, company, jobTitle, type, summary }) {
  await getDb().collection('notifications').add({
    personId,
    jobId,
    company,
    jobTitle,
    type,
    summary,
    createdAt: new Date().toISOString(),
    read: false
  });
}

async function run() {
  const pending = await loadPendingThreads();
  console.log(`Checking ${pending.length} sent applications for replies.`);

  const connectionCache = {};
  let checked = 0;
  let repliesFound = 0;
  let errors = 0;

  progress.write({ status: 'running', total: pending.length, repliesFound: 0, percent: 0 });

  for (const application of pending) {
    if (!(application.personId in connectionCache)) {
      connectionCache[application.personId] = await getConnection(application.personId);
    }
    const connection = connectionCache[application.personId];

    if (!connection) {
      checked++;
      continue;
    }

    try {
      const messages = await getThread({ refreshToken: connection.refreshToken, threadId: application.gmailThreadId });

      if (messages.length > 1) {
        const latest = messages[messages.length - 1];
        const { type, summary } = await classifyReply(latest.body);

        await getDb().collection('applications').doc(application.docId).update({
          replyStatus: type,
          replySummary: summary,
          repliedAt: new Date().toISOString()
        });

        await writeNotification({
          personId: application.personId,
          jobId: application.jobId,
          company: application.company,
          jobTitle: application.jobTitle,
          type,
          summary
        });

        repliesFound++;
        console.log(`[reply:${type}] ${application.company} / ${application.jobTitle} (${application.personId}) - ${summary}`);
      }
    } catch (err) {
      errors++;
      console.error(`[error] ${application.company} / ${application.jobTitle} (${application.personId}): ${err.message}`);
    }

    checked++;
    progress.write({
      status: 'running',
      total: pending.length,
      repliesFound,
      percent: Math.round((checked / pending.length) * 100)
    });
  }

  progress.write({ status: 'done', total: pending.length, repliesFound, percent: 100 });
  console.log(`\nDone. Checked: ${checked}, replies found: ${repliesFound}, errors: ${errors}.`);
}

run().catch(err => {
  console.error('Failed:', err);
  progress.write({ status: 'error', message: err.message, total: 0, repliesFound: 0, percent: 0 });
  process.exitCode = 1;
});
