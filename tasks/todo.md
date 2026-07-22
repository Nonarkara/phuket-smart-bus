# Ops console: drivers · flights · Phuket conditions — 2026-07-22

## Outcome
Make `/ops` feel human and usable for anyone in Phuket: named drivers with
sim-derived records, live aircraft on the map, and Flood/Air conditions —
without inventing a second numbers pipeline.

## Conservation laws
- Driver day stats = f(plate, schedule trips completed by sim clock, trip load, polyline km, fare, CO₂ factor)
- Aircraft marker = one ADS-B hex from last good poll (never invent positions)
- Env badge = existing environmentSimulator / FloodDash link (no parallel AQI fiction)

## Plan
- [x] 1. `driverRoster.ts` — Thai names + deterministic 8-bit SVG faces keyed by plate
- [x] 2. `driverStats.ts` — per-plate day records from schedule + trip loads + CO₂
- [x] 3. `DriverProfileSheet.tsx` — click row → shifts, efficiency, reliability, hours, pax, CO₂
- [x] 4. `OperatorFleetPanel` — avatar + name column; accessible click/keyboard
- [x] 5. `adsbFlights.ts` + `AircraftLayer` on `V2LiveMap` (airplanes.live HKT + schedule beads)
- [x] 6. Map layer toggles: Buses / Flights / Rain / Incidents
- [x] 7. Phuket conditions strip: weather + AQI + flood risk (env sim + FloodDash link)
- [x] 8. UX pass: clearer fleet affordances, focus states, contrast
- [x] 9. Tests for driver stats identities + typecheck
- [ ] 10. CDPT when user asks

## Review
- Shipped locally: Thai driver faces/names on fleet rows; dossier sheet with
  sim-derived trips/hours/km/pax/revenue/CO₂/efficiency/reliability + career
  rollups; HKT ADS-B + schedule approach beads; layer toggles; conditions strip
  on wall + phone briefing.
- 6/6 new driver tests green; app typecheck clean. Unrelated ToolkitStudy
  snapshot test still failing (pre-existing).
- Remaining: commit/push/deploy/live verify on request.
