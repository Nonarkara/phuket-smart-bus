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

import { settle } from "./settle.mjs";
const BASE_DEFAULT = "https://bus.nonarkara.org";
// EVERY route the app serves. A type rule that only holds on seven of
// thirteen routes is not a rule.
//
// Routes may also be given on the command line, so the proof script can
// point the instrument at a fixture. A rule that can only be run against
// the live site cannot be proven to fail.
const ALL_ROUTES = [
  "/", "/ops", "/fleet", "/fleet/raw", "/study", "/research", "/capacity",
  "/toolkit", "/toolkit#phuket", "/toolkit#evidence", "/toolkit#build",
  "/toolkit#fieldnotes",
  "/roi", "/driver", "/v2", "/v2?view=insights", "/v2?view=toolkit",
  "/governor", "/info", "/more", "/stops", "/pass", "/ride", "/compare",
];
const argv = process.argv.slice(2);
const baseArg = argv.indexOf("--base");
const BASE = baseArg === -1 ? (process.env.BASE || BASE_DEFAULT) : argv[baseArg + 1];
const ROUTES = argv.filter((a, i) => {
  if (a.startsWith("--")) return false;
  // `--base` takes the NEXT argument. When there is no --base, baseArg is
  // -1 and baseArg + 1 is 0 — which silently dropped the FIRST route.
  if (baseArg !== -1 && (i === baseArg || i === baseArg + 1)) return false;
  return true;
});
const ROUTE_LIST = ROUTES.length ? ROUTES : ALL_ROUTES;

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
    // THE FLOOR. The smallest text a reader can be asked to read is 11px.
    // The rider phone app's rule has said so since 2026-10-21 ("the smallest
    // text on the screen is 11"), and the legacy consumer chain was below it:
    // 9px in three declarations, 10px in thirteen, rendering 10px tab labels
    // on seven routes and a 10px ticket meta on a phone. A floor that lives
    // only in a stylesheet is a number; a floor the audit checks is a rule.
    // Only an element that OWNS text is judged — a container's own font-size
    // never renders as text on its own.
    if (ownsText && size < 11) {
      offenders.push({ rule: "text below the 11px floor", fam, w, size, el: label, text: e.textContent.trim().slice(0, 40) });
    }
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
// The rider phone app WAS the one open exception, and it is closed. On
// 2026-10-21 the app at 390 rendered 18 sizes — 26 distinct declarations in
// PassengerApp.css, built in `rem` against a 16px root, with microcopy at
// 9.9px and 10px. It now renders 7: the sheet declares the eight names
// once and every font-size in it is one of them. The switch that turned the
// exception off went with it — a switch with nothing to switch is a trap,
// and a named exception that is closed is a deleted law.
const KNOWN_OPEN = {};

for (const vp of VIEWPORTS) {
  await p.setViewportSize({ width: vp.width, height: vp.height });
  for (const r of ROUTE_LIST) {
    await p.goto(BASE + r, { waitUntil: "load", timeout: 30000 });
    await settle(p);
    report[`${r} @${vp.label}`] = await p.evaluate(INVENTORY);
  }
}

for (const [route, r] of Object.entries(report)) {
  const display = r.inv.filter(([k]) => /Josefin/.test(k));
  const bad = r.offenders.length;
  const over = r.sizeCount > 8;
  const open = KNOWN_OPEN[route];
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
