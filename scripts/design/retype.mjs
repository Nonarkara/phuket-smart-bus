#!/usr/bin/env node
/**
 * Collapse a surface's type ramp onto its scale.
 *
 * THE ALGORITHM
 *   A surface declares a scale: a list of token names with the size each one
 *   is set to. Every `font-size` in that surface's rules is replaced by the
 *   token whose BAND contains the size that declaration renders at.
 *
 *   The bands are (next_lower, token_value]. So a declaration that already
 *   sits on a step keeps it, and a declaration between two steps moves UP to
 *   the lower of the two. The mapping is monotonic by construction: a bigger
 *   size never lands on a smaller step than a smaller size does. Merging
 *   downwards keeps the top of each band, which is what preserves hierarchy.
 *
 * WHY IT IS A TOOL AND NOT A FIND-REPLACE
 *   A literal `font-size` hides the size it renders at: `clamp()` depends on
 *   the viewport, `rem` on the root, `em` on the parent. The ramp was 37
 *   distinct values in src/styles.css alone and no two of them were the same
 *   role. Collapsing it by eye, from the source, produces a page that still
 *   breaks the rule — which is what "collapsing it by eye" means.
 *
 * USAGE
 *   node scripts/design/retype.mjs --file src/styles.css --group v2 \
 *        --scale display=30px,hero=24px,figure=20px,title=18px,body=15px,label=14px,micro=13px
 *
 *   --file    the stylesheet to rewrite
 *   --group   only rewrite rules whose selector's first class starts with
 *             this prefix (so one stylesheet can carry several surfaces)
 *   --scale   the token names and their sizes, comma separated, DESCENDING
 *   --width   the viewport to evaluate fluid sizes at (default 1440)
 *   --dry     report the changes without writing
 *   --emit    also print the CSS block that declares the scale
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const file = opt("file");
const group = opt("group", null);
const width = Number(opt("width", 1440));
const dry = has("dry");
const emit = has("emit");

/**
 * An explicit table for PARENT-RELATIVE sizes.
 *
 * `em` cannot be evaluated from the stylesheet alone — it needs its parent's
 * size. The two fleet stylesheets are built entirely in `em`, so they are
 * mapped by an explicit table: the ratio, and the step it belongs to. The
 * table is written from the RENDERED sizes, measured in the browser, so it
 * is a statement about what the page shows, not about what the source says.
 *
 *   --em "0.65em=micro,0.8em=label,1em=body"
 */
const EM_TABLE = new Map(
  opt("em", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [ratio, token] = s.split("=");
      return [ratio.trim(), token.trim()];
    })
);

if (!file) {
  console.error("error: --file is required");
  process.exit(1);
}

// ── the scale ────────────────────────────────────────────────────────────────
const scale = opt("scale", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [name, size] = s.split("=");
    return { name: name.trim(), size: parseFloat(size), raw: size.trim() };
  });
if (!scale.length) {
  console.error("error: --scale is required, e.g. display=30px,body=15px");
  process.exit(1);
}
// The scale must be given DESCENDING: the first entry is the top band.
for (let i = 1; i < scale.length; i++) {
  if (scale[i].size >= scale[i - 1].size) {
    console.error(`error: the scale must descend — ${scale[i].name} (${scale[i].size}) is not below ${scale[i - 1].name} (${scale[i - 1].size})`);
    process.exit(1);
  }
}

// ── css parsing ──────────────────────────────────────────────────────────────
/**
 * Leaf rules with the offsets of their BODY in the original text, so the
 * file can be rebuilt from the original bytes with only the changed ranges
 * replaced.
 *
 * A stylesheet is a TREE: a @media block holds style rules inside it, and a
 * rule inside a media block is a real rule that decides a real size. A flat
 * scan sees the @media block as one rule and misses everything inside it.
 */
