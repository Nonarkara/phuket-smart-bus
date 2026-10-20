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
 * THE BLIND SPOT THIS VERSION CLOSES
 *   The second version read the rule's size out of `rule.style.fontSize ||
 *   rule.style.font`. Chrome cannot expand a shorthand that contains a var():
 *
 *     font: 500 var(--t-hero)/1.05 var(--font-display);
 *
 *   is stored with every longhand carrying a pending substitution, so
 *   `fontSize` reads "", `font` reads "", and the property list shows
 *   `font-size = ` — present, empty. The rule looked like it declared no size
 *   at all. This codebase writes its type in the shorthand form EVERYWHERE, so
 *   the probe was blind to most of the stylesheet — and blind in the quiet
 *   direction: it reported "clean" on /study and /capacity, whose figures it
 *   had just listed as off-scale.
 *
 *   The fix is not to parse the text (the cascade is the browser's job and it
 *   does it correctly). The fix is to read the SIGNAL: a rule that lists a
 *   `font-size` property whose value reads empty is a rule whose size came
 *   from a var(). Chrome has told us it is token-derived; it just cannot tell
 *   us which token, and for this question it does not need to.
 *
 * WHAT THE SCALE IS
 *   Two sets, unioned:
 *     · the sizes TOKEN-RULED elements render at — a fluid step is measured at
 *       the size it renders, not at the floor of its clamp();
 *     · the values the scope DECLARES — a token may be declared and not used
 *       on this page, and a size the scale names is still a size the scale
 *       names.
 *   A scope counts as a scale only if at least four of the eight names resolve
 *   on it: the legacy `:root` block carries three, and those three must not
 *   launder a literal 14px anywhere on the site.
 *
 *   A surface with no token-ruled text has no scale and is not judged: the
 *   legacy tourist chain is on literal sizes and the ≤8 law governs it.
 *
 * THIRD-PARTY MAP CHROME
 *   Leaflet's own controls (the zoom buttons) are excluded. Leaflet is a
 *   third-party library and its control is sized for every map on the site,
 *   not for one surface's scale — the same treatment Leaflet's attribution
 *   blue already gets in STYLE.md. The count of excluded elements is PRINTED
 *   so the exclusion is visible rather than silent.
 *
 *   node scripts/design/offscale.mjs /fleet/raw /fleet --base https://bus.nonarkara.org
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const BASE = bi === -1 ? "http://127.0.0.1:4173" : args[bi + 1];
const BASE_ARG = bi === -1 ? -1 : bi + 1;
const ROUTES = args.filter((a, i) => !a.startsWith("--") && i !== BASE_ARG);

if (!ROUTES.length) {
  console.error("offscale: no routes given. An instrument that checks nothing is decoration.");
  console.error("  usage: node scripts/design/offscale.mjs <route> [<route>…] [--base <url>]");
  process.exit(2);
}

const NAMES = ["--t-display", "--t-hero", "--t-figure", "--t-title", "--t-lead", "--t-body", "--t-label", "--t-micro"];

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();

let totalOff = 0;

for (const route of ROUTES) {
  await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
  await p.waitForTimeout(6000);

  const res = await p.evaluate((NAMES) => {
    // ── collect every rule that could decide a size, in cascade order ───────
    const decls = [];
    let order = 0;

    // A selector LIST is not one selector. `button, input, a` is three
    // selectors of specificity (0,0,1) each; reading it as one selector
    // summed its type counts and made it look stronger than it is, which
    // changed which rule won and which leak was found.
    const splitList = (sel) => {
      const out = [];
      let buf = "", depth = 0, quote = null;
      for (const ch of sel) {
        if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
        if (ch === "(" || ch === "[") depth++;
        else if (ch === ")" || ch === "]") depth--;
        if (ch === "," && depth === 0) { out.push(buf); buf = ""; continue; }
        buf += ch;
      }
      out.push(buf);
      return out.map((s) => s.trim()).filter(Boolean);
    };

    const specificity = (sel) => {
      // id ×10000, class/attr/pseudo-class ×100, type/pseudo-element ×1.
      // :where() contributes nothing. The list's strongest member wins.
      let best = 0;
      for (const part of splitList(sel)) {
        const bare = part.replace(/:where\([^)]*\)/g, " ");
        const ids = (bare.match(/#[A-Za-z0-9_-]+/g) || []).length;
        const cls = (bare.match(/\.[A-Za-z0-9_-]+|\[[^\]]*\]|:(?!:)[A-Za-z-]+/g) || []).length;
        const typ = (bare.match(/(^|[\s>+~])([a-z][A-Za-z0-9]*)/gi) || []).length;
        best = Math.max(best, ids * 10000 + cls * 100 + typ);
      }
      return best;
    };

    /** Does this declaration decide a font-size, and is it token-derived? */
    const sizeOf = (st) => {
      const v = st.getPropertyValue("font-size");
      if (v) return { declared: true, isToken: /var\(\s*--t-/.test(v), value: v };
      // Present but EMPTY means Chrome holds a pending substitution: the size
      // came from a var() and the CSSOM cannot expand it. That is the case
      // the old probe missed, and it is most of this stylesheet.
      for (let i = 0; i < st.length; i++) {
        if (st.item(i) === "font-size") return { declared: true, isToken: true, value: "<shorthand var()>" };
      }
      return { declared: false, isToken: false, value: "" };
    };

    const walk = (list) => {
      for (const rule of list) {
        if (rule.selectorText && rule.style) {
          const st = rule.style;
          const s = sizeOf(st);
          if (s.declared) {
            decls.push({
              selector: rule.selectorText,
              spec: specificity(rule.selectorText),
              order: order++,
              important: st.getPropertyPriority("font-size") === "important" || /!important/.test(s.value),
              isToken: s.isToken,
              value: s.value,
            });
          }
        } else if (rule.cssRules) {
          walk(rule.cssRules);
        }
      }
    };

    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      walk(rules);
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

    const all = [];
    for (const el of document.querySelectorAll("*")) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;

      let win = null;
      for (const d of decls) {
        if (!matches(el, d.selector)) continue;
        if (!win) { win = d; continue; }
        const better =
          (d.important && !win.important) ||
          (d.important === win.important && (d.spec > win.spec || (d.spec === win.spec && d.order > win.order)));
        if (better) win = d;
      }

      // The scale this element's scope declares. A scope counts only when at
      // least four of the eight names resolve on it.
      const cs = s;
      const values = [];
      for (const n of NAMES) {
        const raw = cs.getPropertyValue(n).trim();
        if (raw) values.push({ name: n, raw });
      }
      const declared = values.length >= 4 ? values : [];

      all.push({
        el,
        size: parseFloat(s.fontSize),
        win,
        declared,
        own: [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0),
        chrome: !!el.closest(".leaflet-control-zoom, .leaflet-control-attribution"),
        path: path(el),
        text: (el.textContent || "").trim().slice(0, 46),
      });
    }

    // ── the scale ───────────────────────────────────────────────────────────
    const scale = new Set();
    for (const e of all) if (e.win && e.win.isToken) scale.add(e.size);
    let tokenRuled = 0;
    for (const e of all) if (e.win && e.win.isToken) tokenRuled++;
    for (const e of all) {
      for (const v of e.declared) {
        const m = /^(-?[\d.]+)px$/.exec(v.raw);
        if (m) scale.add(parseFloat(m[1]));
      }
    }

    const off = [];
    let chrome = 0;
    for (const e of all) {
      if (!e.own) continue;
      if (e.chrome) { chrome++; continue; }
      if (!scale.has(e.size)) off.push(e);
    }

    const sizes = [...new Set(all.filter((e) => e.own).map((e) => e.size))].sort((a, b) => a - b);
    const onScale = sizes.filter((s) => scale.has(s)).length;

    return {
      scale: [...scale].sort((a, b) => a - b),
      sizes,
      onScale,
      off,
      chrome,
    };
  }, NAMES);

  console.log(`\n=== ${BASE}${route} ===`);
  // A surface is judged only when its TYPE is on the token system. The legacy
  // tourist chain (the rider app, the welcome sheet, the driver tablet) is on
  // literal sizes and is governed by the ≤8 law instead.
  //
  // The test is over DISTINCT SIZES, not elements: most elements on a
  // console surface inherit their size from a token-ruled ancestor rather
  // than declaring one, so counting elements said "not on the token system"
  // about /fleet — a surface that is on it — and would have hidden the very
  // leak the probe exists to find.
  const judged = res.onScale * 2 >= res.sizes.length && res.sizes.length > 0;
  if (!judged) {
    console.log(`scale:   (not applied — only ${res.onScale} of ${res.sizes.length} distinct sizes are on a token system)`);
    console.log(`rendered: ${res.sizes.join(", ")}  (${res.sizes.length} distinct)`);
    console.log(`OFF-SCALE: not judged — this surface is on the literal system.`);
    if (res.chrome) console.log(`(map chrome excluded: ${res.chrome} element(s))`);
    continue;
  }
  console.log(`scale:   ${res.scale.join(", ")}`);
  console.log(`rendered: ${res.sizes.join(", ")}  (${res.sizes.length} distinct)`);
  const grouped = new Map();
  for (const o of res.off) {
    const k = `${o.size}px  ${o.path}${o.win ? `   [rule: ${o.win.selector} → ${o.win.value}]` : "   [inherited — no rule declares a size]"}`;
    if (!grouped.has(k)) grouped.set(k, o);
  }
  if (!grouped.size) {
    console.log(`OFF-SCALE: none — every rendered size is a size the scale names.`);
  } else {
    console.log(`OFF-SCALE: ${res.off.length} elements in ${grouped.size} groups`);
    for (const [k, o] of [...grouped.entries()].sort()) {
      console.log(`  ${k}  — "${o.text}"`);
    }
  }
  if (res.chrome) console.log(`(map chrome excluded: ${res.chrome} element(s))`);
  totalOff += res.off.length;
}

await b.close();
console.log(`\ntotal off-scale elements: ${totalOff}`);
process.exit(totalOff ? 1 : 0);
