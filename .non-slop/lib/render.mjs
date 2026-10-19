// non-slop-skip-file: scanner code, not UI
// Rendered-page check (optional; needs Playwright: `npm i -D playwright && npx playwright install chromium`).
// Loads a URL or local HTML at 1440×900, 1024×768, 390×844 and 320×640; saves screenshots and a
// silhouette thumbnail; scores layout slop and the mechanical accessibility checks.
// The DOM metrics are ported from Nonarkara/palette tools/slop-lint.mjs (MIT, © 2026 Non Arkaraprasertkul),
// with the style-protection fixes: reading columns are not void, emoji count as icons only in UI slots,
// and STYLE.md allowlists apply.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadStyle, parseStyle, allowedBy } from "./style.mjs";

export function inPageMetrics() {
  const VW = innerWidth, VH = innerHeight, VA = VW * VH;
  const MAPSEL = '.leaflet-container,.maplibregl-map,.mapboxgl-map,.gm-style,.ol-viewport,.esri-view,.cesium-widget,.cesium-viewer,.deckgl-overlay,iframe[src*="map"],iframe[src*="arcgis"],[class*="MapContainer"],[id^="map"]';
  const big = e => { const r = e.getBoundingClientRect(); return r.width * r.height > VA * 0.04; };
  let maps = [...document.querySelectorAll(MAPSEL)].filter(big);
  // a large canvas (WebGL map / 3D) that is not inside a found map counts as map
  for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width * r.height > VA * 0.2 && !maps.some(m => m.contains(c))) maps.push(c); }
  maps = maps.filter(m => !maps.some(o => o !== m && o.contains(m))); // outermost
  const inMap = el => maps.some(m => m.contains(el));
  const hasMap = el => maps.some(m => el.contains(m));
  const docTopLimit = VH * 4; // only look at the first ~4 screens
  const parseC = s => { const m = s && s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const TW = new Set('0f172a 1e293b 334155 475569 64748b 94a3b8 cbd5e1 e2e8f0 f1f5f9 f8fafc 020617 111827 1f2937 374151 4b5563 6b7280 9ca3af d1d5db e5e7eb f3f4f6 f9fafb 030712 09090b 18181b 27272a 3f3f46 52525b 71717a a1a1aa 6366f1 4f46e5 4338ca 818cf8 8b5cf6 7c3aed 6d28d9 a78bfa a855f7 9333ea c084fc 3b82f6 2563eb 1d4ed8 60a5fa 93c5fd 10b981 059669 34d399 22c55e 16a34a ef4444 dc2626 f87171 f59e0b d97706 fbbf24 eab308 06b6d4 22d3ee 0ea5e9 38bdf8 ec4899 f472b6 f97316 fb923c 14b8a6'.split(' ').map(x => '#' + x));
  const out = { vw: VW, vh: VH, title: document.title.slice(0, 120) };
  out.mapCount = maps.length;
  const clipV = r => Math.max(0, Math.min(r.right, VW) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, VH) - Math.max(r.top, 0));
  out.mapShareFirstScreen = Math.min(1, maps.reduce((a, m) => a + clipV(m.getBoundingClientRect()), 0) / VA);
  // charts / tables = data
  let chart = 0;
  for (const e of document.querySelectorAll('svg,canvas,table,img[src*="chart"],[class*="chart"],[class*="Chart"],[class*="recharts"]')) {
    if (inMap(e)) continue; const r = e.getBoundingClientRect(); if (r.width < 120 || r.height < 60) continue;
    if (e.parentElement && e.parentElement.closest('svg,table,[class*="chart"],[class*="Chart"]')) continue;
    chart += clipV(r);
  }
  out.chartTableShareFirstScreen = Math.min(1, chart / VA);
  out.dataShareFirstScreen = Math.min(1, out.mapShareFirstScreen + out.chartTableShareFirstScreen);
  out.scrollHeightScreens = +(document.documentElement.scrollHeight / VH).toFixed(2);
  out.hOverflow = document.documentElement.scrollWidth > VW + 2;
  out.textChars0 = (document.body.innerText||'').length;
  const els = [...document.body.querySelectorAll('*')].slice(0, 9000);
  const info = new Map();
  const boxes = [];
  let gradients = 0, textGradients = 0, glass = 0, shadows = 0, pills = 0, eyebrows = 0, iconTiles = 0, flexKids = 0, flexGrowKids = 0;
  const fontSizes = new Map(), radii = new Map(); const colorArea = { purple: 0, painted: 0 }; const hues = new Map(); let twHits = 0, colorSamples = 0, oklch = 0;
  const fams = new Map();
  for (const el of els) {
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.top > docTopLimit || r.bottom < -VH) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) continue;
    const im = inMap(el);
    const directText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (directText && !im) {
      const fs = Math.round(parseFloat(cs.fontSize) * 2) / 2; fontSizes.set(fs, (fontSizes.get(fs) || 0) + directText.length);
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase(); fams.set(fam, (fams.get(fam) || 0) + directText.length);
      if (cs.textTransform === 'uppercase' && parseFloat(cs.letterSpacing) > 0.04 * parseFloat(cs.fontSize) && directText.length < 40) eyebrows++;
      const tc = parseC(cs.color); if (tc) { colorSamples++; if (TW.has(hex(tc))) twHits++; const [h, s, l] = hsl(tc); if (s > .4 && l > .2 && l < .85) { const b = Math.round(h / 30) % 12; hues.set(b, (hues.get(b) || 0) + 1); } }
      if (cs.color.includes('oklch') || cs.color.includes('oklab')) oklch++;
    }
    if (im) continue;
    const bgImg = cs.backgroundImage || '';
    if (bgImg.includes('gradient')) { gradients++; if ((cs.webkitBackgroundClip || cs.backgroundClip) === 'text') textGradients++; }
    if (cs.backdropFilter && cs.backdropFilter !== 'none' && cs.backdropFilter.includes('blur')) glass++;
    if (cs.boxShadow && cs.boxShadow !== 'none') shadows++;
    if (cs.display.includes('flex') || cs.display.includes('grid')) {
      for (const k of el.children) { const kcs = getComputedStyle(k); if (kcs.display === 'none' || kcs.position === 'absolute' || kcs.position === 'fixed') continue; flexKids++; if (parseFloat(kcs.flexGrow) > 0 || (cs.display.includes('grid') && cs.justifyItems.includes('stretch') && kcs.width && 0)) flexGrowKids++; }
    }
    const bg = parseC(cs.backgroundColor);
    const pbg = el.parentElement ? parseC(getComputedStyle(el.parentElement).backgroundColor) : null;
    const hasBg = bg && bg[3] > 0.05 && !(pbg && pbg[3] > 0.05 && Math.abs(bg[0] - pbg[0]) + Math.abs(bg[1] - pbg[1]) + Math.abs(bg[2] - pbg[2]) < 6);
    const bw = ['Top', 'Right', 'Bottom', 'Left'].filter(s => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none').length;
    const isBox = hasBg || bw >= 3 || (cs.boxShadow && cs.boxShadow !== 'none') || bgImg.includes('gradient');
    if (bg && bg[3] > 0.05) {
      const a = clipV(r); if (a > 0 && el.tagName !== 'BODY') { colorArea.painted += a; const [h, s, l] = hsl(bg); if (h >= 235 && h <= 300 && s > .3 && l > .15 && l < .85) colorArea.purple += a; if (TW.has(hex(bg))) twHits += 2; colorSamples += 2; if (s > .4 && l > .2 && l < .85 && a > 400) { const b = Math.round(h / 30) % 12; hues.set(b, (hues.get(b) || 0) + 1); } }
    }
    if (cs.backgroundColor.includes('oklch')) oklch++;
    if (!isBox || hasMap(el)) continue;
    const area = r.width * r.height;
    if (area < 600 || area > VA * 0.9) continue;
    const rad = Math.round(parseFloat(cs.borderTopLeftRadius) || 0);
    if (rad > 0 && rad >= r.height / 2 - 1 && r.height < 44) pills++;
    if (area > 1500) radii.set(rad, (radii.get(rad) || 0) + 1);
    const pad = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
    const rec = { el, r, cs, pad, rad, cArea: 0, bx: [1e9, 1e9, -1e9, -1e9], text: 0, digits: false, media: 0, fs: parseFloat(cs.fontSize) };
    info.set(el, rec); boxes.push(rec);
  }
  // content: text rects + media rects, attributed to every ancestor box
  const add = (node, rect, isText, len, digit) => {
    let p = node.nodeType === 1 ? node : node.parentElement;
    for (let d = 0; p && d < 30; d++, p = p.parentElement) {
      const b = info.get(p); if (!b) continue;
      b.cArea += rect.width * rect.height; b.bx[0] = Math.min(b.bx[0], rect.left); b.bx[1] = Math.min(b.bx[1], rect.top); b.bx[2] = Math.max(b.bx[2], rect.right); b.bx[3] = Math.max(b.bx[3], rect.bottom);
      if (isText) { b.text += len; if (digit) b.digits = true; } else b.media++;
    }
  };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n, tcount = 0; const range = document.createRange();
  const lines = []; const emojiRe = /\p{Extended_Pictographic}/u; let emoji = 0, emojiIcons = 0;
  const paraSeen = new Set();
  while ((n = tw.nextNode()) && tcount < 6000) {
    const t = n.textContent.trim(); if (!t) continue; const pe = n.parentElement; if (!pe || pe.closest('script,style,noscript')) continue;
    if (inMap(pe)) continue;
    range.selectNodeContents(n); const rects = [...range.getClientRects()].filter(q => q.width > 0 && q.top < docTopLimit);
    if (!rects.length) continue; tcount++;
    const em = [...t.matchAll(/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu)].length; emoji += em;
    // Non-Slop change: an emoji is an *icon* only in UI slots, never in prose or a playful list.
    { const ui = pe.closest('button,a,nav,h1,h2,h3,h4,h5,h6,label,th,summary,[role=button],[role=tab],[role=menuitem]'); if (em && ui && !(ui.tagName === 'A' && ui.closest('p,li,blockquote,dd'))) emojiIcons++; }
    for (const q of rects) add(n, q, true, t.length / rects.length, /\d/.test(t));
    // line length (em) for prose blocks
    const blk = pe.closest('p,li,dd,blockquote,div,span,td'); if (blk && !paraSeen.has(blk) && (blk.innerText || '').length > 120) {
      paraSeen.add(blk); const fsz = parseFloat(getComputedStyle(blk).fontSize) || 16;
      const r2 = document.createRange(); r2.selectNodeContents(blk); const lr = [...r2.getClientRects()]; const byLine = new Map();
      for (const q of lr) { const k = Math.round(q.top / 4); const o = byLine.get(k) || [1e9, -1e9]; o[0] = Math.min(o[0], q.left); o[1] = Math.max(o[1], q.right); byLine.set(k, o); }
      const ls = [...byLine.values()].filter(o => o[1] - o[0] <= VW).map(o => (o[1] - o[0]) / fsz); if (ls.length >= 2) { const cpl = (blk.innerText || '').length / ls.length; lines.push({ em: Math.max(...ls), cpl }); }
    }
  }
  for (const m of document.querySelectorAll('img,svg,canvas,video,input,select,textarea,iframe,button')) { if (inMap(m) || (m.tagName !== 'svg' && m.closest('svg'))) continue; const r = m.getBoundingClientRect(); if (r.width > 1 && r.height > 1 && r.top < docTopLimit) add(m, r, false, 0, false); }
  // per-box analysis
  let inflated = 0, statTiles = 0, wideChips = 0, tallBoxes = 0, measured = 0; const fills = []; const examples = [];
  for (const b of boxes) {
    const { r, pad } = b; const area = r.width * r.height; if (b.text === 0 && b.media === 0) continue;
    measured++; const fill = Math.min(1, b.cArea / area); fills.push(fill);
    const iw = Math.max(1, r.width - pad.l - pad.r), ih = Math.max(1, r.height - pad.t - pad.b);
    const cw = Math.max(0, b.bx[2] - b.bx[0]), ch = Math.max(0, b.bx[3] - b.bx[1]);
    const lh = (b.fs || 14) * 1.4;
    const emptyW = iw - cw, emptyH = ih - ch;
    const txtOnly = b.media === 0;
    // inflated box: lots of unused inner space relative to the type size
    if (txtOnly && area > 6000 && fill < 0.12 && (emptyH > 4 * lh || emptyW > 12 * lh)) { inflated++; if (examples.length < 6) examples.push({ kind: 'inflated', w: Math.round(r.width), h: Math.round(r.height), fill: +fill.toFixed(3), text: (b.el.innerText || '').trim().slice(0, 40) }); }
    if (b.text <= 40 && b.digits && area > 8000 && fill < 0.12 && r.top < VH * 2) statTiles++;
    if (b.text <= 24 && b.text > 0 && r.height < 56 && r.width > Math.max(3 * cw, cw + 140) && b.el.parentElement && r.width > 0.5 * b.el.parentElement.getBoundingClientRect().width) { wideChips++; if (examples.length < 8) examples.push({ kind: 'wide-chip', w: Math.round(r.width), cw: Math.round(cw), text: (b.el.innerText || '').trim().slice(0, 30) }); }
    if (txtOnly && emptyH > Math.max(60, 3 * lh) && ch < 0.4 * ih) tallBoxes++;
    if (r.width <= 72 && r.height <= 72 && Math.abs(r.width - r.height) < 6 && b.text <= 2 && (b.media > 0 || b.text > 0) && b.rad > 0) iconTiles++;
  }
  // equal-height stretch + uniform grids + sparse stretched rows
  let eqStretch = 0, eqRows = 0, uniGrids = 0, uniGrid34 = 0, sparseRows = 0;
  const parents = new Set(boxes.map(b => b.el.parentElement).filter(Boolean));
  for (const p of parents) {
    const kids = [...p.children].map(k => info.get(k)).filter(Boolean).filter(k => k.text + k.media > 0);
    if (kids.length < 2) continue;
    const rows = new Map(); for (const k of kids) { const key = Math.round(k.r.top / 3); (rows.get(key) || rows.set(key, []).get(key)).push(k); }
    for (const row of rows.values()) {
      if (row.length >= 2) {
        const hs = row.map(k => k.r.height), chs = row.map(k => Math.max(1, k.bx[3] - k.bx[1]));
        const sameH = Math.max(...hs) - Math.min(...hs) < 3;
        if (sameH && Math.max(...chs) / Math.min(...chs) > 1.6 && Math.max(...chs) - Math.min(...chs) > 40) { eqRows++; eqStretch += row.filter(k => (k.bx[3] - k.bx[1]) < 0.7 * k.r.height).length; }
        const ws = row.map(k => k.r.width); const sameW = (Math.max(...ws) - Math.min(...ws)) / Math.max(...ws) < 0.06;
        if (sameW && row.length >= 3 && row.every(k => k.r.width * k.r.height > 15000)) { uniGrids++; if (row.length === 3 || row.length === 4) uniGrid34++; }
      }
      // too-few items stretched across a wide row
      const pr = p.getBoundingClientRect();
      if (row.length <= 3 && pr.width > 0.6 * VW && row.every(k => k.r.width > 0.28 * VW) && row.every(k => (k.cArea / (k.r.width * k.r.height)) < 0.15 && k.media === 0)) sparseRows++;
    }
  }
  // ---- direct stretch test: how much bigger is each content box than its own content wants to be?
  const stretch = { w: 0, h: 0, byCause: {}, examples: [] };
  const cand = boxes.filter(b => b.text > 0 && b.text <= 80 && b.r.width >= 60 && b.r.top < VH * 2 && b.r.width < VW * 0.995).slice(0, 350);
  for (const b of cand) {
    const el = b.el, st = el.style, saved = st.cssText, r0 = el.getBoundingClientRect();
    const pcs = el.parentElement ? getComputedStyle(el.parentElement) : null;
    st.setProperty('width', 'max-content', 'important'); st.setProperty('min-width', '0', 'important'); st.setProperty('max-width', 'none', 'important'); st.setProperty('flex', 'none', 'important');
    st.setProperty('height', 'auto', 'important'); st.setProperty('min-height', '0', 'important'); st.setProperty('align-self', 'flex-start', 'important'); st.setProperty('justify-self', 'start', 'important');
    const r1 = el.getBoundingClientRect(); st.cssText = saved;
    const wR = r0.width / Math.max(1, r1.width), hR = r0.height / Math.max(1, r1.height);
    if (r1.width < 20 || r1.height < 12) continue; // content is absolutely positioned or a background image: can't measure intrinsic size
    const wHit = wR >= 2 && r0.width - r1.width >= 120, hHit = hR >= 1.6 && r0.height - r1.height >= 40;
    if (!wHit && !hHit) continue;
    const isStat = b.digits && b.text <= 30;
    const parentW = el.parentElement ? el.parentElement.getBoundingClientRect().width : VW;
    if (!isStat && parentW <= 480) continue; // full-width rows/controls inside a side panel or phone column are normal
    const kcs = b.cs; let cause = 'block-full-width';
    if (pcs && pcs.display.includes('grid')) cause = 'grid-track';
    else if (pcs && pcs.display.includes('flex')) cause = (parseFloat(kcs.flexGrow) > 0) ? 'flex-grow' : (hHit && !wHit ? 'equal-height(align-stretch)' : 'flex-stretch');
    if (hHit && parseFloat(kcs.minHeight) > 0) cause = 'min-height';
    if (hHit && kcs.height && el.style.height) cause = 'fixed-height';
    const kind = (b.digits && b.text <= 30) ? 'stat-tile' : (b.text <= 24 && r1.height < 48 ? 'chip/badge/button' : 'card/panel');
    if (wHit) stretch.w++; if (hHit) stretch.h++;
    const key = kind + ' · ' + cause; stretch.byCause[key] = (stretch.byCause[key] || 0) + 1;
    if (stretch.examples.length < 8) stretch.examples.push({ kind, cause, w: Math.round(r0.width), wantW: Math.round(r1.width), h: Math.round(r0.height), wantH: Math.round(r1.height), text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 36) });
  }
  out.stretchedW = stretch.w; out.stretchedH = stretch.h; out.stretchedTotal = Object.values(stretch.byCause).reduce((a, b) => a + b, 0); out.stretchByCause = stretch.byCause; out.stretchExamples = stretch.examples;
  out.stretchedShareOfSmallBoxes = cand.length ? +(out.stretchedTotal / cand.length).toFixed(2) : 0; out.smallBoxesTested = cand.length;
  // modal / wall on load
  let modal = false;
  for (const e of document.querySelectorAll('body *')) { const cs = getComputedStyle(e); if (cs.position !== 'fixed' && cs.position !== 'absolute') continue; const r = e.getBoundingClientRect(); if (r.width * r.height < VA * 0.85) continue; const c = parseC(cs.backgroundColor); if ((c && c[3] >= 0.2 && c[3] <= 0.97 && !inMap(e)) || (cs.backdropFilter && cs.backdropFilter.includes('blur'))) { modal = true; break; } }
  if (!modal) for (const e of document.querySelectorAll('dialog[open],[role=dialog],[aria-modal=true]')) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width * r.height > VA * 0.12 && clipV(r) > 0) { modal = true; break; } }
  out.modalOnLoad = modal;
  // content column width (phone layout on a desktop?)
  const xs = []; { const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t, c = 0; const rg = document.createRange(); while ((t = w2.nextNode()) && c < 3000) { if (!t.textContent.trim() || !t.parentElement || inMap(t.parentElement)) continue; rg.selectNodeContents(t); for (const q of rg.getClientRects()) if (q.top >= 0 && q.top < VH && q.width > 0 && q.right > 0 && q.left < VW) { xs.push(Math.max(0, q.left), Math.min(VW, q.right)); c++; } } }
  xs.sort((a, b) => a - b); out.textColumnShare = xs.length > 10 ? +((xs[Math.floor(xs.length * 0.97)] - xs[Math.floor(xs.length * 0.03)]) / VW).toFixed(2) : null;
  // neon glow + big-number tiles + dark theme
  let glow = 0, bigNum = 0;
  for (const b of boxes) { const sh = b.cs.boxShadow || ''; const m = sh.match(/rgba?\([^)]+\)/g) || []; if (m.some(c => { const q = parseC(c); if (!q) return false; const [, s2, l2] = hsl(q); return s2 > .5 && l2 > .3 && q[3] > .2; }) && /\d+px\s+\d+px\s+([1-9]\d|[4-9])px/.test(sh)) glow++; }
  for (const e of document.querySelectorAll('body *')) { if (e.children.length) continue; const t = (e.textContent || '').trim(); if (!/^[\d.,%+\-]{1,7}$/.test(t)) continue; const r = e.getBoundingClientRect(); if (r.top > VH * 2 || r.width === 0 || inMap(e)) continue; if (parseFloat(getComputedStyle(e).fontSize) >= 26) bigNum++; }
  out.neonGlow = glow; out.bigNumbers = bigNum;
  { let inBox = 0, tot = 0; for (const [el, b] of info) {} const w3 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t, c = 0;
    while ((t = w3.nextNode()) && c < 4000) { const tx = t.textContent.trim(); const pe = t.parentElement; if (!tx || !pe || inMap(pe) || pe.closest('script,style')) continue; const r = pe.getBoundingClientRect(); if (r.top > VH || r.bottom < 0 || r.width === 0) continue; c++; tot += tx.length;
      let q = pe, boxed = false; for (let d = 0; q && d < 12; d++, q = q.parentElement) { const b = info.get(q); if (b && b.r.width * b.r.height < VA * 0.35) { boxed = true; break; } } if (boxed) inBox += tx.length; }
    out.boxedTextShare = tot ? +(inBox / tot).toFixed(2) : 0; }
  const bb = parseC(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 0]; const hb = parseC(getComputedStyle(document.documentElement).backgroundColor) || [255, 255, 255, 0];
  const bgc = bb[3] > 0.1 ? bb : hb[3] > 0.1 ? hb : [255, 255, 255, 1]; out.darkTheme = (0.3 * bgc[0] + 0.59 * bgc[1] + 0.11 * bgc[2]) < 50;
  // hero
  const h1 = [...document.querySelectorAll('h1,h2,[class*="hero"],header')].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < VH; });
  let hero = 0;
  if (h1) { let s = h1, best = h1; while (s && s !== document.body) { const r = s.getBoundingClientRect(); if (r.width >= 0.8 * VW && r.top <= 5 + window.scrollY * 0 && r.height < 1.5 * VH) best = s; if (r.height >= 1.5 * VH) break; s = s.parentElement; } const r = best.getBoundingClientRect(); if (!hasMap(best) && !best.querySelector('table,canvas')) hero = Math.min(r.bottom, VH * 1.5) / VH; }
  // first data element top
  const dataEls = [...maps, ...document.querySelectorAll('table,canvas,svg[class*="chart"],[class*="recharts"]')].map(e => e.getBoundingClientRect()).filter(r => r.width > 120 && r.height > 60);
  out.firstDataTopScreens = dataEls.length ? +(Math.min(...dataEls.map(r => r.top)) / VH).toFixed(2) : null;
  // largest non-map box share (clipped to first screen)
  let largest = 0; for (const b of boxes) { if (b.el === document.body) continue; const a = clipV(b.r); if (a / VA > largest && b.r.width < VW * 0.98 + 1) largest = a / VA; }
  const rv = [...radii.entries()].filter(([k]) => k > 0).sort((a, b) => b[1] - a[1]); const rTot = [...radii.values()].reduce((a, b) => a + b, 0);
  const txt = (document.body.innerText || '').slice(0, 200000);
  const ph = {}; const PH = { lorem: /lorem ipsum/gi, placeholder: /placeholder/gi, sample: /sample data|ข้อมูลตัวอย่าง|\bdemo data\b|\bmock\b|dummy/gi, simulated: /simulated|จำลอง/gi, broken: /\bundefined\b|\bNaN\b|\[object Object\]/g, loading: /loading\.\.\.|กำลังโหลด/gi, comingSoon: /coming soon|เร็ว ?ๆ ?นี้/gi, dash: /(^|\s)(--|—|N\/A)(\s|$)/g };
  for (const [k, re] of Object.entries(PH)) ph[k] = (txt.match(re) || []).length;
  const famTop = [...fams.entries()].sort((a, b) => b[1] - a[1]);
  const SLOPF = ['inter', 'poppins', 'montserrat', 'roboto', 'open sans', 'lato', 'dm sans', 'space grotesk', 'geist', 'plus jakarta sans', 'manrope', 'nunito', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'arial', 'helvetica', 'sans-serif', 'ui-sans-serif', 'noto sans thai', 'ibm plex sans thai', 'sarabun', 'kanit', 'prompt'];
  Object.assign(out, {
    boxesMeasured: measured, medianFill: fills.length ? +fills.sort((a, b) => a - b)[Math.floor(fills.length / 2)].toFixed(3) : null,
    inflatedBoxes: inflated, statTilesStretched: statTiles, wideChips, tallEmptyBoxes: tallBoxes, eqHeightRows: eqRows, eqHeightStretchedCards: eqStretch,
    sparseStretchedRows: sparseRows, flexGrowShare: flexKids ? +(flexGrowKids / flexKids).toFixed(2) : 0,
    uniformGrids: uniGrids, uniformGrids3or4: uniGrid34, largestNonMapBoxShare: +largest.toFixed(3), heroShare: +hero.toFixed(2),
    fontSizes: fontSizes.size, fontSizesMajor: [...fontSizes.values()].filter(v => v >= 20).length,
    gradients, textGradients, glassBlur: glass, shadows, pills, eyebrowLabels: eyebrows, iconTiles,
    emoji, emojiIcons, maxLineEm: lines.length ? +Math.max(...lines.map(l => l.em)).toFixed(1) : 0, maxCpl: lines.length ? Math.round(Math.max(...lines.map(l => l.cpl))) : 0,
    radiusDistinct: rv.length, radiusModalShare: rTot ? +((rv[0]?.[1] || 0) / rTot).toFixed(2) : 0, radiusModal: rv[0]?.[0] ?? 0, roundedShare: rTot ? +(rv.reduce((a, b) => a + b[1], 0) / rTot).toFixed(2) : 0,
    purpleShare: colorArea.painted ? +(colorArea.purple / colorArea.painted).toFixed(3) : 0, accentHues: [...hues.entries()].filter(([, c]) => c >= 3).length,
    tailwindDefaultShare: colorSamples ? +(twHits / colorSamples).toFixed(2) : 0, oklch, primaryFont: famTop[0]?.[0] || '', fontFamilies: famTop.filter(([, c]) => c > 50).length,
    defaultFont: famTop[0] ? SLOPF.includes(famTop[0][0]) : false,
    placeholderHits: ph, textChars: txt.length, bodySample: txt.slice(0, 160).replace(/\s+/g, ' '), examples
  });
  // Non-Slop change: a 45–80ch prose column at body size is a reading column, not void.
  { const prose = lines.filter(l => l.cpl >= 35); const bodyFs = [...fontSizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 16;
    out.proseBlocks = prose.length; out.medianProseCpl = prose.length ? Math.round(prose.map(l => l.cpl).sort((a, b) => a - b)[Math.floor(prose.length / 2)]) : 0;
    out.readingColumn = prose.length >= 2 && out.medianProseCpl >= 40 && out.medianProseCpl <= 85 && bodyFs >= 15; }
  return out;
}

