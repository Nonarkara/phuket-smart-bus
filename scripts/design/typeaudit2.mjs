// Rendered type inventory + a mechanical check of the type rule.
//
//   BASE=http://localhost:4399 node scripts/design/typeaudit2.mjs
//
// Every route is measured at BOTH viewports. The 1440-only pass is how four
// toolkit headings shipped at display-face 700 under 40px: at desktop they
// clamp to 48-63px, where 700 is legal, and the phone is where the blob
// shows up.
//
// SIZE-COUNT METHOD (the numbers in STYLE.md come from this file):
//   - only elements that own a non-whitespace TEXT NODE count toward the
//     type scale. An element that merely contains text inherits its
//     parent's font-size and would double-count one physical size.
//   - sizes are compared at 0.5px resolution (sub-pixel jitter from
//     viewport rounding collapses), not integer px.
//   - the count is the number of DISTINCT sizes, per route, per viewport.
//
// The rule under test (STYLE.md):
//   display face  < 18px          -> illegal, body face only
//   display face  18-39px, w>=600 -> illegal (the blob)
//   any other face                 -> must be Source Sans 3 / IBM Plex Sans Thai
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://bus.nonarkara.org";
// EVERY route the app serves. A type rule that only holds on seven of
// thirteen routes is not a rule.
const ROUTES = [
  "/", "/ops", "/fleet", "/fleet/raw", "/study", "/research", "/capacity",
  "/toolkit", "/roi", "/driver", "/v2", "/governor", "/info", "/more",
  "/stops", "/pass", "/ride", "/compare",
];

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
];

const INVENTORY = () => {
  const map = new Map();
  const offenders = [];
  const sizes = new Set();
  for (const e of document.querySelectorAll("*")) {
    const cs = getComputedStyle(e);
    if (!e.textContent || !e.textContent.trim()) continue;
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // Owns text? (not merely contains it)
    const ownsText = [...e.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0
    );

    const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "");
    const w = parseInt(cs.fontWeight, 10) || 400;
    const size = parseFloat(cs.fontSize);
    const sizeKey = `${Math.round(size * 2) / 2}px`;
    map.set(`${fam}|${w}|${sizeKey}`, (map.get(`${fam}|${w}|${sizeKey}`) || 0) + 1);
    if (ownsText) sizes.add(sizeKey);

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
  return {
    inv: [...map.entries()].sort((a, b) => b[1] - a[1]),
    offenders,
    sizeCount: sizes.size,
    sizes: [...sizes].map((s) => parseFloat(s)).sort((a, b) => a - b),
  };
};

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
const report = {};
let total = 0;

// THE ≤8 LAW, and the ONE known exception — named, dated, and to be deleted
// when the rider phone app gets its own reviewed type pass. An exception
// that is not written down is a hole; one that is written down is a debt
// with an owner.
//
//   "/ @390" — the rider app renders 16 sizes at 390 because it is built in
//   `rem` against a 16px root with about sixty separate font-size
//   declarations. It does not read as a ramp (the phone screen shows a clear
//   hierarchy and 0 band violations), but the count is over the limit the
//   law states.
const KNOWN_OPEN = {
  "/ @390": "the rider phone app — 16 sizes at 390; its own type pass is pending",
};

// PROVING THE INSTRUMENT CAN FAIL. Set NO_KNOWN_OPEN=1 and every exception
// is ignored, so the rider app's 16 sizes at 390 must turn the run red. A
// gate whose exceptions cannot be switched off is a gate whose exceptions
// are permanent, and a permanent exception is a deleted law.
const OPEN = process.env.NO_KNOWN_OPEN === "1" ? {} : KNOWN_OPEN;

for (const vp of VIEWPORTS) {
  await p.setViewportSize({ width: vp.width, height: vp.height });
  for (const r of ROUTES) {
    await p.goto(BASE + r, { waitUntil: "load", timeout: 30000 });
    await p.waitForTimeout(2500);
    report[`${r} @${vp.label}`] = await p.evaluate(INVENTORY);
  }
}

for (const [route, r] of Object.entries(report)) {
  const display = r.inv.filter(([k]) => /Josefin/.test(k));
  const bad = r.offenders.length;
  const over = r.sizeCount > 8;
  const open = OPEN[route];
  total += bad + (over && !open ? 1 : 0);
  console.log(`\n=== ${route} — ${r.sizeCount} sizes, ${display.length} display-face entries, ${bad} violations${over ? (open ? " (KNOWN OPEN)" : " — OVER THE LAW") : ""}`);
  console.log(`   sizes: ${r.sizes.join(" ")}`);
  if (bad) {
    for (const o of r.offenders.slice(0, 25)) console.log(`     [${o.rule}] ${o.fam} ${o.w} ${o.size}px  ${o.el}  "${o.text}"`);
  }
  if (over) {
    if (open) console.log(`     [ramp law] ${r.sizeCount} sizes — known open: ${open}`);
    else console.log(`     [ramp law] ${r.sizeCount} sizes — the law is 8`);
  }
}

console.log(`\n=== TOTAL VIOLATIONS: ${total} ===`);
await b.close();
process.exit(total > 0 ? 1 : 0);
