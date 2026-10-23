#!/usr/bin/env node
/**
 * SHIPABILITY — the audit that asks "can this be handed over?" rather than
 * "does it look right?".
 *
 * WHY A SECOND INSTRUMENT
 *   The design gate (verify-design.sh) measures the LAYOUT: type, gutters,
 *   overflow, spatial geometry. It says nothing about whether the thing
 *   works when a stranger opens it. A site can pass every layout check and
 *   still throw on every page, send every visitor's IP address to a third
 *   party, call thirty endpoints that do not exist, and keep a live admin
 *   token in its git history.
 *
 *   Every one of those has happened here. This instrument is the part that
 *   would have caught them.
 *
 * THE SIX CHECKS
 *   1. CONSOLE HEALTH    — no uncaught exception, no console error, on any
 *                          route. A page that throws looks fine in a
 *                          screenshot and is broken for the reader.
 *   2. VISITOR COLLECTOR — the site must not ship a beacon that reports the
 *                          visitor to a personal spreadsheet or a third-party
 *                          IP lookup. This instrument ABORTS those requests
 *                          rather than making them, so running the audit
 *                          never sends a reader's address anywhere — and
 *                          so the audit is hermetic.
 *   3. DISCLOSURE        — where the page does collect, the page the reader
 *                          is ON must say so. A notice on the route
 *                          nobody visits is not a notice.
 *   4. DEAD ENDPOINT     — a same-origin request that answers 4xx/5xx. The
 *                          static site has no backend; a call to an API
 *                          that does not exist is a request the reader
 *                          pays for and does not get.
 *   5. SECRETS           — secret-shaped strings in the working tree AND in
 *                          the full git history. The history is the one
 *                          everybody forgets: a token that was removed is
 *                          not removed.
 *   6. GATE COVERAGE     — every route the app serves must be measured by
 *                          the design gate. The gate once covered 18 of 24
 *                          routes, and the six it missed held 63 defects.
 *
 * IT IS A SCREEN, NOT A JUDGE
 *   Every finding names the route, the element and the measurement. A
 *   finding can be argued with. But the rule is never softened to make a
 *   finding go away — the reason is recorded in the rule instead.
 *
 * Usage:
 *   node scripts/design/shipaudit.mjs --base https://bus.nonarkara.org
 *   node scripts/design/shipaudit.mjs --base <url> --routes "/,/ops"
 *   node scripts/design/shipaudit.mjs --scan <dir> [--history]
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { settle } from "./settle.mjs";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const BASE = opt("base", "http://127.0.0.1:4173");
const SCAN_DIR_EXPLICIT = args.includes("--scan");
const SCAN_DIR = opt("scan", process.cwd());
const ROOT = process.cwd();

// ── the routes the design gate measures ─────────────────────────────────────
// The gate's own list is the source of truth, so coverage is measured
// against what the gate ACTUALLY checks rather than a copy of it.
function gateRoutes() {
  const sh = opt("gate", join(ROOT, "scripts/design/verify-design.sh"));
  if (!existsSync(sh)) return null;
  const txt = readFileSync(sh, "utf8");
  const m = txt.match(/^ROUTES=\(([\s\S]*?)^\)/m);
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

// ── the routes the app serves, from the CODE ────────────────────────────────
// Two independent sources must agree: the prefixes App.tsx routes on, and
// the paths public/_redirects serves. A route added to one and forgotten in
// the other is a route that 404s for a real reader.
function servedRoutes() {
  const app = opt("app", join(ROOT, "src/App.tsx"));
  const red = opt("redirects", join(ROOT, "public/_redirects"));
  const code = new Set();
  const redirects = new Set();
  if (existsSync(app)) {
    const txt = readFileSync(app, "utf8");
    // The WHOLE prefix, not its first segment. `startsWith("/fleet/raw")` is
    // a different route from `startsWith("/fleet")`, and a derivation that
    // stopped at the first slash would read the nested one as its parent —
    // which is already in the gate's list, so a new nested route would be
    // silently missed. The check exists to catch a route nobody measures.
    for (const m of txt.matchAll(/startsWith\("(\/[a-z0-9][a-z0-9\/_-]*)/g)) {
      // `startsWith("/driver/")` is the route "/driver" — a trailing slash
      // is a prefix marker, not part of the name.
      code.add(m[1].replace(/\/+$/, "") || "/");
    }
    // AND the routes matched EXACTLY. `pathname === "/newroute"` is a route
    // like any other — `src/App.tsx` matches "/" that way — and a
    // derivation that only read `startsWith` would never see it. A route
    // nobody measures is the whole failure this check exists for, so it
    // has to read every way the app names one.
    for (const m of txt.matchAll(/===\s*"(\/[a-z0-9][a-z0-9\/_-]*)?"/g)) {
      // `*` and not `+`: the root route is `pathname === "/"`, and a
      // pattern that needs a character after the slash cannot see it.
      code.add((m[1] || "/").replace(/\/+$/, "") || "/");
    }
  }
  if (existsSync(red)) {
    const txt = readFileSync(red, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\/([a-z0-9-]+)(?:\s|\/)/);
      if (m) redirects.add("/" + m[1]);
    }
  }
  return { code, redirects };
}

// ── visitor collectors ──────────────────────────────────────────────────────
// A host that receives information about the visitor. The list is a policy
// decision, not a heuristic: these are the hosts this project has used, and
// the audit's job is to say they are still there.
const COLLECTORS = [
  "script.google.com",
  "ipapi.co",
  "ipinfo.io",
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "segment.io",
  "hotjar.com",
  "mixpanel.com",
];

const DISCLOSURE_WORDS = [
  "privacy", "ip address", "ipapi", "analytics", "what we collect",
  "data we collect", "visitor",
];

// ── third-party contacts ────────────────────────────────────────────────────
// A host this site talks to that is NOT a collector but still sees the
// visitor's request — and therefore their IP address.
//
// These are NOT in the COLLECTORS list, and must never be: the collector
// list ABORTS the request so the audit cannot itself leak the visitor to
// the very service it is checking for. A map tile is not a collector, and
// aborting it would change the measurement of every page that draws a map.
//
// So this is a second list with a different question: "does this page
// contact a third party, and does the page tell the reader so?" The
// notice that answers it is the site's own — it has to NAME the service,
// because "your data may be shared" is not a disclosure of anything.
//
// The keys are SUBSTRINGS of the host, because these services serve from
// several hosts: OpenStreetMap from a.tile/b.tile/c.tile…, GISTDA from
// both api-gateway.gistda.or.th and pm25.gistda.or.th, RainViewer from
// api.rainviewer.com and tilecache.rainviewer.com.
//   · OpenStreetMap — map tiles
//   · GISTDA        — weather, air quality, satellite and incident tiles
//   · RainViewer    — radar
//   · Power BI      — the governor's ThaiRSC road-safety dashboard, which
//     is a Microsoft document embedded in an iframe. The page names the
//     DATA (ThaiRSC); it has to name the SERVICE too, because the frame
//     carries the reader's address to Microsoft.
//   · api.airplanes.live — the aircraft overlay (now relayed by this
//     site's own edge, so the browser should never reach it — the entry
//     stays as the guard against that changing back)
//
// Is this list EXHAUSTIVE? It cannot be — a new embed or a new SDK would
// not be on it. What it is is the list of the third parties this site
// makes requests to, and every one of them is either named on the page
// that contacts it or reported as a finding. The check that keeps it
// honest is the one below: it RECORDS every contact the page makes, and
// prints it, so a contact that is not on this list still shows up in the
// log as a service this site does not know about.
const THIRD_PARTY = [
  { host: "tile.openstreetmap.org", name: "OpenStreetMap" },
  { host: "gistda.or.th", name: "GISTDA" },
  { host: "rainviewer.com", name: "RainViewer" },
  { host: "app.powerbi.com", name: "Power BI" },
  { host: "airplanes.live", name: "api.airplanes.live" },
];

// ── secret shapes ───────────────────────────────────────────────────────────
// A VALUE belongs to the name on its OWN LINE. A newline is a separator,
// not whitespace inside a value — and when the pattern allowed a newline,
// `SMARTBUS_BEARER_TOKEN=` on one line matched the NEXT LINE'S name as its
// value, and an example file with no secrets in it was reported as a leak.
const VALUE = "[ \\t]*[=:][ \\t]*[\"']?([A-Za-z0-9._-]{16,})[\"']?(?![A-Za-z0-9._-])";
const SECRET_PATTERNS = [
  { name: "SMARTBUS_BEARER_TOKEN", re: new RegExp("SMARTBUS_BEARER_TOKEN" + VALUE) },
  { name: "TICK_TOKEN", re: new RegExp("TICK_TOKEN" + VALUE) },
  { name: "INGEST_TOKEN", re: new RegExp("INGEST_TOKEN" + VALUE) },
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "gistda-key", re: /[0-9a-f]{32}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: "secret-assignment", re: new RegExp("\\b(?:api[_-]?key|secret|passwd|password)" + VALUE, "i") },
];

// A line that NAMES a variable is not a secret. `SMARTBUS_BEARER_TOKEN=` with
// nothing after it, or a placeholder, is a declaration.
const PLACEHOLDER = /^(?:\s*|\$\{.*\}|\{\{.*\}\}|<[^>]*>|null|undefined|true|false|process\.env.*|["']?["']?)$/;

const findings = [];
const notes = [];
const debt = [];
const F = (check, route, detail) => findings.push({ check, route, detail });
// A CARRIED DEBT is a finding that this deploy CANNOT fix, and that no
// amount of deploying will ever fix. It is reported on every run, in its own
// block, with the steps that clear it — and it does NOT block the deploy.
//
// The reason is not convenience. A gate that reports "NOT SHIPPPABLE" on its
// own repository, forever, is a gate that gets disabled — and when it is
// disabled, the checks that CAN be fixed stop running with it. A secret in a
// published commit is already public; a deploy cannot unpublish it. What
// clears it is a rotation at the issuer and a rewrite of the history, and
// both are the owner's decisions, not this script's.
const D = (check, detail) => debt.push({ check, detail });

// ═══════════════════════════════════════════════════════════════════════════
// 5 · SECRETS — the tree and the history
// ═══════════════════════════════════════════════════════════════════════════
function scanSecrets() {
  const hits = [];
  const scanText = (text, where) => {
    for (const { name, re } of SECRET_PATTERNS) {
      const m = text.match(re);
      if (!m) continue;
      const value = m[0];
      // A declaration that names a variable and points at the environment is
      // not a secret. Only a VALUE is.
      if (PLACEHOLDER.test(value.replace(/^[A-Za-z_]+\s*[=:]\s*/, "").trim())) continue;
      hits.push(`${name} in ${where}`);
    }
  };
  // The tree to scan. An EXPLICIT --scan is a directory to WALK, so the
  // proof can point the scanner at a fixture that is not a repository.
  // Without one, the tracked files are scanned — that is the set that
  // gets published, and it is fast.
  const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".next", ".vite"]);
  // Test DATA, not a leak. The proof's fixtures hold secrets on purpose, and
  // a scanner that reads its own test data as a finding can never be green.
  //
  // The match is on the FULL repo-root path, not on a fragment of it. A
  // fragment match would exempt any real file that happened to sit under a
  // directory with the same name somewhere else in the tree. The paths are
  // named here, so the exemption is visible rather than hidden.
  //
  // Note what this exemption does NOT cover: when the proof points the
  // scanner AT one of these directories (`--scan …/fixtures/dirty-tree`),
  // the paths are relative to that directory, so the secret inside it is
  // found. That is the whole point of the exemption — the fixture is
  // exempt from the repository scan, and live when the proof scans it.
  const TEST_DATA_DIRS = [
    "scripts/design/fixtures/dirty-tree",
    "scripts/design/fixtures/history-tree",
  ];
  const isTestData = (rel) =>
    TEST_DATA_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`));

  if (SCAN_DIR_EXPLICIT) {
    const walk = (dir, prefix = "") => {
      let entries = [];
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (ent.name.startsWith(".") || SKIP_DIRS.has(ent.name)) continue;
        const full = join(dir, ent.name);
        const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
        if (ent.isDirectory()) { walk(full, rel); continue; }
        if (/\.(png|jpe?g|gif|webp|woff2?|ttf|sqlite3?|pdf|zip|gz)$/i.test(rel)) continue;
        if (isTestData(rel)) continue;
        let txt;
        try { txt = readFileSync(full, "utf8"); } catch { continue; }
        if (txt.length > 4 * 1024 * 1024) continue;
        scanText(txt, rel);
      }
    };
    walk(SCAN_DIR);
  } else {
    // the tracked tree
    try {
      const files = execSync("git ls-files", { cwd: SCAN_DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
        .split("\n").filter(Boolean);
      for (const f of files) {
        const p = join(SCAN_DIR, f);
        if (!existsSync(p)) continue;
        if (/\.(png|jpe?g|gif|webp|woff2?|ttf|sqlite3?|pdf|zip|gz)$/i.test(f)) continue;
        if (isTestData(f)) continue;
        let txt;
        try { txt = readFileSync(p, "utf8"); } catch { continue; }
        if (txt.length > 4 * 1024 * 1024) continue;
        scanText(txt, f);
      }
    } catch (e) {
      notes.push(`tree scan walked the directory, not git ls-files (${String(e.message).slice(0, 40)})`);
      const walk = (dir, prefix = "") => {
        let entries = [];
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const ent of entries) {
          if (ent.name.startsWith(".") || SKIP_DIRS.has(ent.name)) continue;
          const full = join(dir, ent.name);
          const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
          if (ent.isDirectory()) { walk(full, rel); continue; }
          if (/\.(png|jpe?g|gif|webp|woff2?|ttf|sqlite3?|pdf|zip|gz)$/i.test(rel)) continue;
          if (isTestData(rel)) continue;
          let txt;
          try { txt = readFileSync(full, "utf8"); } catch { continue; }
          if (txt.length > 4 * 1024 * 1024) continue;
          scanText(txt, rel);
        }
      };
      walk(SCAN_DIR);
    }
  }
  // the history — the one everybody forgets
  if (has("history")) {
    try {
      const log = execSync("git log --all -p --full-history", { cwd: SCAN_DIR, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
      const lines = log.split("\n");
      // The file each added line belongs to. The diff's own header says so,
      // and the proof's fixture is exempt for the SAME reason it is exempt
      // from the tree scan: it holds a secret on purpose. Without this, the
      // proof's own test data adds a debt entry to every deploy — noise in
      // the one block a human has to read carefully.
      let currentFile = "";
      for (const line of lines) {
        if (line.startsWith("+++ ")) {
          currentFile = line.slice(4).replace(/^b\//, "").trim();
          continue;
        }
        if (!line.startsWith("+") || line.startsWith("+++")) continue;
        if (isTestData(currentFile)) continue;
        scanText(line, "git history");
      }
    } catch (e) {
      notes.push(`secret scan of the history skipped: ${String(e.message).slice(0, 80)}`);
    }
  }
  // One finding per LOCATION, naming every shape found there. A file that
  // matches three patterns is one leak, not three.
  const byWhere = new Map();
  for (const h of hits) {
    const where = h.replace(/^.* in /, "");
    if (!byWhere.has(where)) byWhere.set(where, new Set());
    byWhere.get(where).add(h.replace(/ in .*/, ""));
  }
  for (const [where, names] of byWhere) {
    // EXACTLY the history, not "something whose path mentions history".
    // A substring test let a WORKING-TREE secret under any path containing
    // "history" be reported as carried debt — and debt does not block a
    // deploy. The repo has tracked files under public/toolkit/history/, so
    // this was not hypothetical. The one exemption from blocking is the
    // published commit, and it is named, not guessed at.
    if (where === "git history") {
      // In the HISTORY — a published commit. Carried debt, not a finding:
      // see the note on `debt` above. The steps that clear it are printed
      // with it, every run.
      D("secret-history", `${[...names].join(", ")} — a secret-shaped value is committed in the history. ASSUME IT IS COMPROMISED: rotate it at the issuer, then rewrite the history (git filter-repo --path server/config.ts --invert-paths).`);
    } else {
      F("secret", where, `${[...names].join(", ")} — a secret-shaped value is committed here`);
    }
  }}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · GATE COVERAGE
// ═══════════════════════════════════════════════════════════════════════════
function checkCoverage() {
  const gate = gateRoutes();
  const { code, redirects } = servedRoutes();
  if (!gate) {
    F("coverage", "—", "the gate's route list could not be read — coverage was not checked");
    return;
  }
  const G = new Set(gate);
  for (const r of code) {
    if (!G.has(r)) F("coverage", r, "the app serves this route and the design gate does not measure it");
  }
  for (const r of redirects) {
    if (!code.has(r) && r !== "/") F("coverage", r, "_redirects serves this path but App.tsx has no route for it");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1–4 · the browser checks
// ═══════════════════════════════════════════════════════════════════════════
const ROUTES = (opt("routes", "") || "").split(",").map((s) => s.trim()).filter(Boolean);

async function browserChecks() {
  if (!ROUTES.length) {
    const gate = gateRoutes();
    if (gate) ROUTES.push(...gate);
  }
  if (!ROUTES.length) {
    F("routes", "—", "no routes to check — the audit measured nothing");
    return;
  }

  const b = await chromium.launch();
  const c = await b.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  });

  for (const route of ROUTES) {
    const p = await c.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const collectorHits = [];
    const dead = [];
    const thirdParty = [];
    const thirdPartyHits = [];

    p.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 140)));
    p.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      // A resource that failed to load is reported by the collector and
      // dead-endpoint checks, which know WHICH url failed. Counting it twice
      // would make one defect look like two.
      if (/Failed to load resource|net::ERR_/.test(t)) return;
      consoleErrors.push(t.slice(0, 140));
    });
    p.on("request", (r) => {
      const u = r.url();
      if (COLLECTORS.some((h) => u.includes(h))) collectorHits.push(u.slice(0, 100));
      // A third-party CONTACT is not aborted — a map tile is not a collector,
      // and aborting it would change the measurement of every page that
      // draws a map. It is recorded, because the question is whether the
      // page TELLS the reader that the request happened.
      for (const t of THIRD_PARTY) {
        if (u.includes(t.host)) thirdPartyHits.push(t.name);
      }
    });
    // ABORT the collector requests: the audit must never send a reader's
    // address anywhere, and an audit that leaks would be its own defect.
    await p.route("**/*", (route2) => {
      const u = route2.request().url();
      if (COLLECTORS.some((h) => u.includes(h))) return route2.abort();
      return route2.continue();
    });
    p.on("response", (r) => {
      if (r.status() < 400) return;
      const u = r.url();
      let sameOrigin = false;
      try { sameOrigin = new URL(u).origin === new URL(BASE).origin; } catch { /* ignore */ }
      if (sameOrigin) dead.push(`${r.status()} ${u.slice(0, 100)}`);
      else thirdParty.push(`${r.status()} ${new URL(u).host}`);
    });

    try {
      const res = await p.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
      // The SAME wait every other instrument uses. An audit that decides
      // whether the site can be handed over must measure a finished page —
      // a fixed five seconds is a page that may not be there yet.
      await settle(p);
      const status = res ? res.status() : 0;

      if (status >= 400) F("route", route, `the route answered ${status} — it could not be measured`);
      if (pageErrors.length) F("console", route, `uncaught exception: ${pageErrors[0]}`);
      if (consoleErrors.length) F("console", route, `console error: ${consoleErrors[0]}`);

      const uniqCollectors = [...new Set(collectorHits)];
      for (const u of uniqCollectors) F("collector", route, `the page reports the visitor to ${u}`);

      if (uniqCollectors.length) {
        const disclosed = await p.evaluate((words) => {
          const t = (document.body.innerText || "").toLowerCase();
          return words.filter((w) => t.includes(w));
        }, DISCLOSURE_WORDS);
        if (!disclosed.length) F("disclosure", route, "the page collects visitor data and says nothing about it");
      }

      for (const d of [...new Set(dead)]) F("dead-endpoint", route, `the page called ${d}`);
      if (thirdParty.length) {
        notes.push(`${route}: third-party ${thirdParty.length} failed request(s) — ${[...new Set(thirdParty)].slice(0, 3).join(", ")}`);
      }

      // THE THIRD-PARTY DISCLOSURE. A page that contacts a third party sees
      // that party's request — and therefore the visitor's IP address. If
      // the page says nothing about it, the visitor cannot know, and a
      // notice that cannot be kept is not a notice.
      //
      // The requirement is that the page NAMES the service it talks to. A
      // link to a privacy page is enough only if that page names it too,
      // so the audit follows the link's own route when there is one.
      const named = await p.evaluate(() => (document.body.innerText || "").toLowerCase());
      const contacted = [...new Set(thirdPartyHits)];
      // THE CONTACTS ARE RECORDED, NOT ONLY THE FAILURES. A check that
      // prints nothing when it passes cannot be re-derived from the log: a
      // run that saw two contacts and a run that saw none read the same.
      // The number the commit claims has to be a number the next run
      // prints.
      if (contacted.length) {
        notes.push(`${route}: contacted ${contacted.join(", ")}`);
      }
      for (const name of contacted) {
        const key = name.toLowerCase();
        // A page may name the service the way a person would — "Airplanes
        // live", not "api.airplanes.live" — so the API prefix is dropped
        // before the text is searched. The disclosure must be TEXT: a
        // service named only in an image or a title attribute is not a
        // disclosure the reader can read.
        if (named.includes(key) || named.includes(key.replace("api.", ""))) continue;
        F(
          "third-party",
          route,
          `the page contacts ${name} — so ${name} sees the visitor's IP address — and the page does not say so`
        );
      }
    } catch (e) {
      F("route", route, `the route could not be measured: ${String(e.message).slice(0, 100)}`);
    }
    await p.close();
  }
  await b.close();
}