function rules(text) {
  const out = [];

  const findClose = (s, open) => {
    let depth = 0;
    for (let i = open; i < s.length; i++) {
      if (s[i] === "/" && s[i + 1] === "*") {
        const close = s.indexOf("*/", i + 2);
        i = close === -1 ? s.length : close + 1;
        continue;
      }
      if (s[i] === "{") depth++;
      else if (s[i] === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  };

  const parse = (start, end) => {
    let i = start;
    while (i < end) {
      if (text[i] === "/" && text[i + 1] === "*") {
        const close = text.indexOf("*/", i + 2);
        i = close === -1 ? end : close + 2;
        continue;
      }
      const open = text.indexOf("{", i);
      if (open === -1 || open >= end) return;
      const close = findClose(text, open);
      if (close === -1) return;
      const prelude = text.slice(i, open).trim();
      if (prelude.startsWith("@")) {
        // An at-rule with a block may hold style rules, and may nest more
        // at-rules. Descend into it.
        parse(open + 1, close);
      } else {
        out.push({ selector: prelude, body: text.slice(open + 1, close), start: open + 1, end: close });
      }
      i = close + 1;
    }
  };

  parse(0, text.length);
  return out;
}

const len = (v, w) => {
  if (v.endsWith("rem")) return parseFloat(v) * 16;
  if (v.endsWith("px")) return parseFloat(v);
  if (v.endsWith("vw")) return (parseFloat(v) / 100) * w;
  return null;
};

/** The size a font-size value RENDERS at, or null when it is parent-relative. */
function evalSize(value, w) {
  const v = value.trim().replace(/\s*!important$/, "");
  if (/^clamp\(/i.test(v)) {
    const inner = v.slice(6, v.lastIndexOf(")"));
    const parts = inner.split(",").map((s) => s.trim());
    if (parts.length < 3) return null;
    const lo = len(parts[0], w);
    const mid = len(parts[1], w);
    const hi = len(parts[2], w);
    if (lo === null || mid === null || hi === null) return null;
    return Math.min(Math.max(mid, lo), hi);
  }
  return len(v, w);
}

/**
 * The token whose band contains the size.
 *
 * The scale is given DESCENDING, so the band of a step is (next_lower,
 * step_value]. Walking the scale from its SMALLEST entry upwards, the first
 * step whose value is >= the size is the one whose band holds it.
 *
 * A size ABOVE the top of the scale belongs to the TOP step — it is the
 * biggest thing on the surface, and mapping it to the smallest step is how a
 * 52px hero figure ends up at 13px.
 */
function tokenFor(size) {
  if (size > scale[0].size) return scale[0];
  for (let i = scale.length - 1; i >= 0; i--) {
    if (size <= scale[i].size) return scale[i];
  }
  return scale[scale.length - 1]; // below the floor: the smallest step
}

const SKIP = new Set(
  opt("skip", "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
);

const inGroup = (selector) => {
  for (const s of SKIP) if (selector.includes(s)) return false;
  if (!group) return true;
  const m = selector.match(/\.([a-zA-Z][\w-]*)/);
  if (!m) return false;
  return m[1].startsWith(group);
};

/**
 * The size inside a `font:` shorthand, or null.
 *
 * A shorthand that carries a var() cannot be expanded at parse time, so the
 * CSSOM leaves fontSize empty and only `style.font` holds the string. 95
 * rules in src/styles.css are written that way, and every one of them was
 * invisible to a tool that only asked for fontSize — which is how a ramp
 * hides 95 of its own sizes.
 *
 * The size is the length that sits immediately before the line-height ("/…")
 * or before the family. Taking the FIRST length in the string is wrong: in
 * `font: 700 clamp(0.95rem, 1.8vw, 1.3rem)/1.1 …` the first length is the
 * clamp's FLOOR, not the size that renders.
 */
function shorthandSize(value) {
  const v = value.trim();
  const slash = v.indexOf("/");
  const head = slash === -1 ? v : v.slice(0, slash);
  const m = head.match(/(clamp\([^)]*\)|\d+(?:\.\d+)?(?:px|rem|em|vw|%)?)\s*$/);
  if (!m) return null;
  const raw = m[1];
  if (!raw) return null;
  const index = head.length - m[0].length;
  return { raw, index, length: raw.length };
};

// ── rewrite ──────────────────────────────────────────────────────────────────
const text = readFileSync(file, "utf8");
let changed = 0;
let skipped = 0;
const perValue = new Map();
const edits = [];

for (const r of rules(text)) {
  if (!inGroup(r.selector)) continue;
  let body = r.body.replace(/font-size:\s*([^;}]+)/g, (full, value) => {
    const decl = value.trim();
    const important = /!important/.test(decl) ? " !important" : "";
    const bare = decl.replace(/\s*!important$/, "").trim();
    if (/^var\(/.test(bare)) return full; // already a token
    if (EM_TABLE.has(bare)) {
      const name = EM_TABLE.get(bare);
      changed++;
      perValue.set(`${bare} → ${name} (table)`, (perValue.get(`${bare} → ${name} (table)`) || 0) + 1);
      return `font-size: var(--t-${name})${important}`;
    }
    const size = evalSize(bare, width);
    if (size === null) {
      skipped++;
      perValue.set(bare, (perValue.get(bare) || 0) + 1);
      return full;
    }
    const step = tokenFor(size);
    changed++;
    const key = `${bare} → ${step.name} (${step.size}px)${Math.abs(step.size - size) < 0.01 ? "  (same size, now a token)" : ""}`;
    perValue.set(key, (perValue.get(key) || 0) + 1);
    return `font-size: var(--t-${step.name})${important}`;
  });

  // The `font:` shorthand carries a size too, and the CSSOM cannot expand it
  // when the family is a var(). Replace the size INSIDE the shorthand.
  body = body.replace(/font:\s*([^;}]+)/g, (full, value) => {
    const decl = value.trim();
    if (/!important/.test(decl)) return full;
    const hit = shorthandSize(decl);
    if (!hit) return full;
    if (EM_TABLE.has(hit.raw)) {
      const name = EM_TABLE.get(hit.raw);
      changed++;
      perValue.set(`font ${hit.raw} → ${name} (table)`, (perValue.get(`font ${hit.raw} → ${name} (table)`) || 0) + 1);
      const replaced = decl.slice(0, hit.index) + `var(--t-${name})` + decl.slice(hit.index + hit.length);
      return `font: ${replaced}`;
    }
    const size = evalSize(hit.raw, width);
    if (size === null) {
      skipped++;
      perValue.set(`font ${hit.raw}`, (perValue.get(`font ${hit.raw}`) || 0) + 1);
      return full;
    }
    const step = tokenFor(size);
    changed++;
    const key = `font ${hit.raw} → ${step.name} (${step.size}px)${Math.abs(step.size - size) < 0.01 ? "  (same size, now a token)" : ""}`;
    perValue.set(key, (perValue.get(key) || 0) + 1);
    const replaced = decl.slice(0, hit.index) + `var(--t-${step.name})` + decl.slice(hit.index + hit.length);
    return `font: ${replaced}`;
  });

  if (body !== r.body) edits.push({ start: r.start, end: r.end, body });
}

// Rebuild from the original bytes, replacing only the changed rule bodies.
let out = "";
let cursor = 0;
for (const e of edits) {
  out += text.slice(cursor, e.start) + e.body;
  cursor = e.end;
}
out += text.slice(cursor);

console.log(`${file} · group ${group || "(all)"} · viewport ${width}`);
console.log(`  ${changed} declaration(s) changed, ${skipped} left alone (parent-relative)`);
const rows = [...perValue.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, n] of rows) console.log(`    ${String(n).padStart(3)} × ${k}`);

if (emit) {
  console.log("\n  /* the scale */");
  for (const s of scale) console.log(`  --t-${s.name}: ${s.raw};`);
}

if (!dry && changed > 0) {
  writeFileSync(file, out);
  console.log(`\n  written to ${file}`);
}
