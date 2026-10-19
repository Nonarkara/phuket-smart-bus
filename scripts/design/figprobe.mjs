import { chromium } from "playwright";
const BASE = process.env.BASE || "https://depa-usdot.nonarkara.org";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
await p.goto(BASE + "/toolkit", { waitUntil: "load", timeout: 40000 });
await p.waitForTimeout(3000);
// Click through the tabs until the bus-systems figure is present.
const tabs = await p.$$("button");
for (const t of tabs) {
  const txt = (await t.textContent() || "").trim().toLowerCase();
  if (!txt) continue;
  if (txt.includes("bus") || txt.includes("system") || txt.includes("phuket")) {
    await t.click().catch(() => {});
    await p.waitForTimeout(1200);
    if (await p.$(".pb-evidence")) break;
  }
}
const info = await p.evaluate(() => {
  const img = document.querySelector(".pb-evidence img");
  if (!img) return null;
  const cs = getComputedStyle(img);
  const r = img.getBoundingClientRect();
  const fig = img.closest("figure");
  const fr = fig ? fig.getBoundingClientRect() : null;
  return {
    natural: `${img.naturalWidth}x${img.naturalHeight}`,
    rendered: `${Math.round(r.width)}x${Math.round(r.height)}`,
    figure: fr ? `${Math.round(fr.width)}x${Math.round(fr.height)}` : null,
    cssWidth: cs.width, cssHeight: cs.height, objectFit: cs.objectFit, maxWidth: cs.maxWidth,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