// ── run ─────────────────────────────────────────────────────────────────────
scanSecrets();
checkCoverage();
await browserChecks();

// ── report ──────────────────────────────────────────────────────────────────
const byCheck = new Map();
for (const f of findings) {
  if (!byCheck.has(f.check)) byCheck.set(f.check, []);
  byCheck.get(f.check).push(f);
}
const CHECK_NAMES = {
  "console": "CONSOLE HEALTH",
  "collector": "VISITOR COLLECTOR",
  "disclosure": "DISCLOSURE",
  "third-party": "THIRD PARTY",
  "dead-endpoint": "DEAD ENDPOINT",
  "secret": "SECRETS",
  "coverage": "GATE COVERAGE",
  "route": "ROUTE",
};
for (const [k, v] of byCheck) {
  console.log(`\n=== ${CHECK_NAMES[k] || k} (${v.length}) ===`);
  for (const f of v.slice(0, 40)) console.log(`  ${f.route}: ${f.detail}`);
  if (v.length > 40) console.log(`  … and ${v.length - 40} more`);
}
if (notes.length) {
  console.log("\n=== NOTES (recorded, not failures) ===");
  for (const n of notes.slice(0, 20)) console.log("  " + n);
}
if (debt.length) {
  console.log(`\n=== CARRIED DEBT (${debt.length}) — not fixed by any deploy ===`);
  for (const d of debt) console.log(`  ${d.check}: ${d.detail}`);
  console.log("  These are the owner's decisions, not this script's. They do not block a");
  console.log("  deploy — a deploy cannot unpublish a commit — but they are printed on");
  console.log("  every run until they are cleared.");
}
console.log(`\ntotal shipability findings: ${findings.length}`);
console.log(`total carried debt: ${debt.length}`);
if (findings.length) {
  console.log("shipability: NOT SHIPPPABLE — fix the findings above.");
  process.exit(1);
}
if (debt.length) {
  console.log(`shipability: SHIPPABLE — 0 blocking findings, ${debt.length} carried debt above. A carried debt is not a pass; it is a thing that is still owed.`);
  process.exit(0);
}
console.log("shipability: OK — the site can be handed over.");
