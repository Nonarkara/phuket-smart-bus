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
- [x] 10. CDPT — commit `3678457` on main, push, wrangler deploy, live verify
  (GitHub Actions CF token still auth-fails; deployed via local wrangler.
   GitHub Pages workflow succeeded. Live bundle on bus.nonarkara.org contains
   Driver dossier / ADS-B / FloodDash / สมชาย.)

## Review
- Shipped: Thai driver faces/names on fleet rows; dossier sheet with
  sim-derived trips/hours/km/pax/revenue/CO₂/efficiency/reliability + career
  rollups; HKT ADS-B + schedule approach beads; layer toggles; conditions strip
  on wall + phone briefing.
- Live: https://bus.nonarkara.org/ops · preview https://f0560908.phuket-smart-bus.pages.dev
- Bundle evidence: `index-DmgvGBrP.js` includes Driver dossier, ADS-B, FloodDash, สมชาย
- Note: CI Cloudflare token is broken (auth 10000); local wrangler deploy is the working path until secrets are fixed.
