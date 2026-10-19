#!/usr/bin/env node
// non-slop-skip-file: scanner code, not UI
// non-slop: one CLI for the anti-slop stack. Zero dependencies; `render` optionally uses Playwright.
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (!(nodeMajor >= 18)) { console.error(`non-slop needs Node 18+ (this is ${process.version}). https://nodejs.org`); process.exit(1); }
import fs from "node:fs";
import path from "node:path";
import { scanTarget, formatText, verdict } from "../lib/scan.mjs";
import { RULES } from "../lib/rules.mjs";
import { SEV_ORDER } from "../lib/rules.mjs";

const HELP = `non-slop — remove the defaults nobody chose; keep the choices somebody made.

  non-slop scan [dir|file|url ...]   static scan of source or a live page (default: .)
      --json                           machine-readable
      --min=P0|P1|P2                   lowest severity to report (default P2)
      --fail-on=slop|P0|P1|P2|never    exit 2 when the verdict is SLOP (default) or any counted hit at that level
      --staged                         only files staged in git (pre-commit)
      --style=path/STYLE.md            allowlist to apply (default: STYLE.md and ## Signature, from the file up to the git root)
      --include-examples               also scan examples/, fixtures/, test/
      --hook                           Claude Code PostToolUse mode (reads hook JSON on stdin)
  non-slop render <url|file.html>     rendered check (needs Playwright): screenshots 1440/1024/390,
                                       320px reflow, silhouette, contrast, tap targets, focus, map share
      --out=dir  --json  --style=path  --settle=ms (wait for live data; default 6000)
  non-slop init [dir]                  install into a repo: .non-slop/, agent pointers, STYLE.md, pre-commit
      --update  --no-append  --no-hook  --dry-run
  non-slop hook [dir]                  (re)install only the pre-commit gate
  non-slop rules [--md]                list the static rules

Exit codes: 0 ok · 2 gate failed · 1 error.`;

const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith("-") ? argv.shift() : "help";
const flag = (n) => argv.includes("--" + n);
const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); if (a) return a.slice(n.length + 3); const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && /^--(min|fail-on|style|out|settle)$/.test(argv[i - 1])));

function gateFails(res, failOn) {
  failOn = String(failOn).toUpperCase();
  if (failOn === "NEVER") return false;
  if (failOn === "SLOP") return res.summary.verdict === "SLOP";
  return res.findings.some((f) => f.status === "FAIL" && SEV_ORDER[f.sev] <= SEV_ORDER[failOn]);
}

async function main() {
  if (cmd === "help" || flag("help")) { console.log(HELP); return 0; }
  if (cmd === "version") { console.log(JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url))).version); return 0; }
  if (cmd === "rules") {
    if (flag("md")) { const { catalogMarkdown } = await import("../lib/catalog.mjs"); process.stdout.write(catalogMarkdown()); return 0; }
    for (const r of RULES) console.log(`${r.sev}  ${r.id.padEnd(22)} ${r.title}`); return 0;
  }
  if (cmd === "scan") {
    if (flag("hook")) {
      let input = ""; try { input = fs.readFileSync(0, "utf8"); } catch {}
      let file; try { const j = JSON.parse(input || "{}"); file = j.tool_input?.file_path || j.tool_input?.path; } catch {}
      if (!file || !fs.existsSync(file)) return 0;
      const res = await scanTarget(file, { min: "P1" });
      const bad = res.findings.filter((f) => f.status === "FAIL");
      if (!bad.length) return 0;
      console.error(`non-slop: ${bad.length} finding(s) in ${file}. Fix them unless STYLE.md lists the choice:\n` + bad.map((f) => `  ${f.sev} ${f.id} L${f.line}: ${f.title}. Fix: ${f.fix}`).join("\n"));
      return 2;
    }
    const targets = positional.length ? positional : ["."];
    const failOn = opt("fail-on", "slop"); let fail = false; const all = [];
    for (const t of targets) {
      const res = await scanTarget(t, { min: opt("min", "P2"), staged: flag("staged"), style: opt("style"), includeExamples: flag("include-examples") });
      if (flag("staged") && !res.filesScanned) continue;
      all.push(res); if (!flag("json")) console.log(formatText(res)); if (gateFails(res, failOn)) fail = true;
    }
    if (flag("json")) console.log(JSON.stringify(all.length === 1 ? all[0] : all, null, 2));
    if (fail && flag("staged")) console.error("\nnon-slop: commit blocked. Fix the hits, list a deliberate choice in STYLE.md, or skip once with --no-verify.");
    return fail ? 2 : 0;
  }
  if (cmd === "render") {
    const { renderUrl, formatRender } = await import("../lib/render.mjs");
    if (!positional.length) { console.error("usage: non-slop render <url|file.html>"); return 1; }
    let worst = 0;
    for (const t of positional) { const r = await renderUrl(t, { out: opt("out"), style: opt("style"), settleMs: +opt("settle", 6000) }); console.log(flag("json") ? JSON.stringify(r, null, 2) : formatRender(r)); if (r.verdict === "SLOP") worst = 2; }
    return worst;
  }
  if (cmd === "init" || cmd === "hook") {
    const { init, installHook } = await import("../lib/init.mjs");
    const dir = positional[0] || ".";
    const log = cmd === "hook" ? (() => { const l = []; installHook(path.resolve(dir), l, flag("dry-run")); return l; })() : init(dir, { update: flag("update"), append: !flag("no-append"), hook: !flag("no-hook"), dry: flag("dry-run") });
    console.log((flag("dry-run") ? "non-slop (dry run, nothing written)\n" : "non-slop installed\n") + log.map((l) => "  " + l).join("\n"));
    if (cmd === "init") console.log("\nNext: fill in STYLE.md (your deliberate choices), then tell your agent:\n  \"Read .non-slop/AGENTS.md and follow it for every UI change. STYLE.md wins.\"");
    return 0;
  }
  console.error(HELP); return 1;
}
main().then((c) => process.exit(c), (e) => { console.error("non-slop: " + (e.message || e)); process.exit(1); });
