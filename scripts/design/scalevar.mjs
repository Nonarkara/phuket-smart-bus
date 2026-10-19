// How much does the measured type scale move on a live, ticking page?
// Same route, same viewport, different moments.
import { chromium } from "playwright";
const BASE = process.env.BASE || "https://bus.nonarkara.org";
const ROUTES = (process.env.ROUTES || "/ops,/fleet,/fleet/raw,/study,/v2,/toolkit,/governor,/roi,/capacity,/").split(",");
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
for (const r of ROUTES) {
  const seen = new Set();
  for (let pass = 0; pass < 3; pass++) {
    await p.goto(BASE + r + (pass === 2 ? "?probe=" + Date.now() : ""), { waitUntil: "load", timeout: 30000 });
    await p.waitForTimeout(4000);
    const n = await p.evaluate(() => {
      const leaf = new Set();
      for (const e of document.querySelectorAll("*")) {
        const cs = getComputedStyle(e);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const rect = e.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const owns = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!owns) continue;
        leaf.add(Math.round(parseFloat(cs.fontSize) * 2) / 2);
      }
      return leaf.size;
    });
    seen.add(n);
  }
  console.log(`${r.padEnd(13)} leaf-text sizes across 3 loads: ${[...seen].sort((a,b)=>a-b).join(", ")}`);
}
await b.close();
