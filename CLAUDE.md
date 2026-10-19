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

### Phase 2: NOW (supply side) — LIVE mode on /ops
`/ops` has a **LIVE ⇄ SIMULATION** switch (header, top-right; `?source=live|sim` pins it, no param = LIVE whenever real buses are reporting, else SIMULATION):
- **ONE live path. Don't build a second.** `functions/api/live-buses.ts` (Cloudflare Pages Function) → `src/engine/liveOps.ts` (polls it every 15 s, ref-counted) → LIVE UI. A parallel producer that injected real buses into the SIMULATION map (next to simulated ghosts, on a replay clock) was removed for exactly that reason.
- **Feeds** (`shared/pksbFeed.ts`): primary is the **keyless** tracker `po-smartbus.phuket.cloud/vehicles/last` (needs a `smartbus.phuket.cloud` Referer, no token; rows = plate, lat/lon strings, speed, JSON-string `data` with `HangXiang` heading, `GPSTime`, `PeopleCur` on-board count). Optional enrichment: `smartbus-pk-api …/bus-news-2/` with `SMARTBUS_BEARER_TOKEN` (Pages secret) adds line + destination. Joined on `plateKey()` ("10-1230ภูเก็ต" → "10-1230"). Edge-cached 10 s. (The old open CORS proxy `functions/api/vehicles/last.ts` was deleted 2026-10-16; `/api/vehicles/last` is a 404.)
- **Keyless tracker clock lies about its zone** (verified 2026-09-29): `GPSTime`/`RecvTime` are Bangkok wall time stamped `Z`; `UpdateTime` is real UTC (server receive). `resolveKeylessFixTime` takes the reading of GPSTime nearest UpdateTime that isn't after it — "nearest now" picks the wrong one for any fix >3.5 h stale. Trusting the `Z` put every fix 7 h in the future, so every bus looked fresh. `Speed` is tenths of a km/h (529 = 52.9). `LiCheng` is an odometer in metres. `Online` is the device-connected flag. Token feed still uses `normalizeTrackerTime`.
- **Passenger counter is not reporting** (2026-09-29): PeopleCur/CurPeople/PeopleUp/PeopleDown/IncrPeople were 0 on all 24 buses at 11:00 with 8 driving. A counter that has never read >0 is "no counter" — riders and fares null, never ฿0 and never modelled into the study archive. Ask PKSB whether APC is fitted/enabled on the CMSV6 platform.
- **Two fleets, two feeds — the official map (smartbus.phuket.cloud) draws both** (verified 2026-10-01): keyless = 24 town buses 10-1227…1250; token `bus-news-2` = 30 line buses 10-1147…1292 (Airport–Rawai, Patong, Dragon), ~1 fix/min. The relay merges both (`feed: "keyless" | "token"` on each bus). `SMARTBUS_BEARER_TOKEN` is set as a Pages secret (the official site ships it in its public JS; never commit it). Token row time: `data.time` is the server *poll* time — the fix is `gpstime`, Bangkok wall time; `fix_age_s` confirms it; `stat` = online/offline.
- **Research record (D1 `phuket-smart-bus-fixes`, binding `FIXES`)**: every distinct fix from both feeds, PK (plate, fix_ms), INSERT OR IGNORE, no expiry — written by the same tick as the KV ledger. Schema `migrations/0001_fixes.sql`. `/api/research/fixes?date=&format=csv` exports a service day (03:00→03:00 BKK); `/api/research/day?date=` returns `shared/research.ts`'s analysis (finished days cached in KV `research:v1:`); `/research` draws it (Marey time–distance diagram, trip times, headways, stop-to-stop minutes, p85 running time per hour). Line geometry for functions: `shared/lineGeometry.json`, rebuilt by `npx tsx scripts/build-line-geometry.ts`.
- **`data/pksb.sqlite3` `vehicle_history` is NOT real GPS**: the old server's schedule mock stamped real device IDs onto simulated positions (trips on the clock face, 115.0-min runs, 700 km/h jumps). Never use it as history.
- **The tracked fleet is town buses, not the airport line** (verified 2026-09-30 from 2,730 raw samples): none of the 24 buses (10-1227…10-1250) came within 17 km of HKT, Rawai or Patong. They run Phuket Town routes (Saphan Hin, Chalong, Central, Bus Terminal 2, Kathu side) — mostly a morning run, a 3–7 h halt, an evening run; ~114 km and ~4.6 h moving per bus-day. The airport-line simulation is not a model of this fleet; `/study` counts `busesReachedAirport` per day so the claim stays checked. Never mine a route polyline from this feed (6e74122 did, corrupting the official Airport–Rawai GIS line; reverted in e6727cf).
- **Runs, not trips**: the feed has no line, so the archive counts a *run* = leaving a halt of ≥10 min, *hours moving* = fix-to-fix steps ≥50 m taken ≤3 min apart, and `no_fix` = no new fix for 15 min (flagged `lostWhileMoving` if it was driving). Ledgers without `rules: 2` predate this and show those figures as null.
- **Study archive** (`shared/gpsBatch.ts`, one writer: `/api/collect/tick` on the `phuket-smart-bus-collector` cron): km from the odometer (GPS trace kept beside it, reads ~10% short), only fixes taken that Bangkok day, each fix once, per-minute coverage of 05:00–24:00, raw samples kept 45 days. `/api/collect/week?from=…&days=7` is the report. `POST /api/collect/gps` is closed unless the `INGEST_TOKEN` secret is set. `/api/collect/tick` is closed unless the request carries `Authorization: Bearer <TICK_TOKEN>`; the same secret lives on the Pages project, the collector worker and GitHub (backup workflow). The collector worker has no fetch handler and no workers.dev URL.
- **Line + trips from geometry** (the keyless feed has neither): a fix ≤250 m from one route polyline and ≥400 m farther from every other is a vote; 2 votes assign the line (shared road, e.g. Patong beach, stays "identifying"). A trip = arriving within 400 m of a terminal after ≥50% of the line's length since the last one (Airport↔Rawai, Old Town↔Patong; Dragon = a lap). Departure time = last fix at the origin terminal.
- **Riders, best evidence first**: `apc-count` (every rise in `PeopleCur` during the trip is a boarding — a lower bound) → `scheduled-run` (model's boarded load for the run it matches, ±30 min, today's weekday) → `hour-average` → `line-occupancy` (local lines). Each trip stores its basis; the UI says counted vs modelled. km = fix-to-fix haversine (jitter <15 m, jumps >120 km/h, gaps >10 min dropped). Ledger persists per Bangkok date in localStorage and only counts what it observed ("observed since"). No "walked away" in LIVE — GPS can't see it.
- **The simulation runs on the departures the real buses made** (2026-10-18). `src/engine/measuredSupply.ts` turns `/api/research/period` into, per weekday, the latest recorded day's Airport-line departures (southbound from HKT = `fwd`, northbound with the real airport-arrival minute = `rev`; a day with <5 trips either way is an outage and skipped). `setMeasuredAirportSupply()` in `fleetSimulator.ts` installs it; `getAirportDepartures(dow)` / `getAirportboundTrips(dow)` honour it, `getPublished…()` always return the timetable (the rider countdown uses those). Every day-keyed cache checks `getSupplyVersion()`. The /ops timebar shows `AS RAN · <date>` ⇄ `TIMETABLE`; DAY REPORT's ±N fleet re-runs compare against whichever is in force, and an added bus runs that day's median trip time. Measured reality (2–16 Oct): 13–20 complete trips each way vs ~25 published, median 120–137 min vs 95. Ceiling: only complete recorded trips count (can undercount), and simulated buses on the map still move at timetable speed.
- **Rider phone app** (`/` on a phone, `src/components/passenger/`): `LiveArrivals.tsx` = stop picker (+ "Use my location", asked only on tap) → next real buses each direction with road distance and minutes → `RiderMap.tsx` (every bus reporting ≤15 min). `arrivals.ts`: minutes = metres along the line to the stop ÷ median pace (min/km) of recorded trips for line·direction·hour (hour needs ≥3 trips, else direction, else line); no recorded pace → distance only, never invented minutes. Direction: tracker destination text → movement since the last poll → last terminal left. Town buses (keyless, no line) are on the map only. Ceiling: ignores dwell and the turnaround leg — upgrade with per-stop medians from `Trip.stopMin`. The timetable countdown and flight board run on the Bangkok wall clock, never the 30× sim clock.
- In LIVE the demand side (flight board, equation, balance chart) runs on the real Bangkok clock + today's weekday via `setClockOverride`; any "replay this hour" click switches to SIMULATION at that hour (`pksb:scrub-to-hour` event).

