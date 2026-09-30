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
