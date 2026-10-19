# Ops Dashboard — UX/UI Audit

*2026-08-18 · bus.nonarkara.org/ops · audited against Axiom Design Core V4 (Console register) + Visual-DNA.md*

## 0. First: the site was down

Before this audit could begin, `bus.nonarkara.org` was serving a blank white page — every route, every visitor. The last manual Cloudflare deploy (a68aa6f, ~1 week ago) had shipped an artifact built with `GITHUB_PAGES=true` leaking into the shell, so `index.html` pointed at `/phuket-smart-bus/assets/…` while the files lived at `/assets/…`. The SPA fallback returned HTML for the CSS/JS request; strict MIME checking refused it; nothing rendered.

Fixed by rebuilding from `main` with a clean env and redeploying. Verified live: assets resolve as `text/css` / `application/javascript`, 22 buses render. **This is a process bug, not a code bug** — the CF auto-deploy workflow has failed on every push for weeks (bad `CLOUDFLARE_API_TOKEN`), so every deploy is manual and unguarded. Fix the token or the next hand-deploy will do this again.

## 1. The bus-movement finding — the math is right, the frame is wrong

Dr Non's mental model ("you know where every bus is at every second, like a 24/7 movie") is **already exactly the architecture**:

- `fleetSimulator.ts` computes each vehicle as a pure function of a fractional simulated minute — no state, no ticking, no interpolation. `getVehiclesNow(t)` → time-offset along the timetable → meters along the road → `posOnPolyline` binary-searches 3,944 real road points → exact lat/lng + heading.
- `DashboardV2.tsx` runs a `requestAnimationFrame` loop that reads the clock once per frame and calls `mapRef.syncNow(vehicles)` — the map is repainted at the true position ~60×/sec.
- Buses and money read the same cached minute so they can never desync.

The engine is a movie. So why doesn't it *look* like one? Because of arithmetic the eye can't argue with:

| | |
|---|---|
| Airport line | ~48 km, ~95 min → **~30 km/h** |
| Map zoom 10 at 7.9°N | **151 m per pixel**; the 1230px map spans **186 km** |
| At the default 10× sim speed | a bus crosses **0.009 px per frame** — half a pixel per second |
| Even at 30× | 0.03 px/frame · 1.7 px/second |

A moving bus doesn't move visibly because it *can't* — the whole 48 km trip is ~317 screen pixels, and the map is zoomed out to include Phi Phi and Krabi ferry lanes 60 km offshore. Then a `transition: transform 1s linear` on the marker icon smears each of those sub-pixel steps across a full second, so the little motion that exists reads as float, not travel. Everything about the pipeline is honest; the viewport gives it nowhere to show.

**Verdict on "movement is not convincing":** correct instinct, wrong suspect. Fix the frame, not the engine.

## 2. What the Console register asks for that the page currently doesn't give

Measured against design.md §I–VIII/§XV and Visual-DNA's eleven rules:

**Maps are the surface, not a component** (§VII, Visual-DNA rule 3). The map is a 1230×356 letterbox in the middle of a three-band layout — a 3.5:1 strip. The Console register says full-bleed; the Folly law says the one grid-breaking element per page should be *derived from content* — "a map refuses to fit its cell." Here it fits its cell obediently and pays for it with 151 m/px.

**One amber, always, only** (rule 1, invariant). Amber is currently on: bus markers, the timeline scrubber, the SHORTFALL chip, the ฿ money figure, the "6 LIVE AIRCRAFT" badge, live-plane icons, HKT marker, the FULL chip. Seven jobs for the one accent. When everything is amber, nothing is. The register says: primary CTA, active state, *the* most-critical metric, threshold breach — pick.

**Max three text sizes** (invariant 4). Counting the ops page: header title, hero numbers (216/21/1,076), operating-equation numbers (414/75/14), body, mono labels at ~10px, mono labels at ~11px, chip text — six or seven. Hierarchy is being done with size where the register does it with weight and family.

**Data density is not a failure of minimalism** (rule 2) — but density needs one grid. The left column, the three hero cards, the map, the fleet table, and the six-metric footer bar each declare their own inner rhythm. Planar Alignment (invariant 7): tracing the right edge of "WHAT ARRIVES" against the left edge of the map, and the map's bottom edge against the "FLEET OPERATIONS" header — they don't meet. Edges float.

**Honest state** (invariant 10, §XXXII). There is a green "OPS" pill and a "6 LIVE AIRCRAFT · 18 TIMETABLE · MODEL ONLY" badge — the second is honest, the first is a green light on a simulation. The register asks for one top-right chip: `LIVE` / `STALE·12m` / `SIM ×10`. Right now the reader must infer from three places that they're watching a model.

