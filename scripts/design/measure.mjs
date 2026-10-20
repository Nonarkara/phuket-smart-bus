#!/usr/bin/env node
/**
 * Capture a page and MEASURE the layout defects, not just look at it.
 *
 * WHY THIS EXISTS
 *   "The top bar goes to the corner but the body is indented. The boxes are
 *   big and narrow. Every element is the same size." Those are measurable
 *   claims, and a screenshot cannot settle them. This dumps:
 *     · the gutter each major band starts at (the alignment complaint)
 *     · every box's width/height and the text inside it (the "big and narrow
 *       banner boxes" complaint)
 *     · the font size distribution (the "everything is the same size" one)
 *
 *   node scripts/design/measure.mjs "/v2?view=toolkit" --base https://depa-usdot.nonarkara.org --out /tmp/x.png
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const BASE = opt("base", "https://bus.nonarkara.org");
const OUT = opt("out", "/tmp/measure.png");
const W = Number(opt("width", 1440));
const H = Number(opt("height", 900));
const ROUTE = args.find((a) => !a.startsWith("--") && a !== BASE && a !== OUT && a !== String(W) && a !== String(H)) || "/";

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: "block" });
const p = await c.newPage();
await p.goto(BASE + ROUTE, { waitUntil: "load", timeout: 60000 });
await p.waitForTimeout(7000);
await p.screenshot({ path: OUT, fullPage: false });

const res = await p.evaluate(() => {
  const out = { bands: [], boxes: [], sizes: {}, text: "" };

  // ── bands: what x does each major band start at? ────────────────────────
  const bands = [];
  const push = (label, el) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    bands.push({ label, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
  };
  const cls = (sel) => document.querySelector(sel);
  for (const sel of ["header", "nav", ".v2-header", ".v2-topbar", ".v2-shell", "main", ".v2-body", ".v2-content", "footer"]) {
    const el = cls(sel);
    if (el) push(sel, el);
  }
  // any direct child of the app root
  const root = cls("#root") || document.body;
  for (const child of root.children) {
    const r = child.getBoundingClientRect();
    if (r.height > 20) bands.push({ label: `root>${child.tagName.toLowerCase()}.${String(child.className).split(/\s+/)[0]}`, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
  }
  out.bands = bands.sort((a, b) => a.y - b.y);

  // ── boxes: every bordered/padded block and its text ──────────────────────
  const boxes = [];
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
    const hasBg = cs.backgroundColor !== "rgba(0, 0, 0, 0)";
    if (!hasBorder && !hasBg) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) continue;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (text.length > 120) continue;
    boxes.push({
      cls: String(el.className).split(/\s+/).slice(0, 2).join(".") || el.tagName.toLowerCase(),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      ratio: +(r.width / r.height).toFixed(2),
      fs: cs.fontSize, text: text.slice(0, 60),
    });
  }
  out.boxes = boxes.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 70);

  // ── font size distribution ───────────────────────────────────────────────
  const sizes = {};
  for (const el of document.querySelectorAll("*")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const k = `${cs.fontSize} / w${cs.fontWeight}`;
    sizes[k] = (sizes[k] || 0) + 1;
  }
  out.sizes = sizes;
  out.text = (document.body.textContent || "").replace(/\s+/g, " ").trim().slice(0, 4000);
  return out;
});

console.log(`=== ${BASE}${ROUTE} @ ${W}x${H} → ${OUT} ===\n`);
console.log("BANDS (x = where the band starts):");
for (const b of res.bands) console.log(`  x=${String(b.x).padStart(4)}  y=${String(b.y).padStart(4)}  ${String(b.w).padStart(5)}×${String(b.h).padStart(4)}  ${b.label}`);
console.log("\nFONT SIZES (size / weight → count):");
for (const [k, n] of Object.entries(res.sizes).sort()) console.log(`  ${k}  ×${n}`);
console.log("\nBOXES (y-sorted, first 70):");
for (const b of res.boxes) console.log(`  ${String(b.x).padStart(4)},${String(b.y).padStart(4)}  ${String(b.w).padStart(4)}×${String(b.h).padStart(4)} r=${String(b.ratio).padStart(5)} ${b.fs.padStart(7)}  ${b.cls}  — "${b.text}"`);

await b.close();
