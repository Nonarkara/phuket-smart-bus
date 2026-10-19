// Whole-site accent-family sweep. EVERY colour property, every route.
//
// The first version of the ROI probe checked four properties and missed
// #007aff on a border-bottom-color. A colour audit that only looks at the
// properties you happened to think of is not an audit.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:4399";
const ROUTES = [
  "/", "/ops", "/fleet", "/fleet/raw", "/study", "/research", "/capacity",
  "/toolkit", "/roi", "/driver", "/v2", "/governor", "/info", "/more",
  "/stops", "/pass", "/ride", "/compare",
];
const PROPS = [
  "color", "backgroundColor",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "outlineColor", "textDecorationColor", "columnRuleColor", "caretColor",
];

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();

const SCAN = (props) => {
  const hits = [];
  const seen = new Set();
  const isBlue = (r, g, b) => b > 120 && b - r > 40 && b - g > 25;
  const label = (e) => e.tagName.toLowerCase() + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  for (const e of document.querySelectorAll("*")) {
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const lb = label(e);
    const txt = (e.textContent || "").trim().slice(0, 30).replace(/\s+/g, " ");
    for (const prop of props) {
      const v = cs[prop];
      const m = v && v.match(/rgba?\((\d+), (\d+), (\d+)/);
      if (!m) continue;
      if (!isBlue(Number(m[1]), Number(m[2]), Number(m[3]))) continue;
      const k = `${lb}|${prop}|${v}`;
      if (seen.has(k)) continue;
      seen.add(k);
      hits.push(`${prop}=${v}  ${lb}  "${txt}"`);
    }
    const sh = cs.boxShadow;
    if (sh && sh !== "none") {
      for (const m of sh.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)) {
        if (!isBlue(Number(m[1]), Number(m[2]), Number(m[3]))) continue;
        const k = `${lb}|shadow|${sh}`;
        if (seen.has(k)) continue;
        seen.add(k);
        hits.push(`boxShadow=${sh}  ${lb}  "${txt}"`);
      }
    }
  }
  return hits;
};

let total = 0;
for (const route of ROUTES) {
  await p.goto(BASE + route, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(3000);
  const hits = await p.evaluate(SCAN, PROPS);
  if (!hits.length) { console.log(`${route.padEnd(12)} 0`); continue; }
  total += hits.length;
  console.log(`\n${route} — ${hits.length} blue property value(s)`);
  for (const h of hits.slice(0, 14)) console.log(`   ${h}`);
}
console.log(`\n=== BLUE HITS: ${total} ===`);
await b.close();
