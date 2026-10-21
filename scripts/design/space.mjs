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
const PEER_SHARE = 0.4;     // of the screen: how much a peer set must own to be a choice
const VERTICAL_TRAP = 2.5;  // screens of scroll before it reads as a hole
const HORIZONTAL_TRAP = 1.25; // a column pushed off the edge
const ROW_TOLERANCE = 8;   // px of baseline difference that is still one row

const WIDTHS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
];

let b = await chromium.launch();
let c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
let p = await c.newPage();

const freshPage = async () => {
  try {
    return await c.newPage();
  } catch {
    // The CONTEXT went with the page. A dead context is the only thing the
    // retry above cannot come back from, and an instrument that dies on a
    // dropped page stops checking every route after it — which is how a gate
    // ends up green on the routes it never reached.
    try {
      c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
    } catch {
      // The BROWSER went too. A page cannot be made from a closed browser,
      // so the browser is relaunched. An instrument that crashes is an
      // instrument that stops checking.
      b = await chromium.launch();
      c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
    }
    return c.newPage();
  }
};

const open = async (route, vp) => {
  // The path the gate ASKED for. `goto` follows redirects and reports the
  // final status, so a 302 that lands on the homepage answers 200 — and the
  // gate would measure the homepage and call it the route it wanted.
  const wanted = new URL(BASE + route, BASE).pathname.replace(/\/+$/, "") || "/";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (p.isClosed()) p = await freshPage();
      await p.setViewportSize({ width: vp.width, height: vp.height });
      const res = await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
      // A ROUTE THAT IS NOT THERE is not a clean route. The instrument
      // measures whatever HTML came back, so a 404 — or a typo in the route
      // list — reads as a pass on a page nobody asked for. The status is the
      // answer to "is this the route?", and anything that is not a success
      // is a route that could not be measured.
      if (res && res.status() >= 400) {
        console.error(`  (${route} @${vp.label} answered ${res.status()} — not a page this gate can measure)`);
        return false;
      }
      const landed = new URL(p.url()).pathname.replace(/\/+$/, "") || "/";
      if (landed !== wanted) {
        console.error(`  (${route} @${vp.label} ended on ${landed} — a different page than the one that was asked for)`);
        return false;
      }
      await p.waitForTimeout(5000);
      return true;
    } catch (e) {
      console.error(`  (the browser dropped the page on ${route} @${vp.label}; retrying)`);
      try { await p.close(); } catch { /* already gone */ }
      try {
        p = await freshPage();
      } catch (e2) {
        // The browser is gone for good. The route is unmeasured, and the
        // caller counts that as a finding.
        return false;
      }
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

    let res;
    try {
      res = await p.evaluate(({ DEAD_SPACE, ORPHAN_RATIO, SCATTER_GAP, EMPTY_BAND, PEER_SHARE, VERTICAL_TRAP, HORIZONTAL_TRAP, ROW_TOLERANCE }) => {
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
        // The page shell is not a stretched cell. A body with 600px of page
        // background under its content is a page with little to say, not a
        // layout that invented the space.
        if (el.tagName === "BODY" || el.tagName === "HTML") continue;
        // A rule, a divider, a 2px rail marker — a box too narrow to hold
        // content is a mark, and the space around a mark is its own job.
        const r = el.getBoundingClientRect();
        if (r.width < 24) continue;
        // THE TEST. A cell is stretched when its container is a grid or a
        // flex and the cell is taller than its own content. Only then is the
        // space under the content the leftover of a taller sibling.
        const parent = el.parentElement;
        const pcs = parent ? getComputedStyle(parent) : null;
        const stretched = pcs && (
          pcs.display === "grid" || pcs.display === "inline-grid" ||
          pcs.display === "flex" || pcs.display === "inline-flex"
        );
        if (!stretched) continue;
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
        // A ROW is a line of items, not a set of identical tops. Items in one
        // flex line sit at different baselines — a pill is vertically
        // centred, a chip is not — and a 3px difference used to split one
        // line into two, so a pill beside its chips read as "alone on the
        // last line". Cluster the tops with a tolerance.
        const rows = new Map();
        const tops = [];
        for (const k of kids) tops.push(Math.round(k.getBoundingClientRect().top));
        tops.sort((a, b) => a - b);
        const rowKeys = [];
        for (const t of tops) {
          const last = rowKeys[rowKeys.length - 1];
          if (last !== undefined && t - last <= ROW_TOLERANCE) continue;
          rowKeys.push(t);
        }
        const keyFor = (top) => {
          let best = rowKeys[0];
          for (const k of rowKeys) if (Math.abs(top - k) <= ROW_TOLERANCE) best = k;
          return best;
        };
        for (const k of kids) {
          const kr = k.getBoundingClientRect();
          const key = keyFor(Math.round(kr.top));
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
        //
        // A MARKER ON A TRACK is not a pair of actions. The fleet console
        // draws each bus on the corridor rail at `left: NN%` — its position
        // is WHERE THE BUS IS, not where the layout put it. Two buses 149px
        // apart on a 258px rail is a gap in the DATA, and reading it as a
        // gap in the layout made the gate fail or pass with the traffic.
        //
        // The exclusion is SCOPED to the two rail classes, and it takes BOTH
        // members of the pair. A generic "any absolutely positioned button
        // with a percentage left" rule would have excused a real pair of
        // scattered actions; a pair where only one member is a marker is
        // still a pair to measure.
        const TRACK_MARKER = /\b(fc-line__bus|fd-corridor-bus)\b/;
        const isTrackMarker = (x) => {
          const kcs = getComputedStyle(x.k);
          if (kcs.position !== "absolute" && kcs.position !== "fixed") return false;
          if (!TRACK_MARKER.test(String(x.k.className || ""))) return false;
          const inline = x.k.getAttribute("style") || "";
          return /(^|;)\s*left\s*:\s*[\d.]+%\s*(;|$)/.test(inline);
        };
        for (const [, row] of rows) {
          const acts = row.filter((x) => /^(button|a)$/i.test(x.k.tagName) && x.r.width > 0);
          if (acts.length !== 2) continue;
          // A PAIR OF MARKERS is a pair of data points on a rail, not a pair
          // of actions. One marker and one real action is still a pair.
          if (acts.every((x) => isTrackMarker(x))) continue;
          const used = acts.reduce((s, x) => s + x.r.width, 0);
          if (used > r.width * 0.55) continue;
          for (let i = 0; i < acts.length; i++) {
            for (let j = i + 1; j < acts.length; j++) {
              const A = acts[i].r, B = acts[j].r;
              const wA = A.width, wB = B.width;
              if (!wA || !wB) continue;
              const similar = Math.max(wA, wB) / Math.min(wA, wB) < 1.6;
              // The gap between two boxes, in whichever order they sit. DOM
              // order is not visual order: a button placed by a percentage can
              // come FIRST in the markup and land on the RIGHT, and a gap
              // computed as `B.left - A.right` then reads as a large negative
              // number and the pair is never measured. The space between two
              // boxes does not care which one came first.
              const left = A.left <= B.left ? A : B;
              const right = left === A ? B : A;
              const gap = right.left - left.right;
              if (similar && gap > r.width * SCATTER_GAP) {
                scattered.push({
                  el: label(el),
                  a: label(left === A ? acts[i].k : acts[j].k),
                  b: label(right === A ? acts[i].k : acts[j].k),
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
            // A cell can be marked by a colour that is not on its FIRST line —
            // a green figure under a grey label marks the cell as surely as a
            // tinted ground would. So the cell's mark is the SET of colours it
            // carries, and a group where the sets differ HAS a leader.
            const colours = new Set();
            for (const d of [k, ...k.querySelectorAll("*")]) {
              if (![...d.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)) continue;
              colours.add(getComputedStyle(d).color);
            }
            // A cell can be marked by a coloured RULE as well as by a tinted
            // ground — the left rule is this product's state marker, and the
            // scenario cards use it to say gain / even / loss. A mark on the
            // border is a mark.
            const kcs2 = getComputedStyle(k);
            const rules = [kcs2.borderTopColor, kcs2.borderRightColor, kcs2.borderBottomColor, kcs2.borderLeftColor].join("|");
            return {
              k, isBox,
              size: tcs.fontSize,
              weight: tcs.fontWeight,
              bg: kcs.backgroundColor,
              color: tcs.color,
              colours: [...colours].sort().join(","),
              rules,
            };
          });
          const boxed = peers.filter((p) => p.isBox);
          if (boxed.length >= 3) {
            const same = new Set(boxed.map((p) => `${p.size}|${p.weight}`));
            // A row where one cell is marked — a tab strip's active tab, a
            // card's accent — HAS a leader. The defect is a row where every
            // cell is identical, so nothing tells the reader where to look.
            const marks = new Set(boxed.map((p) => `${p.bg}|${p.colours}|${p.rules}|${p.weight}`));
            if (same.size === 1 && marks.size === 1) {
              // PROMINENCE. A navigation row and a metadata strip are peers
              // BY DESIGN: nothing there is meant to win, because nothing
              // there is a choice. The defect is a set of identical cells
              // that owns so much of the screen that the reader is expected
              // to choose among them and cannot.
              const area = boxed.reduce((s, p) => {
                const r = p.k.getBoundingClientRect();
                return s + r.width * r.height;
              }, 0);
              const share = area / (window.innerWidth * window.innerHeight);
              // A strip of three parallel facts is NOT a choice — the reader
              // reads all of it, and equal weight is the point. A grid of
              // four or more identical cells that owns half the screen IS a
              // choice, and nothing in it helps the reader make it.
              if (share >= PEER_SHARE && boxed.length >= 4) {
                equals.push({
                  el: label(el), n: boxed.length, size: boxed[0].size, weight: boxed[0].weight,
                  share: Math.round(share * 100),
                });
              }
            }
          }
        }

        // 5 · a wrapping row whose last line holds one item
        //
        // A COLUMN flex is a STACK, not a row that broke: every child is on
        // its own line by design, and `flex-wrap: wrap` in a column wraps on
        // the HEIGHT, not the width. The live fleet table's route cell is
        // exactly this — a line badge, a direction, a progress rule — and
        // reading its last line as a widow fired on every live row of the
        // operations wall. Seventy-four false findings on one deploy, all
        // of them the same shape.
        //
        // So the rule reads the direction before it reads the wrap.
        const isRowDirection = cs.flexDirection === "row" || cs.flexDirection === "row-reverse";
        if (isFlex && cs.flexWrap === "wrap" && isRowDirection) {
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
        // The page's TAIL. Content that ends in the middle of the last
        // screen is not a hole — it is the end of the page. A band that
        // holds the page's final content is measured against what the
        // reader is actually looking at, not against a full screen.
        const isTail = contentBottom <= y + vh + 4;
        if (isTail) continue;
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

      // ── 8 · scroll traps ─────────────────────────────────────────────────
      // A region that scrolls three screens deep is not a scroll region, it
      // is a page that has been cut into a hole. The reader has to scroll to
      // find what they came for, and nothing on the surface says that it is
      // down there.
      //
      // The page's own scroller is exempt: that is how a page is a page.
      const traps = [];
      for (const el of all) {
        const cs = getComputedStyle(el);
        const vScroll = cs.overflowY === "auto" || cs.overflowY === "scroll";
        const hScroll = cs.overflowX === "auto" || cs.overflowX === "scroll";
        if (!vScroll && !hScroll) continue;
        if (el === document.scrollingElement || el === document.documentElement) continue;
        const r = el.getBoundingClientRect();
        // The page's OWN scroll is not a trap. A long briefing on a phone is
        // a long briefing. What is a trap is a REGION inside the page that
        // is several screens deep — the fleet table that finished 1,482px
        // below the fold of a rail the reader was looking at.
        //
        // A scroller is the PAGE when it is the page's <main> (or holds
        // one), or when it fills the viewport's height. The operations rail
        // is 59% of the viewport — a region beside the map — and the fleet
        // console's shell is 100% of it. One is a hole, the other is the
        // page.
        const isThePage = el.tagName === "MAIN" || !!el.querySelector("main") ||
          el.clientHeight >= window.innerHeight * 0.9;
        if (vScroll && !isThePage && el.scrollHeight > el.clientHeight * VERTICAL_TRAP && el.clientHeight > 200) {
          traps.push({
            el: label(el), axis: "vertical",
            screens: +(el.scrollHeight / el.clientHeight).toFixed(1),
            visible: Math.round(el.clientHeight), total: Math.round(el.scrollHeight),
          });
        }
        // A wide DATA TABLE on a phone is a legitimate horizontal scroll:
        // the reader reaches it, and that is what tables do at 390px. What is
        // not legitimate is a card grid or a column pushed off the edge, so
        // a scroller whose overflow comes from a <table> is exempt.
        const tableOverflow = el.querySelector("table");
        // The map engine sizes its own overlay to the route's bounds, not to
        // the viewport. Leaflet clips it; the box model still counts it. It
        // is the map's business, not the layout's.
        const leafletOverflow = el.querySelector(".leaflet-container");
        // A strip that scrolls in ONE axis only was designed that way: the
        // map's route pills are a swipeable strip, and the author wrote
        // `overflow-x: auto` and hid the scrollbar on purpose. A region that
        // scrolls in BOTH axes is a content area that happens to overflow,
        // and that is the defect.
        const oneAxisOnly = el.scrollHeight <= el.clientHeight + 4;
        if (hScroll && !tableOverflow && !leafletOverflow && !oneAxisOnly && el.scrollWidth > el.clientWidth * HORIZONTAL_TRAP && el.clientWidth > 120) {
          traps.push({
            el: label(el), axis: "horizontal",
            ratio: +(el.scrollWidth / el.clientWidth).toFixed(2),
            visible: Math.round(el.clientWidth), total: Math.round(el.scrollWidth),
          });
        }
      }

      return {
        clipped: clipped.slice(0, 12), clippedCount: clipped.length,
        dead: dead.slice(0, 12), deadCount: dead.length,
        orphans: orphans.slice(0, 12), orphanCount: orphans.length,
        scattered: scattered.slice(0, 12), scatterCount: scattered.length,
        equals: equals.slice(0, 12), equalCount: equals.length,
        wrapped: wrapped.slice(0, 12), wrapCount: wrapped.length,
        bands: bands.slice(0, 6), bandCount: bands.length,
        traps: traps.slice(0, 12), trapCount: traps.length,
        docH, vh,
      };
    }, { DEAD_SPACE, ORPHAN_RATIO, SCATTER_GAP, EMPTY_BAND, PEER_SHARE, VERTICAL_TRAP, HORIZONTAL_TRAP, ROW_TOLERANCE });
    } catch (e) {
      // The page died while it was being measured. A route that could not be
      // measured is NOT a clean route — it is an unmeasured route, and it is
      // counted as a finding so the gate cannot pass over it.
      console.log(`\nNOT MEASURED: ${route} @${vp.label} — the browser dropped it mid-measurement`);
      findings++;
      continue;
    }

    const total = res.deadCount + res.orphanCount + res.scatterCount + res.equalCount + res.wrapCount + res.bandCount + res.clippedCount + res.trapCount;
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
    section("EQUAL-WEIGHT peers", res.equals, (x) => `${x.el}  ${x.n} boxed cells, all ${x.size}/${x.weight}, holding ${x.share}% of the screen`);
    section("ACCIDENTAL WRAP", res.wrapped, (x) => `${x.el} → ${x.item} alone on the last line (${x.w}px in ${x.of}px)`);
    section("EMPTY SCREEN", res.bands, (x) => `at y=${x.y} — ${x.why} (${Math.round(x.ratio * 100)}% covered)`);
    section("SCROLL TRAP", res.traps, (x) => x.axis === "vertical"
      ? `${x.el}  ${x.screens} screens of scroll inside ${x.visible}px (${x.total}px of content)`
      : `${x.el}  ${x.ratio}× wider than its box — a column is off the edge (${x.visible}px visible of ${x.total}px)`);
  }
}

await b.close();
console.log(`\ntotal spatial-hallucination findings: ${findings}`);
process.exit(findings ? 1 : 0);
