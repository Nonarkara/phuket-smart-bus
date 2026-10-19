// non-slop-skip-file: scanner code, not UI
// STYLE.md allowlist: the owner's deliberate choices. Anything listed here is reported
// as ALLOWED and never counts toward a verdict. See templates/STYLE.md for the format.
import fs from "node:fs";
import path from "node:path";

export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}

const ENTRY = /^\s*[-*]\s+(rule|font|colou?r|phrase|marker)\s+(.+?)\s*(?::\s*(.*))?$/i;

function stripQuotes(s) {
  return String(s).trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

// Case-fold and collapse whitespace so a listed phrase matches the sentence that carries it.
export function normPhrase(s) {
  return stripQuotes(s).replace(/\s+/g, " ").toLowerCase();
}

// Parse "## Allow" (and "## Signature") plus "## Protected voice".
// Returns { rules, fonts, colours, phrases:[{text,why,kind}], markers:[{text,why,kind}], warnings }.
// A prose "## Voice" section is not machine-readable. Protected voice is.
export function parseStyle(text, file = "STYLE.md") {
  const out = { file, rules: [], fonts: new Map(), colours: new Map(), phrases: [], markers: [], warnings: [] };
  if (!text) return out;
  let section = null, level = 0;
  for (const raw of text.split(/\r?\n/)) {
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const title = h[2].trim();
      const openAllow = /^(allow(list)?|signature)\b|scanner allow/i.test(title);
      const openVoice = /^protected voice\b/i.test(title);
      if (section && h[1].length <= level) section = null;
      // "## Signature" in AGENTS.md is the same machine-readable list as "## Allow".
      if (openAllow || openVoice) { section = openVoice ? "voice" : "allow"; level = h[1].length; }
      continue;
    }
    if (!section) continue;
    const m = raw.match(ENTRY);
    if (!m) continue;
    const kind = m[1].toLowerCase(); let target = m[2].trim(); const why = (m[3] || "").trim();
    if (!why) out.warnings.push(`${file}: "${raw.trim()}" has no reason. It is still honoured; add one so reviewers know why.`);
    if (kind === "phrase" || kind === "marker") {
      const text = stripQuotes(target);
      if ([...text].length < 4) { out.warnings.push(`${file}: "${raw.trim()}" is too short to protect. It was not honoured.`); continue; }
      if ([...text].length < 8) out.warnings.push(`${file}: "${text}" is a short ${kind}. It is honoured, and it hides every sentence that contains it.`);
      (kind === "phrase" ? out.phrases : out.markers).push({ text, why, kind });
      continue;
    }
    if (section !== "allow") { out.warnings.push(`${file}: "${raw.trim()}" is under Protected voice. Rules, fonts and colours belong under Allow; phrase and marker belong here.`); continue; }
    if (kind === "rule") {
      const [id, , glob] = target.split(/\s+/);
      out.rules.push({ id: id.toLowerCase(), glob: glob ? globToRegExp(glob) : null, globText: glob || null, why });
    } else if (kind === "font") {
      target = stripQuotes(target).toLowerCase();
      out.fonts.set(target, why);
    } else {
      const hex = normHex(target);
      if (hex) out.colours.set(hex, why); else out.warnings.push(`${file}: can't read colour "${target}" (use #rrggbb).`);
    }
  }
  return out;
}

export function normHex(s) {
  const m = String(s).trim().toLowerCase().match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/);
  if (!m) return null;
  let h = m[1]; if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return "#" + h;
}

function emptyStyle(file = "(none)") {
  return { file, rules: [], fonts: new Map(), colours: new Map(), phrases: [], markers: [], warnings: [] };
}

function styleUseful(s) {
  return s.rules.length || s.fonts.size || s.colours.size || (s.phrases || []).length || (s.markers || []).length || s.warnings.length;
}

function dedupeVoice(list) {
  const seen = new Set(); const out = [];
  for (const item of list || []) {
    const k = normPhrase(item.text);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(item);
  }
  return out;
}

