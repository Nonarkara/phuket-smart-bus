import "@testing-library/jest-dom/vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Every test worker gets its OWN database file.
//
// The server's store is a SQLite file, and it was the one at
// `data/pksb.sqlite3` — shared by every test file, in every worker, at the
// same time. Two of them use the vehicle id "bus-1":
// `driver_monitor_latest` is keyed on vehicle_id with INSERT OR REPLACE, and
// `server/app.test.ts` calls `clearRealtimeState()`, which DELETEs those
// rows. So "re-hydrates telemetry, seat, driver, and passenger-flow data
// after an in-memory reset" was reading another file's cleanup — and failed
// about once in three full-suite runs, and never in isolation.
//
// A file per worker (the process, not the test file) means the files inside
// one worker still share a database and run one after another, and no two
// workers share one. The production path is untouched: no env var, the same
// `data/pksb.sqlite3`.
if (!process.env.PKSB_DB_PATH) {
  const dir = mkdtempSync(join(tmpdir(), "pksb-test-"));
  process.env.PKSB_DB_PATH = join(dir, `pksb-${process.pid}.sqlite3`);
}

// jsdom has no ResizeObserver, and the hero measures its own height with
// one — the number that puts the language toggle, the weather pill and the
// live badge UNDER the hero instead of over it. A stub that does nothing
// would let the component's production path go untested; this one calls
// the callback once, the way a real observer does when an element is
// observed, so the publish path runs in every test that renders the hero.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  };
}
