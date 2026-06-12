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

- [ ] 1. `src/engine/aircraftData.ts` — aircraft registry (A320/A321/B738/A333/B77W…)
        + deterministic airline+pax → aircraft assignment. Seats + load factor.
- [ ] 2. `src/engine/demandSupplyEngine.ts` — ONE deterministic day model:
        per-flight customs-ramp demand curves (minute resolution) →
        FIFO airport queue → per-trip boarding (bus departs, takes min(queue,25))
        → abandonment after 60 min wait (they take Grab = lost revenue)
        → full-day timeline (5-min snapshots) → what-if(+N buses) re-run.
- [ ] 3. Rebase `computeSimState()` demand/boarded/delivered on the engine
        (same SimState shape — SSOT consumers untouched). Fix
        `getHourlyDemandSupply()` to airport-line-only supply.
- [ ] 4. Enrich `OpsFlight` with aircraft + seats (display layer).
- [ ] 5. /v2 wiring: flight rail shows aircraft/seats/load; map buses get
        per-trip boarded pax (engine join by departure); SupplyPanel shows
        captured / missed / lost ฿ / "+2 buses → +฿X" line; hourly chart
        becomes click-to-scrub (sets sim clock + pauses).
- [ ] 6. Engine invariant tests (conservation: boarded+waiting+abandoned =
        demand; per-trip ≤ capacity; monotonic cumulatives; what-if ≥ baseline).
- [ ] 7. Build, visual verify (desktop + mobile), full test suite, commit,
        deploy, live verify.

## Decisions made (not asked)

- Aircraft data is a static registry modeled API-ready (AeroDataBox shape) —
  Phase 2 swaps the source, types stay.
- Queue abandonment threshold 60 min (after an hour tourists take Grab).
- Day timeline resolution 5 min (288 snapshots, trivial cost).
- What-if computes +2 and +5 buses inline now; interactive what-if UI is the
  user's stated "later" phase.