// Union of allowlists. Earlier entries win when a font, colour, phrase or marker is named twice (nearest folder first).
export function mergeStyles(list) {
  const out = emptyStyle();
  const files = [];
  for (const s of list) {
    if (!s) continue;
    if (styleUseful(s) && s.file && s.file !== "(none)") files.push(s.file);
    out.rules.push(...s.rules);
    for (const [k, v] of s.fonts) if (!out.fonts.has(k)) out.fonts.set(k, v);
    for (const [k, v] of s.colours) if (!out.colours.has(k)) out.colours.set(k, v);
    out.phrases.push(...(s.phrases || []));
    out.markers.push(...(s.markers || []));
    out.warnings.push(...s.warnings);
  }
  out.phrases = dedupeVoice(out.phrases);
  out.markers = dedupeVoice(out.markers);
  const uniq = [...new Set(files)];
  out.file = uniq.length ? uniq.join(" + ") : "(none)";
  return out;
}

// Does this sentence, or the matched span inside it, contain a protected phrase or marker?
// Returns the listed item, or null. The listed text must occur in the sentence or the span.
// A listed phrase that merely contains the match does not cover it, and neither does a
// marker that only shares the source line.
export function coveredByVoice(style, sentence, span) {
  if (!style) return null;
  const hay = normPhrase(sentence);
  const bit = normPhrase(span);
  if (!hay && !bit) return null;
  for (const item of [...(style.phrases || []), ...(style.markers || [])]) {
    const n = normPhrase(item.text);
    if (n.length < 4) continue;
    if (hay && hay.includes(n)) return item;
    if (bit && bit !== hay && bit.includes(n)) return item;
  }
  return null;
}

function readText(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

// Every STYLE.md in this folder (any case) plus ## Allow / ## Signature in AGENTS.md.
function styleInDir(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return emptyStyle(); }
  const rank = (n) => (n === "STYLE.md" ? 0 : n === "style.md" ? 1 : 2);
  const parts = [];
  for (const n of names.filter((n) => /^style\.md$/i.test(n)).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
    const p = path.join(dir, n);
    try { if (!fs.statSync(p).isFile()) continue; } catch { continue; }
    const t = readText(p); if (t != null) parts.push(parseStyle(t, p));
  }
  for (const n of [".non-slop/STYLE.md", ".non-slop/style.md"]) {
    const p = path.join(dir, n);
    const t = readText(p); if (t != null) parts.push(parseStyle(t, p));
  }
  const agents = path.join(dir, "AGENTS.md");
  const at = readText(agents);
  if (at != null) {
    const s = parseStyle(at, agents + "#Signature");
    if (styleUseful(s)) parts.push(s);
  }
  return mergeStyles(parts);
}

// Stop at the git root (inclusive). A folder that is not in a repo stops at the filesystem root.
function ceilingOf(dir) {
  let d = dir;
  for (;;) {
    if (fs.existsSync(path.join(d, ".git"))) return d;
    const up = path.dirname(d);
    if (up === d) return d;
    d = up;
  }
}

// Allows from `start` upward, nearest first. An empty STYLE.md does not hide a Signature section,
// and a nested STYLE.md does not erase allows from a parent folder.
function insideDir(dir, ceiling) {
  const d = path.resolve(dir), c = path.resolve(ceiling);
  if (d === c) return true;
  // The filesystem root plus a separator is "//", which matches nothing. A root ceiling
  // (a folder that is not a git repo) still contains every path under it.
  const root = path.parse(c).root;
  const prefix = c === root ? root : c + path.sep;
  return d.startsWith(prefix);
}

