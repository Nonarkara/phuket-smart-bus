// Screenshot one URL at 1440×1100 and print page/console errors: node scripts/render-screenshot.mjs <url> <name> [chromiumPath] → /tmp/screens/<name>.png
import { chromium } from 'playwright';
const [, , url, name, browserPath] = process.argv;
const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(`PAGE ERROR: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });
try { await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 }); } catch (e) { errors.push(`NAV: ${e.message}`); }
await page.waitForTimeout(3500);
await page.screenshot({ path: `/tmp/screens/${name}.png`, fullPage: false });
console.log('--- errors ---'); errors.forEach(e => console.log(' -', e));
await browser.close();
