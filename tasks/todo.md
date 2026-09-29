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
- [ ] Parser: resolve GPSTime against UpdateTime; speed ÷10; carry odometer, online, raw passenger fields
- [ ] Archive: odometer km (trace as fallback); counter honest ("no counter" ≠ 0 riders); coverage per day; raw rows kept
- [ ] One writer: /api/live-buses stops writing; tick is the archive
- [ ] Lock POST /api/collect/gps behind a secret
- [ ] Week report: coverage, counters reporting, revenue null without a counter
- [ ] Retention 45 days
- [ ] Telemetry console: stop inventing riders
- [ ] Tests on the real captured row; CDPT; verify live

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
