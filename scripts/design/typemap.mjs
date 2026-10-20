#!/usr/bin/env node
/**
 * Map every font-size declaration in a stylesheet to the size it RENDERS at,
 * so a type ramp can be collapsed deliberately.
 *
 * WHY THIS EXISTS
 *   The house rule is ≤8 distinct rendered font sizes per page. The rendered
 *   size is not the declared size: a clamp() renders at whatever the
 *   viewport makes it, rem resolves against the root, and em resolves against
 *   the PARENT — which is why a stylesheet can look like it has six sizes and
 *   render as fifteen. Collapsing the ramp by eye, from the source, produces
 *   a page that still breaks the rule.
 *
 * HOW IT EVALUATES
 *   px        → the value
 *   rem       → value × 16 (the root is never given a font-size; see
 *               CLAUDE.md — rem therefore always resolves against 16px)
 *   clamp(a,b,c) → clamp(a, b@viewport, c) evaluated at the viewport width
 *   em        → reported as CONTEXT-DEPENDENT, with the value kept, because
 *               it needs its parent's size; a parent's own size change moves
 *               the child, so em rules are reviewed by hand
 *   %  / vw  → reported as CONTEXT-DEPENDENT
 *
 *   node scripts/design/typemap.mjs <file> [<file>…] [--width 1440]
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
let width = 1440;
const wi = args.indexOf("--width");
if (wi !== -1) {
  width = Number(args[wi + 1]);
  args.splice(wi, 2);
}
const files = args.length ? args : ["src/styles.css"];

/** Split a stylesheet into { selector, body } rules. */
function rules(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let depth = 0;
  let buf = "";
  let selector = "";
  for (const c of clean) {
    if (c === "{") {
      if (depth === 0) {
        selector = buf.trim();
        buf = "";
      } else buf += c;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        out.push({ selector, body: buf });
        buf = "";
        selector = "";
      } else buf += c;
    } else buf += c;
  }
  return out;
}

const len = (v) => (v.endsWith("rem") ? parseFloat(v) * 16 : v.endsWith("px") ? parseFloat(v) : null);

/** Evaluate a length at the given viewport width. */
function evalLen(v, w) {
  if (v.endsWith("rem")) return parseFloat(v) * 16;
  if (v.endsWith("px")) return parseFloat(v);
  if (v.endsWith("vw")) return (parseFloat(v) / 100) * w;
  if (v.endsWith("em")) return null; // parent-relative
  if (v.endsWith("%")) return null;
  return null;
}

/** Evaluate a font-size value. Returns a number, or null when contextual. */
export function evalSize(value, w = width) {
  const v = value.trim().replace(/\s*!important$/, "");
  if (/^clamp\(/i.test(v)) {
    const inner = v.slice(6, v.lastIndexOf(")"));
    const parts = inner.split(",").map((s) => s.trim());
    if (parts.length < 3) return null;
    const lo = evalLen(parts[0], w);
    const mid = evalLen(parts[1], w);
    const hi = evalLen(parts[2], w);
    if (lo === null || mid === null || hi === null) return null;
    return Math.min(Math.max(mid, lo), hi);
  }
  if (/^(min|max)\(/i.test(v)) return null;
  return evalLen(v, w);
}

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rows = [];
  for (const r of rules(text)) {
    for (const m of r.body.matchAll(/font-size:\s*([^;}]+)/g)) {
      const declared = m[1].trim().replace(/\s*!important$/, "");
      const size = evalSize(declared, width);
      rows.push({
        selector: r.selector.replace(/\s+/g, " ").slice(0, 70),
        declared,
        size
      });
    }
  }
  const bySize = new Map();
  for (const r of rows) {
    const key = r.size === null ? "context" : r.size;
    if (!bySize.has(key)) bySize.set(key, []);
    bySize.get(key).push(r);
  }
  const keys = [...bySize.keys()].sort((a, b) => {
    if (a === "context") return 1;
    if (b === "context") return -1;
    return b - a;
  });
  console.log(`\n${file}  (${rows.length} font-size declarations, viewport ${width})`);
  for (const k of keys) {
    const list = bySize.get(k);
    const vals = [...new Set(list.map((r) => r.declared))];
    console.log(
      `  ${String(k).padStart(6)}px  ×${String(list.length).padStart(3)}  ${vals.join("  ")}`
    );
  }
}
