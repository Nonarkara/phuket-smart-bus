import { chromium } from "playwright";
const BASE = process.env.BASE || "https://bus.nonarkara.org";
const TABS = ["overview","phuket","evidence","build","fieldnotes"];
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
const all = new Map();
for (const w of [1440, 390]) {
  await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  for (const tab of TABS) {
    await p.goto(`${BASE}/toolkit#${tab}`, { waitUntil: "load", timeout: 40000 });
    await p.waitForTimeout(3500);
    const sizes = await p.evaluate(() => {
      const s = new Set();
      for (const e of document.querySelectorAll("*")) {
        const cs = getComputedStyle(e);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const owns = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!owns) continue;
        s.add(Math.round(parseFloat(cs.fontSize) * 2) / 2);
      }
      return [...s].sort((a, b) => b - a);
    });
    console.log(`${w}px ${tab.padEnd(11)} ${String(sizes.length).padStart(2)} sizes: ${sizes.join(", ")}`);
    for (const s of sizes) all.set(`${w}:${s}`, s);
  }
}
await b.close();
