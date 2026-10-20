#!/usr/bin/env node
/**
 * Spatial hallucination — the geometry of a page that cannot explain itself.
 *
 * WHAT THIS IS
 *   "Why is this here, why this size, and why this far from that?" If the
 *   answer is "the grid put it there", the layout has failed. A page can
 *   look composed at a glance and still fail that question, and a
 *   screenshot cannot settle it: you can SEE a gap, you cannot tell whether
 *   the gap is a decision or a leftover.
 *
 *   Six failure modes, and every one of them is measurable:
 *
 *     1. UNJUSTIFIED GAPS — space stretched to fill a container.
 *     2. ORPHAN ELEMENTS — a photo stranded beside an empty area.
 *     3. SCATTERED ACTIONS — related buttons on different rows, or pushed to
 *        opposite edges.
 *     4. FALSE HIERARCHY — everything gets equal weight, so nothing helps
 *        the reader choose.
 *     5. ACCIDENTAL WRAPPING — navigation breaks wherever it runs out of
 *        room.
 *     6. SPATIALLY EXPENSIVE INFORMATION — a small decision needs a long
 *        scroll.
 *
 * WHAT IT MEASURES
 *   1. The empty band UNDER a stretched cell. A grid stretches its items to
 *      the tallest one; the shorter cell then carries a cushion of nothing.
 *      Measured as the distance from the cell's last visible content to the
 *      cell's own bottom edge.
 *   2. A grid's last row holding one narrow item while the rest of the row
 *      is empty.
 *   3. Two same-shaped actions in one row with a gulf of nothing between
 *      them.
 *   4. Three or more peer cells — cells with a border or a ground of their
 *      own — carrying exactly the same type. Nothing in the row wins, so
 *      nothing tells the reader where to look.
 *   5. A wrapping row whose last line holds one item.
 *   6. A screen that is mostly empty. The page's content is measured in
 *      viewport bands and each band is scored by how much of it the content
 *      actually covers. A band that is 20% covered is a screen the reader
 *      paid for and did not use.
 *
 * WHAT IT IS NOT
 *   It is a screen, not a judge. It reports geometry; a human decides
 *   whether the geometry is a decision. The thresholds are deliberately
 *   generous — a probe that cries wolf is as useless as one that cannot
 *   fail — and every finding names the element and the measurement, so it
 *   can be argued with.
 *
 *   node scripts/design/space.mjs /v2?view=toolkit /ops --base https://bus.nonarkara.org
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const BASE = bi === -1 ? "http://127.0.0.1:4173" : args[bi + 1];
const BASE_ARG = bi === -1 ? -1 : bi + 1;
const ROUTES = args.filter((a, i) => !a.startsWith("--") && i !== BASE_ARG);

if (!ROUTES.length) {
  console.error("space: no routes given. An instrument that checks nothing is decoration.");
  console.error("  usage: node scripts/design/space.mjs <route> [<route>…] [--base <url>]");
  process.exit(2);
}

// The thresholds. Generous on purpose: these are the readings that are
// hard to argue with, not the ones that are merely untidy.
const DEAD_SPACE = 48;      // px of emptiness under a cell
const ORPHAN_RATIO = 0.55;  // a last-row item narrower than this
const SCATTER_GAP = 0.35;   // of the container's width, between two actions
const EMPTY_BAND = 0.3;     // a screen covered less than this is wasted

const WIDTHS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
];

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
let p = await c.newPage();

const open = async (route, vp) => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (p.isClosed()) p = await c.newPage();
      await p.setViewportSize({ width: vp.width, height: vp.height });
      await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
      await p.waitForTimeout(5000);
      return true;
    } catch (e) {
      console.error(`  (the browser dropped the page on ${route} @${vp.label}; retrying)`);
      try { await p.close(); } catch { /* already gone */ }
      p = await c.newPage();
    }
  }
  return false;
};

let findings = 0;

