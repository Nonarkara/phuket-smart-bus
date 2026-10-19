// Type-system transform.
//
// RULE (evidence-based, see STYLE.md):
//   • The display face (Josefin Sans) is a display face. It belongs to
//     headline-size type and nothing else.
//   • Display face at < 18px          -> body face (Source Sans 3) 700
//   • Display face at 18–39px         -> display face, weight <= 500
//   • Display face at >= 40px         -> 600/700/800 allowed
//   • All-caps tracked micro-labels   -> body face, always
//   • Weight 600+ in the display face fills the counters and reads as a
//     blob below 40px. That blob IS the "fat ugly font" the user saw.
//
// Every edit below is scoped to one selector. A selector that does not match
// exactly, or matches twice, is a hard failure — no silent no-ops.

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;

/** Locate `<selector> { ... }` and return [start, end) of the whole rule. */
function findRule(src, selector, anchor, allowNested) {
  const needle = selector.replace(/\s+/g, " ").trim();
  let from = 0;
  const hits = [];
  for (;;) {
    const i = src.indexOf(needle, from);
    if (i < 0) break;
    // Must be a selector boundary: preceded by start-of-file / newline / "}" /
    // whitespace, and followed by optional whitespace then "{".
    const before = src.slice(0, i).trimEnd();
    const after = src.slice(i + needle.length);
    const okBefore = before === "" || /[}\n;]$/.test(before);
    // Top-level only: the rule must start in column 0. A rule nested in an
    // @media block is indented, and a same-named media override must never be
    // mistaken for the rule we meant to rewrite.
    const atColumn0 = allowNested || i === 0 || src[i - 1] === "\n";
    const m = after.match(/^\s*\{/);
    if (okBefore && atColumn0 && m) {
      if (anchor) {
        // The rule must sit immediately after this exact preceding rule.
        const beforeSlice = src.slice(Math.max(0, i - anchor.length - 4), i);
        if (!beforeSlice.trimEnd().endsWith(anchor)) {
          from = i + needle.length;
          continue;
        }
      }
      const open = i + needle.length + m[0].length;
      // walk to the matching close brace
      let depth = 1;
      let j = open;
      while (j < src.length && depth > 0) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
        j++;
      }
      hits.push([i, open - 1, j - 1]);
    }
    from = i + needle.length;
  }
  if (hits.length === 0) throw new Error(`RULE NOT FOUND: ${needle}`);
  if (hits.length > 1) throw new Error(`RULE AMBIGUOUS (${hits.length}x): ${needle}`);
  return hits[0];
}

const FILES = [
  "src/styles.css",
  "src/components/passenger/PassengerApp.css",
  "src/components/toolkit/toolkit-showcase.css",
  "src/components/toolkit/toolkit-hub.css",
  "src/components/toolkit/toolkit-study.css",
];

// Idempotence: start every run from the committed state, so the script can be
// re-run after a partial failure without compounding edits.
execFileSync("git", ["checkout", "--", ...FILES], { cwd: ROOT, stdio: "inherit" });

function apply(file, edits) {
  const path = ROOT + file;
  let src = fs.readFileSync(path, "utf8");
  // Apply from the bottom up so earlier offsets stay valid.
  const located = edits.map((e) => {
    const [selStart, open, close] = findRule(src, e.selector, e.anchor, e.allowNested);
    const body = src.slice(open + 1, close);
    const next = e.fn(body);
    if (next === body) throw new Error(`NO-OP EDIT: ${file} :: ${e.selector}`);
    return { selStart, open, close, next, label: e.selector };
  });
  located.sort((a, b) => b.selStart - a.selStart);
  for (const l of located) {
    // Rewrite ONLY the declaration block; the selector and the braces stay.
    src = src.slice(0, l.open + 1) + l.next + src.slice(l.close);
  }
  fs.writeFileSync(path, src);
  console.log(`${file}: ${located.length} rules rewritten`);
}

/* ── helpers ─────────────────────────────────────────────────────────── */

// add a weight declaration to a rule that has none
const addWeight = (w) => (body) => ` font-weight: ${w};` + body;

// display -> body face, keep the weight
const toBody = (body) => body.replace(/var\(--font-display\)/g, "var(--font-body)");

