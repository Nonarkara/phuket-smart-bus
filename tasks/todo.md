# Demand-Supply Engine — the one-go fix

## Diagnosis (why it never worked)

1. **Two vehicle engines.** `simulation.ts buildVehiclePositions()` (airport line,
   synthetic, linear) vs `fleetSimulator getVehiclesNow()` (full fleet, schedule +
   road polyline). /v2 merges both; the plate join fails → every bus shows 10 pax.
2. **Ferry seats counted as airport bus supply.** `getScheduleSupply()` adds 100
   seats per ferry departure into `capacityByHour`, which `getHourlyDemandSupply()`
   compares against airport-arrival bus demand. Apples vs boats.
3. **No aircraft/seat layer.** Flights are `estimatedPax` only — the left bar can't
   show "TG201 · A330-300 · 290 seats · 174 pax" the way an airport API feed would.
4. **Hour-bucket min() accounting.** Capture = min(demand_h, seats_h) per hour.
   No queue, no carry-over, no abandonment — so "missed" was never traceable.

## Build plan

- [x] 1. `src/engine/aircraftData.ts` — aircraft registry (A320/A321/B738/A333/B77W…)
        + deterministic airline+pax → aircraft assignment. Seats + load factor.
- [x] 2. `src/engine/demandSupplyEngine.ts` — ONE deterministic day model:
        per-flight customs-ramp demand curves (minute resolution) →
        FIFO airport queue → per-trip boarding (bus departs, takes min(queue,25))
        → abandonment after 60 min wait (they take Grab = lost revenue)
        → full-day timeline (5-min snapshots) → what-if(+N buses) re-run.
- [x] 3. Rebase `computeSimState()` demand/boarded/delivered on the engine
        (same SimState shape — SSOT consumers untouched). Fix
        `getHourlyDemandSupply()` to airport-line-only supply.
- [x] 4. Enrich `OpsFlight` with aircraft + seats (display layer).
- [x] 5. /v2 wiring: flight rail shows aircraft/seats/load; map buses get
        per-trip boarded pax (engine join by departure); SupplyPanel shows
        captured / missed / lost ฿ / "+2 buses → +฿X" line; hourly chart
        becomes click-to-scrub (sets sim clock + pauses).
- [x] 6. Engine invariant tests (conservation: boarded+waiting+abandoned =
        demand; per-trip ≤ capacity; monotonic cumulatives; what-if ≥ baseline).
- [x] 7. Build, visual verify (desktop + mobile), full test suite, commit,
        deploy, live verify.

## Review — shipped 2026-06-13 (commit 28820fd)

- 93/93 tests pass (15 new engine invariants). Live at bus.nonarkara.org/v2,
  bundle index-BxB8JjI4.js verified.
- Upgrade over plan: what-if models +N buses as full DUTY CYCLES (a bus
  re-departs every ~210 min from the worst-queue moment, greedy per bus),
  not single departures. +2 buses → +157 pax → +฿15,700/day on SAT pattern.
- Honest-numbers pass: banners now split "in queue now" (456) from
  "walked away today" (1,302 · ฿130,200) — the old serviceGap conflated
  them. "74 buses required" was counting ferries; land-only = 34.
- Deferred (user's stated phase 2): interactive what-if UI (pick a time,
  add a bus, watch the day re-run). The engine API already supports it —
  planExtraBuses() takes any departure list.
- Leftover noticed, not touched: public/data/timefm/ (unreferenced
  TimeFM ridership forecast from a Jun 7 experiment, left untracked).

## Decisions made (not asked)

- Aircraft data is a static registry modeled API-ready (AeroDataBox shape) —
  Phase 2 swaps the source, types stay.
- Queue abandonment threshold 60 min (after an hour tourists take Grab).
- Day timeline resolution 5 min (288 snapshots, trivial cost).
- What-if computes +2 and +5 buses inline now; interactive what-if UI is the
  user's stated "later" phase.

---

# Day selector + weekly economics — 2026-07-02

Goal: pick any day MON–SUN on /ops, watch that day's simulation, and see a
weekly revenue roll-up (week = Σ 7 deterministic day models).

- [x] opsFlightSchedule: per-dow deterministic schedules + active-day state
- [x] demandSupplyEngine: dow-keyed model memo + getWeekEconomics()
- [x] simulation.ts: de-const FULL_DAY_FLIGHTS/FLIGHTS, dow-keyed hourly memo
- [x] SimulationControls: MON–SUN day picker in timebar
- [x] SupplyPanel: Weekly Revenue card (7 rows + week total)
- [x] styles.css: Axiom styles for day buttons + week rows
- [x] Tests: week = Σ days, per-day conservation, day switch invalidates model
- [x] Verify preview → build → deploy → commit