function chainFrom(start) {
  let dir = path.resolve(start);
  try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch { return { at: () => emptyStyle(), summary: emptyStyle() }; }
  const ceiling = ceilingOf(dir);
  const local = new Map();
  const chain = new Map();
  const at = (d) => {
    d = path.resolve(d);
    if (chain.has(d)) return chain.get(d);
    // A symlink target that lives outside this project still honours this project's allows,
    // plus a STYLE.md sitting next to that file. It does not walk up through /tmp or /.
    if (!insideDir(d, ceiling)) {
      const merged = mergeStyles([styleInDir(d), at(ceiling)]);
      chain.set(d, merged);
      return merged;
    }
    const parts = [];
    let cur = d;
    const guard = new Set();
    while (!guard.has(cur)) {
      guard.add(cur);
      if (!local.has(cur)) local.set(cur, styleInDir(cur));
      parts.push(local.get(cur));
      if (path.resolve(cur) === path.resolve(ceiling)) break;
      const up = path.dirname(cur);
      if (up === cur) break;
      cur = up;
    }
    const merged = mergeStyles(parts);
    chain.set(d, merged);
    return merged;
  };
  return { at, summary: at(dir) };
}

// Find STYLE.md (any case) and the "## Signature" section of AGENTS.md at or above `start`, up to the git root.
export function loadStyle(start, explicit) {
  if (explicit) return parseStyle(fs.readFileSync(explicit, "utf8"), explicit);
  return chainFrom(start).summary;
}

// Per-file allowlist for a tree: each file sees its own folder's STYLE.md plus every allow above it.
export function resolveStyles(scanRoot, explicit) {
  if (explicit) {
    const s = parseStyle(fs.readFileSync(explicit, "utf8"), explicit);
    return { forFile: () => s, summary: s };
  }
  const chain = chainFrom(scanRoot);
  return {
    summary: chain.summary,
    forFile(abs) {
      try { if (fs.statSync(abs).isFile()) return chain.at(path.dirname(abs)); } catch { /* fall through */ }
      return chain.at(abs);
    },
  };
}

// Inline escapes in source: `non-slop-allow: id, id -- reason` on the line or the line above;
// `non-slop-allow-file: id, id -- reason` anywhere in the file (no ids = whole file).
export function inlineAllows(text) {
  const file = new Set(); let wholeFile = false; const lines = new Map();
  const ls = text.split(/\r?\n/);
  ls.forEach((l, i) => {
    let m = l.match(/non-slop-allow-file:?\s*([a-z0-9, -]*?)(?:\s+--|\*\/|-->|$)/i);
    if (m) { const ids = m[1].split(/[\s,]+/).filter(Boolean); if (!ids.length) wholeFile = true; ids.forEach((x) => file.add(x.toLowerCase())); return; }
    m = l.match(/non-slop-allow:?\s*([a-z0-9, -]+?)(?:\s+--|\*\/|-->|$)/i);
    if (m) { const ids = m[1].split(/[\s,]+/).filter(Boolean).map((x) => x.toLowerCase()); for (const n of [i + 1, i + 2]) lines.set(n, [...(lines.get(n) || []), ...ids]); }
  });
  return { file, wholeFile, lines };
}

function styleLabel(style) {
  if (!style?.file || style.file === "(none)") return "(none)";
  return style.file.split(" + ").map((f) => path.basename(f)).join(" + ");
}

// Is this finding allowed? Returns a reason string or null.
export function allowedBy(style, inline, finding, rel) {
  if (inline) {
    if (inline.wholeFile) return "inline (whole file)";
    if (inline.file.has(finding.id)) return "inline (file)";
    if ((inline.lines.get(finding.line) || []).includes(finding.id)) return "inline (line)";
  }
  for (const r of style.rules) {
    if (r.id !== finding.id && r.id !== "*") continue;
    if (r.glob && !r.glob.test(rel)) continue;
    return `${styleLabel(style)}: ${r.why || "listed"}`;
  }
  if (finding.font && style.fonts.has(finding.font.toLowerCase())) return `${styleLabel(style)}: font ${finding.font}${style.fonts.get(finding.font.toLowerCase()) ? " — " + style.fonts.get(finding.font.toLowerCase()) : ""}`;
  if (finding.colours && finding.colours.length && finding.colours.every((c) => style.colours.has(c))) return `${styleLabel(style)}: colour ${finding.colours.join(", ")}`;
  return null;
}
