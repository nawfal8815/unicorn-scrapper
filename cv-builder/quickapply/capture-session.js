// Run this yourself, locally, to save a logged-in session for CVbankas/CV.lt quick-apply
// automation - it opens a real, visible Chrome window; you log in there by hand (nothing
// is captured until AFTER you confirm), and only the resulting cookies/storage are saved
// to disk. No password is ever read, typed, or seen by anything other than you and the
// real site.
//
// Usage:
//   node cv-builder/quickapply/capture-session.js cvbankas naoufal
//   node cv-builder/quickapply/capture-session.js cvbankas seif
//   node cv-builder/quickapply/capture-session.js cvlt naoufal
//   node cv-builder/quickapply/capture-session.js cvlt seif

const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const SITES = {
  cvbankas: 'https://www.cvbankas.lt/prisijungimas',
  cvlt: 'https://www.cv.lt/prisijungimas'
};

async function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => rl.question(prompt, resolve));
  rl.close();
}

async function main() {
  const [, , site, person] = process.argv;
  if (!SITES[site] || !person) {
    console.error('Usage: node capture-session.js <cvbankas|cvlt> <naoufal|seif>');
    process.exit(1);
  }

  const outPath = path.join(__dirname, 'storage-state', `${site}-${person}.json`);

  // channel: 'chrome' (real installed Google Chrome, not Playwright's bundled Chromium)
  // + hiding the automation flag - Google's "this browser may not be safe" OAuth block
  // is triggered by the bundled/automation-flagged browser, not by the login itself.
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(SITES[site]);

  console.log(`\nA Chrome window just opened to ${site}'s login page.`);
  console.log(`Log in there as ${person} yourself (password, 2FA, whatever it needs).`);
  await waitForEnter('Once you are fully logged in and can see your account/dashboard, press Enter here to save the session... ');

  await context.storageState({ path: outPath });
  await browser.close();

  console.log(`Saved session to ${outPath}`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
