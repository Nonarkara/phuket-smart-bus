// non-slop-skip-file: scanner code, not UI
// Static scan of a folder, files, staged files or a URL. Zero dependencies (Node 18+).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { RULES, SEV_POINTS, SEV_ORDER } from "./rules.mjs";
import { loadStyle, resolveStyles, mergeStyles, inlineAllows, allowedBy, coveredByVoice, parseStyle } from "./style.mjs";

export const MAX_SCAN_BYTES = 8_000_000;
const MAX_FILES = 8000;

const KIND = { ".css": "css", ".scss": "css", ".sass": "css", ".less": "css", ".html": "markup", ".htm": "markup", ".vue": "markup", ".svelte": "markup", ".astro": "markup", ".jsx": "markup", ".tsx": "markup", ".js": "script", ".mjs": "script", ".cjs": "script", ".ts": "script" };
const IMG = /\.(png|jpe?g|gif|webp|avif|bmp|tiff?)$/i, FONT = /\.(woff2?|ttf|otf|eot)$/i;
const SKIP = new Set(["node_modules", ".git", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit", ".output", "coverage", "vendor", ".turbo", ".vercel", ".cache", ".non-slop", ".wrangler", "__pycache__"]);
const EXAMPLES = new Set(["examples", "example", "fixtures", "__fixtures__", "__mocks__", "stories", ".storybook", "test", "tests"]);

function deniedRealpath(real) {
  const n = path.resolve(real);
  if (n === path.parse(n).root) return true;
  return ["/proc", "/sys", "/dev", "/run"].some((p) => n === p || n.startsWith(p + path.sep));
}

// Follows symlinks (file or directory) with a realpath cycle guard. A link to the filesystem
// root or a virtual filesystem is skipped and named in ctx.notes rather than scanned.
// The path you pass as the scan root counts: a symlink there is a link too.
function walk(root, opts, out = [], ctx = null, viaLink = false) {
  if (!ctx) ctx = { seen: new Set(), notes: [], n: 0, capped: false };
  if (ctx.n >= MAX_FILES) { if (!ctx.capped) { ctx.notes.push(`stopped after ${MAX_FILES} files`); ctx.capped = true; } return out; }
  let link = viaLink;
  if (!link) { try { link = fs.lstatSync(root).isSymbolicLink(); } catch { /* missing */ } }
  let real; try { real = fs.realpathSync(root); } catch { if (link) ctx.notes.push(`skipped symlink ${root} (broken)`); return out; }
  if (ctx.seen.has(real)) return out;
  if (link && deniedRealpath(real)) { ctx.notes.push(`skipped symlink ${root} (resolves to ${real})`); ctx.seen.add(real); return out; }
  ctx.seen.add(real);
  let st; try { st = fs.statSync(root); } catch { return out; }
  if (st.isFile()) { out.push(root); ctx.n++; return out; }
  let ents; try { ents = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(root, e.name);
    const link = e.isSymbolicLink();
    let dir = e.isDirectory();
    if (link) { try { dir = fs.statSync(p).isDirectory(); } catch { ctx.notes.push(`skipped symlink ${p} (broken)`); continue; } }
    if (dir) {
      if (SKIP.has(e.name) || (!opts.includeExamples && EXAMPLES.has(e.name))) continue;
      walk(p, opts, out, ctx, link);
    } else if (e.isFile() || link) walk(p, opts, out, ctx, link);
  }
  return out;
}

function skipped(rel, abs, size, skip) {
  return { rel, abs, kind: "skipped", text: "", raw: "", size, skip };
}
function hasNul(buf) { return buf.includes(0); }

export function fileCtx(abs, base, text) {
  const ext = path.extname(abs).toLowerCase(); const rel = (path.relative(base, abs) || path.basename(abs)).split(path.sep).join("/");
  if (text === undefined) {
    const kind = KIND[ext];
    if (!kind) return IMG.test(abs) || FONT.test(abs) ? { rel, abs, kind: "other", text: "", size: fs.statSync(abs).size } : null;
    if (/\.min\.(js|css)$/.test(abs)) return null;
    const size = fs.statSync(abs).size;
    if (size > MAX_SCAN_BYTES) return skipped(rel, abs, size, `over ${Math.round(MAX_SCAN_BYTES / 1e6)} MB`);
    const fd = fs.openSync(abs, "r");
    try {
      const buf = Buffer.alloc(Math.min(4096, size));
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      if (hasNul(buf.subarray(0, n))) return skipped(rel, abs, size, "binary");
    } finally { fs.closeSync(fd); }
    text = fs.readFileSync(abs, "utf8");
  } else if (text.length > MAX_SCAN_BYTES) return skipped(rel, abs, text.length, `over ${Math.round(MAX_SCAN_BYTES / 1e6)} MB`);
  else if (text.includes("\0")) return skipped(rel, abs, text.length, "binary");
  if (/non-slop-skip-file|non-slop-example|slop-example/.test(text.slice(0, 400)) && !process.env.NON_SLOP_INCLUDE_EXAMPLES) return null;
  // Rules read `text` with comments blanked (same length, newlines kept); allow comments are read from `raw`.
  const blank = (m) => m.replace(/[^\n]/g, " ");
  const code = text.replace(/<!--[\s\S]*?-->/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
  return { rel, abs, kind: KIND[ext] || "markup", text: code, raw: text, size: text.length };
}

export function runRules(files, style) {
  const styleFor = typeof style === "function" ? style : () => style;
  const proj = { files, css: files.filter((f) => f.kind === "css" || /<style/i.test(f.text)), fontFiles: files.filter((f) => FONT.test(f.rel)).map((f) => path.basename(f.rel).toLowerCase().replace(/[-_ ](regular|bold|italic|light|medium|semibold|variable|vf|latin|thai|\d+).*$/, "").replace(/[-_]/g, "")) };
  const inl = new Map(files.map((f) => [f.rel, inlineAllows(f.raw ?? f.text)]));
  const findings = [];
  for (const r of RULES) {
    const raw = [];
    if (r.project) { try { for (const h of r.project(proj)) raw.push(h); } catch (e) { if (process.env.NON_SLOP_DEBUG) console.error(r.id, e); } }
    else for (const f of files) { if (!r.kinds.includes(f.kind)) continue; try { for (const h of r.file(f)) raw.push({ rel: f.rel, ...h }); } catch (e) { if (process.env.NON_SLOP_DEBUG) console.error(r.id, f.rel, e); } }
    for (const h of raw) {
      const st = styleFor(h.rel) || styleFor();
      // Copy only. The protected phrase or marker must sit in this hit's sentence
      // or in the matched span. The rest of the line does not count, and a listed
      // phrase that merely contains the match does not hide a different sentence.
      if (r.cat === "copy" && coveredByVoice(st, h.sentence || "", h.phrase || h.detail || "")) continue;
      const f = { id: r.id, sev: r.sev, cat: r.cat, title: r.title, fix: r.fix, ...h };
      const why = allowedBy(st, inl.get(h.rel), f, h.rel);
      f.status = why ? (r.noAllow ? "ASK-OWNER" : "ALLOWED") : (r.review ? "REVIEW" : "FAIL");
      if (why) f.allowedBy = why;
      findings.push(f);
    }
  }
  return findings;
}

// Judge the stack, not the item: distinct counted rules, weighted by severity.
export function verdict(findings) {
  const counted = new Map();
  for (const f of findings) if (f.status === "FAIL" && !counted.has(f.id)) counted.set(f.id, f);
  const list = [...counted.values()];
  const points = list.reduce((a, f) => a + SEV_POINTS[f.sev], 0);
  const p0 = list.filter((f) => f.sev === "P0").length, p1 = list.filter((f) => f.sev === "P1").length, p2 = list.filter((f) => f.sev === "P2").length;
  const cats = new Set(list.filter((f) => f.sev !== "P2").map((f) => f.cat));
  const v = points >= 8 || (p0 >= 1 && p0 + p1 >= 2) || cats.size >= 3 ? "SLOP" : points >= 3 ? "REVIEW" : "OK";
  return { verdict: v, points, p0, p1, p2, allowed: findings.filter((f) => f.status === "ALLOWED").length, askOwner: findings.filter((f) => f.status === "ASK-OWNER").length, review: findings.filter((f) => f.status === "REVIEW").length };
}

function takeUsable(list, note) {
  const files = []; const skipped = [];
  for (const c of list) {
    if (!c) continue;
    if (c.skip) skipped.push(`${c.rel} (${c.skip})`);
    else files.push(c);
  }
  if (skipped.length) note.push("not scanned: " + skipped.slice(0, 8).join(", ") + (skipped.length > 8 ? ` … +${skipped.length - 8}` : ""));
  return files;
}

export async function scanTarget(target, opts = {}) {
  let files = [], note = [], styles;
  if (/^https?:\/\//i.test(target)) {
    ({ files, note } = await fetchSite(target));
    note = note || [];
    files = takeUsable(files, note);
    const s = opts.style ? loadStyle(null, opts.style) : parseStyle("", "(none: pass --style STYLE.md to apply an allowlist to a URL)");
    styles = { forFile: () => s, summary: s };
  } else {
    const base = path.resolve(target);
    const rootStat = fs.statSync(base);
    const root = rootStat.isFile() ? path.dirname(base) : base;
    const ctx = { seen: new Set(), notes: [], n: 0, capped: false };
    const list = opts.staged ? stagedFiles(base) : walk(base, opts, [], ctx);
    note = [...ctx.notes];
    const raw = [];
    for (const abs of list) { try { raw.push(fileCtx(abs, root)); } catch (e) { note.push(`skipped ${abs} (${e.message})`); } }
    files = takeUsable(raw, note);
    styles = resolveStyles(base, opts.style);
  }
  const byRel = new Map(files.map((f) => [f.rel, styles.forFile(f.abs || f.rel)]));
  const used = []; const seenStyle = new Set();
  for (const s of byRel.values()) { if (s && !seenStyle.has(s)) { seenStyle.add(s); used.push(s); } }
  const style = mergeStyles(used.length ? used : [styles.summary]);
  // The verdict always weighs every rule; --min only trims what is listed.
  const all = runRules(files, (rel) => byRel.get(rel) || styles.summary);
  const min = opts.min || "P2";
  const findings = all.filter((f) => SEV_ORDER[f.sev] <= SEV_ORDER[min]);
  return { target, filesScanned: files.filter((f) => f.kind !== "other").length, style: { file: style.file, rules: style.rules.length, fonts: style.fonts.size, colours: style.colours.size, phrases: style.phrases.length, markers: style.markers.length, warnings: style.warnings }, findings, summary: verdict(all), note };
}

function stagedFiles(root) {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: fs.statSync(root).isFile() ? path.dirname(root) : root, encoding: "utf8" }).trim();
    return execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { cwd: top, encoding: "utf8" }).split("\n").filter(Boolean).map((p) => path.join(top, p)).filter((p) => !p.split(path.sep).some((s) => SKIP.has(s)) && fs.existsSync(p));
  } catch { return []; }
}

