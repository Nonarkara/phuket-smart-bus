// Type-scale map: for each route, the distinct rendered font sizes AND the
// elements that own each one, so a ramp can be collapsed deliberately instead
// of by guesswork.
//
// Method (mirrors scripts/design/scale.mjs and STYLE.md): only elements that
// own a non-whitespace text node count, because an element that merely contains
// text inherits its parent's size and would double-count one physical size.
// Sizes are compared at 0.5px. Hidden and zero-box elements are skipped.
//
//   BASE=https://bus.nonarkara.org node scripts/design/scalemap.mjs
//   BASE=https://bus.nonarkara.org node scripts/design/scalemap.mjs /toolkit /roi
//   WIDTH=390 BASE=… node scripts/design/scalemap.mjs /stops
//
// WIDTH exists because the rider surface is a PHONE: a ramp that is legal at
// 1440 can be different at 390, because the desktop shell's chrome is gone
// there and the app's own labels take its place. An instrument that can only
// measure the desktop reads a page the rider never sees.
import { chromium } from "playwright";
import { settle } from "./settle.mjs";

const BASE = process.env.BASE || "https://bus.nonarkara.org";
const WIDTH = Number(process.env.WIDTH || 1440);
const HEIGHT = Number(process.env.HEIGHT || (WIDTH === 1440 ? 900 : 844));
const ALL = [
  "/", "/ops", "/fleet", "/fleet/raw", "/study", "/research", "/capacity",
  "/toolkit", "/roi", "/driver", "/v2", "/governor", "/info", "/more",
  "/stops", "/pass", "/ride", "/compare"
];
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const b = await chromium.launch();
const c = await b.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  serviceWorkers: "block"
});
const p = await c.newPage();

for (const r of routes) {
  await p.goto(BASE + r, { waitUntil: "load", timeout: 45000 });
  // The SAME wait every gate instrument uses. This one used a fixed three
  // seconds, which is the very thing the shared settle was built to
  // replace — an instrument that quotes a ramp must quote the ramp of a
  // FINISHED page, or the number it publishes is the ramp of whatever
  // happened to have arrived by then.
  await settle(p);
  const map = await p.evaluate(() => {
    const bySize = new Map();
    for (const e of document.querySelectorAll("*")) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const rect = e.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const owns = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!owns) continue;
      const size = Math.round(parseFloat(cs.fontSize) * 2) / 2;
      if (!bySize.has(size)) bySize.set(size, []);
      const list = bySize.get(size);
      if (list.length < 4) {
        const cls = String(e.className || "").split(" ").filter(Boolean).slice(0, 2).join(".");
        const txt = (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34);
        list.push(`${e.tagName.toLowerCase()}${cls ? "." + cls : ""} "${txt}"`);
      }
    }
    return [...bySize.entries()].sort((a, b) => b[0] - a[0]);
  });
  const sizes = map.map(([s]) => s);
  const over = sizes.length > 8;
  console.log(
    `\n${over ? "OVER" : "ok  "} ${r.padEnd(12)} ${String(sizes.length).padStart(2)} sizes: ${sizes.join(", ")}`
  );
  for (const [size, els] of map) {
    console.log(`       ${String(size).padStart(5)}px  ${els.join("  |  ")}`);
  }
}

await b.close();
