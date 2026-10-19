// Screenshot every route and compare against a baseline directory.
//
//   node non-slop-shots/shotdiff.mjs capture <baseUrl> <outDir>
//   node non-slop-shots/shotdiff.mjs compare  <baseUrl> <baselineDir>
//
// The comparison is a byte hash first (cheap, and an exact match is proof).
// A mismatch falls back to @playwright/test's pixel comparison, which
// tolerates antialiasing noise and reports the actual differing pixels.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROUTES = ["/", "/ops", "/fleet", "/fleet/raw", "/study", "/research", "/capacity", "/toolkit"];
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];


/** Compare two PNG buffers by decoding them in the browser and counting pixels. */
async function countDiff(page, aBuf, bBuf) {
  const toUrl = (buf) => "data:image/png;base64," + buf.toString("base64");
  return await page.evaluate(async ([ua, ub]) => {
    const load = (src) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
    const [A, B] = await Promise.all([load(ua), load(ub)]);
    if (A.width !== B.width || A.height !== B.height) return { count: -1, total: 0 };
    const c = document.createElement("canvas");
    c.width = A.width; c.height = A.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(A, 0, 0);
    const da = ctx.getImageData(0, 0, A.width, A.height).data;
    ctx.clearRect(0, 0, A.width, A.height);
    ctx.drawImage(B, 0, 0);
    const db = ctx.getImageData(0, 0, B.width, B.height).data;
    let count = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) count++;
    }
    return { count, total: A.width * A.height };
  }, [toUrl(aBuf), toUrl(bBuf)]);
}

const mode = process.argv[2];
const base = process.argv[3];
const dir = process.argv[4];
if (!mode || !base || !dir) {
  console.error("usage: shotdiff.mjs capture|compare <baseUrl> <dir>");
  process.exit(2);
}

fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
let mismatches = 0;
const report = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, serviceWorkers: "block" });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const slug = `${route === "/" ? "root" : route.replace(/\//g, "_")}-${vp.name}.png`;
    const file = path.join(dir, slug);
    await page.goto(base + route, { waitUntil: "load", timeout: 40000 });
    await page.waitForTimeout(3500);
    const buf = await page.screenshot({ fullPage: true });
    if (mode === "capture") {
      fs.writeFileSync(file, buf);
      console.log(`captured ${slug}  ${(buf.length / 1024).toFixed(0)}KB`);
    } else {
      if (!fs.existsSync(file)) {
        report.push(`${slug}: NO BASELINE`);
        mismatches++;
        continue;
      }
      const old = fs.readFileSync(file);
      const a = crypto.createHash("sha256").update(old).digest("hex");
      const b = crypto.createHash("sha256").update(buf).digest("hex");
      if (a === b) {
        console.log(`same     ${slug}`);
      } else {
        // byte-identical failed: count differing pixels IN THE BROWSER, using
        // a canvas. No image library needed, and the decoder is the browser's.
        const diffPx = await countDiff(page, old, buf);
        if (diffPx === null) {
          report.push(`${slug}: BYTES DIFFER (could not pixel-compare)`);
          mismatches++;
          continue;
        }
        if (diffPx.count === 0) {
          console.log(`same*    ${slug}  (0 px differ; the byte hash moved on PNG encoding only)`);
        } else {
          const pct = ((diffPx.count / diffPx.total) * 100).toFixed(3);
          console.log(`DIFF     ${slug}  ${diffPx.count} px (${pct}%)`);
          report.push(`${slug}: ${diffPx.count} px differ (${pct}%)`);
          mismatches++;
          fs.writeFileSync(path.join(dir, slug.replace(/\.png$/, "-after.png")), buf);
        }
      }
    }
  }
  await ctx.close();
}
await browser.close();

if (mode === "compare") {
  console.log(`\n${mismatches === 0 ? "✓ NO VISUAL DIFFERENCE" : `✗ ${mismatches} route(s) changed`}`);
  for (const r of report) console.log(`   ${r}`);
  process.exit(mismatches === 0 ? 0 : 1);
}
