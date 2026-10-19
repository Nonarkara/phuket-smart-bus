import { chromium } from "playwright";
const BASE = process.env.BASE || "https://bus.nonarkara.org";
const ROUTES = (process.env.ROUTES || "/roi,/toolkit,/capacity,/study,/research,/governor").split(",");
const PROPS = ["color","backgroundColor","borderTopColor","borderRightColor","borderBottomColor","borderLeftColor","outlineColor","textDecorationColor","columnRuleColor","caretColor"];
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
const SCAN = (props) => {
  const hits = []; const seen = new Set();
  const isBlue = (r,g,b) => b > 120 && b - r > 40 && b - g > 25;
  for (const e of document.querySelectorAll("*")) {
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const lb = e.tagName.toLowerCase() + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/)[0] : "");
    for (const prop of props) {
      const v = cs[prop]; const m = v && v.match(/rgba?\((\d+), (\d+), (\d+)/);
      if (!m || !isBlue(Number(m[1]),Number(m[2]),Number(m[3]))) continue;
      const k = lb+prop+v; if (seen.has(k)) continue; seen.add(k);
      hits.push(`${prop}=${v} ${lb}`);
    }
  }
  return hits;
};
let total = 0;
for (const r of ROUTES) {
  await p.goto(BASE + r, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(3000);
  const h = await p.evaluate(SCAN, PROPS);
  total += h.length;
  console.log(`${r.padEnd(12)} ${h.length === 0 ? "CLEAN" : h.length + " blue"} ${h.slice(0,4).join(" | ")}`);
}
console.log(`TOTAL: ${total}`);
await b.close();
