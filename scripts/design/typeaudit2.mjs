// Rendered type inventory + a mechanical check of the new type rule.
//   BASE=http://localhost:4399 node non-slop-shots/typeaudit2.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://bus.nonarkara.org";
// EVERY route the app serves. A type rule that only holds on seven of
// thirteen routes is not a rule.
const ROUTES = [
  "/", "/ops", "/fleet", "/fleet/raw", "/study", "/research", "/capacity",
  "/toolkit", "/roi", "/driver", "/v2", "/governor", "/info", "/more",
  "/stops", "/pass", "/ride", "/compare",
];

const INVENTORY = () => {
  const map = new Map();
  const offenders = [];
  for (const e of document.querySelectorAll("*")) {
    const cs = getComputedStyle(e);
    if (!e.textContent || !e.textContent.trim()) continue;
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "");
    const w = parseInt(cs.fontWeight, 10) || 400;
    const size = Math.round(parseFloat(cs.fontSize));
    map.set(`${fam}|${w}|${size}px`, (map.get(`${fam}|${w}|${size}px`) || 0) + 1);

    // THE RULE
    const isDisplay = /Josefin/.test(fam);
    const isBody = /Source Sans|Plex Sans Thai/i.test(fam);
    const label = e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
    if (isDisplay) {
      if (size < 18) offenders.push({ rule: "display face below 18px", fam, w, size, el: label, text: e.textContent.trim().slice(0, 40) });
      else if (size < 40 && w >= 600) offenders.push({ rule: "display face 600+ below 40px", fam, w, size, el: label, text: e.textContent.trim().slice(0, 40) });
    } else if (!isBody && !/ui-monospace|system-ui|Helvetica|Arial|Georgia|Times/i.test(fam)) {
      offenders.push({ rule: "unknown face", fam, w, size, el: label, text: e.textContent.trim().slice(0, 40) });
    }
    if (/Times|Georgia|serif/i.test(fam)) {
      offenders.push({ rule: "serif leaking", fam, w, size, el: label, text: e.textContent.trim().slice(0, 40) });
    }
  }
  const sizes = new Set([...map.keys()].map((k) => k.split("|")[2]));
  return { inv: [...map.entries()].sort((a, b) => b[1] - a[1]), offenders, sizeCount: sizes.size };
};

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
const report = {};
for (const r of ROUTES) {
  await p.goto(BASE + r, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(3000);
  report[r] = await p.evaluate(INVENTORY);
}
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + "/", { waitUntil: "load" });
await p.waitForTimeout(3000);
report["/ (390px)"] = await p.evaluate(INVENTORY);

for (const [route, r] of Object.entries(report)) {
  const display = r.inv.filter(([k]) => /Josefin/.test(k));
  console.log(`\n=== ${route} — ${r.sizeCount} font sizes, ${display.length} display-face entries ===`);
  for (const [k, n] of display) console.log(`   ${k}  x${n}`);
  if (r.offenders.length) {
    console.log(`   OFFENDERS (${r.offenders.length}):`);
    for (const o of r.offenders.slice(0, 25)) console.log(`     [${o.rule}] ${o.fam} ${o.w} ${o.size}px  ${o.el}  "${o.text}"`);
  } else {
    console.log("   no rule violations");
  }
}
await b.close();
