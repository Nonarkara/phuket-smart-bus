#!/usr/bin/env node
/**
 * A rule that names a type token the scope does not define is a DEAD RULE.
 *
 * WHY THIS EXISTS
 *   The toolkit view rendered every text element at 13px, 15px or 28px. The
 *   CSS was not written that way: it said `font-size: var(--t-hero)`,
 *   `var(--t-label)`, `var(--t-title)`, `var(--t-figure)`, `var(--t-lead)` —
 *   sixteen declarations. The scope the toolkit renders in (`.v2--toolkit`)
 *   defined only three of the eight names, so those sixteen declarations
 *   were invalid at computed-value time: the property silently inherited,
 *   and the page lost the hierarchy it had been designed with. Nothing
 *   failed, nothing warned, and the CSS looked correct.
 *
 *   A scale that is declared for one surface and referenced from another is
 *   invisible to every instrument that only looks at RENDERED sizes, because
 *   the dead declaration renders the same size as the one that won.
 *
 *   Three passes:
 *     · static  — every `--t-*` name referenced must be DEFINED somewhere in
 *                 the project. A name nobody defines is a typo or a missing
 *                 scope. No browser needed, so it can run in the pre-commit.
 *     · scope   — every scope that defines tokens must define ALL EIGHT.
 *                 A scale block with a hole in it is a trap: the next
 *                 `var(--t-lead)` in that scope is a dead rule.
 *     · render  — for every rule that names a token, the token must actually
 *                 RESOLVE on an element the rule matches. This is the pass
 *                 that catches the scope mismatch.
 *
 * WHY THE RENDER PASS PARSES THE TEXT
 *   The first version asked the CSSOM: `rule.style.fontSize || rule.style.font`.
 *   Chrome cannot expand a shorthand that contains a var() —
 *
 *     font: 500 var(--t-hero)/1.05 var(--font-display);
 *
 *   is stored with every longhand carrying a pending substitution, so
 *   `fontSize` reads "", `font` reads "", and the property list shows
 *   `font-size = ` : present, empty. The rule looked like it named no token
 *   at all — and this codebase writes its type in the shorthand form
 *   everywhere, so the pass was blind to most of the stylesheet.
 *
 *   So the render pass reads the STYLESHEET TEXT — the same text the browser
 *   read, minus the erasure — and asks the browser only the questions the
 *   browser is good at: which elements does this selector match, and does
 *   this token resolve on them.
 *
 *   node scripts/design/tokenscope.mjs                # static + scope
 *   node scripts/design/tokenscope.mjs --render       # + browser
 *   node scripts/design/tokenscope.mjs --render --base https://bus.nonarkara.org
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { settle } from "./settle.mjs";
import { parseCss, definedTokens, tokenNames, sizeDecl, readStylesheets } from "./cssrules.mjs";

const args = process.argv.slice(2);
const has = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const BASE = opt("base", "http://127.0.0.1:4173");
const RENDER = has("render");

const ROOT = process.cwd();
const CSS_DIRS = ["src"];
const NAMES = ["display", "hero", "figure", "title", "lead", "body", "label", "micro"];
const FULL = NAMES.map((n) => `--t-${n}`);

let failures = 0;

// ── PASS 1 · static: every referenced token is defined somewhere ─────────────
{
  const defined = new Set();
  const referenced = new Map();
  const scopes = new Map(); // selector -> Set(defined names)
  const literals = new Map(); // size -> [ "file: selector" ]

  for (const file of readStylesheets(CSS_DIRS.map((d) => path.join(ROOT, d)))) {
    const text = fs.readFileSync(file, "utf8");
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/(--t-[a-z]+)\s*:/g)) defined.add(m[1]);
      for (const m of line.matchAll(/var\(\s*(--t-[a-z]+)/g)) {
        const list = referenced.get(m[1]) || [];
        list.push(`${path.relative(ROOT, file)}:${i + 1}`);
        referenced.set(m[1], list);
      }
    });

    for (const rule of parseCss(text)) {
      const defs = definedTokens(rule);
      if (defs.length) {
        const set = scopes.get(rule.selector) || new Set();
        for (const d of defs) set.add(d);
        scopes.set(rule.selector, set);
      }
      const sd = sizeDecl(rule);
      if (sd && !tokenNames(rule).length && sd.size) {
        const list = literals.get(sd.size) || [];
        list.push(`${path.relative(ROOT, file)}: ${rule.selector}`);
        literals.set(sd.size, list);
      }
    }
  }

  const orphans = [...referenced.keys()].filter((t) => !defined.has(t));
  if (orphans.length) {
    failures += orphans.length;
    console.error(`\n  DEAD TOKEN NAME — referenced but never defined:`);
    for (const t of orphans) {
      console.error(`    ${t}`);
      for (const at of referenced.get(t).slice(0, 6)) console.error(`        ${at}`);
    }
  } else {
    console.log(`  static: ${referenced.size} token name(s) referenced, all defined.`);
  }

  // ── PASS 2 · scope: a scale block declares all eight names ────────────────
  const incomplete = [...scopes.entries()].filter(([, set]) => set.size < FULL.length);
  if (incomplete.length) {
    failures += incomplete.length;
    console.error(`\n  INCOMPLETE SCOPE — a scope that defines type tokens must define all eight:`);
    for (const [selector, set] of incomplete) {
      const missing = FULL.filter((n) => !set.has(n));
      console.error(`    ${selector}`);
      console.error(`        defines ${set.size}/8 — missing ${missing.join(", ")}`);
    }
  } else {
    console.log(`  scope: ${scopes.size} scope(s) that define tokens, all define all eight.`);
  }

  if (literals.size) {
    console.log(`  literal sizes (not on a token): ${literals.size} distinct — informational.`);
    for (const [size, where] of [...literals.entries()].sort()) {
      console.log(`      ${size}  ×${where.length}   ${where[0]}`);
    }
  }
}

// ── PASS 3 · render: the token resolves where the rule applies ───────────────
if (RENDER) {
  const ROUTES = ["/v2?view=toolkit", "/v2?view=insights", "/ops", "/fleet/raw", "/fleet", "/study", "/capacity", "/toolkit", "/roi", "/governor", "/research", "/info", "/more", "/stops", "/ride", "/compare", "/pass", "/driver", "/"];
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  const p = await c.newPage();
  const seen = new Set();

  // The stylesheet is the same bundle on every route: read it ONCE.
  await p.goto(BASE + ROUTES[0], { waitUntil: "load", timeout: 60000 });
  await p.waitForTimeout(4000);
  const hrefs = await p.evaluate(() => [...document.styleSheets].map((s) => s.href).filter(Boolean));
  const rules = [];
  for (const href of hrefs) {
    const abs = new URL(href, BASE).toString();
    let text = "";
    try {
      const res = await fetch(abs);
      text = await res.text();
    } catch { text = ""; }
    if (!text) continue;
    for (const rule of parseCss(text)) {
      const names = tokenNames(rule);
      if (!names.length) continue;
      rules.push({ selector: rule.selector, names, conditions: rule.conditions });
    }
  }
  if (!rules.length) {
    failures++;
    console.error(`\n  tokenscope render pass could not read the stylesheet.`);
  }

  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
    await settle(p);
    if (!rules.length) continue;

    const dead = await p.evaluate(async (rules) => {
      const out = [];
      const NAMES = ["--t-display", "--t-hero", "--t-figure", "--t-title", "--t-lead", "--t-body", "--t-label", "--t-micro"];

      for (const rule of rules) {
        // A rule inside a media query that does not match this viewport does
        // not apply here — but it does apply somewhere, so it is judged at the
        // width where it lives. Skip it rather than cry wolf.
        if (rule.conditions.length && !rule.conditions.every((c) => { try { return matchMedia(c).matches; } catch { return true; } })) continue;

        let els = [];
        try { els = [...document.querySelectorAll(rule.selector)]; } catch { continue; }
        els = els.filter((e) => {
          const cs = getComputedStyle(e);
          if (cs.display === "none" || cs.visibility === "hidden") return false;
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (!els.length) continue;

        for (const name of rule.names) {
          const resolved = els.some((e) => getComputedStyle(e).getPropertyValue(name).trim() !== "");
          if (!resolved) {
            out.push({ kind: "dead", selector: rule.selector, name, sample: els[0].className ? String(els[0].className).slice(0, 40) : els[0].tagName });
            break;
          }
        }
      }

      // ── an element whose scope resolves SOME of the eight must resolve all ─
      for (const e of document.querySelectorAll("*")) {
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (!own) continue;
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const resolved = NAMES.filter((n) => cs.getPropertyValue(n).trim() !== "");
        if (resolved.length && resolved.length < NAMES.length) {
          out.push({
            kind: "scope",
            selector: e.className ? String(e.className).trim().split(/\s+/).slice(0, 2).join(".") : e.tagName.toLowerCase(),
            missing: NAMES.filter((n) => !resolved.includes(n)),
            sample: (e.textContent || "").trim().slice(0, 40),
          });
        }
      }
      return out;
    }, rules);

    for (const d of dead) {
      const key = `${d.kind}|${d.selector}|${d.name || (d.missing || []).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures++;
      if (d.kind === "dead") {
        console.error(`\n  DEAD RULE — ${d.name} does not resolve here:`);
        console.error(`    ${d.selector}`);
        console.error(`    on: ${d.sample}`);
      } else {
        console.error(`\n  INCOMPLETE SCOPE — the scope does not define: ${d.missing.join(", ")}`);
        console.error(`    ${d.selector}`);
        console.error(`    on: "${d.sample}"`);
      }
    }
  }
  await b.close();
  if (!seen.size) console.log(`  render: every token-ruled declaration resolves on every route.`);
}

console.log(failures ? `\ntokenscope: ${failures} dead declaration(s).\n` : "\ntokenscope: clean.\n");
process.exit(failures ? 1 : 0);
