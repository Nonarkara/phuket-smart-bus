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
 *   Two passes:
 *     · static  — every `--t-*` name referenced must be DEFINED somewhere in
 *                 the project. A name nobody defines is a typo or a missing
 *                 scope. No browser needed, so it can run in the pre-commit.
 *     · render  — for every rule that names a token, the token must actually
 *                 RESOLVE on an element the rule matches. This is the pass
 *                 that catches the scope mismatch.
 *
 *   node scripts/design/tokenscope.mjs                # static
 *   node scripts/design/tokenscope.mjs --render       # static + browser
 *   node scripts/design/tokenscope.mjs --render --base https://bus.nonarkara.org
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const has = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const BASE = opt("base", "http://127.0.0.1:4173");
const RENDER = has("render");

const ROOT = process.cwd();
const CSS_DIRS = ["src"];
const NAMES = ["display", "hero", "figure", "title", "lead", "body", "label", "micro"];

/** Every stylesheet the app ships. */
function stylesheets() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".css")) out.push(p);
    }
  };
  for (const d of CSS_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  return out;
}

let failures = 0;

// ── PASS 1 · static: every referenced token is defined somewhere ─────────────
{
  const defined = new Set(); // "--t-hero"
  const referenced = new Map(); // "--t-hero" -> [ "file:line" ]
  for (const file of stylesheets()) {
    const text = fs.readFileSync(file, "utf8");
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/(--t-[a-z]+)\s*:/g)) defined.add(m[1]);
      for (const m of line.matchAll(/var\(\s*(--t-[a-z]+)/g)) {
        const list = referenced.get(m[1]) || [];
        list.push(`${path.relative(ROOT, file)}:${i + 1}`);
        referenced.set(m[1], list);
      }
    });
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
}

// ── PASS 2 · render: the token resolves where the rule applies ───────────────
if (RENDER) {
  const ROUTES = ["/v2?view=toolkit", "/v2?view=insights", "/ops", "/fleet/raw", "/study", "/capacity", "/toolkit"];
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  const p = await c.newPage();
  const seen = new Set();

  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
    await p.waitForTimeout(5000);

    const dead = await p.evaluate(() => {
      const out = [];
      // Every rule that names a token in a size declaration.
      const rules = [];
      const walk = (list) => {
        for (const rule of list) {
          if (rule.selectorText && rule.style) {
            const st = rule.style;
            const decl = st.fontSize || st.font || "";
            const names = [...decl.matchAll(/var\(\s*(--t-[a-z]+)/g)].map((m) => m[1]);
            if (names.length) rules.push({ selector: rule.selectorText, names });
          } else if (rule.cssRules) walk(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        let r;
        try { r = sheet.cssRules; } catch { continue; }
        walk(r);
      }

      for (const rule of rules) {
        let els = [];
        try { els = [...document.querySelectorAll(rule.selector)]; } catch { continue; }
        els = els.filter((e) => {
          const cs = getComputedStyle(e);
          if (cs.display === "none" || cs.visibility === "hidden") return false;
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (!els.length) continue; // the rule matches nothing HERE — not this route's problem
        for (const name of rule.names) {
          const resolved = els.some((e) => getComputedStyle(e).getPropertyValue(name).trim() !== "");
          if (!resolved) {
            out.push({ selector: rule.selector, name, sample: els[0].className ? String(els[0].className).slice(0, 40) : els[0].tagName });
            break;
          }
        }
      }
      return out;
    });

    for (const d of dead) {
      const key = `${d.selector}|${d.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures++;
      console.error(`\n  DEAD RULE — ${d.name} does not resolve here:`);
      console.error(`    ${d.selector}`);
      console.error(`    on: ${d.sample}`);
    }
  }
  await b.close();
  if (!seen.size) console.log(`  render: every token-ruled declaration resolves on every route.`);
}

console.log(failures ? `\ntokenscope: ${failures} dead declaration(s).\n` : "\ntokenscope: clean.\n");
process.exit(failures ? 1 : 0);
