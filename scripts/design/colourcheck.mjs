// Whole-site accent-family sweep: every route, every colour property,
// every state the page can be in.
//
// Two lessons are baked into this file, both learned from a probe that gave
// a FALSE PASS:
//
//   1. CLICK INTO THE CONTROLS. A colour can live in a state the page is
//      not in when it loads. The rider's /pass page opens on the "day"
//      pass; the "week" pass button was #1e63b8 — a saturated blue on the
//      rider's warm paper — and a probe that only looked at the loaded
//      state reported the route clean.
//   2. REPORT DISTINCT COLOURS, NOT PROPERTY COUNT. outlineColor,
//      textDecorationColor, columnRuleColor and caretColor all inherit
//      currentColor, so one blue on one element was counted ten times and
//      the totals were unreadable.
//
//   Also: an image's height attribute becomes the used CSS height, so
//   width:100% distorts a portrait. Not this file's job, but the same
//   habit of "the declaration looks right, the render does not" applies.
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
// Controls that change the page's state without navigating.
const CONTROLS = [
  '[role="tab"]', ".pass-switch__button", ".v2-mode-btn", ".v2-source__btn",
  ".hub-tab-nav button", ".roi-nav-tab", ".fleet-tab", ".study-tab",
  '[class*="switch"] button', '[class*="toggle"] button',
];

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();

const SCAN = (props) => {
  const hits = new Map(); // "value -> [elements]"
  const isBlue = (r, g, b) => b > 120 && b - r > 40 && b - g > 25;
  const label = (e) =>
    e.tagName.toLowerCase() +
    (typeof e.className === "string" && e.className.trim()
      ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "");
  for (const e of document.querySelectorAll("*")) {
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const lb = label(e);
    const txt = (e.textContent || "").trim().slice(0, 26).replace(/\s+/g, " ");
    const add = (prop, v) => {
      const m = v && v.match(/rgba?\((\d+), (\d+), (\d+)/);
      if (!m) return;
      if (!isBlue(Number(m[1]), Number(m[2]), Number(m[3]))) return;
      const key = v;
      if (!hits.has(key)) hits.set(key, new Set());
      hits.get(key).add(`${lb} ${prop}${txt ? ` "${txt}"` : ""}`);
    };
    for (const prop of props) add(prop, cs[prop]);
    const sh = cs.boxShadow;
    if (sh && sh !== "none") {
      for (const m of sh.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)) {
        if (isBlue(Number(m[1]), Number(m[2]), Number(m[3]))) {
          const key = sh;
          if (!hits.has(key)) hits.set(key, new Set());
          hits.get(key).add(`${lb} boxShadow${txt ? ` "${txt}"` : ""}`);
        }
      }
    }
  }
  return [...hits.entries()].map(([val, els]) => ({ val, els: [...els] }));
};

let total = 0;
for (const route of ROUTES) {
  await p.goto(BASE + route, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(3000);

  // The loaded state, then every control's state.
  const states = [await p.evaluate(SCAN, PROPS)];
  const n = await p.evaluate((sel) => {
    const set = new Set();
    for (const s of sel) for (const e of document.querySelectorAll(s)) set.add(e);
    return set.size;
  }, CONTROLS);
  for (let i = 0; i < n; i++) {
    await p.evaluate((sel, idx) => {
      const set = [];
      const seen = new Set();
      for (const s of sel) for (const e of document.querySelectorAll(s)) {
        if (seen.has(e)) continue;
        seen.add(e);
        set.push(e);
      }
      set[idx]?.click();
    }, CONTROLS, i).catch(() => {});
    await p.waitForTimeout(900);
    states.push(await p.evaluate(SCAN, PROPS));
  }

  const merged = new Map();
  for (const s of states) for (const h of s) {
    if (!merged.has(h.val)) merged.set(h.val, new Set());
    for (const e of h.els) merged.get(h.val).add(e);
  }
  if (!merged.size) { console.log(`${route.padEnd(13)} CLEAN (${n} controls exercised)`); continue; }
  total += merged.size;
  console.log(`\n${route} — ${merged.size} distinct blue value(s), ${n} controls exercised`);
  for (const [val, els] of merged) {
    console.log(`   ${val}`);
    for (const e of [...els].slice(0, 4)) console.log(`      ${e}`);
  }
}
console.log(`\n=== DISTINCT BLUE VALUES: ${total} ===`);
await b.close();
process.exit(total ? 1 : 0);