---

# Seamless 24h-in-60s playback (Fable-5 design panel, imperative-split 42/50)

- [x] fleetSimulator: DAY_SPEED=1020, DAY_TARGET_END=1350; runOnce flag; one-shot wrap; setSpeed cap 1200 + clear runOnce; setSimulatedMinutes clear runOnce; startDaySweep(); resetClockAnchor(); getVehiclesNow(now, overrideMin) purity arg
- [x] simulation: getLiveTotals(nowMin) SSOT for streaming money; computeSimState consumes it
- [x] V2LiveMap: forwardRef syncNow handle; delete 950ms glide + 500m snap + lerp (root-cause teleport/corner-cut fix)
- [x] SimulationControls: DAY-60s one-touch button (44px)
- [x] DashboardV2: rAF loop + setInterval failsafe heartbeat (buses+money 60fps, panels 4Hz gate), visibility anchor reset, ref-written streaming cells (de-bound from state), twin earned/lost accum cell + hairline meter
- [x] styles.css: twin cell + proportion meter + DAY button (Axiom laws)
- [x] tests: getVehiclesNow(min) purity, money identities, DAY-sweep clamp/pause/resume (4 new describe blocks, 107/107 total)
- [x] verify preview at 1020x (buses hug road, money climbs, freeze EXACTLY at 22:30 confirmed via screenshot + deterministic unit tests) -> tsc+vitest+build all green -> CPD

## Review
- Shipped: one-touch DAY·60s button resets to 05:30, plays the whole service day at
  1020× (derived from DAY_TARGET_END−SERVICE_START), and freezes exactly at 22:30 on
  the payoff shot instead of looping past it. Buses now sample the live clock every
  frame and paint the engine's already-road-snapped position directly — no more
  950ms tween + 500m-snap teleport guard, which was the actual cause of the old
  corner-cutting-over-water bug at speed. Money numbers (earned vs walked-away)
  stream via refs written straight from getLiveTotals(), bypassing the 1.2s Counter
  ease that could never keep up with a fast sweep. A twin accumulator cell now shows
  earned vs lost side by side with a hairline proportion meter — the ฿ story the
  WeekCard already told is now dramatized live during a single day's sweep.
- Learned: getSimulatedMinutes() mutates the clock on every call — an unthreaded
  render loop that calls it twice per frame (once for buses, once for money) would
  silently desync them. Fixed by reading it ONCE per frame and threading that value
  through getVehiclesNow(now, overrideMin) and getLiveTotals(nowMin).
  getClockState() only reflects mode as of the last getSimulatedMinutes() read —
  advancement is lazy-on-read, so a test (or any caller) checking mode without first
  reading the clock sees stale state. A pure rAF loop can go fully idle if the
  browser never fires a callback (confirmed in the Claude Preview harness, which
  reports visibilityState:"hidden" indefinitely) — added a coarse setInterval
  failsafe that only does work if rAF hasn't ticked in >150ms, zero overhead when
  rAF is healthy, guarantees the wall display can never silently freeze.
- Remaining: none — feature complete, 107/107 tests green, typecheck clean, build
  clean, verified in preview via screenshot (exact 22:30 freeze) and unit tests
  (deterministic clamp/pause/resume behavior).

---

# Bidirectional demand model + missed-money diagram — 2026-07-16

- [x] travelBehavior.ts: region capture heuristics (Europeans rent cars 3%, SE Asia budget carriers 7%; fleet-wide ≈5-6%, replacing flat 12%)
- [x] fleetSimulator: getAirportboundTrips() — northbound supply (origin dep + airport arrival)
- [x] demandSupplyEngine: buildOutbound() — departing flights → be-at-airport-by-T−60 cohorts, latest-feasible-bus assignment w/ cascade, lost→Grab; outbound conservation demand=boarded+lost by construction; combined totals; bidirectional getHourlyCorridor; getReturnTripLoad
- [x] simulation: getLiveTotals + computeSimState fully combined (SSOT); occupancy denominator = both directions
- [x] v2OpsPanel: direction-aware verdicts (an hour can need a southbound bus while northbound seats run empty) + emptySeatsPax
- [x] HourlyBalanceChart → "Missed Money · Hour by Hour": IN/OUT/SEATS bars, ADD BUS/LIGHT chips, per-hour missed ฿, footer = the 4 operator questions
- [x] Map joins: northbound buses carry real return loads (both panels)
- [x] 14 new tests (outbound conservation, combined identities, heuristic bounds, weighted avg ∈ 3-8%) — 121/121
- [x] Verified: diagram footer "฿79,600 earned · ฿356,900 missed · 22 hrs need buses · 3 hrs light (138 empty seats)"; DAY·60s sweep streams combined money