async function fetchText(url) {
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (non-slop scanner; +https://github.com/Nonarkara/Non-Slop)", accept: "text/html,text/css,*/*" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return { text: await r.text(), url: r.url };
}
async function fetchSite(url) {
  const note = []; const page = await fetchText(url); const files = [fileCtx(new URL(page.url).pathname.replace(/\/$/, "/index") + (/(\.html?)$/.test(page.url) ? "" : ".html"), "/", page.text)];
  const hrefs = [...page.text.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)].map((m) => (m[0].match(/href=["']?([^"'\s>]+)/) || [])[1]).filter(Boolean).slice(0, 15);
  for (const h of hrefs) { try { const u = new URL(h, page.url); const css = await fetchText(u.href); const c = fileCtx((u.host === new URL(page.url).host ? u.pathname : "/" + u.host + u.pathname).replace(/(\.css)?$/, ".css"), "/", css.text); if (c) files.push(c); } catch (e) { note.push(`could not fetch ${h}: ${e.message}`); } }
  if (page.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, "").trim().length < 300) note.push("Little text in the HTML: the page is probably rendered by JavaScript. Run `non-slop render` for the real picture.");
  return { files, note };
}

export function formatText(res, { color = process.stdout.isTTY } = {}) {
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const SEVC = { P0: "31;1", P1: "33", P2: "36" };
  const voiceN = (res.style.phrases || 0) + (res.style.markers || 0);
  const allowN = res.style.rules + res.style.fonts + res.style.colours;
  const styleBits = [
    allowN ? `${res.style.rules} rules, ${res.style.fonts} fonts, ${res.style.colours} colours allowed` : "",
    voiceN ? `${res.style.phrases || 0} phrases, ${res.style.markers || 0} voice markers protected` : "",
  ].filter(Boolean).join("; ");
  const out = [`non-slop scan ${res.target}  ·  ${res.filesScanned} files  ·  style: ${res.style.file}${styleBits ? ` (${styleBits})` : ""}`];
  for (const w of res.style.warnings) out.push(c("33", "  note: " + w));
  const byFile = new Map(); for (const f of res.findings) (byFile.get(f.rel) || byFile.set(f.rel, []).get(f.rel)).push(f);
  for (const [rel, fs_] of byFile) {
    out.push("", c("1", rel));
    for (const f of fs_.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev])) {
      const tag = f.status === "FAIL" ? c(SEVC[f.sev], f.sev.padEnd(9)) : f.status === "REVIEW" ? c("33", "REVIEW   ") : f.status === "ALLOWED" ? c("32", "ALLOWED  ") : c("35", "ASK-OWNER");
      out.push(`  ${tag} ${f.id.padEnd(20)} ${f.line ? "L" + f.line : ""}  ${f.detail || ""}`);
      if (f.status === "FAIL") out.push(`            ${c("2", f.title)}`, `            fix: ${f.fix}`);
      else if (f.status === "REVIEW") out.push(`            ${c("2", f.why || f.title)}`, `            do not rewrite. ${f.fix}`);
      else out.push(`            ${c("2", f.allowedBy + (f.status === "ASK-OWNER" ? " — listed as deliberate, but this one affects access: raise it with the owner, don't change it." : ""))}`);
    }
  }
  for (const n of res.note || []) out.push("", c("33", "note: " + n));
  const s = res.summary; const vc = s.verdict === "SLOP" ? "31;1" : s.verdict === "REVIEW" ? "33;1" : "32;1";
  out.push("", `${c(vc, "Verdict: " + s.verdict)}  points ${s.points} (distinct rules: P0 ${s.p0} · P1 ${s.p1} · P2 ${s.p2})  ·  allowed ${s.allowed}${s.askOwner ? `  ·  ask-owner ${s.askOwner}` : ""}${s.review ? `  ·  review ${s.review} (sentences to read; not scored, not rewritten)` : ""}`);
  out.push(c("2", "SLOP = ≥8 points, a P0 stacked with another P0/P1, or P0/P1 hits in ≥3 categories. REVIEW = 3–7. A screen, not a judge: render it and get a second reviewer."));
  return out.join("\n");
}
