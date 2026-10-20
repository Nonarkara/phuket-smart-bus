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
  await p.goto(BASE + surface.route, { waitUntil: "load", timeout: 60000 });
  await p.waitForTimeout(5000);

  const edges = await p.evaluate((probes) => {
    const out = [];
    for (const [sel, label] of probes) {
      const el = document.querySelector(sel);
      if (!el) { out.push({ label, sel, x: null }); continue; }
      const r = el.getBoundingClientRect();
      out.push({ label, sel, x: Math.round(r.left * 10) / 10 });
    }
    return out;
  }, surface.probes);

  const missing = edges.filter((e) => e.x === null);
  const real = edges.filter((e) => e.x !== null);
  const lefts = [...new Set(real.map((e) => e.x))];
  const spread = lefts.length ? Math.max(...lefts) - Math.min(...lefts) : 0;

  console.log(`\n=== ${surface.route} — ${surface.label} ===`);
  for (const e of edges) {
    console.log(`  ${e.x === null ? "  ?" : String(e.x).padStart(6)}  ${e.label}${e.x === null ? `  (${e.sel} not found)` : ""}`);
  }

  if (missing.length) {
    failures += missing.length;
    console.error(`  FAIL — ${missing.length} probe(s) did not render.`);
  } else if (spread > TOL) {
    failures++;
    console.error(`  FAIL — ${spread}px of disagreement between the bands' left edges (tolerance ${TOL}px).`);
  } else {
    console.log(`  PASS — every band starts on the same line (${real[0].x}px).`);
  }
}

await b.close();
console.log(failures ? `\nguttercheck: ${failures} failure(s).\n` : "\nguttercheck: clean.\n");
process.exit(failures ? 1 : 0);
