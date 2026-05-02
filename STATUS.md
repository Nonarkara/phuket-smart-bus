# Phuket Smart Bus — Status, midnight Singapore time

This is the file to read first when you wake up.

## What is true right now (verified)

- **52 unit tests pass.** Including 10 new regression tests that catch
  the four bug classes that have repeatedly bitten this project:
  - Bus polyline adherence — every active bus is within 5 m of its
    polyline at any sim minute.
  - Polyline-aware sub-tick interpolation lands on the road, not on a chord.
  - Per-tick distance is ≤ 50 m (catches the "stuck-at-integer-minutes"
    bug where buses jumped 580 m at once).
  - Right-bar metrics are non-zero by sim 09:30; cumulative servedPax > 50
    over the day (catches dead-zone regressions).
  - `simNow()` and `getSimulatedMinutes()` always return the same value
    (catches clock-drift between the map and the metrics).
  - Sim returns FRACTIONAL minutes, not stuck integers.
  - Day-of-week fuzz produces the expected count of arrival flights.
- **CI gates the deploy on `tsc --noEmit && npm test`.** Failing tests
  block the GitHub Pages deploy. No more "I shipped a broken build."
- **Build is clean.** Typecheck, vitest, vite build all green.

## What is true right now (unverified)

- The bus-flying fix landed, and the test suite says geometry is correct,
  but I cannot watch real-time bus motion in this preview — `requestAnimationFrame`
  and `setInterval` are throttled when the page is hidden. The math is
  asserted; the visual is not.
- The right-bar `AnimatedCounter` was switched to `setTimeout` so it
  works in backgrounded tabs — verified across three samples in the
  preview, but again I cannot see the smooth tween in your browser.

## What was deleted tonight (Musk rule pass 2)

- `src/lib/vehicleAnimation.test.ts` — covered three orphan exports.
- Three orphan exports in `src/lib/vehicleAnimation.ts`:
  - `buildAnimatedVehicleFrame`, `shouldAnimateVehicleFrame`,
    `buildAnimatedVehicleFrameOnRoutes`, plus their helper types
    (`RouteAnimationPath`, `RouteAnimationIndex`).
- Unused `getBangkokNowMinutes` import from `fleetSimulator.ts`.
- The old "two clocks" architecture: `simulation.ts` now imports
  `getSimulatedMinutes` from `fleetSimulator`. One clock, no drift.
- `buildScheduleMockFleet` was using wall-clock time while
  `getVehiclesNow` used sim time. Both now use sim time — the ops console
  and the map agree on what minute it is.

## What was optimized

- `getHourlyDemandSupply()` is now memoized. It depends only on the
  flight schedule and the bus departure list, both immutable for the
  session. Previously every poll (1 Hz × multiple consumers) recomputed
  24 hourly buckets from 380 flights and 18 departures. Now: compute
  once, return the cached array forever.

## What is open (deferred — bring it up tomorrow if you want)

1. **Migrate the bus marker layer to Deck.gl `TripsLayer`.** This is the
   right tool for animated vehicles on a map and your workspace already
   uses it elsewhere. If buses still look wrong in your real browser,
   this is the architectural fix. ~half a day.
2. **OpsConsole at `/ops` is 1,500 lines** and has its own hand-rolled
   simulator at line 1014. It produces VehiclePositions with `polylineMeters: null`
   so they fall back to straight-line interpolation. Either delete the
   ops simulator (use `getVehiclesNow()` directly) or extend it to emit
   polyline meters too. Not blocking.
3. **i18n strings are 919 hardcoded lines.** CLAUDE.md says these should
   move to JSON. Not blocking.
4. **Server code (`server/`).** Preserved per CLAUDE.md instruction
   "Don't delete it — when GPS data becomes available, switch one import."
   Not touched.
5. **Day-of-week fuzz uses a 5% cancellation rate** that produces a
   non-deterministic flight count per day (170-195 arrivals). The test
   suite uses range assertions. If you want exact counts to match
   marketing copy, dial the fuzz down or quote a range.

## How to verify in your browser when you wake up

Open https://nonarkara.github.io/phuket-smart-bus/ on your phone.

1. **Right bar climbs?** Open the page, watch the four numbers for 30
   seconds. They should all increase: Riders, Buses, On-time, CO₂. If
   they sit at the same number for the full 30 s, the AnimatedCounter
   regressed — open DevTools, check the React state on the
   `live-stat__val` span. If `propsValue` rises but `display` is stuck,
   the counter is broken; if both are stuck, the engine is broken.

2. **Buses follow the road?** Pick a bus on the Airport Line (the
   north-south teal corridor). Watch it for 30 seconds. The path
   should curve along the road, not cut diagonals. If it cuts a
   diagonal, the polyline lookup failed for that route — open DevTools
   console, look for the route id, and tell me which one.

