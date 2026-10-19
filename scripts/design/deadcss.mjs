// Dead CSS detector.
//
// A class selector in a stylesheet that no component renders is not a style
// choice, it is residue. "Nothing that doesn't make sense shall stay in the
// system" applies to CSS as much as to code.
//
// Method: collect every class name that appears in a .tsx/.ts source file
// (className="x", className={`x ...`}, classList.add("x"), clsx("x")) plus
// every class name in a sibling stylesheet, then report CSS class selectors
// that appear nowhere.
//
// False positives to watch: classes added at runtime, and classes referenced
// only from a string in a test. The report prints the count so a human can
// judge the ratio before acting.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SKIP = new Set(["node_modules", "dist", ".git", "non-slop-shots", "e2e", ".non-slop", "assets-src", "public", "data", "server"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const cssFiles = files.filter((f) => f.endsWith(".css"));
const codeFiles = files.filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.endsWith(".d.ts"));

// Every identifier that could be a class name, from code and from CSS.
const used = new Set();
for (const f of codeFiles) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)) used.add(m[0]);
}
// Class names written in a stylesheet but not in code are also suspects;
// collect them separately so a CSS-only reference is not counted as usage.
const cssOnly = new Set();
for (const f of cssFiles) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) {
    if (!used.has(m[1])) cssOnly.add(m[1]);
  }
}

const report = [];
for (const f of cssFiles) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  const dead = [];
  let current = null;
  lines.forEach((line, i) => {
    const sel = line.match(/^([^{}\/]+)\{/);
    if (sel) {
      current = sel[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("@") && !s.startsWith(":root") && !s.startsWith("from") && !s.startsWith("to") && !s.startsWith("%"))
        .map((s) => s.split(/[\s>+~:]+[^{]*$/)[0] || s);
    }
    if (current && line.includes("{")) {
      for (const s of current) {
        const m = s.match(/^\.([A-Za-z_][A-Za-z0-9_-]*)$/);
        // DEAD = the class name appears in no .ts/.tsx file at all.
        // A modifier (foo--bar) is alive if its BASE (foo) is used, because
        // modifiers are applied by template interpolation the scanner cannot see.
        if (m && !used.has(m[1])) {
          const base = m[1].split("--")[0];
          if (base !== m[1] && used.has(base)) continue;
          dead.push({ line: i + 1, sel: s, cls: m[1] });
        }
      }
    }
  });
  if (dead.length) report.push({ file: path.relative(ROOT, f), dead, total: lines.length });
}

let grand = 0;
for (const r of report.sort((a, b) => b.dead.length - a.dead.length)) {
  grand += r.dead.length;
  console.log(`\n${r.file} — ${r.dead.length} dead class selectors in ${r.total} lines`);
  for (const d of r.dead.slice(0, 40)) console.log(`   L${String(d.line).padStart(5)}  ${d.sel}`);
  if (r.dead.length > 40) console.log(`   … and ${r.dead.length - 40} more`);
}
console.log(`\nTOTAL dead class selectors: ${grand}`);
console.log("(a class that appears in ANY .ts/.tsx file is treated as used, including test files)");
