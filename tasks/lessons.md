# Lessons Log

---

## 2026-09-29 · Read the raw feed before trusting a report about it
- **What went wrong:** A collector shipped with a "fresh fix" count, "0 boardings is the counter, not a guess", and km from GPS traces. The raw tracker showed GPSTime is Bangkok wall time stamped `Z` (every fix 7 h in the future → every bus "fresh"), Speed is tenths of km/h, the passenger counter reads 0 on every field for all 24 buses while 8 drive, and an odometer (`LiCheng`) sat unused. Tests passed because fixtures were written from assumed rows, not captured ones.
- **Correct behaviour:** Capture one real row and build the fixture from it. Cross-check units against a second physical signal (odometer vs trace, speed vs distance/time). Treat a sensor that never leaves zero as absent, not as a zero reading.
- **How to recognise:** "fresh" > "online"; a speed over 200 km/h on a city bus; every counter identical across a fleet; a zoned timestamp nearer to local wall time than to UTC.

## 2026-06-26 · Conservation law before code (V1 vs V2 post-mortem)

- **What went wrong:** V1 (many agents, months) produced incoherent, mostly-fake numbers. Two vehicle engines, three fake data paths, two flight sources — none agreed. Numbers looked plausible; none balanced.
- **Correct behaviour:** V2 (one model, 20 min) started from `demand = boarded + abandoned + waiting`. That invariant forced honesty. All surfaces read the same memoized arrays. Fakes became unnecessary and were deleted.
- **How to recognise:** If the codebase has `buildFallback*`, `*Mock*`, or multiple sources for the same quantity (two vehicle engines, two flight lists), the conservation law was never written. Find it and write it first. Everything else follows.

---

## 2026-06-26 · React-Leaflet markers don't move imperatively

- **What went wrong:** `<Marker position={...}>` props don't update on re-render.
- **Correct behaviour:** Use imperative `L.marker().setLatLng()` via a `VehicleLayer` component with `useMap()`. See `LiveMap.tsx`.
- **How to recognise:** Buses frozen on map despite state updating.

---

## 2026-06-26 · f.origin vs f.city (OpsFlight type)

- **What went wrong:** CityIntel rewrite used `f.origin` — TypeScript caught it (3 errors).
- **Correct behaviour:** `OpsFlight` field is `city: string`. `origin` is optional raw source field. Always grep the type definition before accessing fields on imported types.
- **How to recognise:** `Property 'X' does not exist on type 'Y'` — check the type file, not your assumption.

---

## 2026-06-26 · vite preview base path vs production

- **What went wrong:** `GITHUB_PAGES=true` build sets base `/phuket-smart-bus/`. Preview of that build has `/phuket-smart-bus/ops` paths; `getInitialView()` checks `p.startsWith("/ops")` and misses. Looks like the tourist app.
- **Correct behaviour:** Rebuild without `GITHUB_PAGES=true` for local preview, or restart the preview server after a clean build. Production at `bus.nonarkara.org` uses `/ops` paths directly.
- **How to recognise:** `/ops` URL shows tourist app in preview but works in production.

## 2026-07-02 · Root html zoom silently dead — scale was never tested >1920px
- **What went wrong:** /ops used `html.ops-mode { zoom: clamp(1, 100vw/1920, 3) }` for wall-screen scaling. Standardized CSS zoom (Chrome 128+) ignores zoom on the root element, so the rule did nothing and the dashboard rendered microscopic on big displays — through THREE "fix" deploys.
- **Correct behaviour:** compute scale in JS (`innerWidth / designWidth`, clamped) and set inline `zoom` on a normal element (`.v2`). Keep every size inside fixed px — standardized zoom does not scale vw units, so px+vw mixes double-scale.
- **How to recognise:** any viewport-conditional CSS (zoom, clamp, media queries) verified only at a width where the condition is inert is UNVERIFIED. Test the branch that fires: preview_resize to 2560/3440 before shipping wall-screen code. "Looks fine at my width" is the trap.
