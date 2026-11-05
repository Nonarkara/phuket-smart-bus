// headingrank.mjs — a section heading must outrank the headings under it.
//
//   BASE=http://127.0.0.1:4173 node scripts/design/headingrank.mjs
//
// For every visible h2 in the research hub, every h3 inside the same
// <section> must render SMALLER than the h2 — at every width the reader
// holds. A sub-heading the same size as its section heading is not a
// hierarchy; a bigger one is an inverted one. The hub's type scale is fluid,
// so a rule that holds at 1440 can invert at 1024 (it did, twice, on
// 2026-11-05): this probe measures 1440, 1024 and 390, clicking each tab and
// proving the click landed. The hero h1 must outrank every h2.
//
// "Outrank" means a real step, not a pixel: STYLE.md says two sizes 2px
// apart at the same weight are one size, so a heading must be at least
// STEP (1.15x) the size of the heading it outranks.
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://bus.nonarkara.org";
const TABS = ["overview", "phuket", "evidence", "build", "fieldnotes", "paper"];
const WIDTHS = [[1440, 900], [1024, 768], [390, 844]];
const STEP = 1.15;

const b = await chromium.launch();
const p = await b.newPage();
let fails = 0;
for (const [w, h] of WIDTHS) {
  await p.setViewportSize({ width: w, height: h });
  for (const tab of TABS) {
    await p.goto(`${BASE}/toolkit#${tab}`, { waitUntil: "load", timeout: 40000 });
    await p.waitForTimeout(3000);
    if (!(await p.$(`#tab-${tab}`))) {
      console.log(`${w}px ${tab}: NOT MEASURED — no such tab on this build`);
      continue;
    }
    await p.click(`#tab-${tab}`);
    await p.waitForTimeout(1500);
    const mounted = await p.$(`#panel-${tab}`);
    if (!mounted) { console.error(`error: ${w}px ${tab} — the panel did not mount`); process.exit(1); }
    const found = await p.evaluate(([tab, STEP]) => {
      const out = [];
      const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== "none" && c.visibility !== "hidden"; };
      const px = (e) => parseFloat(getComputedStyle(e).fontSize);
      const panel = document.getElementById(`panel-${tab}`);
      const h1 = [...panel.querySelectorAll("h1")].filter(vis);
      const h2s = [...panel.querySelectorAll("h2")].filter(vis);
      for (const a of h1) for (const c of h2s) if (px(a) < px(c) * STEP) out.push(`h1 ${px(a)}px is not a step above h2 "${c.textContent.trim().slice(0, 40)}" ${px(c)}px`);
      for (const h2 of h2s) {
        const sec = h2.closest("section") ?? h2.parentElement;
        for (const h3 of [...sec.querySelectorAll("h3")].filter(vis)) {
          if (h3.closest("section") !== sec && h3.closest("section") !== null && sec.contains(h3.closest("section")) && h3.closest("section").querySelector("h2")) continue; // belongs to a nested section with its own h2
          if (px(h2) < px(h3) * STEP) out.push(`h2 "${h2.textContent.trim().slice(0, 30)}" ${px(h2)}px is not a step above h3 "${h3.textContent.trim().slice(0, 36)}" ${px(h3)}px`);
        }
      }
      return out;
    }, [tab, STEP]);
    fails += found.length;
    console.log(`${w}px ${tab.padEnd(10)} ${found.length ? found.length + " without a step" : "ok"}`);
    for (const f of found) console.log("     " + f);
  }
}
await b.close();
console.log(`\n=== HEADING INVERSIONS: ${fails} ===`);
process.exit(fails ? 1 : 0);
