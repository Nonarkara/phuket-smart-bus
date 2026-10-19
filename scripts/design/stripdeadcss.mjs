// Remove dead CSS rules, using a real CSS parser (postcss).
//
// "Nothing that doesn't make sense shall stay in the system." A class selector
// that no component renders is residue from a previous version of the UI.
//
// Safety rules:
//   • A rule is removed only when EVERY selector in it is a single dead
//     class. A compound selector (.a .b), a pseudo-selector, an element
//     selector or an attribute selector is never touched — the detector
//     does not model them, so they are left alone.
//   • A rule with a mix of live and dead selectors keeps the live ones.
//   • Verify with `removedclasscheck.mjs`: no element in any route may carry
//     a removed class. That check is time-independent; a screenshot diff is
//     not (the ops wall, the fleet tables and the rider countdown all tick).
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

// Repo root: walk up from this file until a package.json appears. A fixed
// relative path breaks the moment the tool moves.
function findRoot(start) {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) throw new Error("package.json not found above " + start);
    dir = up;
  }
}
const ROOT = findRoot(path.dirname(new URL(import.meta.url).pathname));
const SKIP = new Set(["node_modules", "dist", ".git", "non-slop-shots", "e2e", ".non-slop", "assets-src", "public", "data", "server", "scripts"]);

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

const used = new Set();
for (const f of codeFiles) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)) used.add(m[0]);
}

const isDead = (cls) => {
  if (used.has(cls)) return false;
  const base = cls.split("--")[0];
  return !(base !== cls && used.has(base));
};

/** A selector we can reason about: exactly one class, nothing else. */
const singleClass = (sel) => {
  const t = sel.trim();
  if (!t.startsWith(".")) return null;
  const m = t.match(/^\.([A-Za-z_][A-Za-z0-9_-]*)$/);
  return m ? m[1] : null;
};

const removedClasses = new Set();
const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((t) => path.resolve(t))
  : cssFiles;

for (const file of targets) {
  const src = fs.readFileSync(file, "utf8");
  const root = postcss.parse(src, { from: file });
  let removed = 0;
  let kept = 0;

  root.walkRules((rule) => {
    const selectors = rule.selectors || [];
    if (selectors.length === 0) return;
    const live = [];
    let allDead = true;
    for (const sel of selectors) {
      const cls = singleClass(sel);
      if (cls === null) {
        // Not a bare class: we cannot prove it is dead, so it stays.
        allDead = false;
        live.push(sel);
        continue;
      }
      if (isDead(cls)) {
        removedClasses.add(cls);
        continue;
      }
      allDead = false;
      live.push(sel);
    }
    if (allDead) {
      rule.remove();
      removed++;
    } else if (live.length !== selectors.length) {
      rule.selectors = live;
      kept++;
    } else {
      kept++;
    }
  });

  const out = root.toString();
  if (out !== src) {
    fs.writeFileSync(file, out);
    console.log(`${path.relative(ROOT, file)} — removed ${removed} dead rule(s), kept ${kept}`);
  }
}

if (process.env.WRITE_REMOVED) {
  fs.writeFileSync(process.env.WRITE_REMOVED, [...removedClasses].sort().join("\n") + "\n");
  console.log(`\nwrote ${removedClasses.size} removed class names to ${process.env.WRITE_REMOVED}`);
}
console.log(`\nTOTAL removed rules: ${[...targets].length} file(s) processed`);