// ── accessibility metrics (run in page)
export function a11yMetrics(mobile) {
  const VW = innerWidth, VH = innerHeight;
  const parse = (s) => { const m = s && s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const MAPSEL = '.leaflet-container,.maplibregl-map,.mapboxgl-map,.gm-style,.ol-viewport,.esri-view,.cesium-widget,canvas';
  const bgOf = (el) => { let acc = null; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { if (c[3] >= 0.95) return acc ? [acc[0] * acc[3] + c[0] * (1 - acc[3]), acc[1] * acc[3] + c[1] * (1 - acc[3]), acc[2] * acc[3] + c[2] * (1 - acc[3])] : c; acc = acc || c; } } return acc ? null : [255, 255, 255]; };
  // contrast: every visible text element on the first screen, against what is really painted under it
  const fails = []; let checked = 0;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  const seen = new Set();
  while ((n = tw.nextNode()) && checked < 1500) {
    const t = n.textContent.trim(); const el = n.parentElement; if (!t || !el || seen.has(el) || el.closest('script,style,noscript,svg') || el.closest(MAPSEL)) continue; seen.add(el);
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.top > VH * 2 || r.bottom < 0) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
    let bg;
    const cx = r.left + Math.min(r.width, 40) / 2, cy = r.top + Math.min(r.height, 20) / 2;
    if (cx >= 0 && cy >= 0 && cx < VW && cy < VH) { // what is really under the text, including canvases and siblings painted behind it
      const stack = document.elementsFromPoint(cx, cy); const at = stack.indexOf(el); if (at < 0) continue; // covered by something else: not visible
      bg = undefined; for (const e of stack.slice(at)) { if (/^(IMG|VIDEO|CANVAS|IFRAME|PICTURE)$/.test(e.tagName)) { bg = null; break; } const es = getComputedStyle(e); if (es.backgroundImage && es.backgroundImage !== 'none') { bg = null; break; } const c = parse(es.backgroundColor); if (c && c[3] >= 0.95) { bg = c; break; } }
      if (bg === undefined) bg = parse(getComputedStyle(document.documentElement).backgroundColor)?.[3] > 0.5 ? parse(getComputedStyle(document.documentElement).backgroundColor) : [255, 255, 255];
    } else continue; // off the first screen: covered or scrolled content can't be judged reliably
    const fg = parse(cs.color); if (!fg || !bg || fg[3] < 0.95) continue; checked++;
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700; const large = px >= 24 || (bold && px >= 18.66);
    const cr = ratio(fg, bg); if (cr < (large ? 3 : 4.5)) fails.push({ text: t.slice(0, 30), ratio: +cr.toFixed(2), px });
  }
  // tap targets (phone only): interactive controls under 44×44, excluding inline links in running text
  const small = []; let controls = 0;
  if (mobile) for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=link],summary')) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || r.top > VH * 3) continue; if (el.closest(MAPSEL) && !el.closest('.leaflet-control,.maplibregl-ctrl,.mapboxgl-ctrl')) continue;
    if (el.tagName === 'A' && el.closest('p,li,dd,blockquote,td') && cs.display === 'inline') continue; controls++;
    if (r.width < 44 || r.height < 44) { // WCAG 2.5.8 spacing exception: a 24px target with room around it is OK; we hold the house 44px line
      small.push({ text: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }); }
  }
  // bars: the chrome at the top/bottom edge of a map product
  let topBar = 0, bottomBar = 0;
  for (const el of document.querySelectorAll('header,nav,[role=banner],[class*=header],[class*=Header],[class*=toolbar],[class*=topbar],[class*=navbar],footer,[class*=bottom-bar],[class*=tabbar]')) {
    const r = el.getBoundingClientRect(); if (r.width < VW * 0.8 || r.height < 8 || r.height > VH * 0.5) continue; if (el.querySelector(MAPSEL)) continue;
    if (r.top <= 4) topBar = Math.max(topBar, r.bottom); else if (r.bottom >= VH - 4 && r.top > VH * 0.5) bottomBar = Math.max(bottomBar, VH - r.top);
  }
  return { contrastChecked: checked, contrastFails: fails.length, contrastExamples: fails.slice(0, 6), controls, smallTargets: small.length, smallTargetExamples: small.slice(0, 6), topBar: Math.round(topBar), bottomBar: Math.round(bottomBar) };
}