for (const route of ROUTES) {
  for (const vp of WIDTHS) {
    if (!(await open(route, vp))) {
      console.log(`\nNOT MEASURED: ${route} @${vp.label}`);
      findings++;
      continue;
    }

    const res = await p.evaluate(({ DEAD_SPACE, ORPHAN_RATIO, SCATTER_GAP, EMPTY_BAND }) => {
      const label = (el) => {
        const c = typeof el.className === "string" ? el.className.trim() : "";
        return el.tagName.toLowerCase() + (c ? "." + c.split(/\s+/).slice(0, 2).join(".") : "");
      };
      const visible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      const all = [...document.querySelectorAll("*")].filter(visible);
      const dead = [];
      const clipped = [];
      const orphans = [];
      const scattered = [];
      const equals = [];
      const wrapped = [];

      // ── 1 · the empty band under a stretched cell ─────────────────────────
      for (const el of all) {
        const cs = getComputedStyle(el);
        const isBox = cs.borderTopWidth !== "0px" || cs.borderBottomWidth !== "0px" ||
          (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
        if (!isBox) continue;
        const r = el.getBoundingClientRect();
        // the last visible content inside the box
        let last = -Infinity;
        let lastEl = null;
        for (const d of el.querySelectorAll("*")) {
          if (!visible(d)) continue;
          const owns = [...d.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
          const leaf = d.children.length === 0;
          if (!owns && !leaf) continue;
          const dr = d.getBoundingClientRect();
          if (dr.bottom > last) { last = dr.bottom; lastEl = d; }
        }
        if (last === -Infinity) continue;
        // Padding is a DECISION — the box's own, and the padding of every box
        // between the last content and the box being measured. Only what is
        // left after all of that is the leftover of a stretched cell.
        let pad = parseFloat(cs.paddingBottom) || 0;
        for (let n = lastEl.parentElement; n && n !== el; n = n.parentElement) {
          const ncs = getComputedStyle(n);
          pad += parseFloat(ncs.paddingBottom) || 0;
          pad += parseFloat(ncs.borderBottomWidth) || 0;
        }
        const gap = Math.round(r.bottom - pad - last);
        if (gap >= DEAD_SPACE) {
          dead.push({ el: label(el), gap, w: Math.round(r.width), h: Math.round(r.height) });
        }
      }

      // ── 2, 3, 4, 5 · per container ───────────────────────────────────────
      for (const el of all) {
        const cs = getComputedStyle(el);
        const isGrid = cs.display === "grid" || cs.display === "inline-grid";
        const isFlex = cs.display === "flex" || cs.display === "inline-flex";
        if (!isGrid && !isFlex) continue;
        const kids = [...el.children].filter(visible);
        if (kids.length < 2) continue;
        const r = el.getBoundingClientRect();
        const rows = new Map();
        for (const k of kids) {
          const kr = k.getBoundingClientRect();
          const key = Math.round(kr.top / 4) * 4;
          if (!rows.has(key)) rows.set(key, []);
          rows.get(key).push({ k, r: kr });
        }

        // 2 · an orphan in the last row
        //
        // A row that holds one item while the rest of the grid's width lies
        // empty. The test is not "the item is placed" — an item can be
        // placed on purpose and still be an orphan — it is the space the
        // item LEAVES BEHIND it. A header's control sits in the grid's last
        // track on purpose and nothing follows it; an orphan strands the
        // reader with an empty field on the item's trailing side.
        if (isGrid) {
          const cols = cs.gridTemplateColumns.split(" ").filter((x) => x && x !== "none").length;
          const rowKeys = [...rows.keys()].sort((a, b) => a - b);
          const lastRow = rows.get(rowKeys[rowKeys.length - 1]);
          if (cols >= 2 && lastRow && lastRow.length === 1) {
            const item = lastRow[0];
            const w = item.r.width;
            const contentRight = r.right - (parseFloat(cs.paddingRight) || 0);
            const emptyRight = Math.max(0, contentRight - item.r.right);
            if (w < r.width * ORPHAN_RATIO && emptyRight > r.width * 0.45) {
              orphans.push({
                el: label(el), item: label(item.k),
                w: Math.round(w), of: Math.round(r.width), empty: Math.round(emptyRight),
              });
            }
          }
        }

        // 3 · two same-shaped actions with a gulf between them
        //
        // A navigation row spread across the width is not scattered actions —
        // that is what a navigation row IS. The defect is a PAIR pushed to
        // opposite ends of a row that is mostly empty, so the row's own
        // width is what makes the gap. Hence: exactly two actions, and they
        // must leave the row mostly empty.
        for (const [, row] of rows) {
          const acts = row.filter((x) => /^(button|a)$/i.test(x.k.tagName) && x.r.width > 0);
          if (acts.length !== 2) continue;
          const used = acts.reduce((s, x) => s + x.r.width, 0);
          if (used > r.width * 0.55) continue;
          for (let i = 0; i < acts.length; i++) {
            for (let j = i + 1; j < acts.length; j++) {
              const A = acts[i].r, B = acts[j].r;
              const wA = A.width, wB = B.width;
              if (!wA || !wB) continue;
              const similar = Math.max(wA, wB) / Math.min(wA, wB) < 1.6;
              const gap = B.left - A.right;
              if (similar && gap > r.width * SCATTER_GAP) {
                scattered.push({
                  el: label(el),
                  a: label(acts[i].k), b: label(acts[j].k),
                  gap: Math.round(gap), of: Math.round(r.width),
                });
              }
            }
          }
        }

        // 4 · peer cells with exactly the same type — nothing wins
        if (kids.length >= 3) {
          const peers = kids.map((k) => {
            const kcs = getComputedStyle(k);
            const isBox = kcs.borderTopWidth !== "0px" || kcs.borderBottomWidth !== "0px" ||
              (kcs.backgroundColor !== "rgba(0, 0, 0, 0)" && kcs.backgroundColor !== "transparent");
            // The TYPE a cell presents is the type of the text inside it, not
            // the size the cell happens to inherit.
            let textEl = null;
            for (const d of [k, ...k.querySelectorAll("*")]) {
              if ([...d.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)) { textEl = d; break; }
            }
            const tcs = textEl ? getComputedStyle(textEl) : kcs;
            return {
              k, isBox,
              size: tcs.fontSize,
              weight: tcs.fontWeight,
              bg: kcs.backgroundColor,
              color: tcs.color,
            };
          });
          const boxed = peers.filter((p) => p.isBox);
          if (boxed.length >= 3) {
            const same = new Set(boxed.map((p) => `${p.size}|${p.weight}`));
            // A row where one cell is marked — a tab strip's active tab, a
            // card's accent — HAS a leader. The defect is a row where every
            // cell is identical, so nothing tells the reader where to look.
            const marks = new Set(boxed.map((p) => `${p.bg}|${p.color}|${p.weight}`));
            if (same.size === 1 && marks.size === 1) {
              equals.push({ el: label(el), n: boxed.length, size: boxed[0].size, weight: boxed[0].weight });
            }
          }
        }

        // 5 · a wrapping row whose last line holds one item
        if (isFlex && cs.flexWrap === "wrap") {
          const rowKeys = [...rows.keys()].sort((a, b) => a - b);
          if (rowKeys.length >= 2) {
            const lastRow = rows.get(rowKeys[rowKeys.length - 1]);
            if (lastRow.length === 1 && lastRow[0].r.width < r.width * ORPHAN_RATIO) {
              wrapped.push({ el: label(el), item: label(lastRow[0].k), w: Math.round(lastRow[0].r.width), of: Math.round(r.width) });
            }
          }
        }
      }

      // ── 7 · content clipped by its own box ───────────────────────────────
      // The operations wall's fleet table was five columns wide — 448px of
      // minimum — inside a 380px rail, and the rail's `overflow: hidden`
      // cut the ETA column off. The column was not missing; it was there,
      // and invisible. Nothing in the layout could say so.
      //
      // A SCROLLING ancestor is fine: the content is reachable. A CLIPPING
      // one is not: the content is gone.
      for (const el of all) {
        const owns = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (!owns) continue;
        const r = el.getBoundingClientRect();
        let clipper = null;
        for (let a = el.parentElement; a; a = a.parentElement) {
          const acs = getComputedStyle(a);
          if (acs.overflowX === "auto" || acs.overflowX === "scroll") { clipper = null; break; }
          if (acs.overflowX === "hidden" || acs.overflowX === "clip") { clipper = a; break; }
        }
        if (!clipper) continue;
        const cr = clipper.getBoundingClientRect();
        const ccs = getComputedStyle(clipper);
        const limit = cr.right - (parseFloat(ccs.paddingRight) || 0);
        if (r.right > limit + 1) {
          clipped.push({
            el: label(el),
            by: label(clipper),
            over: Math.round(r.right - limit),
            text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
          });
        }
      }

      // ── 6 · screens that are mostly empty ────────────────────────────────
      // The page is often its own scroller (a fixed shell with an inner
      // overflow container), so the DOCUMENT's height is one screen and the
      // measurement would be blind. Find the element that actually scrolls.
      const scroller = (() => {
        let best = null;
        for (const el of all) {
          const cs = getComputedStyle(el);
          if (cs.overflowY !== "auto" && cs.overflowY !== "scroll") continue;
          if (!best || el.scrollHeight > best.scrollHeight) best = el;
        }
        if (best && best.scrollHeight > document.documentElement.clientHeight + 4) return best;
        return document.scrollingElement || document.documentElement;
      })();
      const bands = [];
      const docH = scroller.scrollHeight;
      const vh = window.innerHeight;
      const content = all.filter((el) => {
        const owns = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
        return owns || el.tagName === "IMG" || el.tagName === "SVG" || el.tagName === "CANVAS";
      });
      const contentRects = content.map((el) => el.getBoundingClientRect());
      const contentTop = contentRects.length ? Math.min(...contentRects.map((r) => r.top)) : 0;
      const contentBottom = contentRects.length ? Math.max(...contentRects.map((r) => r.bottom)) : 0;
      const bandCount = Math.ceil(docH / vh);
      for (let y = 0; y < docH; y += vh) {
        let covered = 0;
        let inBand = false;
        for (const r of contentRects) {
          const top = Math.max(r.top, y), bot = Math.min(r.bottom, y + vh);
          if (bot > top) { covered += bot - top; inBand = true; }
        }
        const ratio = Math.min(1, covered / vh);
        // A page that fits on one screen has not wasted a screen — it has
        // simply said what it had to say. Only a page the reader must SCROLL
        // can waste one.
        if (bandCount <= 1) continue;
        if (!inBand) {
          // An empty band. It is wasted if the reader scrolled into it (there
          // is content above), or if it is a void before the content starts
          // (there is content below). Either way the reader paid for it.
          const above = contentRects.some((r) => r.bottom <= y + 1);
          const below = contentRects.some((r) => r.top >= y + vh - 1);
          if (above || below) bands.push({ y, ratio: 0, why: "no content in this screen" });
          continue;
        }
        if (ratio < EMPTY_BAND) bands.push({ y, ratio: +ratio.toFixed(2), why: "this screen is mostly empty" });
      }
      bands.sort((a, b) => a.ratio - b.ratio);

      return {
        clipped: clipped.slice(0, 12), clippedCount: clipped.length,
        dead: dead.slice(0, 12), deadCount: dead.length,
        orphans: orphans.slice(0, 12), orphanCount: orphans.length,
        scattered: scattered.slice(0, 12), scatterCount: scattered.length,
        equals: equals.slice(0, 12), equalCount: equals.length,
        wrapped: wrapped.slice(0, 12), wrapCount: wrapped.length,
        bands: bands.slice(0, 6), bandCount: bands.length,
        docH, vh,
      };
    }, { DEAD_SPACE, ORPHAN_RATIO, SCATTER_GAP, EMPTY_BAND });

    const total = res.deadCount + res.orphanCount + res.scatterCount + res.equalCount + res.wrapCount + res.bandCount + res.clippedCount;
    findings += total;
    console.log(`\n=== ${route} @${vp.label} — ${total} finding(s) · page ${res.docH}px tall, ${Math.ceil(res.docH / res.vh)} screens`);
    if (!total) { console.log("  clean — every band, cell and row explains itself."); continue; }

    const section = (name, rows, fmt) => {
      if (!rows.length) return;
      console.log(`  ${name} (${rows.length}):`);
      for (const x of rows) console.log(`    ${fmt(x)}`);
    };
    section("CLIPPED CONTENT", res.clipped, (x) => `${x.el} is ${x.over}px past the edge of ${x.by} — "${x.text}"`);
    section("DEAD SPACE under a cell", res.dead, (x) => `${x.el}  ${x.gap}px of nothing below its content (${x.w}×${x.h})`);
    section("ORPHAN in a last row", res.orphans, (x) => `${x.el} → ${x.item} is ${x.w}px in a ${x.of}px row`);
    section("SCATTERED actions", res.scattered, (x) => `${x.el}: ${x.a} … ${x.b}  ${x.gap}px apart in a ${x.of}px row`);
    section("EQUAL-WEIGHT peers", res.equals, (x) => `${x.el}  ${x.n} boxed cells, all ${x.size}/${x.weight}`);
    section("ACCIDENTAL WRAP", res.wrapped, (x) => `${x.el} → ${x.item} alone on the last line (${x.w}px in ${x.of}px)`);
    section("EMPTY SCREEN", res.bands, (x) => `at y=${x.y} — ${x.why} (${Math.round(x.ratio * 100)}% covered)`);
  }
}

await b.close();
console.log(`\ntotal spatial-hallucination findings: ${findings}`);
process.exit(findings ? 1 : 0);
