# Phuket Smart Bus — Project Intelligence

This file is the single source of truth for this project. Every Claude Code session should read this before writing a single line.

---

## What This Is

A **simulation that will become a production system**. Today it's a static site with a client-side simulation engine. Tomorrow, when GPS devices on buses and cameras in vehicles start sending data, this becomes the real operational dashboard. The simulation must be so convincing that the bus company wants to plug in their real data — because the system is already built and waiting for it.

**Two audiences, one system:**
1. **Tourists** (mobile-first, phone screen) — "Where's my bus? When does it arrive? How much does it cost vs a taxi?"
2. **Operations / Owner** (50"+ wall screen, also accessible on phone) — "Where are all my buses? How many passengers? How much revenue today? Where's the demand?"

---

## The Vision: Simulation → Production Pipeline

### Phase 1: NOW — Static Simulation (GitHub Pages)
- Client-side engine computes all vehicle positions from published timetables + `new Date()`
- No backend, no server costs, no API keys
- 30× time acceleration so a visitor sees a full day unfold in minutes
- Every number on screen traces back to the demand-supply chain: flights land → passengers arrive → buses collect them → revenue earned → CO₂ saved

### Phase 2: NEXT — GPS Integration
When the bus company provides GPS connectivity:
- Replace `fleetSimulator.ts` with real GPS telemetry from devices on buses
- The `VehiclePosition` type already has `telemetrySource: "public_tracker" | "direct_gps" | "schedule_mock"`
- The `dataProvider.ts` layer swaps from engine to API calls — UI code doesn't change
- The ingest endpoints already exist in `server/app.ts`: `/api/integrations/vehicle-telemetry`

### Phase 3: FUTURE — Camera + On-Demand Intelligence
- Seat cameras → real occupancy data (the `SeatAvailability` type is ready)
- Driver attention monitoring (the `DriverAttentionStatus` type exists)
- Passenger flow counting → boarding/alighting at each stop
- On-demand bus dispatch based on real-time demand hotspots
- All the TypeScript types for these are already defined in `shared/types.ts` — the system is designed to receive this data

---

## Architecture

### Static Site (current)
```
src/
├── App.tsx                    # Entry: mobile detection, routing (/ops, /v2, /)
├── DashboardV2.tsx            # v2 demand-supply dashboard (now also at /ops)
├── engine/                    # Client-side simulation (replaces server)
│   ├── simulation.ts          # SimState, getLiveTotals, line P&L — consumes demandSupplyEngine
│   ├── demandSupplyEngine.ts  # THE engine: flights → queue → buses → revenue, both directions
│   ├── travelBehavior.ts      # Region-based bus-capture heuristics (Europeans rent cars, …)
│   ├── opsFlightSchedule.ts   # Per-dow fuzzed schedule (190+ base flights, 5% cancel, ±15% pax)
│   ├── aircraftData.ts        # Airline→aircraft assignments, seat counts, load factor
│   ├── fleetSimulator.ts      # Bus positions, sim clock, DAY·60s sweep, polyline math
│   ├── v2OpsPanel.ts          # Hourly balance rows, operator fleet panel, peaks
│   ├── headlineMetrics.ts     # Hero-strip math
│   ├── dataProvider.ts        # Thin adapter; legacy tourist-app chain (kept for /)
│   ├── routes.ts              # GeoJSON route/stop loader
│   ├── config.ts              # Route definitions, pricing, competitor data
│   ├── decisionEngine.ts      # "Go now" / "Wait" (legacy chain)
│   ├── impactSimulator.ts     # CO₂/revenue/accent (legacy chain)
│   ├── environmentSimulator.ts # Seasonal weather model
│   ├── flightData.ts          # 65 peak-day flights fixture (legacy)
│   ├── scheduleService.ts     # Timetable lookups (legacy)
│   ├── transferHubs.ts        # Bus-to-ferry connections
│   ├── time.ts                # Bangkok timezone math
│   ├── geo.ts, polyline.ts    # Haversine, polyline interpolation + cum meters
│   ├── gistda.ts, safetyData.ts, roi.ts # Live integrations / investor math
│   └── i18n.ts                # Text helpers
├── components/
│   ├── LiveMap.tsx             # Leaflet map (tourist view)
│   ├── v2/                     # The /ops dashboard split
│   │   ├── DemandPanel.tsx     # Flights + region chart + HourlyBalanceChart
│   │   ├── SupplyPanel.tsx
│   │   ├── HourlyBalanceChart.tsx # "Missed Money · Hour by Hour" — both directions
│   │   ├── OperatorFleetPanel.tsx # One row per in-service bus
│   │   ├── InsightsTimeline.tsx
│   │   ├── V2LiveMap.tsx       # Wall-screen map (imperative markers)
│   │   ├── V2Shared.tsx        # Counter, InsightCard, helpers
│   │   └── SimulationControls.tsx # Speed, DAY·60s, day picker
│   ├── WelcomeSheet.tsx        # Tourist bottom sheet
│   ├── DecisionPanel.tsx       # "Go now" advice card
│   ├── GovernorDashboard.tsx   # /governor — AI decision picture
│   ├── RoiCalculator.tsx       # /roi — investor payback
│   ├── DriverTablet.tsx        # /driver — driver view
│   └── ... (16 components total)
├── data/upstream/              # Bundled GeoJSON routes + stops + fixtures
├── lib/
│   ├── i18n.ts                 # 919 lines of 6-language UI strings
│   └── vehicleAnimation.ts     # CSS transition helpers
└── styles.css                  # 5,000+ lines (includes v2 dark theme)

server/                         # Express backend (preserved, not deployed)
  ├── app.ts                    # 30+ API endpoints ready for production
  ├── services/providers/       # Bus, weather, AQI, traffic providers
  └── services/                 # Decision engine, transfer hubs, operations
```

### Key Design Decision: The Server Code Stays

The `server/` directory is the production backend. It has:
- Real GPS telemetry ingest endpoints
- SQLite persistence for vehicle history
- Background worker for 15-second snapshots
- Live bus API integration (`smartbus-pk-api.phuket.cloud`)
- Seat camera, driver monitor, passenger flow ingest

Don't delete it. When GPS data becomes available, we switch from `src/engine/dataProvider.ts` (client-side simulation) to `src/api.ts` (server API calls) by changing one import in `App.tsx`.

---

## How the Simulation Works

### The Demand-Supply Chain (BOTH directions)

Every number on screen traces back to this chain. The model is **bidirectional** — both legs conserve exactly.

```
INBOUND (arriving pax ride out):
  Flights land at HKT Airport (~190 base flights, real airlines + charters, fuzzed per dow)
  → Passengers clear customs (20-45 min ramp)
  → Per-flight bus-capture by passenger origin (heuristic table — see travelBehavior.ts)
        SE Asia 7% (Bangkok/KL/SIN budget carriers)
        East Asia 5% (Seoul/Tokyo)
        China 4% (tour coaches dominate)
        India 5%
        Russia/CIS 3% (package transfers)
        Europe 3% (rental cars + private transfers)
        Middle East 3% (private vans)
        Other 4%
  → Fleet-wide weighted average ≈ 5% (operator's planning figure)
  → Buses depart on PKSB timetable (~25 daily airport departures, capacity 25)
  → Queue FIFO with 60-min patience; abandoned → Grab (counted as missed ฿100s)
  → Boarded pax delivered progressively along the route
  → Revenue = delivered × ฿100

RETURN LEG (departing pax ride back to the airport):
  Each departing cohort must be at the airport 1h before takeoff
  → Bids onto the latest northbound bus that makes the deadline
  → Cascades to earlier buses if the chosen one is full
  → Nobody rides a bus that lands them >3h early (not a real alternative)
  → Whoever can't fit (or has no feasible bus) takes a Grab → missed ฿100
  → Boarded pax count as delivered when the northbound bus reaches HKT

MONEY (combined both directions):
  → Revenue = delivered × ฿100
  → Lost revenue = (abandoned + return-leg-lost) × ฿100
  → CO₂ saved = paxDelivered × 28 km × 0.15 kg/pax-km (APTA, sourced from roi.ts)
  → Grab equivalent = delivered × ฿720 avg
```

**Nothing decorative.** If a number doesn't trace back to this chain, it shouldn't be on screen.

The hour-by-hour MISSED MONEY diagram (the basic diagram, in `HourlyBalanceChart.tsx`) is the operator's read: per hour, IN demand / OUT demand / scheduled seats both directions / a direction-aware verdict chip (ADD BUS −n when either direction is short, LIGHT when seats outnumber riders) and the ฿ missed that hour. Footer: ฿ earned / ฿ missed / hrs needing buses / hrs light (empty seats).

Conservation: `demand = boarded + lost` at every minute for both directions; `getLiveTotals(t).paxDelivered = inbound.deliveredCum[t] + outbound.deliveredCum[t]` at every minute, asserted by tests.

### Time Acceleration

- `SIM_SPEED = 30` → 1 real second = 30 simulated seconds
- Service window wraps within 06:00–22:30 so buses are always running
- `getSimulatedMinutes()` is the single source of simulated time

### Vehicle Positioning

Buses follow the **actual road polyline geometry** (3,944 points for the Airport line), not straight lines between stops. The flow:

1. `getSimulatedMinutes()` → current sim time
2. `buildTripOccurrences()` → which trips are active at this time
3. Time-based offset → distance along route in meters
4. `posOnPolyline()` → binary search polyline cumulative distance → exact lat/lng on the road
5. CSS `transition: transform 1.5s linear` on Leaflet marker icons → smooth visual glide

**Critical lesson learned**: React-Leaflet's `<Marker>` doesn't reliably update position on prop changes. Use **imperative `L.marker()` with `setLatLng()`** via a `VehicleLayer` component that uses `useMap()`. CSS transition on `.bus-marker-icon` smooths the movement between ticks.

---

## Real Schedule Data

### Bus Timetable (Official PKSB, effective 18 Jan 2025)

**Rawai Beach → Phuket Airport (northbound)**: ~25 departures/day, first 05:30, last 19:30, ~95 min trip. This is the corridor the return-leg engine uses — departing pax who must reach the airport 1h before takeoff bid onto these buses in reverse deadline order.

**Phuket Airport → Rawai Beach (southbound)**: ~25 departures/day, first 08:15, last 23:30, ~95 min trip. This is the corridor the inbound queue uses — arriving pax board FIFO from the curb.

The same 10 vehicles (กข 1001–1010) rotate through both directions; the duty cycle is ~210 min per bus (95 min trip + 95 min layover + 20 min buffer at the airport curb).

Real travel times (from official timetable):
- Airport → Patong: **100 min** (1h40m via Surin/Kamala)
- Airport → Phuket Old Town: **56 min**
- Patong → Old Town: **35 min**
- Patong → Promthep Cape: **48 min**
- Airport → Rawai (full route): **95 min**

### Ferry Schedules (from phi-phi.com + pier websites)

- **Rassada → Phi Phi**: 08:30, 11:00, 13:30, 13:45, 15:00 (~2hr ferry)
- **Rassada → Ao Nang**: 08:30 only (~2hr), return 15:00
- **Bang Rong → Koh Yao Noi**: 09:30, 11:00, 13:30, 17:00 (~40min speedboat)
- **Chalong → Racha**: 11:30, 16:00 (~35min speedboat)

### Orange Line Competitor (Route 8411)

Government-operated, Airport → Phuket Town:
- ฿85-100 fare, every 60-90 min, 08:00–21:00
- 80 min trip, 3 simulated buses
- Stops: Airport, Boat Lagoon, Central/Big C, Pearl Village, Bus Terminal 1

### Peak Day Flight Data

The `peak-day-flights.json` fixture carries ~190 base flights with real airlines (TG, FD, SL, PG, SQ, EK, QR, CA, CX, KE, ZF (Azur Air), 6E, AY, VJ, etc.) and origins across Bangkok, Singapore, KL, Moscow, Beijing, Shanghai, Hong Kong, Delhi, Dubai, Frankfurt, Milan, Seoul, Tokyo, Doha, and more. `opsFlightSchedule.ts` builds 7 deterministic per-dow variations (seed by dow): 5% cancellation, ±15% pax jitter, ±10 min time jitter, plus 0–2 charter flights per day (TUE adds a Rassada ferry + Bang Rong speedboat; SAT adds an Azur Air Yekaterinburg + Korean Air Seoul; SUN adds an Azur Air + a Chalong speedboat). Day-of-week volume factors: SUN 1.10, MON 0.95, TUE 0.85, WED 0.85, THU 1.00, FRI 1.05, SAT 1.18.

Aircraft assignments come from `aircraftData.ts` — each airline's fleet is keyed (e.g. TG gets 777-200ER / A350-900, EK gets A380-800 / 777-300ER). The same flight keeps the same airframe across days; only the load factor varies with the fuzz. Pax can never exceed seats.

---

## Pricing (Realistic 2025 Phuket)

| Mode | Airport→Patong | Airport→Old Town | Airport→Kata |
|------|---------------|-----------------|-------------|
| **Smart Bus** | ฿100 | ฿100 | ฿100 |
| **Grab/taxi** | ฿600–1,000 | ฿400–700 | ฿500–900 |
| **Tuk-tuk** | ฿500–3,000 | ฿300–1,500 | ฿400–2,500 |

Tuk-tuk range is intentionally wide — they're unmetered, unregulated, and the price depends entirely on how well you bargain.

---

## Design Rules for This Project

### The Tourist App (Mobile First)

- iOS-inspired: Inter font, 17px base, 1.41 line height
- Bottom sheet with "Next bus to Patong" countdown (mm:ss format, ticks every 200ms at 30×)
- Route pills along the top for quick route switching
- Map badge shows simulated Bangkok clock + bus count + next departure
- 6 languages: EN, TH, ZH, DE, FR, ES (all hardcoded in `src/lib/i18n.ts`)

### The Operations Wall (50"+ Screen First)

- Dark theme (#0a0e14 background) — reduces eye strain in ops rooms
- Three-column grid: left (demand/flights), center (map), right (supply/impact)
- Bottom accumulator bar: Buses, Trips, Km, Pax, Revenue, CO₂ — all climbing in real time
- `zoom: clamp(1, calc(100vw / 1920), 3)` on `html.ops-mode` — auto-scales for any display size
- Flight ticker with animated pop-in as planes "land"
- Regional origin bar chart (SE Asia, China, Russia/CIS, Europe, India, Middle East)
- Every metric derived from the demand-supply chain, not hardcoded

### CSS Transition Rules for Animation

- Bus markers: `transition: transform 1.5s linear` with `will-change: transform`
- Region bars: `transition: width 1.5s ease`
- Counter numbers: `requestAnimationFrame` with ease-out cubic over 1200ms
- Flight flash: `@keyframes v2-flash` 3s ease-out
- Tick interval: 1s for vehicle positions, 1s for stats, 200ms for countdown timer

---

## Hard-Won Lessons (Don't Repeat These Mistakes)

### 1. React-Leaflet markers don't move
`<Marker position={...}>` does NOT update when position props change. You MUST use imperative `L.marker()` with `setLatLng()` via a component that calls `useMap()`. The `VehicleLayer` component in `LiveMap.tsx` does this correctly.

### 2. Sub-pixel movement is invisible
At zoom 11, a bus at 25kph moves 0.02 pixels per 250ms tick. CSS `transition` doesn't help if the movement is sub-pixel. Solution: 30× time acceleration + 1.5s CSS transitions with overlapping 1s ticks.

### 3. Integer minutes → jerky movement
`getBangkokNowMinutes()` returns integer minutes. Two calls 250ms apart return the SAME value. Use `getBangkokNowFractionalMinutes()` which includes seconds and milliseconds.

### 4. The service window wrap
At 30× speed, simulated time passes midnight after ~33 real minutes. Past midnight = no scheduled departures = all buses vanish. Solution: `getSimulatedMinutes()` wraps within 06:00–22:30 service window.

### 5. Don't override the working app
When adding new views (DashboardV2), DON'T replace the default route. The tourist app must always work at `/`. The /ops path now renders DashboardV2 (was OpsConsole, retired 2025-07 — too many parallel chains). The legacy v1 view is preserved at `/v2` for reference.

### 6. GeoJSON files must be .json, not .geojson
Vite doesn't handle `.geojson` imports. Rename to `.json`.

### 7. Traffic fixture format ≠ Advisory type
`traffic_advisories.json` uses flat `titleEn`/`messageTh` keys, not nested `LocalizedText` objects. Must transform with `text()` helper when loading.

### 8. The OpsConsole bottom bar needs `hourly` data
`getInvestorSimulation()` was returning `hourly: []` — the SimTimeline metrics (Trips, Km, Pax, Revenue) compute from this array. Must populate with realistic hourly capacity gap data indexed from hour 6 (06:00), not hour 0 (00:00).

### 9. Build the simulation engine around observable facts
Don't hardcode "1,200 riders today." Instead: ~190 base flights × fuzzed pax × REGION-BASED capture (see travelBehavior.ts) × customs clearance model × bus capacity × schedule = derived riders. Every number must be traceable. The OLD flat-12% rate was wrong — origin matters (Europeans rent cars, Bangkok budget carriers ride). The heuristic table is the SSOT; each rate is a single-line knob for the day real ridership data exists.

### 10. Demand is bidirectional, and a combined gap hides every underdemanded hour
The /ops "Missed Money" diagram tracks BOTH directions independently. A combined gap (IN − OUT netted together) hid every underdemanded hour because inbound shortage masked northbound buses running empty — was "0 hrs light", truth was "3 hrs · 138 seats". Verdict chips must be direction-aware: `classify(inGap, outGap, …)` flags an hour as SHORTFALL when EITHER direction is short (that's where a bus earns ฿100/boarding). The hourly corridor (`getHourlyCorridor`) emits per-direction `demandPax`/`seats`/`boardedPax`/`lostPax` separately — never collapsed.

### 11. Money must be combined, but conservation must be direction-by-direction
All money surfaces (accum bar, week card, alert banner, hero cards) carry BOTH directions from one SSOT (`getLiveTotals ← atMinute ← day model`). Conservation laws: `outDemand = outBoarded + outLost` AND `demand = boarded + abandoned + waiting` at every minute, INDEPENDENTLY for each leg. The combined figure is the sum, never a model of its own.

---

## Deployment

- **Platform**: Cloudflare Pages (Production environment, project `phuket-smart-bus`) — this is what actually serves `bus.nonarkara.org`. Confirm with `curl -sI https://bus.nonarkara.org/` — the `server: cloudflare` header is the tell.
- **Build**: `npx vite build` → `dist/client/`
- **Custom domain**: `bus.nonarkara.org` is bound to the Cloudflare Pages project's production branch (`main`). `public/CNAME` (`bus.nonarkara.org`) and GitHub Pages exist too, but GitHub Pages only 301-redirects `nonarkara.github.io/phuket-smart-bus/` → `bus.nonarkara.org`; it does not serve the live traffic.
- **SPA routing**: `404.html` copied from `index.html` in the deploy workflow
- **Auto-deploy is broken**: `.github/workflows/cloudflare-pages.yml` runs on push to `main` but fails — `CLOUDFLARE_API_TOKEN` auth-fails (error 10000). `.github/workflows/deploy.yml` (GitHub Pages) succeeds but doesn't matter for the live domain. **Working path until the CF secret is fixed**: deploy manually — `npx vite build && cp dist/client/index.html dist/client/404.html && npx wrangler pages deploy dist/client --project-name phuket-smart-bus --commit-dirty=true` (no `--branch` flag → production). Verify with `npx wrangler pages deployment list --project-name phuket-smart-bus` (look for `Environment: Production`, `Branch: main`).
- **Live URL**: https://bus.nonarkara.org (https://bus.nonarkara.org/ops = DashboardV2)
- **Routes**: `/` (tourist app, v1 chain), `/ops` (DashboardV2), `/v2` (legacy v1 dashboard), `/roi` (investor), `/governor` (God-mode), `/driver` (driver tablet)

---

## Fleet Roster

20 land buses with Thai plates (กข 1001–1010 for Airport Line, กค 2001–2007 for Patong, กง 3001–3003 for Dragon Line) + 13 named ferry vessels + 3 Orange Line competitor buses. The northbound and southbound buses are the SAME 10 vehicles (PKSB rotates them through the duty cycle), so the airport line carries both directions of bus demand.

---

## What Needs Work

1. **Boat schedules** — ferry stops have updated times from phi-phi.com but the simulation doesn't model ferry passenger demand. Boat mode flights appear in the schedule rail as "BOAT" but contribute 0 to the bus queue.
2. **i18n** — 919 lines of hardcoded strings. Should eventually be JSON files. The /ops page is English-only today.
3. **Dead CSS** — ~15% of CSS unused (drift). The legacy v1 `dataProvider.ts` chain is preserved for `/` (tourist app) and `/v2` (reference); not dead, but a candidate for slimming.
4. **Component tests** — the engine has 130 unit tests (conservation, regression, heuristics, combined reconciliation) but the React components have only 2. A `<HourlyBalanceChart>` snapshot test would catch the next "verdict chip reads the wrong gap" regression.
5. **Heuristic calibration** — `travelBehavior.ts` is the weakest link in the chain. The day PKSB shares a week of real boarding counts, those 8 numbers become calibrated facts and every ฿ figure sharpens with them.
6. **`/v2` and `/ops` are now the same view** — the /ops route renders DashboardV2, but the `/v2` URL still exists for reference (legacy v1 dashboard, same engine, different styling). Long-term, retire `/v2` and keep `/ops` as the single operations surface.

---

## The Standard

When something looks wrong — buses cutting through water, numbers frozen, bars not moving, text too small on a big screen — the instinct should be: **trace the chain**. Where does the number come from? What's it computed from? If the answer is "it's hardcoded," that's the bug.

Every pixel earns its place. Every number tells the truth. The simulation works so well that plugging in real data is just swapping an import.