async function focusCheck(page) {
  // Record each focusable element's resting style, then Tab through and see whether focus is visible.
  await page.evaluate(() => { window.__ns = []; const sel = 'a[href],button,input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"]),summary'; for (const el of document.querySelectorAll(sel)) { const cs = getComputedStyle(el); el.__nsRest = [cs.outlineStyle + cs.outlineWidth + cs.outlineColor, cs.boxShadow, cs.borderColor, cs.backgroundColor, cs.color, cs.textDecorationLine]; } });
  const res = { tabbed: 0, invisible: 0, examples: [] };
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body || !el.__nsRest) return null; if (el.__nsSeen) return { again: true }; el.__nsSeen = 1; const cs = getComputedStyle(el); const now = [cs.outlineStyle + cs.outlineWidth + cs.outlineColor, cs.boxShadow, cs.borderColor, cs.backgroundColor, cs.color, cs.textDecorationLine]; const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1; const changed = outline || now.some((v, k) => v !== el.__nsRest[k]); const b = el.getBoundingClientRect(); return { changed, text: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24), visible: b.width > 0 && b.height > 0 }; });
    if (r && r.again) break; if (!r || !r.visible) continue; res.tabbed++; if (!r.changed) { res.invisible++; if (res.examples.length < 5) res.examples.push(r.text); }
  }
  return res;
}