Still to come when the bus company provides direct device GPS:
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
│   ├── liveOps.ts             # LIVE ledger: tracker fixes → trips/km → ฿ at modelled load per run
│   ├── simulation.ts          # SimState, getLiveTotals, line P&L — consumes demandSupplyEngine
│   ├── demandSupplyEngine.ts  # THE engine: flights → queue → buses → revenue, both directions
│   ├── travelBehavior.ts      # Region-based bus-capture heuristics (Europeans rent cars, …)
│   ├── opsFlightSchedule.ts   # Per-dow fuzzed schedule (190+ base flights, 5% cancel, ±15% pax)
│   ├── aircraftData.ts        # Airline→aircraft assignments, seat counts, load factor
│   ├── fleetSimulator.ts      # Bus positions, sim clock, DAY·60s sweep, polyline math
│   ├── v2OpsPanel.ts          # Hourly balance rows, operator fleet panel, peaks, getDayDebrief()
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
│   │   ├── DemandSupplyBalanceChart.tsx # OPS diverging chart: riders−seats per hour, IN/OUT, ▲short ▼light
│   │   ├── DayReportModal.tsx  # End-of-day debrief: add/pull buses per hour, ±N fleet re-runs net of opex
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

functions/api/live-buses.ts     # Cloudflare Pages Function: PKSB tracker relay (token server-side)
shared/pksbFeed.ts              # Tracker parser shared by the edge relay and server/

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

