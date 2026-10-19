import { chromium } from "playwright";
const BASE = process.env.BASE || "https://bus.nonarkara.org";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
const apiCalls = [];
p.on("response", (r) => { if (r.url().includes("/api/")) apiCalls.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
await p.goto(BASE + "/stops", { waitUntil: "load", timeout: 40000 });
await p.waitForTimeout(7000);
const info = await p.evaluate(() => {
  const list = document.querySelector(".stop-list");
  const section = document.querySelector(".stops-section");
  return {
    stopListHTML: (list?.innerHTML || "").slice(0, 400),
    sectionHTML: (section?.innerHTML || "").slice(0, 400),
    routePills: [...document.querySelectorAll(".route-pill, .map-route, [class*='route-pill']")].map(e => e.textContent.trim().slice(0, 30)).slice(0, 10),
    searchValue: document.querySelector("input[type='search'], input")?.value,
  };
});
console.log("API calls:", apiCalls.slice(0, 12));
console.log(JSON.stringify(info, null, 2));
await b.close();
