#!/usr/bin/env node
/**
 * Is every rendered font-size on the surface's scale?
 *
 * WHY THIS EXISTS
 *   The type-scale contract says: every font-size a surface renders is one of
 *   its eight tokens. That is only checkable if you compare RENDERED sizes to
 *   sizes that a token actually PRODUCES.
 *
 *   The first version of this probe parsed the token declarations instead —
 *   and got it wrong in both directions. It read a fluid step
 *   (`clamp(48px, 7.5vw, 108px)`) at its floor, so the toolkit's 108px hero
 *   looked like a size no token named; and it read a token's DECLARED value,
 *   so a surface whose tokens it could not resolve looked empty.
 *
 *   So: resolve tokens by USAGE. For every element that owns text, find the
 *   rule that actually decides its size (cascade order, specificity, !important),
 *   and note whether that decision names a token. The sizes those token-ruled
 *   elements RENDER at are the scale. Every other rendered size is off it.
 *
 *   An element that inherits its size is fine when its parent is token-ruled —
 *   the size is the same one. It is a leak when the inherited size came from a
 *   root that is not a type size: /fleet/raw's root is a fluid em unit, and
 *   every table cell inherited 16.94px from it — a ninth size the page did not
 *   admit to.
 *
 *   node scripts/design/offscale.mjs /fleet/raw --base https://bus.nonarkara.org
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

let totalOff = 0;

for (const route of ROUTES) {
  await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
  await p.waitForTimeout(6000);

  const res = await p.evaluate(() => {
    // ── collect every rule that could decide a size, in cascade order ───────
    const decls = []; // { selector, spec, order, important, isToken, value }
    let order = 0;

    const specificity = (sel) => {
      // Rough but sufficient: id count, class/attr/pseudo-class count, type count.
      const s = sel.replace(/\\./g, "");
      const ids = (s.match(/#[\w-]+/g) || []).length;
      const cls = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) || []).length;
      const typ = (s.match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length;
      return ids * 10000 + cls * 100 + typ;
    };

    const walk = (list, inMedia) => {
      for (const rule of list) {
        if (rule.selectorText && rule.style) {
          const st = rule.style;
          let value = null;
          let isToken = false;
          if (st.fontSize) {
            value = st.fontSize;
            isToken = /var\(\s*--t-/.test(value);
          } else if (st.font) {
            // A `font:` shorthand carrying a var() cannot be expanded by the
            // CSSOM, so fontSize is empty and only `font` holds the string.
            value = st.font;
            isToken = /var\(\s*--t-/.test(value);
          }
          if (value) {
            decls.push({
              selector: rule.selectorText,
              spec: specificity(rule.selectorText),
              order: order++,
              important: st.getPropertyPriority("font-size") === "important" || /!important/.test(value),
              isToken,
              value: value.trim(),
            });
          }
        } else if (rule.cssRules) {
          walk(rule.cssRules, rule.conditionText !== undefined);
        }
      }
    };

    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      walk(rules, false);
    }

    const matches = (el, sel) => {
      try { return el.matches(sel); } catch { return false; }
    };

    const path = (el) => {
      const bits = [];
      let n = el;
      while (n && n !== document.body && bits.length < 5) {
        let s = n.tagName.toLowerCase();
        if (typeof n.className === "string" && n.className.trim()) {
          s += "." + n.className.trim().split(/\s+/).slice(0, 3).join(".");
        }
        bits.unshift(s);
        n = n.parentElement;
      }
      return bits.join(" > ");
    };

    // ── walk the text ───────────────────────────────────────────────────────
    const elements = [];
    for (const el of document.querySelectorAll("*")) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (!own) continue;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;

      // the winning declaration
      let win = null;
      for (const d of decls) {
        if (!matches(el, d.selector)) continue;
        if (!win) { win = d; continue; }
        const better =
          (d.important && !win.important) ||
          (d.important === win.important && (d.spec > win.spec || (d.spec === win.spec && d.order > win.order)));
        if (better) win = d;
      }
      elements.push({ el, size: parseFloat(s.fontSize), win, path: path(el), text: (el.textContent || "").trim().slice(0, 46) });
    }

    // ── the scale is the set of sizes a TOKEN-RULED element renders at ─────
    const tokenSizes = new Set();
    for (const e of elements) if (e.win && e.win.isToken) tokenSizes.add(e.size);

    const off = elements.filter((e) => !tokenSizes.has(e.size));
    const sizes = new Set(elements.map((e) => e.size));

    return {
      tokenSizes: [...tokenSizes].sort((a, b) => b - a),
      sizes: [...sizes].sort((a, b) => b - a),
      off,
    };
  });

  console.log(`\n=== ${BASE}${route} ===`);
  console.log(`scale:   ${res.tokenSizes.length ? res.tokenSizes.join(", ") : "(no token-ruled text — this surface has no scale)"}`);
  console.log(`rendered: ${res.sizes.join(", ")}  (${res.sizes.length} distinct)`);
  const grouped = new Map();
  for (const o of res.off) {
    const k = `${o.size}px  ${o.path}${o.win ? `   [rule: ${o.win.selector} → ${o.win.value}]` : "   [inherited — no rule declares a size]"}`;
    if (!grouped.has(k)) grouped.set(k, o);
  }
  if (!grouped.size) {
    console.log(`OFF-SCALE: none — every rendered size is a token.`);
  } else {
    console.log(`OFF-SCALE: ${res.off.length} elements in ${grouped.size} groups`);
    for (const [k, o] of [...grouped.entries()].sort()) {
      console.log(`  ${k}  — "${o.text}"`);
    }
  }
  totalOff += res.off.length;
}

await b.close();
console.log(`\ntotal off-scale elements: ${totalOff}`);
process.exit(totalOff ? 1 : 0);
