const fs = require('fs');
const path = require('path');
const { renderCvToDocxBuffer } = require('../backend/cv/render');

async function main() {
  const outDir = path.join(__dirname, 'output', '_test');
  fs.mkdirSync(outDir, { recursive: true });

  for (const id of ['naoufal', 'seif']) {
    const cv = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', `${id}.json`), 'utf8'));
    const buf = await renderCvToDocxBuffer(cv);
    const outPath = path.join(outDir, `${id}.docx`);
    fs.writeFileSync(outPath, buf);
    console.log('wrote', outPath);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
