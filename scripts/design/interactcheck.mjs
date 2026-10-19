// Interaction and colour regressions that a screenshot cannot catch.
//
//   BASE=http://localhost:4399 node scripts/design/interactcheck.mjs
//
// Checks three things that each shipped broken once:
//   1. The toolkit ticker must PIN open on click, so a reader can move the
//      mouse away and still read it. It was hover-only, and the focus/click
//      pair fired in the same gesture and fought itself.
//   2. Every deep link into the INFO view must land on a panel. Six paths
//      (/more /info /stops /pass /ride /compare) rendered a blank column
//      because the panel started as null and neither panel rendered.
//   3. /roi must carry no blue outside the house palette.
//
// For (2) this asserts the PANEL is present, not that it has content: the
// stop list is filled from the API, so a local preview with no backend
// renders an empty list inside a present panel. Run it against the deployed
// site to check the content too.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:4399";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
let fails = 0;

// --- 1. the ticker must stay open after the mouse leaves -------------------
await p.goto(BASE + "/toolkit", { waitUntil: "load", timeout: 30000 });
await p.waitForTimeout(3000);
await p.evaluate(() => window.scrollTo(0, 900));
await p.waitForTimeout(800);
const pill = await p.$(".lst__pill");
if (!pill) {
  console.log("TICKER: no pill found — FAIL");
  fails++;
} else {
  await pill.click();
  await p.waitForTimeout(300);
  await p.mouse.move(200, 200); // move the mouse far away
  await p.waitForTimeout(600);
  const state = await p.evaluate(() => {
    const d = document.querySelector(".lst__detail");
    const cs = d ? getComputedStyle(d) : null;
    const a = document.querySelector(".lst");
    return { opacity: cs?.opacity, visibility: cs?.visibility, expanded: a?.classList.contains("is-expanded") };
  });
  const ok = state.opacity === "1" && state.visibility === "visible";
  console.log(`TICKER pinned after mouse-out: ${ok ? "PASS" : "FAIL"} (opacity=${state.opacity} vis=${state.visibility} expanded=${state.expanded})`);
  if (!ok) fails++;
  await pill.click();
  await p.waitForTimeout(400);
  await p.mouse.move(200, 200);
  await p.waitForTimeout(400);
  const closed = await p.evaluate(() => {
    const d = document.querySelector(".lst__detail");
    return d ? getComputedStyle(d).opacity : "none";
  });
  console.log(`TICKER closes on second click: ${closed === "0" ? "PASS" : "FAIL"} (opacity=${closed})`);
  if (closed !== "0") fails++;
}

// --- 2. deep links must land on a panel, not a blank column ----------------
// The stops panel fills from /api/routes/<id>/stops, and the page fetches
// health, environment, routes and compare first — give it room.
for (const route of ["/more", "/info", "/stops", "/ride", "/compare"]) {
  await p.goto(BASE + route, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(8000);
  const r = await p.evaluate(() => {
    const main = document.querySelector("main.stops-view");
    if (!main) return { found: false };
    const panel = main.querySelector(".stops-layout, .pass-panel");
    const cards = document.querySelectorAll(".stop-card").length;
    return { found: !!panel, panel: panel ? panel.className : null, cards, chars: (panel?.textContent || "").trim().length };
  });
  const ok = r.found && r.cards > 0;
  console.log(`${route.padEnd(9)} -> ${ok ? "PASS" : "FAIL"} (panel=${r.panel} stopCards=${r.cards} chars=${r.chars})`);
  if (!ok) fails++;
}
{
  await p.goto(BASE + "/pass", { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const panel = document.querySelector("main.stops-view .pass-panel");
    return { found: !!panel, chars: (panel?.textContent || "").trim().length };
  });
  const ok = r.found && r.chars > 80;
  console.log(`${"/pass".padEnd(9)} -> ${ok ? "PASS" : "FAIL"} (panel=pass-panel chars=${r.chars})`);
  if (!ok) fails++;
}

// --- 3. the /roi page must carry no blue ----------------------------------
// Check EVERY colour property, not a convenient few. The first version of
// this probe looked at color, backgroundColor, borderTopColor and
// borderLeftColor — and missed #007aff on the active tab's
// border-bottom-color, which is how a blue survived a fix that claimed to
// remove them.
await p.goto(BASE + "/roi", { waitUntil: "load", timeout: 30000 });
await p.waitForTimeout(2500);
const PROPS = [
  "color", "backgroundColor",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "outlineColor", "textDecorationColor", "columnRuleColor", "caretColor",
];
const blues = await p.evaluate((props) => {
  const hits = [];
  const isBlue = (r, g, b) => b > 120 && b - r > 40 && b - g > 25;
  for (const e of document.querySelectorAll("*")) {
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    for (const prop of props) {
      const v = cs[prop];
      const m = v && v.match(/rgba?\((\d+), (\d+), (\d+)/);
      if (!m) continue;
      if (!isBlue(Number(m[1]), Number(m[2]), Number(m[3]))) continue;
      hits.push(`${e.className || e.tagName} ${prop}=${v}`);
      break;
    }
    const sh = cs.boxShadow;
    if (sh && sh !== "none") {
      for (const m of sh.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)) {
        if (isBlue(Number(m[1]), Number(m[2]), Number(m[3]))) { hits.push(`${e.className || e.tagName} boxShadow=${sh}`); break; }
      }
    }
  }
  return [...new Set(hits)];
}, PROPS);
console.log(`ROI blue elements: ${blues.length === 0 ? "PASS (none)" : "FAIL"} ${blues.slice(0, 8).join(" | ")}`);
if (blues.length) fails++;

console.log(`\n=== INTERACTION FAILURES: ${fails} ===`);
await b.close();
process.exit(fails ? 1 : 0);
