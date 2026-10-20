#!/usr/bin/env node
/**
 * Which CSS rule sets the size of which element, on which route?
 *
 * WHY THIS EXISTS
 *   The type ramp has to be collapsed per SURFACE, and a rule does not belong
 *   to a surface — a selector's first class prefix is a guess, and `h1` or
 *   `.v2-btn` reaches across surfaces. Mapping the wrong rule to the wrong
 *   scale either breaks a page or leaves it over the limit. This walks the
 *   app's own stylesheets, finds every rule with a font-size that matches
 *   something on the page, and reports the rendered sizes it produces.
 *
 *   A rule that appears on two routes with different scales is a CONFLICT and
 *   is marked as one.
 *
 *   node scripts/design/whichrule.mjs /ops /capacity --base http://127.0.0.1:4173
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const BASE = bi === -1 ? "http://127.0.0.1:4173" : args[bi + 1];
const BASE_ARG = bi === -1 ? -1 : bi + 1;
const ROUTES = args.filter((a, i) => !a.startsWith("--") && i !== BASE_ARG);

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();

// ruleKey -> { routes:Set, sizes:Set, selectors:[] }
const seen = new Map();

for (const route of ROUTES) {
  await p.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
  await p.waitForTimeout(2500);
  const rows = await p.evaluate(() => {
    const out = [];
    // A stylesheet's rules are a TREE: @media and @supports hold style rules
    // inside them, and a rule inside a media block that matches is the rule
    // that decides the size. Walking only the top level finds almost nothing.
    const walk = (ruleList) => {
      for (const rule of ruleList) {
        // Chrome gives EVERY style rule an empty `cssRules` (CSS nesting),
        // so `rule.cssRules` alone cannot tell a style rule from a group.
        // A rule with a selector and a style IS the style rule; only a rule
        // with neither is a group to descend into.
        if (rule.selectorText && rule.style && rule.style.fontSize) {
          const sel = rule.selectorText;
          let els = [];
          try {
            els = [...document.querySelectorAll(sel)];
          } catch {
            continue;
          }
          // Only elements that OWN text, and are actually rendered.
          const own = els.filter((e) => {
            const cs = getComputedStyle(e);
            if (cs.visibility === "hidden" || cs.display === "none") return false;
            const r = e.getBoundingClientRect();
            if (!r.width || !r.height) return false;
            return [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          });
          if (!own.length) continue;
          const sizes = [...new Set(own.map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize) * 2) / 2))];
          out.push({
            sel,
            declared: rule.style.fontSize,
            sizes,
            n: own.length,
            sample: own[0].tagName.toLowerCase() + "." + String(own[0].className || "").split(" ").filter(Boolean)[0]
          });
          continue;
        }
        if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin
      }
      if (rules) walk(rules);
    }
    return out;
  });

  for (const r of rows) {
    const key = r.sel.replace(/\s+/g, " ");
    if (!seen.has(key)) seen.set(key, { sel: r.sel, declared: r.declared, routes: new Set(), sizes: new Set(), n: 0, sample: r.sample });
    const e = seen.get(key);
    e.routes.add(route);
    r.sizes.forEach((s) => e.sizes.add(s));
    e.n = Math.max(e.n, r.n);
    if (e.declared !== r.declared) e.declared += ` / ${r.declared}`;
  }
}

const conflicts = [...seen.values()].filter((e) => e.routes.size > 1);
const single = [...seen.values()].filter((e) => e.routes.size === 1);

console.log(`\n=== rules that set a font-size and match text — ${seen.size} total`);
console.log(`    ${single.length} on one route, ${conflicts.length} shared across routes\n`);

for (const route of ROUTES) {
  console.log(`\n--- ${route} ---`);
  const rows = [...seen.values()]
    .filter((e) => e.routes.has(route))
    .sort((a, b) => a.sizes[0] - b.sizes[0]);
  for (const e of rows) {
    const share = e.routes.size > 1 ? `  [SHARED: ${[...e.routes].join(", ")}]` : "";
    console.log(
      `  ${String([...e.sizes].join("/")).padStart(12)}px  ${String(e.n).padStart(3)}×  ${e.sel.slice(0, 72)}${share}`
    );
  }
}

await b.close();
