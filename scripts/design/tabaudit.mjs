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

    // Click the REAL tab button and PROVE the click landed.
    //
    // The previous version clicked `.hub-tab-nav button:has-text(...)` — that
    // is the Overview tab's "Jump to section" grid, NOT the toolkit's tablist.
    // "Home" and "fieldnotes" matched nothing at all, and "phuket"/"evidence"/
    // "build" matched the wrong buttons. The instrument reported 0 violations
    // for a click that never happened — the same false pass STYLE.md names.
    // The real tablist is `.hub-tab`, one per tab, with id `tab-<id>`.
    const click = await p.evaluate((id) => {
      const btn = document.querySelector(`#tab-${id}`);
      if (!btn) return { clicked: false, reason: "no #tab-" + id };
      btn.click();
      return { clicked: true };
    }, tab);
    await p.waitForTimeout(1800);

    // The click must have taken effect: the button is selected and the panel
    // it controls is the mounted one, with real content in it.
    const state = await p.evaluate((id) => {
      const btn = document.querySelector(`#tab-${id}`);
      const panel = document.querySelector(`#panel-${id}`);
      return {
        selected: btn?.getAttribute("aria-selected") ?? null,
        panelMounted: panel?.getAttribute("aria-labelledby") === `tab-${id}`,
        panelChars: (panel?.textContent ?? "").trim().length
      };
    }, tab);

    if (!click.clicked || state.selected !== "true" || !state.panelMounted) {
      console.error(
        `error: ${width}px tab=${tab} — the click did not take effect ` +
          `(clicked=${click.clicked} selected=${state.selected} panelMounted=${state.panelMounted}). ` +
          `A tab audit that cannot click is a tab audit that measures nothing.`
      );
      process.exit(1);
    }
    if (state.panelChars < 500) {
      console.error(
        `error: ${width}px tab=${tab} — the mounted panel holds ${state.panelChars} characters. ` +
          `An empty panel audits clean for the wrong reason.`
      );
      process.exit(1);
    }

    const off = await p.evaluate(INVENTORY);
    total += off.length;
    console.log(`${width}px  tab=${tab.padEnd(10)} violations=${off.length}  (panel ${state.panelChars} chars)`);
    for (const o of off.slice(0, 8)) console.log(`     [${o.rule}] ${o.fam || ""} w${o.w} ${o.size}px  ${o.el}  "${o.text}"`);
  }
}
console.log(`\n=== TAB VIOLATIONS: ${total} ===`);
await b.close();
process.exit(total ? 1 : 0);