**Real-fleet screens show only what the trackers send (hard rule, 2026-10-05).** `/fleet`, `/fleet/raw`, `/research`, `/study` and LIVE mode never attach a modelled or invented value to a real plate: no driver names (no feed carries them), no seats or occupancy (every counter reads 0 = unknown), no per-bus revenue, "missed ฿" or flight-matched losses. A modelled figure may appear only on a simulation surface, labelled "modelled". The "Truman Show" panel (1c773d4, removed in af8bea7) broke this on the default `/fleet` view and is the reason for the rule. See also `DESIGN.md` evidence rule.

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

- Warm paper surface (`--paper`), Source Sans 3 body at 17px / 1.41 line height, Josefin Sans for display. **Not Inter** — see the anti-slop rules below and the ban at the top of `src/styles.css`.
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

### The Operations Wall — what is on screen and why

- Left column, top to bottom: **flight board** (24-h rail + next-30-min callout), the **operating equation** (demand − seats = buses to add, right now), the **demand-vs-supply balance chart** (24 columns, IN/OUT bars ABOVE the axis = riders without a seat → add a bus, BELOW = seats without a rider → run lighter, verdict row in whole buses), then the seven-hour table (scrolls).
- Map section (≥1200 px, 2026-10-18 focal pass): the **island map runs the full body height** on the left; the rail on the right leads with **one headline — ฿ missed today (modelled)** and its sum, `wanted = collected + took a Grab + waiting`, all from one `atMinute()` frame; then conditions, then the fleet table (with real height). The duplicate status line is hidden (its next-departure fact is in the fleet subtitle). Footer is one slim row. LIVE keeps four cards (buses reporting · trips · riders · fares) — GPS cannot see who walked away, so LIVE has no missed figure. Below 1200 px `/ops` serves the briefing view. One PKSB bus count everywhere: the fleet table excludes the Orange Line 8411 competitor (it shares the airport route id). Footer trips/km are bus figures: both directions, full 54 km line, measured trip length when AS RAN.
- **DAY REPORT** (timebar button, and auto-opens when DAY·60s freezes on 24:00): `getDayDebrief()` — 3-term conservation `collected + lost + waiting = couldHave` at midnight (the 22:30 curb queue is a different, larger number), hours to add buses (฿ missed there), hours to run lighter (whole empty trips × ฿217 opex), and −2…+8 whole-day fleet re-runs netted against ฿2,192/bus-day (฿800k/yr ÷ 365 ÷ 16 h, same constant as /roi).
- **LIVE mode** swaps the hero cards (buses reporting · trips completed · riders est. · fares est.), the fleet table (`LiveFleetPanel`: plate · heading to · speed · seen · trips · km · ฿ est.), the footer, and the timebar (`LiveFeedBar`: feed age, observed-since, pricing basis, DEVICES → telemetry console). LIVE and SIM containers carry distinct React `key`s — the SIM cells are ref-written per frame, and reused DOM froze a stale ฿ once.
- Basemap is plain OpenStreetMap + a "smart invert" CSS filter (`invert(1) hue-rotate(180deg)`, never `grayscale` first). **Not CARTO** — CARTO's raster tiles started demanding an API key and watermarked the whole map. The design reference is 1440×900 css px scaled by `zoom`; every ops surface must fit above the fold at that size — the left column may scroll, the map column never does.
- Type floor in `.v2--operations`: 13 px labels, 14–15 px data, 17 px body, 30 px+ hero figures. Do not reintroduce 9–11 px microcopy on the wall.

