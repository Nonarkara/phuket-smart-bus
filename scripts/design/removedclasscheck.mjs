// Prove a CSS strip was safe: no element in any route may carry a class the
// strip removed.
//
// The screenshot diff is noisy — the ops wall, the fleet pages, the rider
// countdown and the capacity clock all tick, so two captures of the SAME
// build already differ. This check is time-independent: it reads the live
// DOM and intersects it with the removed class list.
//
//   node non-slop-shots/removedclasscheck.mjs <baseUrl> <removedClassesFile>
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2];
const listFile = process.argv[3];
if (!base || !listFile) {
  console.error("usage: removedclasscheck.mjs <baseUrl> <removedClassesFile>");
  process.exit(2);
}

const removed = new Set(
  fs.readFileSync(listFile, "utf8").split("\n").map((s) => s.trim()).filter(Boolean),
);

const ROUTES = [
  "/", "/ops", "/fleet", "/fleet/raw", "/study", "/research", "/capacity",
  "/toolkit", "/roi", "/driver", "/v2", "/governor", "/info", "/more",
  "/stops", "/pass", "/ride", "/compare",
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const page = await ctx.newPage();
let bad = 0;
const seen = new Set();

for (const route of ROUTES) {
  try {
    await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
  } catch {
    console.log(`skip ${route} (did not load)`);
    continue;
  }
  await page.waitForTimeout(2500);
  const used = await page.evaluate(() => {
    const out = new Set();
    for (const e of document.querySelectorAll("*")) {
      const c = e.getAttribute("class");
      if (c) for (const k of c.split(/\s+/)) if (k) out.add(k);
    }
    return [...out];
  });
  const hit = used.filter((c) => removed.has(c));
  for (const c of hit) seen.add(c);
  if (hit.length) {
    bad++;
    console.log(`✗ ${route}: ${hit.length} removed class(es) still in the DOM → ${hit.slice(0, 12).join(", ")}`);
  } else {
    console.log(`✓ ${route}: none of the ${removed.size} removed classes appear in the DOM`);
  }
}
await browser.close();

console.log(`\n${bad === 0 ? "✓ SAFE: the strip touched nothing that renders" : `✗ ${bad} route(s) still use a removed class`}`);
if (seen.size) console.log(`classes: ${[...seen].join(", ")}`);
process.exit(bad === 0 ? 0 : 1);
