import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:4399";
const ROUTES = (process.env.ROUTES || "/roi,/governor").split(",");
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const p = await c.newPage();
for (const route of ROUTES) {
  await p.goto(BASE + route, { waitUntil: "load", timeout: 30000 });
  await p.waitForTimeout(2500);
  const rows = await p.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll("*")) {
      const cs = getComputedStyle(e);
      const ls = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing || "0");
      const fs = parseFloat(cs.fontSize) || 16;
      if (ls / fs < 0.04) continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const owns = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!owns) continue;
      const txt = e.textContent.trim();
      // A tracked label reads as all-caps if it is uppercased by CSS
      // (textContent does NOT reflect text-transform) or the markup is
      // already uppercase.
      const letters = txt.replace(/[^A-Za-z]/g, "");
      if (!letters.length) continue;
      const upper = letters.replace(/[^A-Z]/g, "").length / letters.length;
      if (cs.textTransform !== "uppercase" && upper < 0.85) continue;
      out.push({ cls: e.className || "(none)", size: Math.round(parseFloat(cs.fontSize)), ls: cs.letterSpacing, fam: cs.fontFamily.split(",")[0].replace(/["']/g, ""), text: txt.slice(0, 44) });
    }
    return out;
  });
  console.log(`\n##### ${route} — ${rows.length} tracked all-caps labels #####`);
  for (const r of rows) console.log(`  ${r.size}px ls=${r.ls} ${r.fam}  .${String(r.cls).slice(0, 40)}  "${r.text}"`);
}
await b.close();
