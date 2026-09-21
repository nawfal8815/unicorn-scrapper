const { writeDoc } = require('./firestore');

const RECENT_LIMIT = 8;
const MIN_WRITE_INTERVAL_MS = 1500;
const TERMINAL_STATUSES = new Set(['done', 'error']);

function createProgressWriter(docId) {
  const startedAt = Date.now();
  const recent = [];
  let lastWriteAt = 0;
  let pending = null;
  let flushing = false;

  function pushRecent(entry) {
    recent.unshift(entry);
    if (recent.length > RECENT_LIMIT) recent.length = RECENT_LIMIT;
  }

  async function flush(data) {
    flushing = true;
    try {
      await writeDoc('progress', docId, data);
    } catch (err) {
      console.error(`Progress write failed (${docId}):`, err.message);
    } finally {
      flushing = false;
      if (pending) {
        const next = pending;
        pending = null;
        flush(next);
      }
    }
  }

  function write(data) {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.round((now - startedAt) / 1000));

    let etaSeconds = null;
    if (data.percent > 0 && data.percent < 100) {
      etaSeconds = Math.round((elapsedSeconds / data.percent) * (100 - data.percent));
    }

    const payload = {
      ...data,
      startedAt: new Date(startedAt).toISOString(),
      updatedAt: new Date(now).toISOString(),
      elapsedSeconds,
      etaSeconds,
      recent: [...recent]
    };

    const isTerminal = TERMINAL_STATUSES.has(data.status);
    const dueForWrite = isTerminal || now - lastWriteAt >= MIN_WRITE_INTERVAL_MS;

    if (!dueForWrite) return;

    lastWriteAt = now;

    if (flushing) {
      pending = payload; // coalesce - only the latest pending write survives
      return;
    }

    flush(payload);
  }

  return { write, pushRecent };
}

module.exports = { createProgressWriter };
