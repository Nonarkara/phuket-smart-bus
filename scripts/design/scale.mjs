// Independent type-scale measure: distinct font sizes over ALL rendered
// elements (not only those owning a text node), at 0.5px and at 1px.
import { chromium } from "playwright";
const BASE = process.env.BASE || "https://bus.nonarkara.org";
const ROUTES = ["/","/ops","/fleet","/fleet/raw","/study","/research","/capacity","/toolkit","/roi","/driver","/v2","/governor","/info","/more","/stops","/pass","/ride","/compare"];
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
for (const r of ROUTES) {
  await p.goto(BASE + r, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(2500);
  const n = await p.evaluate(() => {
    const all = new Set(), leaf = new Set();
    for (const e of document.querySelectorAll("*")) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const rect = e.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const s = parseFloat(cs.fontSize);
      all.add(Math.round(s * 2) / 2);
      const owns = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (owns) leaf.add(Math.round(s * 2) / 2);
    }
    return { all: all.size, leaf: leaf.size };
  });
  console.log(`${r.padEnd(12)} all-elements=${n.all}  leaf-text=${n.leaf}`);
}
await b.close();
