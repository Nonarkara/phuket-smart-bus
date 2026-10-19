import { chromium } from "playwright";
const BASE = process.env.BASE || "https://bus.nonarkara.org";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", deviceScaleFactor: 2 });
const p = await c.newPage();
await p.goto(BASE + "/", { waitUntil: "load", timeout: 40000 });
await p.waitForTimeout(7000);
await p.screenshot({ path: "non-slop-shots/rider-390.png" });
const info = await p.evaluate(() => {
  const h = document.querySelector("#pa-live-title");
  const cs = h ? getComputedStyle(h) : null;
  return {
    heading: h?.textContent?.trim(),
    font: cs ? `${cs.fontFamily.split(",")[0]} ${cs.fontSize} w${cs.fontWeight}` : "no heading",
    bodyText: document.body.textContent.replace(/\s+/g, " ").slice(0, 220),
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
