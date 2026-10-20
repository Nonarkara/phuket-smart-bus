#!/usr/bin/env node
/**
 * Does anything hang off the edge of the screen?
 *
 * WHY THIS EXISTS
 *   The toolkit's HUD pipeline went from two columns to four with no
 *   responsive override. A `1fr` track is `minmax(auto, 1fr)` and its
 *   automatic minimum is the cell's min-content, so four cells whose text
 *   cannot break ("20,686 arriving pax") added up to a track 394px wide on
 *   a 390px phone. The hero's column grew to match, and the prose was
 *   clipped at the right edge: the reader could not read the last
 *   characters of every line.
 *
 *   Nothing said so. The page rendered, the tests passed, the type ramp
 *   was on its scale, and a screenshot at 1440 looked perfect. It was
 *   found by a reviewer reading the phone screenshot — a human, by luck.
 *
 *   So: measure it. An element whose box extends past the viewport's right
 *   edge is an element the reader may not be able to read. The one
 *   exception is a strip that is DELIBERATELY scrollable (`overflow-x:
 *   auto`) — the source switcher at 390 is one, and scrolling it is the
 *   design.
 *
 *   Both widths are measured. A phone is the width that breaks; a desktop
 *   is the width that hides the break (the same grid fits at 1440).
 *
 *   node scripts/design/overflow.mjs /v2?view=toolkit /ops --base https://bus.nonarkara.org
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const BASE = bi === -1 ? "http://127.0.0.1:4173" : args[bi + 1];
const BASE_ARG = bi === -1 ? -1 : bi + 1;
const ROUTES = args.filter((a, i) => !a.startsWith("--") && i !== BASE_ARG);

if (!ROUTES.length) {
  console.error("overflow: no routes given. An instrument that checks nothing is decoration.");
  console.error("  usage: node scripts/design/overflow.mjs <route> [<route>…] [--base <url>]");
  process.exit(2);
}

const WIDTHS = [
  { label: "390", width: 390, height: 844 },
  { label: "1440", width: 1440, height: 900 },
];

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
let p = await c.newPage();

let total = 0;

// A gate that dies halfway is not a gate. Chromium occasionally drops the
// page on a heavy route; the probe opens a fresh one and says so.
const open = async (route, vp) => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (p.isClosed()) p = await c.newPage();
      await p.setViewportSize({ width: vp.width, height: vp.height });
      await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
      await p.waitForTimeout(6000);
      return true;
    } catch (e) {
      console.error(`  (the browser dropped the page on ${route} @${vp.label}; retrying — ${String(e).split("\n")[0]})`);
      try { await p.close(); } catch { /* already gone */ }
      p = await c.newPage();
    }
  }
  return false;
};

for (const route of ROUTES) {
  for (const vp of WIDTHS) {
    if (!(await open(route, vp))) {
      console.log(`\nNOT MEASURED: ${route} @${vp.label} — the browser could not hold the page.`);
      total += 1;
      continue;
    }

    const res = await p.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const over = [];

      /** Is this element (or an ancestor) a strip that scrolls on purpose? */
      const scrolls = (el) => {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.overflowX === "auto" || s.overflowX === "scroll") return true;
        }
        return false;
      };

      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right <= docW + 0.5) continue;
        if (scrolls(el)) continue;
        // The map engine positions its own tiles and overlays beyond the
        // viewport — that is how a map pans — and the map's frame clips them.
        // Third-party chrome, not our overflow.
        if (el.closest(".leaflet-container")) continue;
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" && cs.visibility === "hidden") continue;
        over.push({
          cls: (el.className && typeof el.className === "string" && el.className.trim()
            ? el.className.trim().split(/\s+/).slice(0, 2).join(".")
            : el.tagName.toLowerCase()),
          right: Math.round(r.right),
          w: Math.round(r.width),
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 46),
        });
      }
      // Report the worst offender per element, not every descendant of it.
      const seen = new Set();
      const unique = over.filter((o) => {
        const k = `${o.cls}|${o.w}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { docW, over: unique.slice(0, 12), count: over.length };
    });

    const tag = `${route} @${vp.label}`;
    if (!res.count) {
      console.log(`ok:   ${tag} — nothing past the right edge`);
    } else {
      total += res.count;
      console.log(`\nOVERFLOW: ${tag} — ${res.count} element(s) past ${res.docW}px`);
      for (const o of res.over) console.log(`  ${o.cls}  right=${o.right} w=${o.w}  "${o.text}"`);
    }
  }
}

await b.close();
console.log(`\ntotal overflowing elements: ${total}`);
process.exit(total ? 1 : 0);
