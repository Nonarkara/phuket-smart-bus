// non-slop-skip-file: rule definitions, not UI
// Static rules: the tells that are certain from source alone (no render).
// Each rule: id, sev (P0 anyone notices · P1 a designer notices · P2 polish), cat, title, fix, keep (when it is a choice).
// Rules never fire on: em dashes, semicolons, serif type, a single emoji in prose, colour itself, ornament itself.
// generic-promise is status REVIEW: listed, not scored, never a rewrite. A protected phrase or marker is not flagged.
import { parseColour, toHex, is, contrast, twColour, TW_PURPLE } from "./colour.mjs";

const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const lineAt = (text, i) => { let n = 1; for (let k = 0; k < i && k < text.length; k++) if (text.charCodeAt(k) === 10) n++; return n; };
function* matches(text, re) { re.lastIndex = 0; let m; while ((m = re.exec(text))) { yield m; if (m[0] === "") re.lastIndex++; } }
const first = (ctx, re, detail) => { re.lastIndex = 0; const m = re.exec(ctx.text); return m ? [{ line: lineAt(ctx.text, m.index), detail: detail ? detail(m) : m[0].slice(0, 80) }] : []; };
const count = (text, re) => { let n = 0; for (const _ of matches(text, re)) n++; return n; };
const colours = (s) => (s.match(COLOUR_RE) || []).map(parseColour).filter(Boolean);
// class strings in HTML/JSX: class="..." className="..." className={`...`} plus tailwind @apply
function* classAttrs(text) { for (const m of matches(text, /\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*[`"']([^`"']*)[`"']\s*\})|@apply\s+([^;]+);/g)) yield { s: m[1] ?? m[2] ?? m[3] ?? m[4] ?? "", i: m.index }; }
// visible-ish text: HTML text nodes and JSX text, plus string literals in markup-ish files
function visibleText(ctx) {
  if (ctx.kind === "css") return "";
  const t = ctx.text.replace(/<script[\s\S]*?<\/script>/gi, (m) => (ctx.kind === "markup" && !/type=["']?(module|text\/babel)/i.test(m.slice(0, 80)) ? " ".repeat(m.length) : m)).replace(/<style[\s\S]*?<\/style>/gi, (m) => " ".repeat(m.length)).replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));
  return t;
}
const textSegments = function* (ctx) { const t = visibleText(ctx); for (const m of matches(t, />([^<>{}]{2,400})</g)) yield { s: m[1], i: m.index + 1 }; if (ctx.kind === "script") for (const m of matches(t, /(["'`])((?:(?!\1)[^\\\n]|\\.){6,300})\1/g)) if (/\s/.test(m[2]) && !/^[\w./@:-]+$/.test(m[2])) yield { s: m[2], i: m.index + 1 }; };
// Quotations are voice. A closed <blockquote> or <q> (any case, attributes, nesting) is not a copy finding.
// One forward pass. Each name keeps its own stack of open offsets, so a close is one pop and never a search.
// A stray end tag (nothing of that name is open) is an O(1) no-op. An unclosed tag does not open a range.
function quoteRanges(text) {
  const ranges = [];
  const open = { q: [], blockquote: [] };
  const n = text.length;
  for (let i = 0; i < n; i++) {
    if (text.charCodeAt(i) !== 60) continue;
    let j = i + 1; let closing = false;
    if (j < n && text.charCodeAt(j) === 47) { closing = true; j++; }
    const nameAt = j;
    while (j < n) { const c = text.charCodeAt(j); if (c < 65 || (c > 90 && c < 97) || c > 122) break; j++; }
    if (j === nameAt) continue;
    const name = text.slice(nameAt, j).toLowerCase();
    const stack = name === "q" ? open.q : name === "blockquote" ? open.blockquote : null;
    if (!stack) continue;
    while (j < n && text.charCodeAt(j) !== 62) j++;
    if (j >= n) break;
    const end = j + 1;
    if (closing) { const start = stack.pop(); if (start !== undefined) ranges.push([start, end]); }
    else stack.push(i);
    i = end - 1;
  }
  return ranges;
}
const inQuotes = (ranges, i) => ranges.some(([a, b]) => i >= a && i < b);
function sentenceAt(text, i) {
  let a = i; while (a > 0 && !/[.!?\n]/.test(text[a - 1])) a--;
  while (a < text.length && /\s/.test(text[a])) a++;
  let b = Math.max(i, a); while (b < text.length && !/[.!?\n]/.test(text[b])) b++;
  if (b < text.length && text[b] !== "\n") b++;
  return text.slice(a, b).replace(/\s+/g, " ").trim();
}
// Empty promises: a shape, not a word list. A single ordinary word never matches.
const PROMISE_PATTERNS = [
  { re: /\b(?:unlock|unleash|discover|experience|step\s+into)\s+(?:a|the|your)\s+(?:(?:vibrant|whole|new|brand-new|beautiful|amazing|dazzling|bold)\s+){0,2}world\s+of\s+(?:(?:vibrant|endless|pure|true)\s+)?(?:colour|color|possibilit\w*|opportunit\w*|wonder|potential|imagination|creativity|innovation|ideas|everything|anything)\b/i, why: "It promises a world of something and never names which thing, who made it, or how many." },
  { re: /\ba\s+(?:vibrant|whole\s+new|brand-new|beautiful|amazing|dazzling)\s+world\s+of\s+(?:(?:endless|pure|true)\s+)?(?:colour|color|possibilit\w*|opportunit\w*|wonder|potential|imagination|creativity|innovation|ideas|everything|anything)\b/i, why: "It promises a world of something and never names which thing, who made it, or how many." },
  { re: /\ba\s+world\s+of\s+(?:endless\s+)?(?:colour|color|possibilit\w*|opportunit\w*|wonder|potential|imagination|creativity|innovation|ideas)\b/i, why: "It promises a world of something and never names which thing, who made it, or how many." },
  { re: /\bembark\s+on\s+(?:a|your)\s+(?:new\s+)?(?:journey|adventure)\b/i, why: "It promises a journey and never says where, or what the reader will do." },
  { re: /\bthe future of\s+[a-z0-9][\w-]*\s+is\s+here\b/i, why: "It announces a future and never says what changed, when, or for whom." },
  { re: /\bto\s+new\s+heights\b/i, why: "It promises a height and never says what got better, or by how much." },
  { re: /\bdive\s+into\s+(?:a|the)\s+world\s+of\b/i, why: "It invites the reader into a world and never names the subject." },
];
function genericPromises(ctx) {
  const ranges = quoteRanges(ctx.text); const out = []; const seen = new Set();
  for (const seg of textSegments(ctx)) {
    if (inQuotes(ranges, seg.i)) continue;
    for (const p of PROMISE_PATTERNS) {
      const m = seg.s.match(p.re); if (!m) continue;
      const sentence = sentenceAt(seg.s, m.index).slice(0, 180);
      const key = sentence.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
      out.push({ line: lineAt(ctx.text, seg.i), detail: sentence, phrase: m[0], sentence, why: p.why });
      if (out.length >= 3) return out;
    }
  }
  return out;
}

const DEFAULT_FONTS = ["inter", "roboto", "poppins", "montserrat", "open sans", "lato", "dm sans", "space grotesk", "geist", "geist sans", "plus jakarta sans", "manrope", "nunito", "system-ui", "-apple-system", "blinkmacsystemfont", "ui-sans-serif", "arial"];
const TASTEFUL = ["fraunces", "instrument serif", "playfair display", "bricolage grotesque", "satoshi", "cabinet grotesk", "clash display", "general sans", "outfit", "sora"];
const SYSTEM = new Set(["arial", "helvetica", "helvetica neue", "georgia", "times", "times new roman", "courier", "courier new", "verdana", "tahoma", "trebuchet ms", "segoe ui", "menlo", "monaco", "consolas", "sf pro", "sf pro text", "sf pro display", "sf mono", "-apple-system", "blinkmacsystemfont", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "sans-serif", "serif", "monospace", "cursive", "fantasy", "emoji", "math", "inherit", "initial", "unset", "revert", "thonburi", "leelawadee ui", "leelawadee", "pingfang sc", "pingfang tc", "hiragino sans", "hiragino sans gb", "microsoft yahei", "songti sc", "heiti sc", "stheiti", "simsun", "noto color emoji", "apple color emoji", "segoe ui emoji", "segoe ui symbol", "liberation sans", "dejavu sans", "roboto mono", "garamond", "palatino", "palatino linotype", "book antiqua", "optima", "futura", "gill sans", "avenir", "avenir next", "baskerville", "didot", "american typewriter", "lucida grande", "cambria", "calibri", "candara", "impact", "hiragino kaku gothic pron", "hiragino kaku gothic pro", "hiragino mincho pron", "yu gothic", "yugothic", "yu mincho", "meiryo", "ms gothic", "ms mincho", "apple sd gothic neo", "malgun gothic", "noto sans cjk sc", "noto serif cjk sc", "songti tc", "kaiti sc", "stsong", "stkaiti", "stfangsong", "fangsong", "kaiti", "nsimsun", "microsoft jhenghei", "sukhumvit set", "ayuthaya", "krungthep", "silom", "sathu", "angsana new", "browallia new", "cordia new", "symbol", "wingdings"]);

// font-family declarations → [{family, i}]
function fontDecls(ctx) {
  const out = []; const t = ctx.text;
  for (const m of matches(t, /font-family\s*:\s*([^;}{"\n]+(?:"[^"]*"[^;}{\n]*)*)/gi)) out.push({ list: m[1], i: m.index });
  for (const m of matches(t, /fontFamily\s*:\s*(\[[^\]]*\]|["'`][^"'`]*["'`])/g)) out.push({ list: m[1], i: m.index });
  for (const m of matches(t, /\b(?:sans|serif|display|heading|body|mono)\s*:\s*\[\s*([^\]]+)\]/g)) if (/tailwind|theme|fontFamily/.test(t)) out.push({ list: m[1], i: m.index });
  for (const m of matches(t, /import\s*\{([^}]+)\}\s*from\s*["']next\/font\/google["']/g)) for (const f of m[1].split(",")) out.push({ list: f.trim().replace(/_/g, " "), i: m.index, loaded: true });
  // <link href="...family=Inter"> loads a face even when font-family is set in another file.
  for (const m of matches(t, /family=([^&"'\s>]+)/gi)) {
    let raw = m[1]; try { raw = decodeURIComponent(raw); } catch { /* keep */ }
    for (const fam of raw.split("|")) out.push({ list: fam.split(":")[0].replace(/\+/g, " "), i: m.index, loaded: true });
  }
  return out.map((d) => ({ ...d, family: (d.list.replace(/^[\[\s]+/, "").split(",")[0] || "").replace(/["'`\]]/g, "").replace(/!important/, "").trim().toLowerCase() })).filter((d) => d.family && !d.family.startsWith("var("));
}

export const RULES = [
  // ── Typography
  { id: "default-font", sev: "P1", cat: "type", kinds: ["css", "markup", "script"], title: "Primary face is a reach-for-it default (Inter, Roboto, Poppins, Geist, system-ui stack…)", fix: "Choose a face for this product and say why in STYLE.md. House starting point: Jost; Josefin Sans or League Spartan for display; Prompt or Kanit (non-looped) for Thai.", keep: "The default is the brief (e.g. system-ui so the font disappears into the OS). List it under STYLE.md → Allow → font.",
    file: (ctx) => fontDecls(ctx).filter((d) => DEFAULT_FONTS.includes(d.family)).slice(0, 3).map((d) => ({ line: lineAt(ctx.text, d.i), detail: d.family, font: d.family })) },
  { id: "tasteful-font", sev: "P2", cat: "type", kinds: ["css", "markup", "script"], title: "The second-order 'tasteful free font' (Fraunces, Instrument Serif, Playfair…) picked because it isn't Inter", fix: "Fine if it fits the subject; otherwise choose from the subject's world and record the reason.", keep: "Listed in STYLE.md.",
    file: (ctx) => fontDecls(ctx).filter((d) => TASTEFUL.includes(d.family)).slice(0, 2).map((d) => ({ line: lineAt(ctx.text, d.i), detail: d.family, font: d.family })) },
  { id: "eyebrow-caps", sev: "P2", cat: "type", kinds: ["css", "markup", "script"], title: "Tracked all-caps eyebrow labels used as template chrome (≥3)", fix: "Drop the label or make it carry real information in sentence case.", keep: "A wayfinding or signage system that really uses caps.",
    file: (ctx) => { let n = 0, at = -1; for (const c of classAttrs(ctx.text)) if (/\buppercase\b/.test(c.s) && /\btracking-(wide|wider|widest|\[0?\.[1-9])/.test(c.s)) { n++; if (at < 0) at = c.i; } for (const m of matches(ctx.text, /text-transform\s*:\s*uppercase[^}]*letter-spacing\s*:\s*(0?\.\d+em|[2-9]px)|letter-spacing\s*:\s*(0?\.(?:1|2|3)\d*em|[2-9]px)[^}]*text-transform\s*:\s*uppercase/gi)) { n++; if (at < 0) at = m.index; } return n >= 3 ? [{ line: lineAt(ctx.text, at), detail: `${n} eyebrow labels` }] : []; } },
  { id: "type-scale", sev: "P2", cat: "type", kinds: ["css"], title: "More than 8 font sizes in one stylesheet (no type scale)", fix: "State a scale (e.g. 1.25 or 1.333) and map every size to a step; ≤8 sizes.", keep: "",
    file: (ctx) => { const s = new Set(); for (const m of matches(ctx.text, /font-size\s*:\s*([\d.]+)(px|rem|em)\b/gi)) s.add((m[2] === "px" ? +m[1] / 16 : +m[1]).toFixed(3)); return s.size > 8 ? [{ line: 1, detail: `${s.size} sizes` }] : []; } },

  // ── Colour
  { id: "purple-gradient", sev: "P0", cat: "colour", kinds: ["css", "markup", "script"], title: "Purple/indigo/violet gradient: the canonical colour nobody chose", fix: "One flat brand colour from the subject's world; a gradient only with a job (photo veil, data ramp).", keep: "A gradient named in STYLE.md.",
    file: (ctx) => { const out = []; for (const m of matches(ctx.text, /(?:linear|radial|conic)-gradient\(([^;{}]*)\)/gi)) { const cs = colours(m[1]); if (cs.some(is.violet)) { out.push({ line: lineAt(ctx.text, m.index), detail: m[0].slice(0, 70), colours: cs.map(toHex) }); break; } } for (const c of classAttrs(ctx.text)) if (/\b(from|via|to)-(indigo|violet|purple|fuchsia)-\d{2,3}\b/.test(c.s) && /\bbg-gradient-|bg-linear-|bg-radial/.test(c.s)) { out.push({ line: lineAt(ctx.text, c.i), detail: c.s.match(/\b(from|via|to)-(indigo|violet|purple|fuchsia)-\d+/)[0] }); break; } return out; } },
  { id: "gradient-text", sev: "P0", cat: "colour", kinds: ["css", "markup", "script"], title: "Gradient-filled headline text", fix: "Solid ink; let size and weight make the headline win.", keep: "Listed in STYLE.md.",
    file: (ctx) => first(ctx, /(?:-webkit-)?background-clip\s*:\s*text|\bbg-clip-text\b/i) },
  { id: "default-purple", sev: "P1", cat: "colour", kinds: ["css", "markup", "script"], title: "Tailwind indigo/violet/purple as the accent (#6366f1, #8b5cf6, bg-indigo-600…)", fix: "Pick the accent from the subject (a flag, a material, a map layer) and give it one job.", keep: "Purple is the brand and STYLE.md says so.",
    file: (ctx) => { let n = 0, at = -1, hexes = new Set(); for (const m of matches(ctx.text, /#[0-9a-fA-F]{6}\b/g)) if (TW_PURPLE.has(m[0].toLowerCase())) { n++; hexes.add(m[0].toLowerCase()); if (at < 0) at = m.index; } for (const m of matches(ctx.text, /\b(?:bg|text|border|ring|fill|stroke)-(?:indigo|violet|purple)-(?:400|500|600|700)\b/g)) { n++; if (at < 0) at = m.index; } return n ? [{ line: lineAt(ctx.text, at), detail: `${n} uses`, colours: [...hexes] }] : []; } },
  { id: "neon-glow", sev: "P2", cat: "colour", kinds: ["css", "markup", "script"], title: "Coloured glow shadows (0 0 30px <saturated colour>)", fix: "Remove; separate with space or a hairline.", keep: "",
    file: (ctx) => { for (const m of matches(ctx.text, /(?:box|text)-shadow\s*:\s*([^;}]*)/gi)) { const v = m[1]; if (/\b0(?:px)?\s+0(?:px)?\s+(?:[2-9]\d|1\d\d)px/.test(v) && colours(v).some((c) => is.saturated(c) && c.a > 0.2)) return [{ line: lineAt(ctx.text, m.index), detail: v.slice(0, 60) }]; } return first(ctx, /\b(?:shadow|drop-shadow)-\[0_0_\d{2,}px_[^\]]*(?:#|rgb)/); } },
  { id: "cream-terracotta", sev: "P1", cat: "colour", kinds: ["css"], scope: "project", title: "Cream ground + terracotta accent: the second-order 'tasteful' default", fix: "If it isn't your brand, derive ground and accent from the subject.", keep: "It is your house paper and ink: list both colours in STYLE.md → Allow → colour (Non's warm paper is a choice).",
    project: (p) => { let cream = null, terra = null; for (const f of p.css) for (const m of matches(f.text, COLOUR_RE)) { const c = parseColour(m[0]); if (!c) continue; if (!cream && is.cream(c)) cream = { f, m, c }; if (!terra && is.terracotta(c)) terra = { f, m, c }; } return cream && terra ? [{ rel: cream.f.rel, line: lineAt(cream.f.text, cream.m.index), detail: `${toHex(cream.c)} + ${toHex(terra.c)}`, colours: [toHex(cream.c), toHex(terra.c)] }] : []; } },
  { id: "low-contrast", sev: "P1", cat: "a11y", kinds: ["css", "markup", "script"], title: "Text/background pair below WCAG AA (4.5:1, or 3:1 for large text)", fix: "Darken the ink or lighten the ground until it passes; check every real background.", keep: "Never: contrast is not a style choice.", noAllow: true,
    file: (ctx) => { const out = []; for (const m of matches(ctx.text, /\{([^{}]*)\}/g)) { const b = m[1]; const fg = b.match(/(?:^|[;\s])color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|white|black)/i), bg = b.match(/background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|white|black)\s*(?:;|$|!)/i); if (!fg || !bg) continue; const a = parseColour(fg[1]), c = parseColour(bg[1]); if (!a || !c || a.a < 1 || c.a < 1) continue; const big = /font-size\s*:\s*(2[4-9]|[3-9]\d)px|font-size\s*:\s*(1\.[5-9]|[2-9])rem/.test(b); const r = contrast(a, c); if (r < (big ? 3 : 4.5)) { out.push({ line: lineAt(ctx.text, m.index), detail: `${toHex(a)} on ${toHex(c)} = ${r.toFixed(2)}:1` }); if (out.length >= 3) break; } }
      for (const c of classAttrs(ctx.text)) { const t = c.s.match(/(?:^|\s)text-((?:slate|gray|zinc|neutral|stone)-\d{2,3}|white|black)(?:\s|$)/), g = c.s.match(/(?:^|\s)bg-((?:slate|gray|zinc|neutral|stone)-\d{2,3}|white|black)(?:\s|$)/); if (!t || !g) continue; const a = parseColour(twColour(t[1])), b = parseColour(twColour(g[1])); if (!a || !b) continue; const r = contrast(a, b); const big = /\btext-(2xl|[3-9]xl)\b/.test(c.s); if (r < (big ? 3 : 4.5)) { out.push({ line: lineAt(ctx.text, c.i), detail: `text-${t[1]} on bg-${g[1]} = ${r.toFixed(2)}:1` }); if (out.length >= 5) break; } } return out; } },
  { id: "dark-command-centre", sev: "P1", cat: "colour", kinds: ["css"], scope: "project", title: "Dark 'command centre' by default: navy/near-black ground plus glow, glass or gradient", fix: "Light by default. Dark only when the product is used in the dark, and then without glow or glass.", keep: "The product is used in the dark, or STYLE.md says dark.",
    project: (p) => { let dark = null; for (const f of p.css) { for (const m of matches(f.text, /(?:^|[}\n])\s*((?:html|body|:root|main|\.app)\b[^{}]*)\{[^}]*?background(?:-color)?\s*:\s*([^;}]+)/gi)) { if (/dark|night|theme|\[data-|\.is-|\s[.#\w]/i.test(m[1].trim())) continue; const c = colours(m[2])[0]; if (c && (is.navy(c) || is.nearBlack(c))) { dark = { f, i: m.index, c }; break; } } if (dark) break; } if (!dark) return []; const extra = p.css.some((f) => /backdrop-filter\s*:\s*blur|0\s+0\s+[2-9]\dpx\s+(?:#|rgba?\()|-gradient\(/i.test(f.text)); return extra ? [{ rel: dark.f.rel, line: lineAt(dark.f.text, dark.i), detail: toHex(dark.c) + " + glow/glass/gradient" }] : []; } },

  // ── Components & depth
  { id: "glass", sev: "P1", cat: "depth", kinds: ["css", "markup", "script"], title: "Glassmorphism (backdrop blur) by reflex", fix: "Solid surfaces. If text sits on a photo, use a flat veil for legibility.", keep: "A blur with a job (legibility over live video) named in STYLE.md.",
    file: (ctx) => first(ctx, /backdrop-filter\s*:\s*blur|\bbackdrop-blur(?:-\w+)?\b/i) },
  { id: "shadow-everything", sev: "P1", cat: "depth", kinds: ["css", "markup", "script"], title: "Fake depth: ≥8 drop shadows in one file (house limit is 3 per screen)", fix: "Separate with space and hairlines; keep shadows for things that really float (menus, dialogs).", keep: "",
    file: (ctx) => { const n = count(ctx.text, /box-shadow\s*:\s*(?!none|0\s*;|inherit)/gi) + [...classAttrs(ctx.text)].reduce((a, c) => a + (c.s.match(/(?:^|\s)(?:[a-z]+:)?shadow(?:-(?:sm|md|lg|xl|2xl))?(?=\s|$)/g) || []).length, 0); return n >= 8 ? [{ line: 1, detail: `${n} shadows` }] : []; } },
  { id: "rounded-card-kit", sev: "P1", cat: "depth", kinds: ["markup", "script"], title: "The card kit: rounded-xl/2xl + shadow on every box (≥3)", fix: "Let most content sit on the page. One radius system; most boxes need none.", keep: "",
    file: (ctx) => { let n = 0, at = -1; for (const c of classAttrs(ctx.text)) if (/\brounded-(xl|2xl|3xl)\b/.test(c.s) && /\bshadow-(md|lg|xl|2xl)\b/.test(c.s)) { n++; if (at < 0) at = c.i; } return n >= 3 ? [{ line: lineAt(ctx.text, at), detail: `${n} cards` }] : []; } },
  { id: "radius-soup", sev: "P2", cat: "depth", kinds: ["css"], title: "≥5 different corner radii in one stylesheet (no radius system)", fix: "One radius (or none) for the product, plus full-round only for true pills/avatars.", keep: "",
    file: (ctx) => { const s = new Set(); for (const m of matches(ctx.text, /border-radius\s*:\s*([^;}]+)/gi)) { const v = m[1].trim(); if (!/^(0|0px|50%|9{3,}px|100%|inherit|var\()/.test(v)) s.add(v); } return s.size >= 5 ? [{ line: 1, detail: [...s].slice(0, 6).join(" | ") }] : []; } },
  { id: "pill-clutter", sev: "P2", cat: "depth", kinds: ["markup", "script"], title: "≥10 pills/badges in one file (house limit is 5 per screen)", fix: "Use words in running text or a plain list; keep pills for real, filterable states.", keep: "",
    file: (ctx) => { let n = 0; for (const c of classAttrs(ctx.text)) if (/\brounded-full\b/.test(c.s) && /\bpx-\d/.test(c.s) && !/\b(h|w|size)-\d+\b.*\b(h|w|size)-\d+\b/.test(c.s)) n++; return n >= 10 ? [{ line: 1, detail: `${n} pills` }] : []; } },
  { id: "accent-border-card", sev: "P2", cat: "depth", kinds: ["css", "markup", "script"], title: "Coloured left-border 'accent' cards (≥2)", fix: "Drop the stripe; if it encodes a state, say the state in words too.", keep: "A real status colour system (severity, line colour) named in STYLE.md.",
    file: (ctx) => { const n = count(ctx.text, /\bborder-l-(?:4|\[\d+px\])\b|border-left\s*:\s*[3-8]px\s+solid/g); return n >= 2 ? first(ctx, /\bborder-l-(?:4|\[\d+px\])\b|border-left\s*:\s*[3-8]px\s+solid/) : []; } },
  { id: "icon-tile", sev: "P2", cat: "depth", kinds: ["markup", "script"], title: "Icon in a tinted rounded square, repeated (≥3)", fix: "Drop the tile; an icon earns its place only if it is read faster than the word.", keep: "",
    file: (ctx) => { let n = 0, at = -1; for (const c of classAttrs(ctx.text)) if (/\b(?:h|size)-(?:8|9|10|11|12|14)\b/.test(c.s) && /\brounded-(?:md|lg|xl|2xl)\b/.test(c.s) && /\bbg-(?:[a-z]+-(?:50|100)|[a-z]+-\d{3}\/(?:5|10|15|20)|primary\/10)\b/.test(c.s)) { n++; if (at < 0) at = c.i; } return n >= 3 ? [{ line: lineAt(ctx.text, at), detail: `${n} icon tiles` }] : []; } },
  { id: "shadcn-untouched", sev: "P1", cat: "depth", kinds: ["css"], title: "shadcn/ui theme left at its defaults", fix: "Set --primary, --radius and the neutrals from your own tokens.", keep: "",
    file: (ctx) => first(ctx, /--primary\s*:\s*(?:222\.2 47\.4% 11\.2%|oklch\(0\.205 0 0\))|--ring\s*:\s*222\.2 84% 4\.9%/) },
  { id: "effect-library", sev: "P2", cat: "motion", kinds: ["script", "markup"], title: "Stock effect components (Aceternity / Magic UI: spotlight, meteors, beams, aurora…)", fix: "Remove; one orchestrated moment beats a kit of effects.", keep: "",
    file: (ctx) => first(ctx, /from\s+["'][^"']*(?:magicui|aceternity|\/(?:spotlight|meteors|sparkles|background-beams|aurora-background|lamp|shimmer-button|border-beam|animated-beam))["']/i) },

  // ── Layout
  { id: "centered-hero", sev: "P1", cat: "layout", kinds: ["markup", "script"], title: "Centred hero: headline + subhead + two buttons, all centred", fix: "Open with the most characteristic thing in the subject (the map, the number, the photo, the table); one primary action.", keep: "",
    file: (ctx) => { for (const m of matches(ctx.text, /<h1\b/gi)) { const before = ctx.text.slice(Math.max(0, m.index - 900), m.index), after = ctx.text.slice(m.index, m.index + 1600); const around = before + after.slice(0, 400); if (!/\b(?:text-center|place-items-center|justify-items-center)\b|text-align\s*:\s*center|\bitems-center\b[^"']{0,80}\bjustify-center\b|\bjustify-center\b[^"']{0,80}\bitems-center\b|\bflex-col\b[^"']{0,60}\bitems-center\b|\bitems-center\b[^"']{0,60}\bflex-col\b/.test(around)) continue; const ctas = (after.match(/<(?:button|Button)\b|<a\b[^>]*(?:class(?:Name)?=["'][^"']*(?:btn|button|rounded)[^"']*["'])/g) || []).length; if (ctas >= 2) return [{ line: lineAt(ctx.text, m.index), detail: `${ctas} buttons under a centred h1` }]; } return []; } },
  { id: "card-grid-3", sev: "P1", cat: "layout", kinds: ["markup", "script", "css"], title: "Three (or four) identical cards in a row as the default composition", fix: "Vary weight: one thing leads; or use a list/table if the items are parallel.", keep: "The content really is three parallel things of equal weight (rare).",
    file: (ctx) => { const g = /\b(?:\w+:)?grid-cols-[34]\b|grid-template-columns\s*:\s*repeat\(\s*[34]\s*,\s*(?:1fr|minmax)/; const m = ctx.text.match(g); if (!m) return []; const cards = [...classAttrs(ctx.text)].filter((c) => /\brounded(?:-\w+)?\b/.test(c.s) && /\b(?:border|shadow(?:-\w+)?|bg-white|bg-card|bg-[a-z]+-(?:50|100|800|900))\b/.test(c.s) && /\bp-(?:4|5|6|8)\b/.test(c.s)).length; return cards >= 3 || ctx.kind === "css" && /\.card\b/.test(ctx.text) ? [{ line: lineAt(ctx.text, ctx.text.search(g)), detail: m[0] }] : []; } },
  { id: "modal-on-load", sev: "P1", cat: "layout", kinds: ["markup", "script"], title: "A modal, wall or cookie-style overlay on first load", fix: "Answer the question first; onboarding and disclaimers go inline or on demand.", keep: "A legal gate you are required to show.",
    file: (ctx) => first(ctx, /<dialog\b[^>]*\bopen\b|\bdefaultOpen(?:=\{true\}|\b(?!=))|useState\(\s*true\s*\)\s*;?\s*\/\/.*(?:modal|welcome)|const\s*\[\s*(?:show|is)(?:Welcome|Intro|Onboarding|Modal|Splash)\w*\s*,[^\]]*\]\s*=\s*useState\(\s*true/) },

  // ── Motion
  { id: "reduced-motion", sev: "P1", cat: "a11y", kinds: ["css", "script", "markup"], scope: "project", title: "Animation with no prefers-reduced-motion path", fix: "Wrap non-essential motion in @media (prefers-reduced-motion: no-preference) or use motion-safe:/useReducedMotion.", keep: "Never: motion sickness is not a style choice.", noAllow: true,
    project: (p) => { const all = p.files.filter((f) => f.kind !== "other"); if (all.some((f) => /prefers-reduced-motion|useReducedMotion|motion-(?:safe|reduce):|reducedMotion/.test(f.text))) return []; for (const f of all) { const m = f.text.match(/@keyframes\s+[\w-]+|from\s+["'](?:framer-motion|motion\/react|gsap)["']|\bdata-aos=|\banimate-(?!spin|pulse|none)[\w-]+/); if (m) return [{ rel: f.rel, line: lineAt(f.text, m.index), detail: m[0].slice(0, 50) }]; } return []; } },
  { id: "bounce-easing", sev: "P2", cat: "motion", kinds: ["css", "markup", "script"], title: "Bounce/elastic easing", fix: "Ease-out, 150–250 ms, transform/opacity only.", keep: "A playful product where bounce is the voice (STYLE.md).",
    file: (ctx) => { for (const m of matches(ctx.text, /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/g)) if (+m[2] > 1.05 || +m[4] > 1.05 || +m[2] < -0.05 || +m[4] < -0.05) return [{ line: lineAt(ctx.text, m.index), detail: m[0] }]; return first(ctx, /\banimate-bounce\b|\bbounce\s*:\s*0?\.[3-9]/); } },
  { id: "fade-up-everything", sev: "P2", cat: "motion", kinds: ["markup", "script"], title: "The same fade-up-on-scroll on every section (≥4)", fix: "One orchestrated moment, or none; motion should answer an action.", keep: "",
    file: (ctx) => { const n = count(ctx.text, /\bwhileInView\b|\bdata-aos=["']fade-up|\banimate-fade-?up\b|\bfadeInUp\b/g); return n >= 4 ? first(ctx, /\bwhileInView\b|\bdata-aos=["']fade-up|\banimate-fade-?up\b|\bfadeInUp\b/, () => `${n} fade-ups`) : []; } },
  { id: "count-up", sev: "P2", cat: "motion", kinds: ["script", "markup"], title: "Count-up stat animation", fix: "Show the real number, with its date and source.", keep: "",
    file: (ctx) => first(ctx, /from\s+["']react-countup["']|\bnew\s+CountUp\(|countup\.js/i) },

  // ── Icons, copy, imagery
  { id: "emoji-icons", sev: "P1", cat: "icons", kinds: ["markup", "script"], title: "Emoji used as UI icons (buttons, nav, headings, labels, icon props)", fix: "Use a word, or one real icon set used sparingly.", keep: "Emoji in prose, personal posts or a playful list are voice, not icons: they are not flagged.",
    file: (ctx) => { const E = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u; let n = 0, at = -1; const t = visibleText(ctx); for (const m of matches(t, /<(button|a|h[1-6]|nav|label|th|summary|option)\b[^>]*>([\s\S]{0,160}?)<\/\1>/gi)) { const inner = m[2].replace(/<[^>]+>/g, ""); if (E.test(inner)) { n++; if (at < 0) at = m.index; } } for (const m of matches(t, /\b(?:icon|emoji)\s*[:=]\s*\{?\s*["'`]\s*(\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)/gu)) { n++; if (at < 0) at = m.index; } return n ? [{ line: lineAt(ctx.text, at), detail: `${n} emoji icons` }] : []; } },
  { id: "sparkle-ai", sev: "P2", cat: "icons", kinds: ["script", "markup"], title: "Sparkle/wand icon to mean 'AI'", fix: "Name what the feature does.", keep: "",
    file: (ctx) => first(ctx, /import\s*\{[^}]*\b(?:Sparkles|Sparkle|Wand2|WandSparkles)\b[^}]*\}\s*from\s*["']lucide-react["']/) },
  { id: "hype-copy", sev: "P2", cat: "copy", kinds: ["markup", "script"], title: "Filler marketing words (seamless, unlock, supercharge, revolutionise, elevate, cutting-edge…)", fix: "Say what it does, with a noun from this product and a real number.", keep: "Quotation or a sentence that is about the word. A phrase or marker in STYLE.md → Protected voice (or Allow → phrase) is not flagged. Non's own essays are not scanned (Markdown is skipped).",
    file: (ctx) => { const re = /\b(seamless(?:ly)?|supercharg\w*|unlock (?:the|your)\b|revolutioni[sz]\w*|elevate your|empower(?:s|ing)? (?:you|teams|your)|effortless(?:ly)?|cutting[- ]edge|next[- ]gen(?:eration)?|game[- ]chang\w*|world[- ]class|best[- ]in[- ]class|all[- ]in[- ]one|to the next level|harness the power|unleash\w*|blazing(?:ly)?[- ]fast|in (?:just )?seconds)\b/gi; const ranges = quoteRanges(ctx.text); const out = []; const seen = new Set(); for (const s of textSegments(ctx)) { if (inQuotes(ranges, s.i)) continue; for (const m of matches(s.s, re)) { const sentence = sentenceAt(s.s, m.index); const key = sentence.toLowerCase(); if (seen.has(key)) continue; seen.add(key); out.push({ line: lineAt(ctx.text, s.i), detail: m[1], phrase: m[0], sentence }); if (out.length >= 8) return out; } } return out; } },
  { id: "generic-promise", sev: "P2", cat: "copy", kinds: ["markup", "script"], review: true, title: "Empty promise with no subject and no number (a world of colour, a journey, a future that is here)", fix: "Do not rewrite this automatically. Quote the sentence, say what it promises without a subject or a number, and propose the smallest edit that names the real thing. Do not invent a number.", keep: "A quotation (blockquote or q), or a phrase or marker listed in STYLE.md → Protected voice or Allow → phrase. One ordinary word is not this rule. The hit is REVIEW: it is not scored and nothing rewrites it.",
    file: (ctx) => genericPromises(ctx) },
  { id: "fake-proof", sev: "P1", cat: "copy", kinds: ["markup", "script"], title: "Fake social proof or round-number stats (Trusted by 10,000+ teams, 99.9% uptime, ★★★★★)", fix: "Real numbers with date and source, or nothing.", keep: "The number is real and sourced on the page. A quotation (blockquote or q) is not flagged.",
    file: (ctx) => { const re = /trusted by\s+(?:over\s+)?[\d,.]+\s*[km]?\+?|\b[\d,.]+[km]?\+\s+(?:happy\s+)?(?:users|teams|customers|companies|developers|businesses)\b|99\.9+%\s+uptime|★★★★★|join (?:thousands|millions) of/i; const ranges = quoteRanges(ctx.text); for (const s of textSegments(ctx)) { if (inQuotes(ranges, s.i)) continue; const m = s.s.match(re); if (m) return [{ line: lineAt(ctx.text, s.i), detail: m[0], phrase: m[0], sentence: sentenceAt(s.s, m.index) }]; } return []; } },
  { id: "generic-cta", sev: "P2", cat: "copy", kinds: ["markup", "script"], title: "Generic button labels (Get Started, Learn More, Click Here, Submit)", fix: "Verb + object: 'Check my street', 'Download the CSV'.", keep: "",
    file: (ctx) => { const t = visibleText(ctx); const m = t.match(/<(?:button|Button|a)\b[^>]*>\s*(get started|learn more|click here|submit|read more|sign up now)\s*(?:→|->)?\s*<\//i); return m ? [{ line: lineAt(t, m.index), detail: m[1] }] : []; } },
  { id: "placeholder-content", sev: "P1", cat: "copy", kinds: ["markup", "script", "css"], title: "Placeholder people, media or text (Lorem ipsum, John Doe, Acme, picsum, pravatar, Unsplash random)", fix: "Use real content early, including long labels and missing data.", keep: "",
    file: (ctx) => first(ctx, /lorem ipsum|\bjohn doe\b|\bjane doe\b|\bacme (?:inc|corp)\b|via\.placeholder\.com|placehold\.co|picsum\.photos|i\.pravatar\.cc|randomuser\.me\/api\/portraits|ui-avatars\.com|source\.unsplash\.com\/random/i) },
  { id: "ai-visual", sev: "P0", cat: "imagery", kinds: ["markup", "script", "css"], title: "AI-generated imagery (DALL·E, Midjourney, Replicate, Ideogram, Leonardo hosts or file names)", fix: "Use real photos, data, drawings or nothing. House rule: no AI-generated visuals.", keep: "",
    // The filename prefix is bounded. An unbounded [\w-]* makes this hang on a long identifier.
    file: (ctx) => first(ctx, /oaidalleapiprodscus\.blob|cdn\.midjourney\.com|replicate\.delivery|ideogram\.ai\/api\/images|cdn\.leonardo\.ai|(?:^|[^a-z0-9])[\w-]{0,40}(?:dall-?e|midjourney|stable-?diffusion|ai-generated|sdxl)[\w-]{0,40}\.(?:png|jpe?g|webp|avif)/i) },
  { id: "generator-signature", sev: "P1", cat: "imagery", kinds: ["markup", "script"], title: "Generator signature left in (v0, Lovable, Bolt, GPT Engineer)", fix: "Remove the tag/badge/script.", keep: "",
    file: (ctx) => first(ctx, /<meta[^>]+name=["']generator["'][^>]+content=["'](?:v0|lovable|bolt|gpt engineer)|lovable-tagger|cdn\.gpteng\.co|gptengineer\.js|made with bolt|built with v0|data-lovable/i) },

  // ── Accessibility & languages (from the review gate; mechanical part only)
  { id: "img-alt", sev: "P1", cat: "a11y", kinds: ["markup", "script"], title: "Images without alt (use alt=\"\" for decoration)", fix: "Describe what the image says, in the page's language; alt=\"\" if decorative.", keep: "Never.", noAllow: true,
    file: (ctx) => { let n = 0, at = -1; for (const m of matches(ctx.text, /<(?:img|Image)\b(?![^>]*\balt\s*=)(?![^>]*\{\s*\.\.\.)[^>]*>/g)) { n++; if (at < 0) at = m.index; } return n ? [{ line: lineAt(ctx.text, at), detail: `${n} image(s)` }] : []; } },
  { id: "unnamed-button", sev: "P1", cat: "a11y", kinds: ["markup", "script"], title: "Icon-only button with no accessible name", fix: "Add aria-label (in the page's language) or visible text.", keep: "Never.", noAllow: true,
    file: (ctx) => { for (const m of matches(ctx.text, /<button\b([^>]*)>\s*(<svg[\s\S]*?<\/svg>|<i\b[^>]*><\/i>|<[A-Z]\w*(?:Icon)?\b[^>]*\/>)\s*<\/button>/g)) if (!/aria-label|aria-labelledby|title=/.test(m[1])) return [{ line: lineAt(ctx.text, m.index), detail: m[0].slice(0, 60).replace(/\s+/g, " ") }]; return []; } },
  { id: "focus-removed", sev: "P1", cat: "a11y", kinds: ["css", "markup", "script"], scope: "project", title: "Focus outline removed with no :focus-visible replacement anywhere", fix: "Keep a visible focus style (outline 2px, offset 2px) on every interactive element.", keep: "Never.", noAllow: true,
    project: (p) => { const all = p.files.filter((f) => f.kind !== "other"); if (all.some((f) => /:focus-visible|focus-visible:|:focus\s*\{[^}]*(?:outline|box-shadow)\s*:\s*(?!none|0)/.test(f.text))) return []; for (const f of all) { const m = f.text.match(/outline\s*:\s*(?:none|0)\b|\b(?:focus:)?outline-none\b/); if (m) return [{ rel: f.rel, line: lineAt(f.text, m.index), detail: m[0] }]; } return []; } },
  { id: "html-lang", sev: "P1", cat: "lang", kinds: ["markup"], title: "<html> without lang", fix: "lang=\"en\" / \"th\" / \"zh-Hans\" so screen readers and fonts pick the right voice and glyphs.", keep: "Never.", noAllow: true,
    file: (ctx) => first(ctx, /<html\b(?![^>]*\blang=)[^>]*>/i) },
  { id: "viewport", sev: "P1", cat: "a11y", kinds: ["markup"], title: "Page has <head> but no viewport meta, or blocks zoom", fix: "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">; never user-scalable=no or maximum-scale=1.", keep: "Never.", noAllow: true,
    file: (ctx) => { if (/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?\b/i.test(ctx.text)) return first(ctx, /user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?\b/i); return /<head\b/i.test(ctx.text) && /<html\b/i.test(ctx.text) && !/name=["']viewport["']/i.test(ctx.text) ? [{ line: 1, detail: "no viewport meta" }] : []; } },
  { id: "lang-th", sev: "P2", cat: "lang", kinds: ["markup"], title: "Thai text with no lang=\"th\" anywhere in the file", fix: "Mark Thai blocks lang=\"th\" so the Thai face (non-looped: Prompt, Kanit) and line-breaking apply.", keep: "",
    file: (ctx) => { const t = visibleText(ctx); const i = t.search(/[\u0E00-\u0E7F]{3}/); return i >= 0 && !/lang\s*=\s*["']th|lang:\s*["']th|hreflang=["']th/i.test(ctx.text) ? [{ line: lineAt(ctx.text, i), detail: "Thai without lang" }] : []; } },
  { id: "lang-zh", sev: "P2", cat: "lang", kinds: ["markup"], title: "Chinese text with no lang=\"zh-Hans\" (or zh-*) anywhere in the file", fix: "Mark Chinese blocks lang=\"zh-Hans\" (Simplified unless the repo says otherwise).", keep: "",
    file: (ctx) => { const t = visibleText(ctx); const i = t.search(/[\u4E00-\u9FFF]{3}/); return i >= 0 && !/lang\s*=\s*["']zh|lang:\s*["']zh|hreflang=["']zh/i.test(ctx.text) ? [{ line: lineAt(ctx.text, i), detail: "Chinese without lang" }] : []; } },
  { id: "font-not-loaded", sev: "P1", cat: "type", kinds: ["css", "markup", "script"], scope: "project", title: "A named web font is declared but never loaded (silent fallback)", fix: "Load it (@font-face, a <link>, next/font or @fontsource) or remove it from the stack.", keep: "",
    project: (p) => { const loaded = new Set(); const all = p.files.filter((f) => f.kind !== "other"); for (const f of all) { for (const m of matches(f.text, /@font-face\s*\{[^}]*font-family\s*:\s*["']?([^"';}]+)/gi)) loaded.add(m[1].trim().toLowerCase()); for (const m of matches(f.text, /family=([^&"')\s]+)/g)) for (const fam of decodeURIComponent(m[1]).split("|")) loaded.add(fam.split(":")[0].replace(/\+/g, " ").trim().toLowerCase()); for (const m of matches(f.text, /@fontsource(?:-variable)?\/([\w-]+)/g)) loaded.add(m[1].replace(/-/g, " ").toLowerCase()); for (const d of fontDecls(f)) if (d.loaded) loaded.add(d.family); } if (p.fontFiles) for (const n of p.fontFiles) loaded.add(n); const out = []; const seen = new Set(); for (const f of all) for (const d of fontDecls(f)) { const fam = d.family; if (SYSTEM.has(fam) || DEFAULT_FONTS.includes(fam) || loaded.has(fam) || seen.has(fam) || [...loaded].some((l) => l.replace(/\s/g, "") === fam.replace(/\s/g, "") || (p.fontFiles || []).some((x) => x.includes(fam.replace(/\s/g, ""))))) continue; seen.add(fam); out.push({ rel: f.rel, line: lineAt(f.text, d.i), detail: fam, font: fam }); if (out.length >= 3) break; } return out; } },
  { id: "heavy-image", sev: "P2", cat: "speed", kinds: ["other"], title: "Image over 500 KB shipped as-is", fix: "Resize to the largest displayed size and serve AVIF/WebP; set width/height.", keep: "A full-resolution download the reader asked for.",
    file: (ctx) => (ctx.size > 500 * 1024 && /\.(png|jpe?g|gif|webp|avif|bmp|tiff?)$/i.test(ctx.rel) ? [{ line: 0, detail: `${Math.round(ctx.size / 1024)} KB` }] : []) },
];

export const SEV_POINTS = { P0: 3, P1: 2, P2: 1 };
export const SEV_ORDER = { P0: 0, P1: 1, P2: 2 };
