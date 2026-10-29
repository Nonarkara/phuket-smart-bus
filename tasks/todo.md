# LIVE = official map, both fleets, research record — 2026-10-02

- [x] Token feed (line fleet, 30 buses) wired: Pages secret set; fix time = gpstime (BKK), not poll time; online flag
- [x] D1 research store: every distinct fix, both feeds, no expiry, written by the tick
- [x] shared/research.ts: line by geometry/feed, trips terminal→terminal, laps, stop crossing times, jump + plausibility guards (tests)
- [x] /api/research/day + /api/research/fixes (CSV/JSON)
- [x] /research page: Marey, trip times, headways, stop profile, p85 schedule table, trip log; phone-checked
- [x] CDPT 57546a5, 981934e — live

## Next (needs data to accumulate)
- After ~7 service days: multi-day view (same hour across days) → the timetable proposal per line
- Calibrate the simulation's trip times / headways from observed p50/p85 by hour (replace fixed 95 min)
- Ridership: counters read 0 on both fleets → ask PKSB for ticket/farebox counts. No revenue figure survives a lender without it.
- First real trips land from ~05:30 2026-10-02; check /research by 09:00 and fix anything the real data breaks

# PKCD real-GPS monitoring — 2026-10-01

- [x] /study tables render (they did; earlier read was wrong)
- [x] Revert 6e74122: official Airport–Rawai polyline was replaced by one mined from town buses (490/506 pts >0.5 km off road); regression test had been skipped
- [x] Archive fold: runs, hours moving, first/last move, longest halt, airport reach, no_fix state; past days read at their last sample; `rules: 2` so older days show unknown
- [x] /study: collector freshness tile; observed runs · hours replace "vehicles × 5 trips × 25"; airport model labelled reference; per-dow schedule without mutating global sim day; 30D = 30 days
- [x] 30 Sep ledger refolded from raw samples (backup of the old one kept in session scratchpad)
- [x] CDPT: e6727cf, 7764521, 3b706b6, 3a985c8 — live, verified

## Still open
- Ask PKCD: which lines do 10-1227…10-1250 run, and are the airport-line buses on any tracker? A line list turns runs into real trips.
- APC counters still silent — riders/fares stay unknown.
- /ops LIVE still matches these town buses against airport/Patong/Dragon geometry (with LINE_MARGIN restored to 250 m most will stay "identifying"). Its money figures assume airport-line fares.

# Real-bus study audit — 2026-09-29 (study week starts 2026-09-30)

Audit of Grok's collector (f18cdc2). Verified against the raw tracker, not the report.

## Found (evidence in session)
- GPSTime is Bangkok wall time stamped `Z` → every fix 7 h in the future; tick said `fresh: 20` with 8 online. `UpdateTime` is true UTC.
- `speed` is 0.1 km/h (odometer-verified): 222 → 22.2 km/h.
- `LiCheng` is an odometer in metres (Δ2.2 km vs trace 2.15). Trace under-counts ~10%.
- Every passenger field (PeopleCur/CurPeople/PeopleUp/PeopleDown/IncrPeople) = 0 on all 24 buses at 11:00, 8 online and driving. Counter not reporting. Archive records ฿0 as "apc" (counted).
- POST /api/collect/gps: unauthenticated, client-chosen fetchedAt → anyone can write fake riders into any study day.
- Two archive writers (tick + every wall-screen fetch) read-modify-write one KV key across colos.
- Three ledgers disagree: archive ฿0 · wall screen modelled · telemetry console still invents 18 riders/35 km.
- GitHub backup ran once in 4 h (not 5 min). TTL 14 d < "week/month".

## Fixes — ship before 2026-09-30 00:00 BKK
- [x] Parser: resolve GPSTime against UpdateTime; speed ÷10; carry odometer, online, raw passenger fields
- [x] Archive: odometer km (trace as fallback); counter honest ("no counter" ≠ 0 riders); coverage per day; raw rows kept
- [x] One writer: /api/live-buses stops writing; tick is the archive
- [x] Lock POST /api/collect/gps behind a secret
- [x] Week report: coverage, counters reporting, revenue null without a counter
- [x] Retention 45 days
- [x] Telemetry console: stop inventing riders
- [x] Tests on the real captured row; CDPT; verify live

## Verified live (9ac7554 + 8a80a9e, 11:40 BKK)
fresh 11 = online 11 (was 20 vs 8) · 0 fixes in the future · max 34.4 km/h (was 529) · odometer carried · riders null, countersReporting 0 · POST /api/collect/gps 403 · KV >1,008 writes/day still landing (not free-tier capped).

## Still open
- Passenger counter: ask PKSB whether APC is fitted/enabled on CMSV6. Until then the study measures supply (km, hours, coverage), not riders or fares.
- Trips per bus: not in the archive yet (tripsCompleted 0). Derivable after the week from raw samples (kept 45 d).
- server/app.test.ts flakes (a different 1–3 tests each run, HEAD too) — shared data/pksb.sqlite3 state.
- 2026-09-29 is a transition day (old + new rules). Present from 2026-09-30.

# Triple-surface audit — 2026-07-28

## Verdict
One Vite app, three front doors. The engine is honest. The product surfaces
were leaking; this pass closes the sharpest holes.

