// Insert an explicit font-weight into named CSS rules, by source position.
//
//   node scripts/design/setweight.mjs
//
// Every heading rule whose size can fall below 40px must declare its own
// weight: the display face at 600+ under 40px is the blob (STYLE.md). The
// base rule carries 700 for the big headings; a rule that overrides the
// size downward must override the weight too, or it inherits 700.
//
// Usage: setweight.mjs <file> <line>:<weight> [<line>:<weight> ...]
// The line numbers are the rule's start line as reported by postcss.
import postcss from "postcss";
import fs from "node:fs";

const [file, ...specs] = process.argv.slice(2);
if (!file || !specs.length) {
  console.error("usage: setweight.mjs <file> <line>:<weight> [...]");
  process.exit(1);
}

const src = fs.readFileSync(file, "utf8");
const root = postcss.parse(src, { from: file });

const edits = [];
for (const spec of specs) {
  const [line, weight] = spec.split(":");
  const ln = Number(line);
  const found = [];
  root.walkRules((r) => {
    if (r.source.start.line === ln) found.push(r);
  });
  if (found.length !== 1) {
    console.error(`${file}:${ln} matched ${found.length} rules — aborting`);
    process.exit(1);
  }
  const rule = found[0];
  if (rule.nodes.some((n) => n.type === "decl" && n.prop === "font-weight")) {
    console.log(`${file}:${ln} already declares font-weight — skipped (${rule.selector})`);
    continue;
  }
  // Insert right after the rule's opening brace.
  const brace = src.indexOf("{", rule.source.start.offset);
  if (brace < 0) {
    console.error(`${file}:${ln} no opening brace`);
    process.exit(1);
  }
  edits.push({ at: brace + 1, text: ` font-weight: ${weight};` });
}

if (!edits.length) {
  console.log(`${file}: nothing to do`);
  process.exit(0);
}

edits.sort((a, b) => b.at - a.at);
let out = src;
for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.at);
fs.writeFileSync(file, out);
console.log(`${file}: wrote ${edits.length} rule(s)`);
