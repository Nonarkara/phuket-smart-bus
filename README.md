![Phuket Smart Bus — manga hero of a coastal bus and a rider checking a phone map. Floating HUD chips (pin, waves, clock, bus, battery) are illustration only; they are not live telemetry.](docs/hero-banner.png)

*Hero art is a studio illustration. The HUD icons are decorative — they do not report GPS, occupancy, battery, or timetable state.*

# Phuket Smart Bus

An independent civic-studio prototype: a **simulation that is shaped to become a production operations system**. Today it is a static site. Vehicle positions, queues, revenue, and missed ฿100s are computed in the browser from published timetables and a demand model. When real GPS (and later cameras) exist, the same screens are meant to keep their contracts and swap the data source.

Live: [bus.nonarkara.org](https://bus.nonarkara.org)

---

## What this is

Two audiences, one codebase.

1. **Riders** (phone) — where is the next bus, when does it arrive, what does it cost versus a taxi or Grab.
2. **Operations** (wall screen, also usable on a phone) — where the fleet is in the model, how many seats are scheduled, who boarded, what was earned, what was missed, and where demand and supply do not meet.

The public site is a **client-side engine** plus a preserved Express backend that is not the live production feed. Numbers on the operations surfaces are supposed to trace to one demand–supply chain — flights, capture heuristics, the published airport-line timetable, boarding, delivery, fare — not to decorative constants.

| Surface | Path | Who it is for |
|---|---|---|
| Passenger app | [`/`](https://bus.nonarkara.org/) on `bus.nonarkara.org` | Riders |
| Studio / toolkit hub | [`/`](https://bus.nonarkara.org/) on localhost (and `/toolkit`) | Research archive, USASCP method notes |
| Operations wall | [`/ops`](https://bus.nonarkara.org/ops) | Dispatch / owner |
| Legacy ops styling | [`/v2`](https://bus.nonarkara.org/v2) | Same engine, older chrome |
| ROI calculator | [`/roi`](https://bus.nonarkara.org/roi) | Fare / fleet / capture sliders with sourced constants |
| Governor picture | [`/governor`](https://bus.nonarkara.org/governor) | Impact framing |
| Driver tablet | [`/driver/กข 1001 ภูเก็ต`](https://bus.nonarkara.org/driver/%E0%B8%81%E0%B8%82%201001%20%E0%B8%A0%E0%B8%B9%E0%B8%81%E0%B9%87%E0%B8%95) | One-bus cab view |

`/?demo=tuesday` installs a scripted clock for a walkthrough. It is still the same model, not a second set of numbers.

This repository also keeps a **US-ASEAN Smart Cities Partnership / Phuket–Las Vegas mobility toolkit** archive inside the studio hub. That is a research record. It is not a certificate that this app is the official island transit product.

---

## Philosophy

Build the operational picture first. Feed it a model that conserves. Keep every headline number auditable. Swap telemetry later.

The chicken-and-egg that kills most transit software is: you cannot fund a live system without showing the system, and you cannot show the system without the live feed. The studio answer here is the opposite of a slide deck. The UI, types, and ingest shapes exist now. The clock is accelerated so a visitor can watch a service day. Conservation is tested: for each direction, demand is boarded plus lost (inbound also counts who is still waiting). Combined money is the sum of both legs, never a third model.

If a figure cannot be traced to that chain, it should not be on the wall.

Heuristics are stated as heuristics. Region-based bus capture in `src/engine/travelBehavior.ts` is a knob table (Europeans rent cars; some SE Asian budget-carrier arrivals ride). It is not ridership census. The day an operator shares boarding counts, those knobs become calibrated facts.

The `server/` tree stays. It is the production-shaped backend (telemetry ingest, snapshots, provider adapters). Deleting it to “simplify the demo” would throw away the Phase 2 socket.

---

## Ethical use

**This is not an official PAT product, and it is not an official Phuket transit product**, unless a dated, named agreement is written into this README.

- Do not present the live site, the plates, the map, or the HUD-style hero as Phuket Provincial Administration, PAT, Phuket Smart Bus company, or any concessionaire’s official passenger information system.
- Published **PKSB timetable** facts (effective 18 January 2025 in this repo’s schedule comments) and other public sources are **model inputs**. Using a public schedule is not an endorsement and does not grant operational authority.
- Simulated positions use `telemetrySource: "schedule_mock"` until a real feed is wired. Do not describe them as live GPS.
- Seat cameras, driver-attention status, and passenger-flow types in `shared/types.ts` describe **future** ingest. They are not evidence that those devices are running on the island today.
- The toolkit’s USDOT / USASCP / METRANS history is an archive of a programme that was later paused. Independent continuation of the method is not the same as an agency deploying this repo.
- Forks that put this UI in front of real riders must say what is modelled, what is live, and who is responsible for the service. Do not ship the studio illustration HUD as if it were a vehicle API.

No credentials belong in git. `.env` and `.env.*` are ignored. This README names environment **variables** that the code already reads. It does not invent tokens, keys, or passwords.

---

## How it works

### Demand and supply (both directions)

```
INBOUND
  Peak-day flight fixture (~190 base movements, fuzzed by day of week)
  → customs clearance ramp
  → origin-region capture (travelBehavior.ts)
  → FIFO curb queue, 60-minute patience
  → southbound airport-line departures (published timetable, 25 seats in the model)
  → boarded pax delivered along the polyline
  → abandoned pax counted as missed ฿100 (Grab in the story)

RETURN
  Departing cohorts must be at HKT one hour before takeoff
  → bid onto the latest feasible northbound trip
  → cascade earlier if full; reject buses that arrive >3h early
  → leftover demand is lost ฿100
  → boarded pax count as delivered when the bus reaches HKT

MONEY (sum of both legs, one SSOT)
  revenue  = delivered × ฿100
  lost     = (inbound abandoned + return lost) × ฿100
  CO₂      = delivered × 28 km × bus-vs-car factors in roi.ts
```

`getLiveTotals` reads the day model at a simulated minute. Hourly “missed money” rows keep inbound and outbound **separate**. A netted gap hides empty northbound hours.

### Clock and map

- `getSimulatedMinutes()` is the clock. Default acceleration is 30×. The service window wraps so the fleet does not vanish after midnight in a short visit.
- Buses follow bundled **road polylines** (thousands of points on the airport line), not straight chords between stops.
- React-Leaflet `<Marker>` does not reliably move; the maps use imperative `L.marker()` + `setLatLng()`.

### Simulation → GPS (intended, not automatic)

| Phase | What runs | What you change |
|---|---|---|
| 1 — now | Timetable + `new Date()` + demand engine | Nothing required to demo |
| 2 — GPS | Devices → `server/` ingest → API | Swap `dataProvider.ts` for `api.ts` at the app boundary |
| 3 — cameras / dispatch | Occupancy, attention, flow types already in `shared/types.ts` | New providers behind the same contracts |

`VehiclePosition.telemetrySource` is `"public_tracker" | "direct_gps" | "schedule_mock"` so the UI can stay honest about provenance.

### Stack (what is actually in the tree)

- **Client:** React 19, TypeScript, Vite 6, Leaflet, bundled GeoJSON under `src/data/upstream/`.
- **Engine:** Pure TypeScript in `src/engine/` (`demandSupplyEngine.ts`, `fleetSimulator.ts`, `simulation.ts`, `opsFlightSchedule.ts`, `travelBehavior.ts`).
- **Backend (preserved):** Express in `server/` — demo mode by default (`DATA_MODE`). Live mode refuses to boot unless the tokens the code already requires are present in the environment.
- **Tests:** Vitest unit tests around conservation, ROI constants, schedules, and server config. Playwright specs live in `e2e/`.
- **Deploy target documented in-repo:** Cloudflare Pages project `phuket-smart-bus`, custom host `bus.nonarkara.org`. GitHub Actions exist; credentials are repo secrets, not files.

Optional client tile key: `VITE_GISTDA_API_KEY` (GISTDA rate-limit key for satellite tiles; empty string if unset). Optional live-mode server names: `SMARTBUS_BEARER_TOKEN`, `PKSB_INGEST_API_KEY`, plus `DATABASE_URL` / `REDIS_URL` / `CORS_ORIGINS` if you operate those services. **Do not paste values here.**

---

## How to run / fork

### Run locally

```bash
git clone https://github.com/Nonarkara/phuket-smart-bus.git
cd phuket-smart-bus
npm install
npm run dev
```

`npm run dev` starts the Vite app, the Express API watcher, and the worker together. The web server in `vite.config.ts` listens on **port 4173** (`http://localhost:4173`).

| Local URL | What you get |
|---|---|
| http://localhost:4173/ | Toolkit hub (not the passenger domain front door) |
| http://localhost:4173/ops | Operations wall |
| http://localhost:4173/v2 | Legacy ops view |
| http://localhost:4173/roi | ROI sliders |
| http://localhost:4173/governor | Governor view |
| http://localhost:4173/driver/กข%201001%20ภูเก็ต | Driver tablet |

Useful scripts (from `package.json`):

```bash
npm run dev:web          # Vite only
npm test                 # Vitest
npm run typecheck
npm run build:client     # → dist/client/
```

For a GitHub Pages-style base path:

```bash
GITHUB_PAGES=true npm run build:client
cp dist/client/index.html dist/client/404.html
```

Demo mode needs no tokens. If you set `DATA_MODE=live`, the server will demand the live-mode variables it already documents in `server/config.ts`. Obtain those from the feed owner. Do not commit them.

### Fork for another corridor

The engine is data-shaped. Typical edits:

1. `src/engine/config.ts` — routes, fares, competitor notes.
2. Timetable JSON / departure lists the simulator already reads.
3. `src/data/upstream/` — GeoJSON routes and stops (`.json`, not `.geojson`; Vite’s import story).
4. `src/engine/travelBehavior.ts` — capture knobs for *your* origins, or replace them with counts.
5. `src/engine/opsFlightSchedule.ts` / flight fixtures — or delete the airport chain if you have no air side.
6. `src/engine/fleetSimulator.ts` — plates and duty cycle.
7. `src/lib/i18n.ts` — strings (EN TH ZH DE FR ES today).
8. Keep `telemetrySource` accurate. Do not label mock polylines as GPS.

You do not need this README’s hostnames, Cloudflare project name, or anyone else’s secrets to run a fork.

---

## License

[MIT](LICENSE) © 2026 Non Arkaraprasertkul.

Reuse, fork, and deploy are allowed under that licence. Attribution is the copyright notice in `LICENSE`. The hero illustration is part of this repository’s documentation; keep the HUD disclaimer if you reuse the banner.

Schedule data, airline names, plates, and third-party marks remain with their owners. Open map tiles and optional GISTDA imagery are governed by those providers.

If you put a real city’s riders on a descendant of this system, say so — and say who operates the buses.

**Studio:** [nonarkara.org](https://nonarkara.org) · [github.com/Nonarkara](https://github.com/Nonarkara)
