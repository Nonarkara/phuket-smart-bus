import { chromium } from '@playwright/test';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const consoleMsgs = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(m.type() + ': ' + m.text()); });
  try {
    await page.goto('http://localhost:5180/ops', { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.log('NAV ERR:', e.message);
  }
  await page.waitForTimeout(3000);
  const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('--- TEXT ---');
  console.log(text);
  console.log('--- ERRORS ---');
  for (const e of errors) console.log(e);
  console.log('--- CONSOLE ---');
  for (const m of consoleMsgs) console.log(m);
  await browser.close();
})();
