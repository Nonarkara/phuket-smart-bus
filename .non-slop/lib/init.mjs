// non-slop-skip-file: scanner code, not UI
// Install Non-Slop into a repo: vendor the core into .non-slop/, add thin pointer files for each agent,
// a STYLE.md template and a local pre-commit gate. Never overwrites a file it didn't create:
// existing AGENTS.md / CLAUDE.md / copilot-instructions get one marked pointer block appended (once).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = ["AGENTS.md", "CREDITS.md", "LICENSE", "README.md", "package.json", "bin", "lib", "skills", "templates"];
const START = "<!-- non-slop:start -->", END = "<!-- non-slop:end -->";

export function pointer(core = ".non-slop/AGENTS.md", imports = "") {
  return `${START}
## Design quality: Non-Slop
${imports}Before any UI, page, dashboard, deck or visual work, read \`${core}\` and follow it.
\`STYLE.md\` lists this repo's deliberate choices: it wins over every generic rule, and nothing listed there is stripped.
Check with \`node ${path.posix.join(path.posix.dirname(core), "bin/non-slop.mjs")} scan .\` (and \`render <url>\` when Playwright is installed). A different agent or person reviews; never self-review.
${END}
`;
}
export function adapters(core = ".non-slop/AGENTS.md") {
  const p = pointer(core);
  return {
    "AGENTS.md": { create: `# AGENTS.md\n\n${p}`, append: p },
    "CLAUDE.md": { create: `# CLAUDE.md\n\n@${core}\n@STYLE.md\n\n${p}`, append: pointer(core, `@${core}\n@STYLE.md\n`) },
    "GEMINI.md": { create: `# GEMINI.md\n\n${p}`, append: p },
    ".github/copilot-instructions.md": { create: p, append: p },
    ".cursor/rules/non-slop.mdc": { create: `---\ndescription: Non-Slop design quality rules for any UI, page, dashboard or visual\nalwaysApply: true\n---\n${p}`, append: null },
    ".windsurf/rules/non-slop.md": { create: `---\ntrigger: always_on\n---\n${p}`, append: null },
  };
}
const HOOK = `#!/bin/sh
# non-slop pre-commit: a local gate, so it costs no CI minutes. Skip once with: git commit --no-verify
command -v node >/dev/null 2>&1 || { echo "non-slop: node not found, skipping"; exit 0; }
node .non-slop/bin/non-slop.mjs scan --staged --fail-on "\${NON_SLOP_FAIL_ON:-slop}" || exit 1
`;

// mkdir and writeFile follow a symlink in any parent segment, and a dangling symlink is
// created at its target. Refuse the write instead, and say which path was skipped.
export function writeRefusal(root, dest) {
  const base = path.resolve(root);
  const abs = path.resolve(dest);
  const rel = path.relative(base, abs);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return `outside the project (${abs})`;
  let cur = base;
  for (const part of rel.split(path.sep)) {
    if (!part) continue;
    cur = path.join(cur, part);
    let st;
    try { st = fs.lstatSync(cur); }
    catch (e) { return e.code === "ENOENT" ? null : `not writable (${e.message})`; }
    if (st.isSymbolicLink()) {
      let to = "broken";
      try { to = fs.realpathSync(cur); } catch { /* dangling */ }
      return `symlink ${path.relative(base, cur)} -> ${to}`;
    }
  }
  try {
    const back = path.relative(fs.realpathSync(base), fs.realpathSync(cur));
    if (back.startsWith("..") || path.isAbsolute(back)) return `outside the project (${fs.realpathSync(cur)})`;
  } catch { /* missing final component already returned */ }
  return null;
}

function copyDir(from, to, log, dry) {
  const st = fs.statSync(from);
  if (st.isDirectory()) { if (!dry) fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from)) { if (e === "node_modules" || e === ".git") continue; copyDir(path.join(from, e), path.join(to, e), log, dry); } }
  else if (!dry) fs.copyFileSync(from, to);
}