// pixel stats + silhouette, computed in a scratch page from the screenshot (no image library needed)
async function pixels(browser, png, silhouettePath) {
  const page = await browser.newPage();
  const out = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, W, H).data;
    const T = 20, cols = Math.floor(W / T), rows = Math.floor(H / T), flat = new Uint8Array(cols * rows), tc = []; let lumSum = 0;
    for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) { let s = 0, s2 = 0, k = 0, R = 0, G = 0, B = 0; for (let y = ty * T; y < ty * T + T; y += 2) for (let xx = tx * T; xx < tx * T + T; xx += 2) { const i = (y * W + xx) * 4, l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; s += l; s2 += l * l; k++; R += d[i]; G += d[i + 1]; B += d[i + 2]; } const sd = Math.sqrt(Math.max(0, s2 / k - (s / k) ** 2)); flat[ty * cols + tx] = sd < 1.5 ? 1 : 0; tc[ty * cols + tx] = [R / k, G / k, B / k]; lumSum += s / k; }
    const total = cols * rows, seen = new Uint8Array(total); let best = 0;
    for (let i = 0; i < total; i++) { if (!flat[i] || seen[i]) continue; let size = 0; const st = [i]; seen[i] = 1; const c0 = tc[i]; while (st.length) { const j = st.pop(); size++; const px = j % cols, py = (j / cols) | 0; for (const q of [px > 0 ? j - 1 : -1, px < cols - 1 ? j + 1 : -1, py > 0 ? j - cols : -1, py < rows - 1 ? j + cols : -1]) { if (q < 0 || seen[q] || !flat[q]) continue; const cc = tc[q]; if (Math.abs(cc[0] - c0[0]) + Math.abs(cc[1] - c0[1]) + Math.abs(cc[2] - c0[2]) > 12) continue; seen[q] = 1; st.push(q); } } best = Math.max(best, size); }
    // silhouette: 200px wide; black where the page differs from its most common ground colour, white if not
    const modes = new Map(); for (const c of tc) { const k = c.map((v) => Math.round(v / 16)).join(','); modes.set(k, (modes.get(k) || 0) + 1); } const gk = [...modes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; const ground = gk ? gk.split(',').map((v) => +v * 16) : [255, 255, 255], sw = 200, sh = Math.round(H * sw / W), s = document.createElement('canvas'); s.width = sw; s.height = sh; const sx = s.getContext('2d'); sx.fillStyle = '#fff'; sx.fillRect(0, 0, sw, sh); sx.fillStyle = '#000';
    const cw = W / sw; for (let y = 0; y < sh; y += 2) for (let xx = 0; xx < sw; xx += 2) { const i = (Math.floor(y * cw) * W + Math.floor(xx * cw)) * 4; if (Math.abs(d[i] - ground[0]) + Math.abs(d[i + 1] - ground[1]) + Math.abs(d[i + 2] - ground[2]) > 40) sx.fillRect(xx, y, 2, 2); }
    return { flatShare: +(flat.reduce((a, b) => a + b, 0) / total).toFixed(3), largestFlatRegion: +(best / total).toFixed(3), meanLum: Math.round(lumSum / total), darkScreen: lumSum / total < 70, silhouette: s.toDataURL('image/png').split(',')[1] };
  }, png.toString('base64'));
  await page.close();
  if (silhouettePath) fs.writeFileSync(silhouettePath, Buffer.from(out.silhouette, 'base64'));
  delete out.silhouette; return out;
}

