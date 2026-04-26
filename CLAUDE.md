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
├── DashboardV2.tsx            # v2 demand-supply dashboard (WIP, at /v2)
├── engine/                    # Client-side simulation (replaces server)
│   ├── simulation.ts          # v2: complete demand-supply chain
│   ├── fleetSimulator.ts      # Vehicle positioning from schedules + polylines
│   ├── dataProvider.ts        # Drop-in replacement for server API calls
│   ├── routes.ts              # GeoJSON route/stop loader
│   ├── config.ts              # Route definitions, pricing, competitor data
│   ├── decisionEngine.ts      # "Go now" / "Wait" intelligence
│   ├── impactSimulator.ts     # CO₂, revenue, accident reduction
│   ├── environmentSimulator.ts # Seasonal weather model
│   ├── flightData.ts          # 65 peak-day flights (real airlines/origins)
│   ├── scheduleService.ts     # Timetable lookups
│   ├── transferHubs.ts        # Bus-to-ferry connections
│   ├── time.ts                # Bangkok timezone math
│   ├── geo.ts                 # Haversine, polyline interpolation
│   └── i18n.ts                # Text helpers
├── components/
│   ├── LiveMap.tsx             # Leaflet map with imperative VehicleLayer
│   ├── OpsConsole.tsx          # Operations dashboard (1,491 lines — needs splitting)
│   ├── WelcomeSheet.tsx        # Tourist bottom sheet with booking flow
│   ├── DecisionPanel.tsx       # "Go now" advice card
│   └── ... (16 components total)
├── data/upstream/              # Bundled GeoJSON routes + stops + fixtures
├── lib/
│   ├── i18n.ts                 # 919 lines of 6-language UI strings
│   └── vehicleAnimation.ts    # CSS transition helpers
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

### The Demand-Supply Chain

Every number on screen must trace back to this chain:

```
Flights land at HKT Airport (26 real flights, real airlines, real pax counts)
  → Passengers clear customs (20-45 min model)
  → 12% want ground transport by bus (capture rate)
  → Buses depart on published timetable (18 daily departures from airport)
  → Each bus carries up to 25 passengers
  → Passengers delivered to destinations (Patong 35%, Karon 20%, Town 18%...)
  → Revenue = delivered × ฿100
  → CO₂ saved = delivered × 28km × 0.15 kg/pax-km (APTA standard)
  → Grab equivalent = delivered × ฿720 avg (what they'd have paid)
```

**Nothing decorative.** If a number doesn't trace back to this chain, it shouldn't be on screen.

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

**Rawai Beach → Phuket Airport**: 20 departures/day, first 05:30, last 19:30, ~95 min trip
**Phuket Airport → Rawai Beach**: 25 departures/day, first 08:15, last 23:30, ~95 min trip

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

### Peak Day Flight Data (Dec 30)

26 curated arrivals with real airlines: TG, FD, SL, PG, SQ, EK, QR, CA, CX, KE, ZF (Azur Air), 6E, AY, etc. Origins: Bangkok, Singapore, KL, Moscow, Beijing, Shanghai, Hong Kong, Delhi, Dubai, Frankfurt, Milan. Total ~6,500 arriving passengers.

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
When adding new views (DashboardV2), DON'T replace the default route. Add it at a new path (`/v2`). The existing tourist app and OpsConsole must always work at `/` and `/ops`.

### 6. GeoJSON files must be .json, not .geojson
Vite doesn't handle `.geojson` imports. Rename to `.json`.

### 7. Traffic fixture format ≠ Advisory type
`traffic_advisories.json` uses flat `titleEn`/`messageTh` keys, not nested `LocalizedText` objects. Must transform with `text()` helper when loading.

### 8. The OpsConsole bottom bar needs `hourly` data
`getInvestorSimulation()` was returning `hourly: []` — the SimTimeline metrics (Trips, Km, Pax, Revenue) compute from this array. Must populate with realistic hourly capacity gap data indexed from hour 6 (06:00), not hour 0 (00:00).

### 9. Build the simulation engine around observable facts
Don't hardcode "1,200 riders today." Instead: 26 flights × avg pax × 12% capture rate × customs clearance model × bus capacity × schedule = derived riders. Every number must be traceable.

---

## Deployment

- **Platform**: GitHub Pages (free, static only)
- **Build**: `GITHUB_PAGES=true npx vite build` → `dist/client/`
- **Base path**: `/phuket-smart-bus/` (set via `vite.config.ts` when `GITHUB_PAGES` env var is set)
- **SPA routing**: `404.html` copied from `index.html` in the deploy workflow
- **Auto-deploy**: `.github/workflows/deploy.yml` triggers on push to `main`
- **Live URL**: https://nonarkara.github.io/phuket-smart-bus/
- **Routes**: `/` (tourist), `/ops` (OpsConsole), `/v2` (demand-supply dashboard)

---

## Fleet Roster

20 land buses with Thai plates (กข 1001–1010 for Airport Line, กค 2001–2007 for Patong, กง 3001–3003 for Dragon Line) + 13 named ferry vessels + 3 Orange Line competitor buses.

---

## What Needs Work

1. **DashboardV2** (`/v2`) — the demand-supply intelligence dashboard is built but needs polish. Left sidebar flight ticker, regional bar chart, and accumulating metrics are coded but need testing at desktop width.
2. **OpsConsole** — 1,491 lines in one file. Should be split into sub-components (FleetPanel, DemandPanel, WeatherPanel, etc.).
3. **The OpsConsole bottom bar** — needs to show live accumulating metrics from the 30× engine at all times, not just during Simulate replay.
4. **Boat schedules** — ferry stops have updated times from phi-phi.com but the simulation doesn't model ferry passenger demand.
5. **i18n** — 919 lines of hardcoded strings. Should eventually be JSON files.
6. **Dead code** — `CompareView.tsx` (commented out), `AirportGuidePanel.tsx` (unreachable), ~15% of CSS unused.
7. **Testing** — <1% test coverage. Needs unit tests for the engine, component tests, and E2E.

---

## The Standard

When something looks wrong — buses cutting through water, numbers frozen, bars not moving, text too small on a big screen — the instinct should be: **trace the chain**. Where does the number come from? What's it computed from? If the answer is "it's hardcoded," that's the bug.

Every pixel earns its place. Every number tells the truth. The simulation works so well that plugging in real data is just swapping an import.