export function installHook(target, log, dry) {
  let hooksDir;
  try {
    const custom = execFileSync("git", ["config", "--get", "core.hooksPath"], { cwd: target, encoding: "utf8" }).trim();
    if (custom) { log.push(`hook: skipped (core.hooksPath is ${custom}, e.g. husky). Add this line to your pre-commit: node .non-slop/bin/non-slop.mjs scan --staged`); return; }
  } catch {}
  try { hooksDir = path.resolve(target, execFileSync("git", ["rev-parse", "--git-path", "hooks"], { cwd: target, encoding: "utf8" }).trim()); } catch { log.push("hook: skipped (not a git repo)"); return; }
  const f = path.join(hooksDir, "pre-commit");
  const why = writeRefusal(target, f);
  if (why) { log.push(`hook: skipped (${why})`); return; }
  if (fs.existsSync(f)) { const t = fs.readFileSync(f, "utf8"); log.push(t.includes("non-slop") ? "hook: already installed" : `hook: skipped (a pre-commit hook exists). Add: node .non-slop/bin/non-slop.mjs scan --staged`); return; }
  if (!dry) { fs.mkdirSync(hooksDir, { recursive: true }); fs.writeFileSync(f, HOOK, { mode: 0o755 }); }
  log.push(`hook: created ${path.relative(target, f)} (blocks a commit only when staged files score SLOP; NON_SLOP_FAIL_ON=P0|P1 to tighten)`);
}

export function init(target = ".", { update = false, append = true, hook = true, dry = false } = {}) {
  target = path.resolve(target); const log = [];
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) throw new Error(`not a folder: ${target}`);
  const dest = path.join(target, ".non-slop");
  const destBlock = writeRefusal(target, dest);
  if (path.resolve(SRC) === path.resolve(dest)) log.push(".non-slop: in place (submodule or clone), not copied");
  else if (path.resolve(SRC) === target) log.push(".non-slop: skipped (this is the Non-Slop repo itself)");
  else if (destBlock) log.push(`.non-slop: skipped (${destBlock})`);
  else if (fs.existsSync(dest) && !update) log.push(".non-slop: exists, left as is (run with --update to refresh it)");
  else {
    if (!dry && fs.existsSync(dest)) for (const n of CORE) {
      const p = path.join(dest, n);
      const why = writeRefusal(target, p);
      if (why) log.push(`.non-slop/${n}: skipped (${why})`);
      else fs.rmSync(p, { recursive: true, force: true });
    }
    if (!dry) fs.mkdirSync(dest, { recursive: true });
    for (const n of CORE) {
      const from = path.join(SRC, n), to = path.join(dest, n);
      if (!fs.existsSync(from)) continue;
      const why = writeRefusal(target, to);
      if (why) { log.push(`.non-slop/${n}: skipped (${why})`); continue; }
      copyDir(from, to, log, dry);
    }
    log.push(`.non-slop: ${update ? "refreshed" : "created"} (core rules, skills, scanner)`);
  }
  const core = path.resolve(SRC) === target ? "AGENTS.md" : ".non-slop/AGENTS.md";
  for (const [rel, a] of Object.entries(adapters(core))) {
    if (path.resolve(SRC) === target) break;
    const f = path.join(target, rel);
    const why = writeRefusal(target, f);
    if (why) { log.push(`${rel}: skipped (${why})`); continue; }
    if (!fs.existsSync(f)) { if (!dry) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, a.create); } log.push(`${rel}: created`); continue; }
    const t = fs.readFileSync(f, "utf8");
    if (t.includes(START)) { log.push(`${rel}: already points to Non-Slop`); continue; }
    if (!a.append || !append) { log.push(`${rel}: exists, not touched${a.append ? " (--no-append)" : ""}`); continue; }
    if (!dry) fs.appendFileSync(f, (t.endsWith("\n") ? "\n" : "\n\n") + a.append);
    log.push(`${rel}: exists; appended the pointer block (your text is unchanged)`);
  }
  const styleName = (() => { try { return fs.readdirSync(target).find((n) => /^style\.md$/i.test(n)); } catch { return null; } })();
  if (styleName) log.push(`${styleName}: exists, not touched`);
  else if (path.resolve(SRC) !== target) {
    const stylePath = path.join(target, "STYLE.md");
    const why = writeRefusal(target, stylePath);
    if (why) log.push(`STYLE.md: skipped (${why})`);
    else { if (!dry) fs.copyFileSync(path.join(SRC, "templates/STYLE.md"), stylePath); log.push("STYLE.md: created from the template. Fill it in: it is what protects your style."); }
  }
  const gi = path.join(target, ".gitignore");
  const giWhy = writeRefusal(target, gi);
  if (giWhy) log.push(`.gitignore: skipped (${giWhy})`);
  else if (fs.existsSync(gi) && !/non-slop-shots/.test(fs.readFileSync(gi, "utf8"))) { if (!dry) fs.appendFileSync(gi, "\n# non-slop render screenshots\nnon-slop-shots/\n"); log.push(".gitignore: appended non-slop-shots/"); }
  if (hook) installHook(target, log, dry);
  return log;
}