| Surface | Live | Intent | Status |
|---|---|---|---|
| Tourist phone | bus.nonarkara.org | Bus vs car/Grab decision | Ops links removed from phone chrome |
| Investor / ops | /ops /v2 /roi | Fund supply at the right hour | Investor framing + CO₂ honesty |
| Handbook | depa-usdot.nonarkara.org | How to build transit | Host logos · rehearsal · Ton |

## This pass
- [x] Replace NON with DEPA + Smart City Thailand host lockup
- [x] Rehearsal spine + Jakarta→Johor love story + Ton dedication on Overview
- [x] Opt ops out of passenger phone chrome (research link instead)
- [x] Ton spelling → Jaitong (per dedication)
- [x] Investor ops copy: hour / SOV / carbon-credit honesty
- [ ] Wire USDOT photo dump into Field Notes (next)
- [ ] Merge legacy TouristApp map+compare into PassengerApp (next)
- [ ] CDPT when asked

---

## 2026-10-16 · Orchestration pass — audits, merges, hygiene

- [x] Reviewed every open branch, worktree and PR from the other agents. Landed PR #4 (DAY·60s freezes at 24:00 → 0539ae2) and PR #12 (security headers, fixed hash → af0e15f). Closed #1 as superseded.
- [x] Security: tick needs `TICK_TOKEN`; research reads need the gate header (closes the pages.dev bypass); open proxy `/api/vehicles/last` deleted; collector worker has no public URL; tracker text sanitised, feed size capped; aircraft tooltips escaped; API security headers.
- [x] Deps: vitest 5, concurrently 10, tsx latest — `npm audit` 0.
- [x] Trees: 3 worktrees removed, 13 local + 23 remote branches deleted, 8 `archive/*` tags kept. Left: `main`, `depa-usdot.nonarkara.org`.
- [x] Verified live: tick 403 without token / 200 with; research 200 via bus.nonarkara.org, 403 via pages.dev; collector writing (fresh samples); all 12 routes load 200 headless.

### Needs Dr Non
- PKSB bearer token sits in public git history (cd95f46) — ask PKSB to rotate it.
- `.claude/settings.local.json` holds literal tokens in allow-rules — delete those lines.
- Visitor tracker (src/main.tsx) sends IP/city/UA to Google Apps Script without a notice (PDPA) — and the script now answers 401, so it records nothing. Keep (fix script + add notice) or remove?
- airplanes.live blocks us (403, "contact us"). The /ops aircraft overlay falls back to schedule beads. Email contact@airplanes.live if live aircraft matter.
- CSP is report-only. Enforce after a clean week.

---

## 2026-10-18 · Rider app on real buses · simulation on real departures

- [x] Phone `/`: live board (stop picker, location, next real buses with minutes at recorded pace), map of real buses; countdown/flights on the wall clock (were on the 30× sim clock)
- [x] /ops simulation runs the Airport line as it actually ran (latest same-weekday record); AS RAN ⇄ TIMETABLE switch; ±N re-runs compare against reality
- [x] Reload once on a post-deploy chunk 404 (a stale tab went blank)
- [x] Verified live: phone board + map at 375 px; /ops toggle changes collected 225 ⇄ 325 at 12:02 Sun with demand unchanged (1,937); 10 routes render with no errors; gates 403/200/403/403
- Finding for PKSB: 13–20 complete trips/day each way vs 20 published; median trip 120–137 min vs 95

### Still open
- Rider ETA ignores dwell and the turnaround leg (per-stop medians next)
- Simulated map buses still move at timetable speed under AS RAN
- Items from 2026-10-16 (token rotation, settings literals, tracker/PDPA, airplanes.live, CSP) unchanged

---

## 2026-10-29 · Finish MiniMax's work, audit, MSH, ship

- [x] MiniMax's uncommitted departures change did not compile and its parser dropped `departures`; finished (research + endpoint cache v3 + liveService + tests) — 4c3e4b3
- [x] "95 min" was the taxi-comparison figure written down as the timetable's in six modules. Official timetable: 130 min down / 147 up. `/research`'s headline "only 3% make the timetable" is **92%**. Duty cycle 297 min, not 210. One module (`publishedRunning.ts`) now — 6c198ea, fd9adf6, lesson 14, vault lesson captured
- [x] Rider phone (production, 390×844): page was 4.85 screens and the map started at 2,160 px. Order is now board → map → decision → tickets. Decision card no longer invents "35 min", the airport timetable no longer shows at Rawai, the made-up +฿38,000/+64,000 / CO₂ panel is a link to the real console. Standing at a terminal reads "Waiting · At Rawai" — 55304b2, f691982
- [x] CSP sweep gate (`scripts/design/cspsweep.mjs`) + proof, in CI — a92cdc5
- [x] Full suite 334/334 before each deploy

### Decided not to do (owner's call)
- `origin/overhaul/usdot` NOT merged: it swaps the product-wide display face to Public Sans, rewrites STYLE.md and the type-audit instrument to accept it, and replaces the toolkit palette with Tailwind defaults (#0f172a, #ef4444, #0284c7, #10b981, #f8fafc, #e2e8f0) against STYLE.md's paper/ink/red. Branch left in place (deleting a remote branch was refused by the permission classifier).

### Still open
- /ops left column: dense small text (rule 7) — structural
- Rider ETA still ignores dwell at intermediate stops (per-stop medians from `Trip.stopMin`)
- Dr Non: PKSB token rotation, `.claude/settings.local.json` literals, CSP enforcement (see below)