3. **Sim clock advances?** The map badge top-left should show
   `[DAY] HH:MM` and tick forward. At 15× speed, the minute changes
   every 4 real seconds.

If any of those three are broken, send a 30-second screen recording
or three timestamped screenshots. With evidence I can diagnose without
guessing.

## The map of where things live

```
src/engine/
  fleetSimulator.ts     ← the bus-positioning engine + sim clock
  simulation.ts          ← the demand-supply chain + chart data
  polyline.ts            ← shared lat/lng-along-polyline math
  opsFlightSchedule.ts  ← flight data + day-of-week fuzz
  impactSimulator.ts    ← right-bar metrics (riders / co2 / revenue)
  routes.ts              ← route geometry, stops, polylines
  geo.ts                 ← haversine, bounds
  time.ts                ← Bangkok timezone helpers
  regression.test.ts    ← the bug-class catchers (NEW)

src/components/
  LiveMap.tsx            ← the map + polyline-aware vehicle interpolation
  AnalyticsPanel.tsx    ← the demand-supply chart
  HeroSection.tsx       ← the countdown + price comparison overlay
  WelcomeSheet.tsx      ← the bottom sheet
  OpsConsole.tsx        ← the /ops dashboard (1,500 lines, candidate for split)

src/lib/
  vehicleAnimation.ts   ← interpolateCoordinate + interpolateHeading (fallback)
  i18n.ts                ← 919-line UI string catalog (candidate for JSON migration)

src/data/upstream/      ← bundled GeoJSON + ferry stops + flight fixtures
```

## Shipped overnight (the contract-pitch surfaces)

Three new surfaces, all linked from the desktop landing under the
Operator Console button.

1. **`/roi`** — Three sliders (fleet, capture rate, fare). Outputs
   annual revenue, payback period, CO₂ avoided, tourist savings, full
   detail table. Every constant has a sourced comment in
   `src/engine/roi.ts` and a hover tooltip in the table. Pilot CTA at
   the bottom with the contact email. Print stylesheet hides nav cruft
   so the CFO's PDF print is one clean page.

2. **`/driver/[plate]`** — Per-bus tablet view. Next stop big and
   centered (English + Thai), ETA in minutes, on-time delta, passenger
   count, speed, weather. Full upcoming-stops list with checkmarks for
   passed stops and a green highlight on the next stop. ETA uses the
   route's average speed when instantaneous speed is too low (avoids
   "52 minutes to next stop" math when the bus is dwelling). When the
   plate isn't in service, the page suggests active plates you can try.

3. **`?demo=tuesday`** — Auto-play scripted demo. Persistent top
   banner pulses red (`AUTO-PLAY DEMO · Tuesday in October · 5-min
   loop`). Caption strip at the bottom narrates 11 moments through the
   day. Sim spans 08:00 → 22:00 over 5 real minutes — first bus
   departure hits at ~5 real seconds after demo start, no dead zone.
   Loops indefinitely. Works on `/`, `/v2`, and `/ops`.

## Engineering changes that came with the surfaces

- `setClockOverride(fn | null)` exported from `fleetSimulator.ts` —
  scripted demo mode uses this; tests use it.
- `getVehicleDetail(plate)` exported from `fleetSimulator.ts` — single
  call returns everything the driver tablet needs, including stop ETAs
  and the on-time delta.
- `src/engine/roi.ts` — pure math module with sourced ROI constants.
- `ru` / `ko` / `ja` browser locales now fall back to English explicitly
  in `getStoredLang()` rather than hitting the `?? "en"` default by
  accident. (Real Russian translations still TODO.)

## Test count: 63 (was 52 + 11 new)

- `roi.test.ts` — 6 tests covering computeRoi math, formatters,
  baseline scenario, full-island scenario, punitive opex.
- `regression.test.ts` extension — 4 tests for `setClockOverride` and
  `getVehicleDetail`, including determinism of the mocked passenger count.

## Last commits

- [latest] Polish for the contract pitch (this commit)
- 8dc3d1d  Fix CI test gate: vitest/globals types
- dea25a9  Question, simplify, optimize, automate — overnight pass
- 0c0f441  Buses follow the road: polyline-aware interpolation
- 84ff3ec  Fix the dead-zone right bar
- 5ea09a7  Time-driven right bar + day-of-week flight fuzz
- ce9a1ff  Apply Musk rule: delete dead code first

Live URL: https://nonarkara.github.io/phuket-smart-bus/

If the live URL serves an older bundle than the latest commit hash,
GitHub Pages CDN is still propagating — wait 60 seconds and hard refresh.
