// non-slop-skip-file: scanner code, not UI
// Colour helpers: parse CSS colours, HSL, WCAG 2 contrast.
const NAMED = { white: "#ffffff", black: "#000000", gray: "#808080", grey: "#808080", silver: "#c0c0c0", red: "#ff0000", blue: "#0000ff", purple: "#800080", indigo: "#4b0082", violet: "#ee82ee" };
export function parseColour(s) {
  if (!s) return null; s = s.trim().toLowerCase();
  if (NAMED[s]) s = NAMED[s];
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1]; if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = parseInt(h.slice(0, 6), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4] };
  return null;
}
export const toHex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
export function hsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
  return { h, s: s * 100, l: l * 100 };
}
export function luminance({ r, g, b }) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const inHue = (h, lo, hi) => (lo <= hi ? h >= lo && h <= hi : h >= lo || h <= hi);
export const is = {
  violet: (c) => { const { h, s, l } = hsl(c); return inHue(h, 235, 300) && s >= 45 && l >= 30 && l < 88; },
  cream: (c) => { const { h, s, l } = hsl(c); return l >= 89 && l < 99.5 && s >= 12 && inHue(h, 20, 60); },
  terracotta: (c) => { const { h, s, l } = hsl(c); return inHue(h, 8, 28) && s >= 40 && s <= 78 && l >= 35 && l <= 66; },
  nearBlack: (c) => hsl(c).l <= 9,
  navy: (c) => { const { h, s, l } = hsl(c); return inHue(h, 200, 250) && l <= 18 && s >= 20; },
  acid: (c) => { const { h, s, l } = hsl(c); return inHue(h, 70, 160) && s >= 55 && l >= 38 && l <= 72; },
  saturated: (c) => { const { s, l } = hsl(c); return s >= 45 && l >= 25 && l <= 80; },
};
// Tailwind v3 default neutrals, for contrast checks on class pairs.
const TW = {
  slate: "f8fafc f1f5f9 e2e8f0 cbd5e1 94a3b8 64748b 475569 334155 1e293b 0f172a 020617",
  gray: "f9fafb f3f4f6 e5e7eb d1d5db 9ca3af 6b7280 4b5563 374151 1f2937 111827 030712",
  zinc: "fafafa f4f4f5 e4e4e7 d4d4d8 a1a1aa 71717a 52525b 3f3f46 27272a 18181b 09090b",
  neutral: "fafafa f5f5f5 e5e5e5 d4d4d4 a3a3a3 737373 525252 404040 262626 171717 0a0a0a",
  stone: "fafaf9 f5f5f4 e7e5e4 d6d3d1 a8a29e 78716c 57534e 44403c 292524 1c1917 0c0a09",
};
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export function twColour(name) {
  if (name === "white") return "#ffffff"; if (name === "black") return "#000000";
  const m = name.match(/^(slate|gray|zinc|neutral|stone)-(\d{2,3})$/); if (!m) return null;
  const i = STEPS.indexOf(+m[2]); return i < 0 ? null : "#" + TW[m[1]].split(" ")[i];
}
export const TW_PURPLE = new Set("#818cf8 #6366f1 #4f46e5 #4338ca #a78bfa #8b5cf6 #7c3aed #6d28d9 #c084fc #a855f7 #9333ea #7e22ce".split(" "));