// ── render rules → points (weights and thresholds from the palette study; a11y rules added)
const stretchCount = (d, mobile) => Object.entries(d.stretchByCause || {}).reduce((a, [k, v]) => a + (k === 'card/panel · block-full-width' || (mobile && k === 'chip/badge/button · block-full-width') ? 0 : v), 0);
const hasMap = (d) => (d.mapShareFirstScreen || 0) >= 0.15;
export const RENDER_RULES = [
  { id: 'stretch-to-fill', w: 2, desc: 'Small things laid out ≥2× wider or ≥1.6× taller than their content needs (≥2 of them)', test: (d, m) => stretchCount(d, false) + stretchCount(m, true) >= 2 },
  { id: 'rounded-same', w: 2, desc: 'Rounded-everything: ≥80% of boxes rounded and ≥40% share one radius', test: d => d.boxesMeasured >= 8 && d.roundedShare >= 0.8 && d.radiusModalShare >= 0.4 },
  { id: 'emoji-icons', w: 2, desc: '≥3 emoji used as icons in buttons, links, headings, nav or labels', test: (d, m) => Math.max(d.emojiIcons || 0, m.emojiIcons || 0) >= 3 },
  { id: 'dark-command-centre', w: 2, desc: 'Dark first screen plus glow, gradient, glass, ≥10 pills or emoji icons', test: (d, m) => !!(d.darkScreen || m.darkScreen) && ((d.neonGlow || 0) >= 1 || (d.gradients || 0) >= 1 || (d.glassBlur || 0) >= 1 || (d.pills || 0) >= 10 || (d.emojiIcons || 0) >= 3) },
  { id: 'void', w: 2, desc: 'Accidental empty space: a flat region ≥35% of the first screen, or text squeezed into <45% of the width, with no map, no data and no reading column', test: (d) => !d.readingColumn && (d.mapShareFirstScreen || 0) < 0.4 && (d.dataShareFirstScreen || 0) < 0.4 && ((d.largestFlatRegion || 0) >= 0.35 || (d.textColumnShare != null && d.textColumnShare < 0.45)) },
  { id: 'hero-no-data', w: 2, desc: 'Hero ≥55% of the first screen with <20% map or data', test: d => d.heroShare >= 0.55 && d.dataShareFirstScreen < 0.2 },
  { id: 'map-not-first', w: 2, desc: 'Map product where the map takes <60% of the first screen (surgical-table rule)', test: (d, m) => hasMap(d) && (d.mapShareFirstScreen < 0.6 || (hasMap(m) && m.mapShareFirstScreen < 0.6)) },
  { id: 'fat-bars', w: 1, desc: 'Map product with a top or bottom bar taller than 56px', test: (d, m) => (hasMap(d) || hasMap(m)) && Math.max(d.topBar || 0, d.bottomBar || 0, m.topBar || 0, m.bottomBar || 0) > 56 },
  { id: 'shadow-everything', w: 1, desc: '≥8 boxes with a drop shadow on one screen', test: d => (d.shadows || 0) >= 8 },
  { id: 'box-soup', w: 1, desc: '≥30 boxes with ≥5 different corner radii', test: d => (d.boxesMeasured || 0) >= 30 && (d.radiusDistinct || 0) >= 5 },
  { id: 'pill-clutter', w: 1, desc: '≥10 pills/badges on one screen', test: (d, m) => Math.max(d.pills || 0, m.pills || 0) >= 10 },
  { id: 'modal-on-load', w: 1, desc: 'A modal or full-screen overlay on first load', test: (d, m) => !!(d.modalOnLoad || m.modalOnLoad) },
  { id: 'gradients', w: 1, desc: '≥3 decorative gradient fills, or gradient text', test: (d, m) => Math.max(d.gradients || 0, m.gradients || 0) >= 3 || (d.textGradients || 0) >= 1 },
  { id: 'glass', w: 1, desc: '≥2 backdrop-blur layers', test: (d, m) => Math.max(d.glassBlur || 0, m.glassBlur || 0) >= 2 },
  { id: 'big-number-tiles', w: 1, desc: '≥2 big bare numbers in tiles', test: d => (d.bigNumbers || 0) >= 2 },
  { id: 'long-lines', w: 1, desc: 'Prose lines wider than ~40em (≈80+ Latin characters)', test: d => d.maxLineEm > 40 },
  { id: 'type-chaos', w: 1, desc: '≥9 distinct font sizes', test: d => d.fontSizes >= 9 },
  { id: 'mobile-overflow', w: 1, desc: 'Phone (390) or 320px layout scrolls sideways', test: (d, m, x) => !!m.hOverflow || !!(x && x.hOverflow) },
  { id: 'broken-placeholder', w: 1, desc: 'Visible undefined/NaN, lorem ipsum or mock/sample data', test: d => (d.placeholderHits?.broken || 0) + (d.placeholderHits?.lorem || 0) + (d.placeholderHits?.sample || 0) >= 1 },
  { id: 'low-contrast', w: 2, a11y: true, desc: '≥3 text elements below WCAG AA contrast', test: (d, m) => Math.max(d.contrastFails || 0, m.contrastFails || 0) >= 3 },
  { id: 'small-targets', w: 1, a11y: true, desc: '≥3 phone controls smaller than 44×44px', test: (d, m) => (m.smallTargets || 0) >= 3 },
  { id: 'focus-invisible', w: 2, a11y: true, desc: '≥2 controls show no visible change when reached with Tab', test: (d) => (d.focus?.invisible || 0) >= 2 },
  { id: 'boxed-everything', w: 0, desc: '≥70% of first-screen text inside boxes (reported only)', test: d => (d.boxedTextShare || 0) >= 0.7 },
  { id: 'default-font', w: 0, desc: 'Primary face is a stock default (reported only; the static scan judges fonts)', test: d => !!d.defaultFont },
];

