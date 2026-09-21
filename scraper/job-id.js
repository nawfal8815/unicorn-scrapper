const crypto = require('crypto');

function jobId(company, applyUrl) {
  return crypto.createHash('sha1').update(`${company}::${applyUrl}`).digest('hex').slice(0, 16);
}

module.exports = { jobId };
