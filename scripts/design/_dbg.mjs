import { chromium } from "playwright";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
await p.goto("http://127.0.0.1:4173/capacity", { waitUntil: "load", timeout: 45000 });
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const sheets = document.styleSheets;
  let total = 0, withFs = 0, sample = [];
  for (const s of sheets) {
    let rules; try { rules = s.cssRules; } catch { continue; }
    if (!rules) continue;
    total += rules.length;
    for (const r of rules) {
      if (r.style && r.style.fontSize) { withFs++; if (sample.length < 5) sample.push(r.selectorText + " => " + r.style.fontSize); }
    }
  }
  return { sheets: sheets.length, total, withFs, sample, h1: getComputedStyle(document.querySelector("h1")).fontSize };
}));
await b.close();