export async function renderUrl(target, opts = {}) {
  let chromium; try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = await import('playwright-core')); } catch { throw new Error('render needs Playwright. In this repo run: npm i -D playwright && npx playwright install chromium   (or set CHROME=/path/to/chrome with playwright-core)'); } }
  const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(path.resolve(target)).href;
  const outDir = opts.out || 'non-slop-shots'; fs.mkdirSync(outDir, { recursive: true });
  const slug = (url.startsWith('file:') ? path.basename(path.dirname(url)) + '-' + path.basename(url) : url.replace(/^\w+:\/+/, '')).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const res = { url, shots: [] };
  try {
    for (const [vp, w, h, mobile] of [['desktop', 1440, 900, false], ['tablet', 1024, 768, false], ['mobile', 390, 844, true], ['narrow', 320, 640, true]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: mobile, locale: opts.locale || 'th-TH', timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce', ignoreHTTPSErrors: true, userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' : undefined });
      const page = await ctx.newPage();
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 }); res[vp + 'Status'] = resp ? resp.status() : null;
        await page.waitForLoadState('networkidle', { timeout: (opts.settleMs || 6000) + 4000 }).catch(() => {}); await page.waitForTimeout((opts.settleMs || 6000) / 2);
        if (vp === 'narrow') { res.narrow = { hOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2) }; await ctx.close(); continue; }
        const dom = await page.evaluate(inPageMetrics); const a11y = await page.evaluate(a11yMetrics, mobile);
        const shot = await page.screenshot({ type: 'png' }); const file = path.join(outDir, `${slug}-${w}.png`); fs.writeFileSync(file, shot); res.shots.push(file);
        const px = await pixels(browser, shot, vp === 'desktop' ? path.join(outDir, `${slug}-silhouette.png`) : null);
        if (vp === 'desktop') res.silhouette = path.join(outDir, `${slug}-silhouette.png`);
        const focus = vp === 'desktop' ? await focusCheck(page) : undefined;
        res[vp] = { ...dom, ...a11y, ...px, focus };
      } catch (e) { res[vp + 'Error'] = String(e.message || e).split('\n')[0].slice(0, 200); }
      await ctx.close();
    }
  } finally { await browser.close(); }
  const d = res.desktop;
  if (d && /just a moment|attention required|checking your browser/i.test(d.title + ' ' + (d.bodySample || ''))) res.status = 'BLOCKED';
  else if (d && d.textChars < 400 && !d.mapCount && (d.largestFlatRegion || 0) > 0.6) res.status = 'DEAD/EMPTY';
  else if (d) res.status = 'OK'; else res.status = 'ERROR';
  if (res.status === 'OK') {
    const style = opts.style ? loadStyle(null, opts.style) : (/^https?:/.test(target) ? parseStyle('', '(none)') : loadStyle(path.resolve(target)));
    res.style = style.file;
    res.hits = [];
    for (const r of RENDER_RULES) { let hit = false; try { hit = r.test(d, res.mobile || {}, res.narrow); } catch {} if (!hit) continue;
      const rel = /^https?:/.test(target) ? target : path.relative(process.cwd(), path.resolve(target)).split(path.sep).join('/');
      const why = allowedBy(style, null, { id: r.id }, rel);
      res.hits.push({ id: r.id, w: r.w, desc: r.desc, status: why ? (r.a11y ? 'ASK-OWNER' : 'ALLOWED') : 'FAIL', allowedBy: why || undefined }); }
    res.points = res.hits.filter((h) => h.status === 'FAIL').reduce((a, h) => a + h.w, 0);
    res.verdict = res.points >= 6 ? 'SLOP' : res.points >= 3 ? 'REVIEW' : 'OK';
  }
  return res;
}

