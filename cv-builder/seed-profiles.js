// One-off: uploads the local base CV JSON files (personal data, gitignored) into the
// Firestore `profiles` collection, so the backend can build "standard QA CV" PDFs
// on demand without needing local files on the instance.
const fs = require('fs');
const path = require('path');
const { setProfile } = require('./profiles');

const PEOPLE = ['naoufal', 'seif'];

async function main() {
  for (const id of PEOPLE) {
    const cv = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', `${id}.json`), 'utf8'));
    await setProfile(id, cv);
    console.log(`Seeded profile: ${id}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