### CSS Transition Rules for Animation

- Bus markers: `transition: transform 1.5s linear` with `will-change: transform`
- Region bars: `transition: width 1.5s ease`
- Counter numbers: `requestAnimationFrame` with ease-out cubic over 1200ms
- Flight flash: `@keyframes v2-flash` 3s ease-out
- Tick interval: 1s for vehicle positions, 1s for stats, 200ms for countdown timer

---

## Anti-slop design rules (HARD — never re-create these)

These are known AI design-slop patterns. They sit **on top of** the palette and
type rules at the top of `src/styles.css`, and on top of the map-first rule: on
an operations surface the map is the hero and gets the most area.

Check every page you touch before shipping. A hit is a defect, not a preference.

1. **Boxes fit their content.** No card, button or panel much wider or taller
   than the text inside it. Padding proportional to type size (~0.5–1.5× line
   height), never a fixed fat pad. No fixed/min-heights that leave dead space
   under short text. **An ellipsis truncating a label means the box lost.** Fix
   the box or shorten the copy — do not ship the "…".
2. **Balanced composition.** Deliberate grid, balanced visual weight. No heavy
   side beside an empty side, no orphan block. Check 1440 / 1024 / 390 and
   squint: the masses should balance.
3. **Readable line length.** Body lines 45–75 characters, ideally 60–70;
   `max-width: 65ch` for prose. Thai/Chinese keep the same physical measure
   (~30–45 characters). Wide screens get columns or margins, never a
   full-width paragraph.
