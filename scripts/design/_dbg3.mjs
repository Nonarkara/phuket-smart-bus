import { chromium } from "playwright";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
await p.goto("http://127.0.0.1:4173/capacity", { waitUntil: "load", timeout: 45000 });
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const stat = { walked: 0, fs: 0, matched: 0, own: 0 };
  const walk = (list) => {
    for (const rule of list) {
      stat.walked++;
      if (rule.cssRules) { walk(rule.cssRules); continue; }
      if (!rule.selectorText || !rule.style || !rule.style.fontSize) continue;
      stat.fs++;
      let els = []; try { els = [...document.querySelectorAll(rule.selectorText)]; } catch { continue; }
      if (!els.length) continue;
      stat.matched++;
    }
  };
  for (const s of document.styleSheets) { let r; try { r = s.cssRules; } catch { continue; } if (r) walk(r); }
  const q = document.querySelector(".capacity__eyebrow");
  return { stat, hasEyebrow: !!q, eyebrowClass: q && q.className, eyebrowSize: q && getComputedStyle(q).fontSize };
}));
await b.close();
