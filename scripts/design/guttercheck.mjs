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
import { settle } from "./settle.mjs";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const BASE = opt("base", "http://127.0.0.1:4173");
const TOL = Number(opt("tolerance", 1.5));
// The fixture server serves one page for every surface. `--route` points the
// checker at it, which is how the proof script drives the instrument.
// `--surface` picks ONE surface: a fixture page models one surface's bands,
// and the two surfaces declare different ROLES for the same switcher (the
// toolkit's is a cluster in the header's row, the insights bridge's is a band
// on its own row).
const ROUTE = opt("route", null);
const SURFACE = opt("surface", null);
// The surface table can be supplied from a file, so the proof can drive a
// surface through the REAL instrument that the product does not have — a
// surface that declares no band, for instance. A rule that can only be
// exercised on a page that happens to exist cannot be proven to fire.
const SURFACES_FILE = opt("surfaces", null);

/**
 * The probes are the CONTENT of each band — the thing whose left edge the
 * eye reads as the page's margin. `label` names the band. The third element
 * is the probe's ROLE, and it is DECLARED, not inferred:
 *
 *   "band"    (the default) — a strip of the page. Its content must start on
 *               the page's gutter, wherever it happens to sit vertically.
 *   "cluster" — a CONTROL CLUSTER inside a band's own row. The operations
 *               wall puts its LIVE ⇄ SIMULATION switch at the top right of
 *               the header, so that group's left edge is not the page's
 *               gutter and must not be measured against it. It may sit
 *               anywhere to the RIGHT of the gutter, and it may never sit to
 *               the LEFT of it.
 *
 * The role used to be INFERRED from geometry — "a probe whose vertical
 * centre is within 12px of the band before it is a cluster". That was two
 * bugs waiting: a band that happened to share a row with another probe was
 * excused as a cluster, and a cluster that dropped a row was reported as a
 * band. A declared role cannot do either. It also ends the zero-margin
 * comparison the inference depended on: the toolkit's source switcher sits
 * 0.0px from the brand's centre, and the rule above it was written to
 * tolerate a 12px difference.
 */
const BUILTIN_SURFACES = [
  {
    id: "toolkit",
    route: "/v2?view=toolkit",
    label: "the toolkit briefing",
    probes: [
      [".v2-header__brand", "header"],
      [".v2-source", "source switcher", "cluster"],
      [".tk-subnav__brand", "sub-nav"],
      [".tk-briefing > .tk-hero-block .tk-tag", "body"],
      [".tk-briefing > .tk-section-box .tk-section-kicker", "body (chapter)"],
    ],
  },
  {
    id: "insights",
    route: "/v2?view=insights",
    label: "the insights bridge",
    probes: [
      [".v2-header__brand", "header"],
      [".v2-source", "source switcher"],
    ],
  },
];

const SURFACES = SURFACES_FILE
  ? JSON.parse(readFileSync(SURFACES_FILE, "utf8"))
  : BUILTIN_SURFACES;

if (!SURFACES.length) {
  console.error("guttercheck: the surface table is empty — an instrument that checks nothing is decoration.");
  process.exit(2);
}

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();

let failures = 0;

