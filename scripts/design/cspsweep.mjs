// Content-Security-Policy violations, per route, as the browser reports them.
//
//   node scripts/design/cspsweep.mjs [routes…] --base https://bus.nonarkara.org
//
// WHY THIS EXISTS
//   public/_headers carried the policy as Report-Only with the note "enforce
//   once a week of use shows no violations" — and no report endpoint, so
//   nobody could ever see a violation, and the week never ended. A policy that
//   can only be enforced after someone reads a console is a policy that is
//   never enforced.
//
//   A browser fires a `securitypolicyviolation` event for a Report-Only
//   violation exactly as it does for an enforced one (`disposition: "report"`
//   versus "enforce"). So the question "is the policy clean?" does not need a
//   week or a collector: load every route in a real browser, at both
//   viewports, listen for the event, and count.
//
//   It is also what makes ENFORCING safe. An enforced policy that breaks a
//   tile layer or a font fails silently — the page just looks wrong. This is
//   the check that says it does not, on every deploy, before the reader finds
//   out.
//
// WHAT IT MEASURES
//   Every route in verify-design's list, at 1440 and 390, after the page has
//   settled (the shared settle, because a violation raised by a request that
//   fires on a timer is still a violation). It also exercises what only exists
//   after a click on the routes where that matters — the toolkit's tabs are
//   separate routes in the list, so they are visited, not clicked.
//
//   A violation is reported with the directive it broke and the URL it was
//   about, never silently dropped. The same blocked URI on the same route at
//   both widths is one finding with two widths, not two findings.
//
//   An unreachable route is a finding. It is not a clean route.
import { chromium } from "playwright";
import { settle } from "./settle.mjs";

const ALL_ROUTES = [
  "/", "/ops", "/fleet", "/fleet/raw", "/study", "/research", "/capacity",
  "/toolkit", "/toolkit#phuket", "/toolkit#evidence", "/toolkit#build",
  "/toolkit#fieldnotes",
  "/roi", "/driver", "/v2", "/v2?view=insights", "/v2?view=toolkit",
  "/governor", "/info", "/more", "/stops", "/pass", "/ride", "/compare",
];

const argv = process.argv.slice(2);
const baseAt = argv.indexOf("--base");
const BASE = (baseAt >= 0 ? argv[baseAt + 1] : process.env.BASE) || "https://bus.nonarkara.org";
const named = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--base");
const ROUTES = named.length ? named : ALL_ROUTES;
const WIDTHS = [[1440, 900], [390, 844]];

const browser = await chromium.launch({ headless: true });
const findings = new Map(); // key → { route, directive, blocked, disposition, widths:Set }
const unreachable = [];
let measured = 0;

for (const [w, h] of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    try {
      // Installed before any page script runs, so a violation raised by the
      // first request is not missed. The listener is on `document`, where the
      // event fires, in the capture phase.
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener("securitypolicyviolation", (e) => {
          window.__csp.push({
            directive: e.effectiveDirective || e.violatedDirective,
            blocked: e.blockedURI,
            source: e.sourceFile || "",
            disposition: e.disposition,
          });
        }, true);
      });
      const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const status = res ? res.status() : 0;
      if (status >= 400 || status === 0) { unreachable.push(`${route} @${w} → HTTP ${status}`); continue; }
      await settle(page);
      const seen = await page.evaluate(() => window.__csp);
      measured += 1;
      for (const v of seen) {
        const key = `${route}|${v.directive}|${v.blocked}`;
        const f = findings.get(key) ?? { route, directive: v.directive, blocked: v.blocked, disposition: v.disposition, widths: new Set() };
        f.widths.add(w);
        findings.set(key, f);
      }
    } catch (e) {
      unreachable.push(`${route} @${w} → ${String(e.message).slice(0, 80)}`);
    } finally {
      await page.close().catch(() => {});
    }
  }
  await ctx.close();
}
await browser.close();

console.log(`csp sweep: ${BASE}  ·  ${ROUTES.length} routes × ${WIDTHS.length} widths  ·  ${measured} pages measured`);
for (const f of findings.values()) {
  console.log(`  ✗ ${f.route} @${[...f.widths].join("/")}  ${f.directive}  blocked: ${f.blocked || "(inline)"}  [${f.disposition}]`);
}
for (const u of unreachable) console.log(`  ✗ could not measure: ${u}`);
const expected = ROUTES.length * WIDTHS.length;
if (measured < expected) console.log(`  ✗ measured ${measured} of ${expected} pages — an unmeasured page is not a clean page`);
const bad = findings.size + unreachable.length + (measured < expected ? 1 : 0);
console.log(bad === 0 ? "  clean: no route, at either width, violated the policy" : `  ${bad} finding(s)`);
process.exit(bad === 0 ? 0 : 1);
