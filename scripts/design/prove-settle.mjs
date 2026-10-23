#!/usr/bin/env node
/**
 * Proves the shared settle waits for a page that has FINISHED loading.
 *
 *   node scripts/design/prove-settle.mjs http://127.0.0.1:8123
 *
 * The settle is the one thing every gate instrument stands on, and a settle
 * that returns early makes every one of them measure a page that is not
 * there. The first version of it had no floor: it waited for the network to
 * go quiet and for the document to hold still, and it returned EARLIER than
 * the fixed five-second wait it replaced — because the legacy chain's retry
 * is on a three-second TIMER, and a page waiting on a timer is perfectly
 * stable. The document stops changing is exactly what a page waiting on a
 * timer looks like.
 *
 * The proof does not use a product route on purpose. A product page can be
 * correct today and broken tomorrow, and a proof that depends on one tests
 * the page rather than the rule. The FIXTURE is a page whose content arrives
 * on a timer and issues no request at all — the exact shape the defect had,
 * and a shape no product route can be relied on to keep.
 *
 * Four cases, and the second one is the point:
 *
 *   1 · a page whose content arrives on a TIMER → the settle must wait
 *   2 · THE SAME PAGE with the floor removed → the settle must NOT wait
 *       (a proof case that would also pass if the rule were deleted is not
 *        a proof — this is the case that makes the floor load-bearing)
 *   3 · a page whose content arrives over the network → the settle must wait
 *   4 · a page whose network NEVER goes quiet → the settle must still
 *       return, because a gate that hangs has stopped being one
 *
 * RUN IT ON A QUIET MACHINE, and never at the same time as a gate run.
 *   Case 2 is a race by nature: it asserts that the no-floor settle
 *   returns BEFORE the fixture's timer fires. The fixture's timer sits at
 *   four seconds and the no-floor settle returns at about two, so there is
 *   two seconds of margin on each side — but a browser competing for CPU
 *   with another browser can stretch an `evaluate` round trip by hundreds
 *   of milliseconds, and the case would then fail for the machine's sake
 *   and not the floor's. The elapsed time is printed with every assertion
 *   so a failure can be told apart from a busy box.
 */
import { chromium } from "playwright";
import { settle } from "./settle.mjs";

const BASE = process.argv[2];
if (!BASE) {
  console.error("usage: prove-settle.mjs <base-url>");
  process.exit(2);
}

let fail = 0;
const say = (ok, label, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) fail = 1;
};

const b = await chromium.launch();
const c = await b.newContext({ serviceWorkers: "block" });

// ── 1 · the timer ─────────────────────────────────────────────────────────
{
  const p = await c.newPage();
  await p.goto(`${BASE}/timer-load.html`, { waitUntil: "load", timeout: 30_000 });
  const t0 = Date.now();
  await settle(p);
  const elapsed = Date.now() - t0;
  const arrived = await p.evaluate(() => document.body.dataset.late === "arrived");
  const height = await p.evaluate(() => document.body.scrollHeight);
  say(arrived, "a page whose content arrives on a TIMER is waited for", `${elapsed}ms, ${height}px`);
  await p.close();
}

// ── 2 · the mutation: the same page, the floor removed ───────────────────
{
  const p = await c.newPage();
  await p.goto(`${BASE}/timer-load.html`, { waitUntil: "load", timeout: 30_000 });
  const t0 = Date.now();
  await settle(p, { minMs: 0 });
  const elapsed = Date.now() - t0;
  const arrived = await p.evaluate(() => document.body.dataset.late === "arrived");
  // The floor is what makes this work: without it the settle returns before
  // the timer fires and the page is measured empty.
  say(!arrived, "WITHOUT the floor the same page is measured before it loads — so the floor is load-bearing", `${elapsed}ms`);
  await p.close();
}

// ── 3 · the network ───────────────────────────────────────────────────────
{
  const p = await c.newPage();
  await p.goto(`${BASE}/late-load.html`, { waitUntil: "load", timeout: 30_000 });
  const t0 = Date.now();
  await settle(p);
  const elapsed = Date.now() - t0;
  const height = await p.evaluate(() => document.body.scrollHeight);
  say(height > 5000, "a page whose content arrives over the network is waited for", `${elapsed}ms, ${height}px`);
  await p.close();
}

// ── 4 · a page that never goes quiet must still return ────────────────────
{
  const p = await c.newPage();
  await p.goto(`${BASE}/ticker.html`, { waitUntil: "load", timeout: 30_000 });
  const t0 = Date.now();
  await settle(p);
  const elapsed = Date.now() - t0;
  say(elapsed < 40_000, "a page whose network never goes quiet still returns", `${elapsed}ms`);
  await p.close();
}

await b.close();
console.log(fail === 0 ? "\nsettle: PROVEN — it waits for the page, and it is the floor that makes it wait." : "\nsettle: NOT PROVEN.");
process.exit(fail);
