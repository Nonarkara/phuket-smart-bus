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
