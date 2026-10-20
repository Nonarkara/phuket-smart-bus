import { chromium } from "playwright";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
await p.goto("http://127.0.0.1:4173/capacity", { waitUntil: "load", timeout: 45000 });
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const stat = { sheets: 0, rules: 0, noSel: 0, noFs: 0, qsaThrow: 0, matched: 0, ownNonEmpty: 0 };
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    stat.sheets++;
    for (const rule of rules) {
      stat.rules++;
      if (!rule.selectorText) { stat.noSel++; continue; }
      if (!rule.style || !rule.style.fontSize) { stat.noFs++; continue; }
      let els = [];
      try { els = [...document.querySelectorAll(rule.selectorText)]; } catch { stat.qsaThrow++; continue; }
      if (!els.length) continue;
      stat.matched++;
      const own = els.filter((e) => {
        const cs = getComputedStyle(e);
        if (cs.visibility === "hidden" || cs.display === "none") return false;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        return [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      });
      if (own.length) { stat.ownNonEmpty++; out.push(rule.selectorText); }
    }
  }
  return { stat, out: out.slice(0, 10) };
}));
await b.close();
