// One-off probe: every heading element on a route, with the CSS rule that
// decided its font-weight. Used to pick weight fixes by measurement.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:4399";
const ROUTE = process.env.ROUTE || "/toolkit";
const WIDTH = Number(process.env.WIDTH || 390);

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: WIDTH, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
await p.goto(BASE + ROUTE, { waitUntil: "load", timeout: 30000 });
await p.waitForTimeout(2500);

const rows = await p.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll("h1,h2,h3,h4")) {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Which authored rules set font-weight on this element?
    const hits = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      const walk = (list) => {
        for (const rule of list) {
          if (rule.cssRules) { walk(rule.cssRules); continue; }
          if (!rule.selectorText || !rule.style || !rule.style.fontWeight) continue;
          try {
            if (e.matches(rule.selectorText)) {
              hits.push(`${rule.selectorText} => ${rule.style.fontWeight}`);
            }
          } catch { /* invalid selector */ }
        }
      };
      walk(rules);
    }
    out.push({
      tag: e.tagName,
      size: Math.round(parseFloat(cs.fontSize) * 10) / 10,
      weight: cs.fontWeight,
      fam: cs.fontFamily.split(",")[0].replace(/["']/g, ""),
      cls: e.className || "(none)",
      id: e.id || "",
      parent: e.parentElement?.className || "",
      text: e.textContent.trim().slice(0, 46),
      hits: hits.slice(-4),
    });
  }
  return out;
});

for (const r of rows) {
  const flag = /Josefin/.test(r.fam) && r.size < 40 && Number(r.weight) >= 600 ? "  <<< BLOB" : "";
  console.log(
    `${r.tag} ${r.size}px w${r.weight} ${r.fam}  #${r.id || "-"} .${String(r.cls).slice(0, 40)} | parent .${String(r.parent).slice(0, 34)}${flag}`
  );
  console.log(`     "${r.text}"`);
  for (const h of r.hits) console.log(`       ${h}`);
}
await b.close();