4. **No AI-slop fonts.** Banned as primary: Inter, Poppins, Montserrat, Roboto,
   Open Sans, Lato, DM Sans, Space Grotesk, Geist, Plus Jakarta Sans, Manrope,
   Nunito, system-ui-as-design-font. This project's canonical set is already
   set: **Josefin Sans** (display) + **Source Sans 3** (body) + **IBM Plex
   Sans Thai** (non-looped Thai). Max two families per surface.
   **No monospace as a UI face — JetBrains Mono is banned outright** (removed
   2026-10-19 after it set "4 min" in a code-editor face at 44px on the
   rider's phone). Figures that must line up use
   `font-variant-numeric: tabular-nums` in the body face. A monospace is
   allowed only where it is genuinely code: `<pre>`/`<code>`, raw tracker JSON,
   ticket numbers — via `--font-code`, the platform's face, never a download.
5. **No lazy ornaments.** No decorative boxes, borders, cards, dividers or
   icon tiles added only to fill space or balance a page. Every container must
   group things that belong together; if removing it loses no meaning, remove
   it. A grid of N equal bordered boxes holding N unrelated numbers is the
   single most common slop in this repo — prefer space or one hairline between
   items over a box around each.
6. **Clear hierarchy: something must win.** One obvious first thing (the map,
   the hero number, the headline), then a clear second and third. Real contrast:
   ≥1.5–2× type step between levels, plus weight, colour and space. No grid of
   equal-weight cards. **If you squint at a screenshot and cannot name the focal
   point in one second, it fails.**
7. **More slop to kill.** Centre-everything and symmetric card grids used by
   default; fake depth (stacked shadows, glassmorphism, one radius everywhere);
   vague slogan heroes; filler copy ("Unlock…", "Seamless", "Revolutionize") and
   fake stats; too many colours (one meaningful accent); thick top/bottom bars
   and padded chrome that shrink the content; icons and badges on every line;
   dense pages where all the text is the same small grey.

### Pre-ship gate (mechanical, then human)

```bash
bash scripts/design-audit.sh          # screenshots every route at 1440/1024/390
```

1. Screenshot each route at **1440, 1024 and 390**.
2. List every hit against rules 1–7 **with the element that hit it**.
3. Fix, then screenshot again.
4. **A different agent or the human reviews the result. Never self-review** —
   that is how all of this got shipped the first time.

### Standing audit record

Checked 2026-10-18 against the live site at 1440/1024/390. `/capacity` and the
rider app at 390 pass. `/ops` was the offender — see lesson 13.

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

### 12. Overlapping text on the wall is usually a collapsed grid track, not a flex bug
Two commits (`24031e2`, `ed796b8`) "fixed" the fleet table's route badge painting over the destination by adding flex rules to the two spans. Both were wrong, and both stayed broken after deploying. Measuring computed geometry on production showed the real cause:

```
grid-template-columns: 96px 0px 72px 64px 48px 44px 52px 84px
```

The route track was **0px wide**. The wide-wall map grid gives the fleet panel ~430px while its eight columns need ~600px at the wall's 14px; `minmax(0, 1fr)` collapsed the one flexible track to nothing, and because `.v2-fleet__list` clipped on x, the `flex: 0 0 auto` tag then painted over the destination and the Speed cell. The flex declarations were never the cause — they were consequences of a track with no width.

**Apply when:** text overlaps or wraps on the wall. Dump `getComputedStyle().gridTemplateColumns` and the ancestor widths before editing any child rule. A track reading `0px` (or far below its content) is a container-too-narrow problem; fix the budget — give the panel the width it needs or state a `min-width` and let it scroll — never the contents. Also compare the **column headers**, not the data: the headers here needed ~480px on their own, which proves eight columns can never fit that rail at the mandated 13px type floor. The fix was `.v2-fleet` spanning the full map section (`grid-column: 1 / -1`) with `.v2-map__stage` reduced to `grid-row: 1 / 4` — width doubled, height unchanged, because both occupied the same grid row.

### 13. The wall was a grid of glass tiles, and nobody was checking
A slop audit on 2026-10-18 (1440 / 1024 / 390, live) found `/ops` was the one
page failing the anti-slop rules. `/capacity` and the rider app passed.

What it actually was: `.v2-map__hero-card` carried `border: 1px` **and**
`backdrop-filter: blur(14px)` while sitting on an opaque panel — four glass
tiles in a 2×2 grid, with nothing behind them to blur and nothing the border
separated. **Correction (same day, checked with `getComputedStyle` on production):**
that base rule never reached the screen — `.v2 .v2-map__hero-card` (line ~9566)
already set an opaque panel, no border, no blur, so removing it changed nothing.
Read computed styles, not the first matching rule, before claiming a visual fix.
`.v2-conditions__item` had `min-height: 64px` under two lines of
text, and the conditions strip drew an outer border around a grid whose 1px
gaps already made the hairlines. Decoration that carried no information, which
is exactly what rule 5 and rule 7 exist to catch.

**Apply when:** a page feels "AI-generated" but you cannot point at one broken
element. That is the signature of ornament, not breakage — go looking for
`backdrop-filter`, stacked `border` on containers that don't group anything,
`min-height` under short text, and grids of N equal cards holding N unrelated
numbers. Run `bash scripts/design-audit.sh` and check against 1–7.

Rule 6 (focal point) was resolved the same day (focal pass, above). Rule 7 — the
left column's dense small grey mono text — is still open. (The "…" truncation in
the conditions strip and hero details was fixed in ebd4525.)

---