for (const surface of SURFACES) {
  if (SURFACE && surface.id !== SURFACE) continue;
  const route = ROUTE ?? surface.route;
  await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
  await settle(p);

  const measured = await p.evaluate((probes) => {
    const out = [];
    for (const [sel, label, role] of probes) {
      const el = document.querySelector(sel);
      if (!el) { out.push({ label, sel, role: role || "band", x: null, y: 0, h: 0, w: 0 }); continue; }
      const r = el.getBoundingClientRect();
      out.push({ label, sel, role: role || "band", x: Math.round(r.left * 10) / 10, y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) });
    }
    return { edges: out, viewport: window.innerWidth };
  }, surface.probes);
  const edges = measured.edges;
  const viewport = measured.viewport;

  const missing = edges.filter((e) => e.x === null);
  const real = edges.filter((e) => e.x !== null);

  // A BAND is a strip of the page: its content must start on the page's
  // gutter, wherever it happens to sit vertically. A band that has drifted
  // right is still a band that has drifted.
  //
  // A CONTROL CLUSTER is a group of controls inside a band's own row — the
  // operations wall puts its LIVE = SIMULATION switch at the top right of
  // the header, and the toolkit's source switcher joined it there. Measured
  // as a band, that group's left edge (910px) "disagreed" with the page's
  // gutter (104px), but it was never a band: it is part of the header strip,
  // and the header strip's left edge is the brand's. A cluster may sit
  // anywhere to the RIGHT of the gutter and is not measured against it. It
  // may never sit to the LEFT of it — that is the defect the rule was
  // written for (the source switcher flush to the corner while the body sat
  // at 104px), and it stays caught.
  //
  // AND THE CLUSTER'S EXEMPTION IS BOUNDED BY ITS BAND. A cluster is part of
  // the band it shares a row with; a declared cluster that has LEFT its band
  // (moved onto a row of its own) is measured like a band. Either the
  // declaration is stale or the layout changed, and a 400px drift must not
  // ride on a declaration that no longer describes the page. The geometry can
  // only make this rule STRICTER: a cluster still in its band is still
  // excused, and one that is not can only fail.
  const declaredBands = real.filter((e) => e.role !== "cluster");
  const declaredClusters = real.filter((e) => e.role === "cluster");
  const sharesRow = (c, b) => {
    const overlap = Math.min(c.y + c.h, b.y + b.h) - Math.max(c.y, b.y);
    return overlap > 0 && overlap >= Math.min(c.h, b.h) * 0.5;
  };
  const bands = [
    ...declaredBands,
    ...declaredClusters.filter((c) => !declaredBands.some((b) => sharesRow(c, b))),
  ];
  const clusters = declaredClusters.filter((c) => declaredBands.some((b) => sharesRow(c, b)));

  const lefts = [...new Set(bands.map((e) => e.x))];
  const gutter = lefts.length ? Math.min(...lefts) : null;
  const drifted = bands.filter((e) => gutter !== null && Math.abs(e.x - gutter) > TOL);
  const stranded = clusters.filter((e) => gutter !== null && e.x < gutter - TOL);
  const overhung = clusters.filter((e) => e.x + e.w > viewport + TOL);

  console.log(`\n=== ${route} — ${surface.label} ===`);
  for (const e of edges) {
    const kind = e.role === "cluster" ? (clusters.includes(e) ? "cluster" : "cluster (left its band)") : "band";
    console.log(`  ${e.x === null ? "  ?" : String(e.x).padStart(6)}  ${e.label}  (${kind})${e.x === null ? `  (${e.sel} not found)` : ""}`);
  }

  if (missing.length) {
    failures += missing.length;
    console.error(`  FAIL — ${missing.length} probe(s) did not render.`);
  } else if (!declaredBands.length) {
    // A surface that declares no band has no gutter to measure against, and
    // a rule with nothing to measure must not report a pass.
    failures++;
    console.error(`  FAIL — this surface declares no band: the rule has no gutter to measure, so it cannot pass.`);
  } else if (stranded.length) {
    failures++;
    console.error(`  FAIL — ${stranded.map((e) => e.label).join(", ")} sits ${(gutter - stranded[0].x).toFixed(1)}px LEFT of the page's gutter (${gutter}px).`);
  } else if (overhung.length) {
    failures++;
    console.error(`  FAIL — ${overhung.map((e) => e.label).join(", ")} hangs past the right edge of the screen (${viewport}px).`);
  } else if (drifted.length) {
    failures++;
    console.error(`  FAIL — the bands do not share a left edge: ${bands.map((e) => `${e.label} ${e.x}px`).join(", ")} (tolerance ${TOL}px).`);
  } else {
    console.log(`  PASS — every band starts on the same line (${gutter}px)${clusters.length ? `; ${clusters.length} control cluster${clusters.length > 1 ? "s sit" : " sits"} inside it` : ""}.`);
  }
}

await b.close();
console.log(failures ? `\nguttercheck: ${failures} failure(s).\n` : "\nguttercheck: clean.\n");
process.exit(failures ? 1 : 0);
