#!/usr/bin/env node
/**
 * One page, one left edge.
 *
 * WHY THIS EXISTS
 *   The toolkit view had THREE margins. The header's content started at 24px,
 *   the source switcher at 24px, and the body at 104px — so the top of the
 *   page and the page below it looked like two teams had built them without
 *   talking to each other. That is a measurable defect, not a taste
 *   question, and it is invisible to a screenshot review because the eye
 *   reads "aligned" from a single band.
 *
 *   The rule: on a surface whose bands are stacked (a header, a switcher, a
 *   sub-nav, a body), every band's CONTENT starts on the same line. The
 *   bands themselves may be full-bleed; their content may not.
 *
 *   Each surface names its own probes, because a three-column operations
 *   wall legitimately has three columns and is not this rule's subject.
 *
 *   node scripts/design/guttercheck.mjs --base https://bus.nonarkara.org
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const BASE = opt("base", "http://127.0.0.1:4173");
const TOL = Number(opt("tolerance", 1.5));
const ROW_TOL = 12; // px of centre difference that still means "the same row"
// The fixture server serves one page for every surface. `--route` points the
// checker at it, which is how the proof script drives the instrument.
const ROUTE = opt("route", null);

/**
 * The probes are the CONTENT of each band — the thing whose left edge the
 * eye reads as the page's margin. `label` names the band.
 */
const SURFACES = [
  {
    route: "/v2?view=toolkit",
    label: "the toolkit briefing",
    probes: [
      [".v2-header__brand", "header"],
      [".v2-source", "source switcher"],
      [".tk-subnav__brand", "sub-nav"],
      [".tk-briefing > .tk-hero-block .tk-tag", "body"],
      [".tk-briefing > .tk-section-box .tk-section-kicker", "body (chapter)"],
    ],
  },
  {
    route: "/v2?view=insights",
    label: "the insights bridge",
    probes: [
      [".v2-header__brand", "header"],
      [".v2-source", "source switcher"],
    ],
  },
];

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();

let failures = 0;

for (const surface of SURFACES) {
  const route = ROUTE ?? surface.route;
  await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
  await p.waitForTimeout(5000);

  const edges = await p.evaluate((probes) => {
    const out = [];
    for (const [sel, label] of probes) {
      const el = document.querySelector(sel);
      if (!el) { out.push({ label, sel, x: null, y: 0, h: 0 }); continue; }
      const r = el.getBoundingClientRect();
      out.push({ label, sel, x: Math.round(r.left * 10) / 10, y: Math.round(r.top), h: Math.round(r.height) });
    }
    return out;
  }, surface.probes);

  const missing = edges.filter((e) => e.x === null);
  const real = edges.filter((e) => e.x !== null);

  // ── a band is a STRIP of the page, and a control cluster is not a band ──
  //
  // The operations wall puts the LIVE ⇄ SIMULATION switch at the top RIGHT
  // of the header, in the header's own row. Measured as a band, that group's
  // left edge (910px) "disagrees" with the page's gutter (104px) — but it was
  // never a band. It is part of the header strip, and the header strip's left
  // edge is the brand's.
  //
  // So a probe that shares a row with the band before it is a CLUSTER: it may
  // sit anywhere to the right of the gutter, and it is not measured against
  // the gutter. It may never sit to the LEFT of the gutter — that is the
  // defect the rule was written for (the source switcher flush to the corner
  // while the body sat at 104px), and it stays caught.
  let rowCentre = null;
  const bands = [];
  const clusters = [];
  for (const e of real) {
    const centre = e.y + e.h / 2;
    if (rowCentre === null || centre - rowCentre > ROW_TOL) {
      bands.push(e);
      rowCentre = centre;
    } else {
      clusters.push(e);
    }
  }

  const lefts = [...new Set(bands.map((e) => e.x))];
  const spread = lefts.length ? Math.max(...lefts) - Math.min(...lefts) : 0;
  const gutter = lefts.length ? Math.min(...lefts) : null;
  const stranded = clusters.filter((e) => gutter !== null && e.x < gutter - TOL);

  console.log(`\n=== ${route} — ${surface.label} ===`);
  for (const e of edges) {
    const kind = e.x === null ? "?" : clusters.includes(e) ? "cluster" : "band";
    console.log(`  ${e.x === null ? "  ?" : String(e.x).padStart(6)}  ${e.label}  (${kind})${e.x === null ? `  (${e.sel} not found)` : ""}`);
  }

  if (missing.length) {
    failures += missing.length;
    console.error(`  FAIL — ${missing.length} probe(s) did not render.`);
  } else if (stranded.length) {
    failures++;
    console.error(`  FAIL — ${stranded.map((e) => e.label).join(", ")} sits ${(gutter - stranded[0].x).toFixed(1)}px LEFT of the page's gutter (${gutter}px).`);
  } else if (spread > TOL) {
    failures++;
    console.error(`  FAIL — ${spread}px of disagreement between the bands' left edges (tolerance ${TOL}px).`);
  } else {
    console.log(`  PASS — every band starts on the same line (${gutter}px)${clusters.length ? `; ${clusters.length} control cluster${clusters.length > 1 ? "s sit" : " sits"} inside it` : ""}.`);
  }
}

await b.close();
console.log(failures ? `\nguttercheck: ${failures} failure(s).\n` : "\nguttercheck: clean.\n");
process.exit(failures ? 1 : 0);
