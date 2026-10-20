#!/usr/bin/env node
/**
 * How many font-size declarations does each surface carry, and how many
 * distinct rendered sizes do they imply?
 *
 * Reads CSS files, splits them into rules, groups the rules by the first
 * class-name prefix in the selector (the surface they belong to), and
 * reports the distinct font-size values per group.
 *
 *   node scripts/design/csssizes.mjs src/styles.css src/components/v2/fleetConsole.css
 */
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) files.push("src/styles.css");

/** A CSS file, minus comments, split into { selector, declarations } rules. */
function rules(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let depth = 0;
  let buf = "";
  let selector = "";
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === "{") {
      if (depth === 0) {
        selector = buf.trim();
        buf = "";
      } else {
        buf += c;
      }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        out.push({ selector, body: buf });
        buf = "";
        selector = "";
      } else {
        buf += c;
      }
    } else {
      buf += c;
    }
  }
  return out;
}

/** The surface a selector belongs to: its first class prefix, else "root". */
function group(selector) {
  const m = selector.match(/\.([a-zA-Z][\w-]*)/);
  if (!m) return "root";
  const c = m[1];
  const prefixes = [
    "v2", "roi", "governor", "capacity", "fd", "fleet", "lp", "pb", "hub",
    "tk", "pc", "cr", "lf", "rt", "dp", "fc", "abc", "sh", "wl", "ps", "sp"
  ];
  for (const p of prefixes) if (c.startsWith(p)) return p;
  return c.slice(0, 3);
}

const byGroup = new Map();
for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const r of rules(text)) {
    const sizes = [...r.body.matchAll(/font-size:\s*([^;}]+)/g)].map((m) => m[1].trim());
    if (!sizes.length) continue;
    const g = group(r.selector);
    if (!byGroup.has(g)) byGroup.set(g, { count: 0, values: new Map(), file: f });
    const grp = byGroup.get(g);
    grp.count += sizes.length;
    for (const s of sizes) {
      if (!grp.values.has(s)) grp.values.set(s, []);
      const list = grp.values.get(s);
      if (list.length < 2) list.push(r.selector.split("{")[0].trim().slice(0, 46));
    }
  }
}

const rows = [...byGroup.entries()].sort((a, b) => b[1].values.size - a[1].values.size);
console.log(`${"group".padEnd(12)} ${"decls".padStart(5)} ${"distinct".padStart(8)}  values`);
for (const [g, grp] of rows) {
  if (grp.values.size < 2) continue;
  console.log(
    `${g.padEnd(12)} ${String(grp.count).padStart(5)} ${String(grp.values.size).padStart(8)}  ${[...grp.values.keys()].join(", ")}`
  );
}