**Motion is feedback, not ambience** (§XXVIII, §XVI Calm). `transition: transform 1s linear` on every marker is autonomous motion — the exact "pulse markers should hold still" case the doc names. Sub-pixel eased smear is worse than crisp per-frame paint. Two easing tokens exist; `linear` isn't one of them.

**Every marker says "25"** — twenty amber circles all reading 25/25. That is real (the queue is over capacity so every bus leaves full), but as a signal it's dead: uniform values carry no information. Load should be *shape* (fill level), not a number, so a half-empty bus is visible from across the room.

## 3. What Dr Non asked for, mapped to what exists

> "hover over and see how many people are on each bus … the plan of the bus"

Tooltip today: `กข 1003 · 25/25 pax · rawai-airport`. That's a plate and a fraction. There is no per-bus *plan* — where it boards, where it will be full, when it reaches the airport, what it will earn. All of that is computable from the same pure function (`getVehiclesNow` at future t). It just isn't surfaced.

> "only 20 seats anyway, show how many are on each bus … visually accessible"

Capacity is 25 in the engine (`bus capacity 25` per CLAUDE.md, timetable-derived). If PKSB's real seat count is 20, that's a one-line knob — but it changes every ฿ figure on the page, so it needs Dr Non's confirmation, not a guess. Either way, the number should become a *fill*.

## 4. The recomposition — proposed, not built

One register (Console), one grid, one amber, three sizes, map as surface. Concretely:

**A. The map takes the page.** Full-bleed dark tile (CartoDB dark_matter or similar), Airport Line as the hero geometry: default view framed on the 48-km road corridor (roughly 7.78°–8.11°N, 98.28°–98.42°E) at zoom 12 → **~38 m/px**, four times today's resolution. At 30× a bus moves ~6.6 px/s — *visible* travel. Ferry lanes stay drawn but off the default frame; a layer chip pans to them. Panels sit *on* the map (inset, hairline, `#161d27` at 96%) not beside it.

**B. Bus markers become instruments, not dots.** A rounded-rectangle "vehicle" (the only permitted non-circle radius carrying meaning: it *is* a bus) whose fill height = load. Empty is hairline outline; full is solid. Amber only when the bus is the one currently at the curb boarding (the "most-critical" job); everything else is `#e6edf3` on dark. Direction is a wedge at the front. Dwelling = outline pulses off, holds still. Moving = drawn per frame, `transition: none`, exactly the engine's truth.

**C. Hover / tap → the bus's plan.** A single inset panel (not a Leaflet tooltip): plate · route · load bar (n/25) · next stop and ETA · terminal ETA · pax boarded so far this trip · ฿ earned this trip · a 60-min sparkline of load along the road ahead computed from the engine at future t. This is the "reality TV" moment: you're watching one bus fill up. Click pins it; the panel becomes a live follow.

**D. One clock, one state.** Top-right: `SIM ×10 · TUE 12:11` as one chip in the register's five-state grammar. Kill the green OPS pill. Speed chips move into the same chip's dropdown.

**E. Three text sizes, one grid.** Display 32 (page title + the three hero numbers), Body 14, Label 11 mono. All panel insets share the same 12-column grid the map lives on so every panel edge lands on a column line. Footer bar's six metrics inherit the same column rhythm as the three hero cards above — same width, aligned edges.

**F. Amber gets one job.** The bus at the curb, boarding now. Everything else earns attention through weight, contrast, position.

## 5. What to leave alone

- The engine. `fleetSimulator.ts`, `demandSupplyEngine.ts`, `getVehiclesNow`, the rAF loop, the conservation laws — all correct, all tested (154 tests). Nothing above requires touching them; every new surface reads from what already exists.
- The bidirectional queue math and the hourly Missed-Money diagram (already the operator's read; keeps its place, moves onto the shared grid).
- The `SIM_SPEED = 10` default. CLAUDE.md still says 30; the code says 10. 10 is right for a wall display — sedate — once the zoom lets it show. Update the doc, not the constant.

## 6. Open questions for Dr Non (intent, not mechanics)

1. **Seat capacity — 20 or 25?** The engine says 25 everywhere. Your message said 20. This changes every ฿ number; I won't change it on a guess.
2. **Default frame — corridor or island?** Recommendation is the Airport Line corridor (§4A). The tradeoff: ferry lanes leave the default view. If the boat network *must* be in the first frame, the resolution stays low and the movement stays subtle — those two wants are geometrically opposed.
3. **Build order** — the map reframe + marker-as-fill (A + B) is the highest-leverage change and can ship in one pass. C (the plan panel) is the "reality TV" layer and is the second pass. D/E/F are the register cleanup and can ride with either.

Nothing in §4 has been implemented. This is the spec.
