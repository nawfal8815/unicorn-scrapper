const { refreshAccessToken } = require('./oauth');

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildMimeMessage({ fromEmail, fromName, to, subject, bodyText, attachment }) {
  const boundary = `bjr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ].join('\r\n');

  const bodyPart =
    `--${boundary}\r\n` +
    'Content-Type: text/plain; charset="UTF-8"\r\n' +
    'Content-Transfer-Encoding: 7bit\r\n\r\n' +
    `${bodyText}\r\n\r\n`;

  let attachmentPart = '';
  if (attachment) {
    attachmentPart =
      `--${boundary}\r\n` +
      `Content-Type: application/pdf; name="${attachment.filename}"\r\n` +
      'Content-Transfer-Encoding: base64\r\n' +
      `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n` +
      `${attachment.buffer.toString('base64')}\r\n\r\n`;
  }

  const closing = `--${boundary}--`;

  return `${headers}\r\n\r\n${bodyPart}${attachmentPart}${closing}`;
}

// Sends one email via the Gmail API using a stored refresh token. Throws on failure -
// callers decide what "failed to send" means for their record-keeping.
async function sendEmail({ refreshToken, fromEmail, to, subject, bodyText, attachment }) {
  const { access_token: accessToken } = await refreshAccessToken(refreshToken);

  const raw = base64url(buildMimeMessage({ fromEmail, to, subject, bodyText, attachment }));

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!res.ok) {
    throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
  }

  return res.json(); // { id, threadId, ... }
}

function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function extractPlainText(payload) {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts || []) {
    const found = extractPlainText(part);
    if (found) return found;
  }
  return null;
}

// Returns the thread's messages with sender + plain-text body, oldest first.
async function getThread({ refreshToken, threadId }) {
  const { access_token: accessToken } = await refreshAccessToken(refreshToken);

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Gmail thread fetch failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();

  return (data.messages || []).map(msg => {
    const headers = msg.payload?.headers || [];
    const from = headers.find(h => h.name === 'From')?.value ?? null;
    return {
      id: msg.id,
      from,
      snippet: msg.snippet ?? '',
      body: extractPlainText(msg.payload) ?? msg.snippet ?? ''
    };
  });
}

module.exports = { sendEmail, getThread };
