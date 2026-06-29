# Lessons Log

---

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
