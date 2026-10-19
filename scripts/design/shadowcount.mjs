// How many shadows actually RENDER on a page? The scanner counts
// declarations in source; STYLE.md claims a rendered number.
import { chromium } from "playwright";
const BASE = process.env.BASE || "https://bus.nonarkara.org";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
for (const r of (process.env.ROUTES || "/ops,/v2,/toolkit,/roi").split(",")) {
  await p.goto(BASE + r, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(4000);
  const n = await p.evaluate(() => {
    const seen = new Set();
    for (const e of document.querySelectorAll("*")) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const rect = e.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (cs.boxShadow && cs.boxShadow !== "none") {
        seen.add(`${e.tagName}.${String(e.className).split(" ")[0]}`);
      }
    }
    return [...seen];
  });
  console.log(`${r.padEnd(11)} ${n.length} rendered shadow element(s): ${n.slice(0, 8).join(", ")}`);
}
await b.close();