// shorthand: "700 32px/1.05 var(--font-display)" -> "500 32px/1.05 var(--font-display)"
const weightIn = (body, from, to) => {
  const re = new RegExp(`(^|[;{\\s])${from}(?=[\\s;/]|$)`);
  if (!re.test(body)) throw new Error(`weight ${from} not found in: ${body.trim()}`);
  return body.replace(re, `$1${to}`);
};

/* ── 1. src/styles.css ────────────────────────────────────────────────── */

apply("src/styles.css", [
  // — desktop rider chrome: 11–14px labels. Body face, body weight.
  { selector: ".desktop-rider__brand-mark", fn: (b) => toBody(weightIn(b, "800", "700")) },
  { selector: ".desktop-rider__brand-text strong", fn: toBody },
  { selector: ".desktop-rider__nav a", fn: toBody },

  // — ops brand lockup: a 14px tracked label, not a display word
  { selector: ".ops__brand h1", fn: toBody },

  // — all-caps micro-labels. Josefin at 11px uppercase is where the
  //   high-contrast deco turns to mud. Body face, and the tracking stays
  //   because the caps still need the air.
  { selector: ".v2-header__eyebrow", fn: toBody },
  { selector: ".v2-panel__title", fn: toBody },
  { selector: ".v2-regions__title", fn: toBody },
  { selector: ".v2-hourly__title", fn: toBody },
  { selector: ".v2-schedule__title", fn: toBody },
  { selector: ".v2-flights__eyebrow", fn: toBody },
  { selector: ".v2-whatif__title", fn: toBody },
  { selector: ".v2-impact__title", fn: toBody },
  { selector: ".v2-destinations__title", fn: toBody },
  { selector: ".v2-mode-btn", anchor: ".v2-mode-toggle { display: inline-flex; border-radius: 0; overflow: hidden; }", fn: toBody },
  { selector: ".v2-fleet__eyebrow", fn: toBody },
  { selector: ".v2-insights__eyebrow", fn: toBody },
  { selector: ".capacity-gap__title", fn: toBody },
  { selector: ".line-pnl__title", fn: toBody },

  // — the ops wall title, 32px. Was 700: the blob.
  { selector: ".v2-header h1", fn: (b) => b.replace("font-weight: 700", "font-weight: 500") },

  // — 26px clock in the story rail
  { selector: ".v2 .v2-header__time", anchor: ".v2 .v2-header__day { color: var(--ax-ink-3); }", fn: (b) => weightIn(b, "700", "500") },

  // — the ops wall hero figure. It is the one 52px number on the wall and it
  //   must be the display face at 500, like every other hero figure here.
  { selector: ".v2-headline__value", fn: (b) => " font-family: var(--font-display); font-weight: 500;" + b },

  // — study KPIs: 32px / 36px figures, were 700
  { selector: ".study__kpi-value", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".study__now-value", fn: (b) => weightIn(b, "700", "500") },

  // — capacity console
  { selector: ".capacity__time", fn: (b) => weightIn(b, "700", "500") },
  // A trailing longhand overrode the shorthand's weight. The longhand goes.
  { selector: ".capacity__section-head h2", fn: (b) => b.replace(" font-weight: 600;", "") },
  // A <strong> inside 36px display-face prose inherits the display face, so
  // 700 there is the blob again.
  { selector: ".capacity__story-text strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".capacity__action-num", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".capacity__action-hour", fn: (b) => weightIn(b, "700", "500") },
]);

/* ── 2. PassengerApp.css — the rider's phone ─────────────────────────── */

apply("src/components/passenger/PassengerApp.css", [
  // 12.5px and 16px wordmarks -> body face
  { selector: ".pa-header__logo", fn: toBody },
  { selector: ".pa-header__name", fn: toBody },
  { selector: ".pa-portal-header__name", allowNested: true, fn: toBody },

  // THE headline of the rider app. 25.6px in Josefin Bold was the blob the
  // user screenshotted. Display face, weight 500.
  { selector: ".pa-live__head h2", fn: addWeight(500) },
  { selector: ".pa-flights h2", fn: addWeight(500) },
  { selector: ".pa-form__title", fn: addWeight(500) },
  { selector: ".pa-ticket__title", fn: addWeight(500) },

  // price + brand stripe
  { selector: ".pa-card__price", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".pa-stripe__brand span", fn: (b) => weightIn(b, "700", "500") },

  // 16.8px promise heading -> body face
  { selector: ".pa-promise h2", fn: toBody },
]);

/* ── 3. toolkit-showcase.css ─────────────────────────────────────────── */

apply("src/components/toolkit/toolkit-showcase.css", [
  // h3 clamps to 23.2–32px; the shared h1/h2/h3 rule set it at 700.
  { selector: ".toolkit-site h3", fn: addWeight(500) },

  { selector: ".tk-hero__photo figcaption strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-hero__note strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-brief__evidence article > strong", fn: (b) => weightIn(b, "700", "500") },
  // .tk-thesis p and .tk-abcdef__flow keep 700: 54px+ editorial wall of type.
  { selector: ".tk-abcdef__extensions article > span", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-abcdef__extensions article > strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-research > summary strong", fn: (b) => toBody(weightIn(b, "700", "700")) },
  { selector: ".tk-research-cards h4", fn: (b) => toBody(weightIn(b, "700", "700")) },
  { selector: ".tk-program__spine strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-program__timeline article > div:first-child strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-program__people-intro strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-chain__node strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-proof__cta strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-causality__bad strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-value-ledger strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-ecosystem__lesson strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-final a", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".vc-figure figcaption strong", fn: addWeight(500) },
  { selector: ".vc-compare__side h3", fn: addWeight(500) },
  { selector: ".lp-hero__stats strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".lp-handover__chapters strong", fn: (b) => toBody(b) },
  { selector: ".abc-results__hour-label", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".abc-results__cell strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".abc-results__totals strong", fn: (b) => weightIn(b, "700", "500") },
]);

/* ── 4. toolkit-hub.css ──────────────────────────────────────────────── */

apply("src/components/toolkit/toolkit-hub.css", [
  { selector: ".hub-nav__title-group strong", fn: (b) => toBody(b) },
  { selector: ".hub-tab-nav strong", fn: (b) => toBody(b) },
  { selector: ".fc-stats strong, .pb-stats strong, .cr-stats strong, .lf-stats strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".pb-subhead, .cr-subhead, .lf-subhead, .rt-subhead", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".fc-station__verb", fn: (b) => toBody(b) },
  { selector: ".fc-team h4", fn: (b) => toBody(b) },
  { selector: ".pb-operator header h4", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".pb-route-compare strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".pc-hero__stats strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".pc-figure figcaption strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".cr-limit h4", fn: (b) => toBody(b) },
]);

/* ── 5. toolkit-study.css ────────────────────────────────────────────── */

apply("src/components/toolkit/toolkit-study.css", [
  { selector: ".tk-try-system__door strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-live-console > footer strong", fn: (b) => toBody(b) },
  { selector: ".tk-machine__handoff strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-evidence-ladder__verdict strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-whatif__story strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-credit-memo header strong", fn: (b) => weightIn(b, "700", "500") },
  { selector: ".tk-delivery-plan strong", fn: (b) => weightIn(b, "700", "500") },
]);

/* ── 6. The root element carries the family ──────────────────────────── */

{
  const path = ROOT + "src/styles.css";
  let src = fs.readFileSync(path, "utf8");
  const MARK = "html {\n  font-family: var(--font-body);";
  if (!src.includes(MARK)) {
    const anchor = "body {\n  margin: 0;";
    if (!src.includes(anchor)) throw new Error("body anchor not found in styles.css");
    const rule = `/* The type family is set on the ROOT, not on body. A body-level
   declaration leaves <html> itself on the UA default — which is Times New Roman,
   and a 16px Times is exactly the "unstyled" signal that makes a product look
   unfinished. Anything that inherits from the root (a portal-rendered node, a
   ::before on html, a UA-injected element) now gets the product face. */
html {
  font-family: var(--font-body);
  font-size: 17px;
  -webkit-font-smoothing: antialiased;
}

`;
    src = src.replace(anchor, rule + anchor);
    fs.writeFileSync(path, src);
    console.log("src/styles.css: root font rule added");
  }
}

console.log("\nType transform complete.");