export function formatRender(r) {
  const out = [`non-slop render ${r.url}  ·  ${r.status}`];
  if (r.status !== 'OK') { out.push(`  ${r.desktopError || r.mobileError || 'not measured (login, bot check or empty page)'}`); return out.join('\n'); }
  const d = r.desktop, m = r.mobile || {};
  out.push(`  map/data share of first screen: desktop ${Math.round(100 * (d.dataShareFirstScreen || 0))}% · phone ${Math.round(100 * (m.dataShareFirstScreen || 0))}%   bars: top ${d.topBar}px bottom ${d.bottomBar}px`);
  out.push(`  boxes ${d.boxesMeasured} · shadows ${d.shadows} · radii ${d.radiusDistinct} · pills ${d.pills} · font sizes ${d.fontSizes} · longest prose line ${d.maxLineEm}em${d.readingColumn ? ' (reading column)' : ''}`);
  out.push(`  contrast fails ${Math.max(d.contrastFails, m.contrastFails || 0)} of ${d.contrastChecked} · small phone targets ${m.smallTargets ?? '?'} of ${m.controls ?? '?'} · focus invisible ${d.focus?.invisible ?? '?'} of ${d.focus?.tabbed ?? '?'} tabbed · 320px overflow ${r.narrow?.hOverflow ? 'yes' : 'no'}`);
  for (const h of r.hits) out.push(`  ${h.status === 'FAIL' ? ('+' + h.w).padEnd(9) : h.status.padEnd(9)} ${h.id.padEnd(20)} ${h.desc}${h.allowedBy ? '  [' + h.allowedBy + ']' : ''}`);
  const ex = [...(d.contrastExamples || []).map((e) => `contrast ${e.ratio}:1 "${e.text}"`), ...(m.smallTargetExamples || []).slice(0, 3).map((e) => `target ${e.w}×${e.h} "${e.text}"`), ...(d.focus?.examples || []).map((e) => `no focus "${e}"`)].slice(0, 8);
  if (ex.length) out.push('  examples: ' + ex.join(' · '));
  out.push(`  shots: ${r.shots.join(', ')}`, `  silhouette: ${r.silhouette}  ← look at it: could this outline belong to any SaaS page?`);
  out.push(`Verdict: ${r.verdict}  (points ${r.points}; ≥6 SLOP, 3–5 REVIEW)`);
  return out.join('\n');
}
