const { chromium } = require('playwright');
const path = require('path');
const { createProgressWriter } = require('./progress');
const { writeDoc } = require('./firestore');

const SOURCE_URL = 'https://unicorns.lt/en/startups?quarter=2026-2';
const progress = createProgressWriter('scrape');

function parseNumber(value) {
  return Number(
    String(value ?? '')
      .replace(/[€$,\s]/g, '')
      .replace(/[^\d.-]/g, '')
  ) || 0;
}

const MODAL_SELECTOR = 'div[data-modal="company"].show-modal';

async function getCompanyWebsite(page) {
  await page.waitForSelector(MODAL_SELECTOR, { timeout: 10000 }).catch(() => {});

  const website = await page.evaluate(() => {
    const groups = document.querySelectorAll(
      'div[data-modal="company"] .col-about .info-group'
    );
    for (const group of groups) {
      const label = group.querySelector('.e-label');
      if (label && label.textContent.trim() === 'Web page') {
        const link = group.querySelector('a');
        return link ? link.href : null;
      }
    }
    return null;
  }).catch(() => null);

  await page.locator(`${MODAL_SELECTOR} .close-modal`).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForSelector(MODAL_SELECTOR, { state: 'detached', timeout: 10000 }).catch(() => {});

  return website;
}

(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADFUL !== '1'
  });

  const page = await browser.newPage();

  progress.write({
    status: 'loading-rows',
    totalRows: 0,
    targetRows: null,
    processed: 0,
    counts: { perfectMatches: 0, lessThan1000: 0, goodStartups: 0, failedFilters: 0 },
    currentCompany: null,
    percent: 0
  });

  try {
    await page.goto(SOURCE_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.locator('table tbody tr').first().waitFor({
      state: 'visible',
      timeout: 30000
    });

    const loadMoreButton = page.locator(
      'svg use[href*="#more-arrow"], ' +
      'svg use[xlink\\:href*="#more-arrow"]'
    );

    const maxClicks = 100;
    let clickCount = 0;

    // Load all available table rows
    while (true) {
      const buttonCount = await loadMoreButton.count();

      if (buttonCount === 0) {
        console.log('No more load-more button found.');
        break;
      }

      const button = loadMoreButton.first();

      if (!(await button.isVisible().catch(() => false))) {
        console.log('Load-more button is no longer visible.');
        break;
      }

      if (clickCount >= maxClicks) {
        throw new Error(`Stopped after ${maxClicks} clicks.`);
      }

      const oldRowCount = await page.locator('table tbody tr').count();

      await button.click();
      clickCount++;

      await page.waitForFunction(
        oldCount => document.querySelectorAll('table tbody tr').length > oldCount,
        oldRowCount,
        { timeout: 15000 }
      ).catch(() => {
        console.log('No additional rows appeared.');
      });

      await page.waitForTimeout(300);

      const currentRowCount = await page.locator('table tbody tr').count();

      console.log(`Click ${clickCount}: ${currentRowCount} rows`);

      progress.write({
        status: 'loading-rows',
        totalRows: currentRowCount,
        targetRows: null,
        processed: 0,
        counts: { perfectMatches: 0, lessThan1000: 0, goodStartups: 0, failedFilters: 0 },
        currentCompany: null,
        percent: 0
      });
    }

    const loadedRows = await page.locator('table tbody tr').count();
    const totalRows = process.env.LIMIT
      ? Math.min(loadedRows, Number(process.env.LIMIT))
      : loadedRows;
    console.log(`Total rows loaded: ${loadedRows} (processing ${totalRows})`);

    const perfectMatches = [];
    const lessThan1000 = [];
    const goodStartups = [];
    const failedCompanies = [];

    function writeRowProgress(processed, currentCompany) {
      progress.write({
        status: 'processing',
        totalRows,
        targetRows: totalRows,
        processed,
        counts: {
          perfectMatches: perfectMatches.length,
          lessThan1000: lessThan1000.length,
          goodStartups: goodStartups.length,
          failedFilters: failedCompanies.length
        },
        currentCompany,
        percent: Math.round((processed / totalRows) * 100)
      });
    }

    /*
      Column positions in the live table:

      cell[0]  = Number
      cell[1]  = Company name (click target for modal)
      cell[2]  = Taxes paid
      cell[10] = Employees
    */

    for (let i = 0; i < totalRows; i++) {
      const row = page.locator('table tbody tr').nth(i);
      const cells = await row.locator('td').allTextContents();

      // Structural header row (no <td> cells) - skip entirely
      if (cells.length === 0) {
        continue;
      }

      const cleanCells = cells.map(cell => cell.replace(/\s+/g, ' ').trim());

      if (cleanCells.length < 11) {
        failedCompanies.push({
          number: cleanCells[0] ?? '',
          name: cleanCells[1] ?? '',
          taxesPaid: cleanCells[2] ?? '',
          employees: cleanCells[10] ?? '',
          reason: 'Incomplete row'
        });
        progress.pushRecent({ name: cleanCells[1] ?? '(unknown)', bucket: 'failed' });
        writeRowProgress(i + 1, cleanCells[1] ?? null);
        continue;
      }

      const number = cleanCells[0];
      const name = cleanCells[1];
      const taxesPaidText = cleanCells[2];
      const employeesText = cleanCells[10];

      const taxesPaid = parseNumber(taxesPaidText);
      const employees = parseNumber(employeesText);

      // Good startups: under 5 employees but paid more than €1,000 in taxes -
      // exempt from the "less than 5 employees" mandatory-filter rejection.
      const isGoodStartup = employees < 5 && taxesPaid > 1000;
      const passesMandatoryFilters = employees >= 5 && taxesPaid > 0;

      if (!passesMandatoryFilters && !isGoodStartup) {
        const reasons = [];

        if (employees < 5) {
          reasons.push('Less than 5 employees');
        }

        if (taxesPaid <= 0) {
          reasons.push('Taxes paid are zero or negative');
        }

        failedCompanies.push({
          number,
          name,
          taxesPaid: taxesPaidText,
          employees: employeesText,
          reason: reasons.join('; ')
        });
        progress.pushRecent({ name, bucket: 'failed' });
        writeRowProgress(i + 1, name);
        continue;
      }

      // Passed mandatory filters (or qualifies as a Good Startup) - open its
      // modal and capture the company website
      let website = null;

      const nameCell = row.locator('td').nth(1);
      const clickTarget = nameCell.locator('.btn-modal-company').first();

      const clicked = await clickTarget
        .click({ timeout: 8000 })
        .then(() => true)
        .catch(() => false);

      if (clicked) {
        website = await getCompanyWebsite(page);
      } else {
        console.log(`Could not open modal for "${name}", skipping website capture.`);
        // Recover in case a stray modal is left open, blocking future clicks
        await page.keyboard.press('Escape').catch(() => {});
        await page.locator(`${MODAL_SELECTOR} .close-modal`).first().click({ timeout: 2000 }).catch(() => {});
      }

      const company = {
        number,
        name,
        taxesPaid: taxesPaidText,
        employees: employeesText,
        website
      };

      let bucket;
      if (isGoodStartup) {
        goodStartups.push(company);
        bucket = 'goodStartups';
      } else if (taxesPaid >= 1000) {
        perfectMatches.push(company);
        bucket = 'perfectMatches';
      } else {
        lessThan1000.push(company);
        bucket = 'lessThan1000';
      }

      progress.pushRecent({ name, bucket, website });
      writeRowProgress(i + 1, name);

      const processedCount =
        perfectMatches.length + lessThan1000.length + goodStartups.length;

      if (processedCount % 25 === 0) {
        console.log(`Processed ${processedCount} passing companies so far...`);
      }
    }

    const output = {
      scrapedAt: new Date().toISOString(),
      sourceUrl: SOURCE_URL,
      totalRows,
      summary: {
        perfectMatches: perfectMatches.length,
        lessThan1000: lessThan1000.length,
        goodStartups: goodStartups.length,
        failedFilters: failedCompanies.length
      },
      perfectMatches,
      lessThan1000,
      goodStartups,
      failedCompanies
    };

    await writeDoc('data', 'scraped', output);

    progress.write({
      status: 'done',
      totalRows,
      targetRows: totalRows,
      processed: totalRows,
      counts: {
        perfectMatches: perfectMatches.length,
        lessThan1000: lessThan1000.length,
        goodStartups: goodStartups.length,
        failedFilters: failedCompanies.length
      },
      currentCompany: null,
      percent: 100
    });

    console.log(`\nSummary:`);
    console.log(`Total rows: ${totalRows}`);
    console.log(`Perfect matches: ${perfectMatches.length}`);
    console.log(`Less than €1,000: ${lessThan1000.length}`);
    console.log(`Good startups: ${goodStartups.length}`);
    console.log(`Failed filters: ${failedCompanies.length}`);
    console.log('\nData written to Firestore: data/scraped');

  } catch (error) {
    console.error('Script failed:', error);

    progress.write({
      status: 'error',
      message: error.message,
      totalRows: 0,
      targetRows: null,
      processed: 0,
      counts: { perfectMatches: 0, lessThan1000: 0, goodStartups: 0, failedFilters: 0 },
      currentCompany: null,
      percent: 0
    });

    await page.screenshot({
      path: path.join(__dirname, 'playwright-error.png'),
      fullPage: true
    });

    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());

  } finally {
    await browser.close();
  }
})();