- **Platform**: Cloudflare Pages (Production environment, project `phuket-smart-bus`) — this is what actually serves `bus.nonarkara.org`. Confirm with `curl -sI https://bus.nonarkara.org/` — the `server: cloudflare` header is the tell.
- **Build**: `npx vite build` → `dist/client/`
- **Custom domain**: `bus.nonarkara.org` is bound to the Cloudflare Pages project's production branch (`main`). `public/CNAME` (`bus.nonarkara.org`) and GitHub Pages exist too, but GitHub Pages only 301-redirects `nonarkara.github.io/phuket-smart-bus/` → `bus.nonarkara.org`; it does not serve the live traffic.
- **SPA routing**: explicit `public/_redirects` rules rewrite each app route to `/` with 200 (a new top-level route in `App.tsx` needs a line there). Never `/* /index.html 200` — Pages drops it as an infinite loop, and a catch-all would also beat real files. `404.html` (copy of `index.html`) catches the rest with status 404.
- **LIVE feed**: needs no secret (keyless tracker). Optional Pages secret `SMARTBUS_BEARER_TOKEN` adds line/destination labels; `SMARTBUS_KEYLESS_URL` / `SMARTBUS_FEED_URL` override the upstreams. Check with `curl https://bus.nonarkara.org/api/live-buses` — `"status":"live"` and `"sources":{"keyless":true,…}` means it works. Manual deploy: `scripts/deploy.sh`.
- **Auto-deploy**: `.github/workflows/cloudflare-pages.yml` deploys on push to `main` (working again as of 2026-10-16). Manual path: `npx vite build && cp dist/client/index.html dist/client/404.html && npx wrangler pages deploy dist/client --project-name phuket-smart-bus --branch main --commit-hash $(git rev-parse HEAD) --commit-dirty=true`. Verify with `npx wrangler pages deployment list --project-name phuket-smart-bus` (`Environment: Production`). Workers: `npx wrangler deploy -c wrangler.collector.toml` / `-c wrangler.research.toml`.
- **One commit is deployed TWICE** (2026-10-20): `scripts/deploy.sh` builds and uploads locally, and the CI workflow builds and uploads the same commit. Whichever finishes last owns the production alias, and the two bundles are byte-different: a Vite entry chunk embeds its own filename (the other chunks import from `./index-<hash>.js`) and lists every sibling chunk in its dependency map, so one changed name cascades through every chunk's name and back into every chunk's bytes. **Never verify a deploy by comparing asset PATHS against the local build** — that fails on a perfectly good deploy. `scripts/verify-deploy.sh` therefore compares BYTES with hashed asset names normalised away, takes the paths from the LIVE index.html, and separately asserts the production deployment carries the commit being shipped. If you change the deploy path, change the guard with it.
- **Security model (2026-10-16)**: secrets `TICK_TOKEN` (tick), `RESEARCH_GATE_TOKEN` (research reads: the gate worker on bus.nonarkara.org stamps `x-research-gate`; `functions/api/research/_middleware.ts` refuses anything without it, so `*.pages.dev` cannot bypass the 90/min/IP limit), `INGEST_TOKEN` (optional GPS ingest), `SMARTBUS_BEARER_TOKEN` (enrichment). Rotate by setting all copies of a secret together. Response headers: `public/_headers` (HSTS, nosniff, frame-ancestors, CSP **report-only** — enforce once a week of reports is clean) and `functions/api/_middleware.ts` for /api. Tracker strings pass through `cleanText()` before reaching any screen; feeds are capped at 500 rows / 2 MB. Constant-time compares: `shared/secret.ts`.
- **Branches**: only `main` plus `depa-usdot.nonarkara.org` (deploy branch for the toolkit site — keep). Retired work is kept as `archive/*` tags, not branches.
- **Live URL**: https://bus.nonarkara.org (https://bus.nonarkara.org/ops = DashboardV2)
- **Routes**: `/` (tourist app, v1 chain), `/ops` (DashboardV2), `/v2` (legacy v1 dashboard), `/roi` (investor), `/governor` (God-mode), `/driver` (driver tablet)
- **Real-fleet screens**: `/fleet` (FleetConsole — people read this: state counts, a strip per line with every bus at its position and heading, map, "needs a look", one card per bus), `/fleet/raw` (FleetDetail — every tracker field, sort/filter/export), `/research` (trips, Marey, schedule running times), `/study` (week/month archive).
- **Deploying from a clean worktree** (when another agent has uncommitted work in the main tree): `git worktree add <dir> HEAD`, symlink `node_modules`, build there, and pass `--branch main` — a detached HEAD otherwise deploys as a *Preview* named "HEAD".

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

<!-- non-slop:start -->
## Design quality: Non-Slop
@.non-slop/AGENTS.md
@STYLE.md
Before any UI, page, dashboard, deck or visual work, read `.non-slop/AGENTS.md` and follow it.
`STYLE.md` lists this repo's deliberate choices: it wins over every generic rule, and nothing listed there is stripped.
Check with `node .non-slop/bin/non-slop.mjs scan .` (and `render <url>` when Playwright is installed). A different agent or person reviews; never self-review.
<!-- non-slop:end -->
