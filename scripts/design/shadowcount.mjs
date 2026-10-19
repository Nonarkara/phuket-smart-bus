// How many shadows actually RENDER on a page? The scanner counts
// declarations in source; STYLE.md claims a rendered number.
//
// TWO NUMBERS, because "7 shadows" and "7 shadow-bearing rules" are
// different claims and only one of them was true. The instrument reports:
//   elements — every node on the page that paints a shadow
//   rules    — the distinct tag.class pairs among them
// A page with three landmark badges that share one rule is 3 elements and
// 1 rule. STYLE.md says which one it is quoting.
import { chromium } from "playwright";
const BASE = process.env.BASE || "https://bus.nonarkara.org";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
for (const r of (process.env.ROUTES || "/ops,/v2,/toolkit,/roi").split(",")) {
  await p.goto(BASE + r, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(4000);
  const n = await p.evaluate(() => {
    const rules = new Set();
    let elements = 0;
    for (const e of document.querySelectorAll("*")) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const rect = e.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (cs.boxShadow && cs.boxShadow !== "none") {
        elements++;
        rules.add(`${e.tagName}.${String(e.className).split(" ")[0]}`);
      }
    }
    return { elements, rules: [...rules] };
  });
  console.log(
    `${r.padEnd(24)} ${String(n.elements).padStart(3)} element(s) · ${String(n.rules.length).padStart(2)} rule(s): ${n.rules.slice(0, 8).join(", ")}`
  );
}
await b.close();
