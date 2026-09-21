const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function convertDocxToPdf(docxPath, outDir) {
  return new Promise((resolve, reject) => {
    execFile(
      'soffice',
      ['--headless', '--convert-to', 'pdf', '--outdir', outDir, docxPath],
      { timeout: 60000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`soffice conversion failed: ${err.message}\n${stderr}`));
        const pdfPath = path.join(outDir, path.basename(docxPath, '.docx') + '.pdf');
        if (!fs.existsSync(pdfPath)) return reject(new Error(`soffice did not produce ${pdfPath}\n${stdout}`));
        resolve(pdfPath);
      }
    );
  });
}

async function docxBufferToPdfFile(docxBuf, finalPdfPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvbuild-'));
  const tmpDocx = path.join(tmpDir, 'doc.docx');
  fs.writeFileSync(tmpDocx, docxBuf);

  try {
    const producedPdf = await convertDocxToPdf(tmpDocx, tmpDir);
    fs.mkdirSync(path.dirname(finalPdfPath), { recursive: true });
    fs.copyFileSync(producedPdf, finalPdfPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return finalPdfPath;
}

// Renders straight to a Buffer with no file left behind — used by the on-demand
// backend endpoint, which must never persist generated CVs to disk.
async function docxBufferToPdfBuffer(docxBuf) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvbuild-'));
  const tmpDocx = path.join(tmpDir, 'doc.docx');
  fs.writeFileSync(tmpDocx, docxBuf);

  try {
    const producedPdf = await convertDocxToPdf(tmpDocx, tmpDir);
    return fs.readFileSync(producedPdf);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { docxBufferToPdfFile, docxBufferToPdfBuffer };
