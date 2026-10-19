// Type audit across the toolkit's TABS, not just its default tab.
// The hub mounts one panel at a time, so a route-level audit only ever
// sees "overview".
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://bus.nonarkara.org";
const TABS = ["overview", "phuket", "evidence", "build", "fieldnotes"];
const WIDTHS = [1440, 390];

const INVENTORY = () => {
  const offenders = [];
  for (const e of document.querySelectorAll("*")) {
    const cs = getComputedStyle(e);
    if (!e.textContent || !e.textContent.trim()) continue;
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "");
    const w = parseInt(cs.fontWeight, 10) || 400;
    const size = parseFloat(cs.fontSize);
    const label = e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
    if (/Josefin/.test(fam)) {
      if (size < 18) offenders.push({ rule: "display face below 18px", w, size, el: label, text: e.textContent.trim().slice(0, 40) });
      else if (size < 40 && w >= 600) offenders.push({ rule: "display face 600+ below 40px", w, size, el: label, text: e.textContent.trim().slice(0, 40) });
    } else if (!/Source Sans|Plex Sans Thai/i.test(fam) && !/ui-monospace|system-ui|Helvetica|Arial|Georgia|Times/i.test(fam)) {
      offenders.push({ rule: "unknown face", fam, w, size, el: label, text: e.textContent.trim().slice(0, 40) });
    }
    if (/Times|Georgia/i.test(fam)) offenders.push({ rule: "serif leaking", fam, w, size, el: label, text: e.textContent.trim().slice(0, 40) });
  }
  return offenders;
};

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
let total = 0;

for (const width of WIDTHS) {
  await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  for (const tab of TABS) {
    await p.goto(`${BASE}/toolkit#${tab}`, { waitUntil: "load", timeout: 40000 });
    await p.waitForTimeout(3500);
    // Click the tab button as well, in case the hash alone does not mount it.
    const btn = await p.$(`.hub-tab-nav button:has-text("${tab === "overview" ? "Home" : tab}")`);
    if (btn) { await btn.click().catch(() => {}); await p.waitForTimeout(1500); }
    const off = await p.evaluate(INVENTORY);
    total += off.length;
    console.log(`${width}px  tab=${tab.padEnd(10)} violations=${off.length}`);
    for (const o of off.slice(0, 8)) console.log(`     [${o.rule}] ${o.fam || ""} w${o.w} ${o.size}px  ${o.el}  "${o.text}"`);
  }
}
console.log(`\n=== TAB VIOLATIONS: ${total} ===`);
await b.close();
process.exit(total ? 1 : 0);
