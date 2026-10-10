# Contributing

Thanks for reading the code before changing it. The useful patch is one that a later reader can trace: a number on screen comes from a function, and that function says whether the number was observed or modelled.

## Setup

CI uses Node 20 (`.github/workflows/ci.yml`).

```bash
git clone https://github.com/Nonarkara/phuket-smart-bus.git
cd phuket-smart-bus
npm ci
npm run dev
```

`npm run dev` starts Vite, the Express API watcher, and the worker together. The web app listens on port 4173 (`vite.config.ts`). The API listens on `PORT`, default 3001 (`server/index.ts`).

On localhost, `http://localhost:4173/` is the studio hub. The operations wall is `http://localhost:4173/ops`. On `bus.nonarkara.org`, `/` is the rider front door (a phone gets the passenger app; a wide window gets the desktop shell) and `/toolkit` is the hub. See the route table in the README.

Demo mode needs no `.env`. Copy `.env.example` to `.env` only when you are setting a name the code already reads. Never commit values.

## Branches and pull requests

1. Branch from `main`.
2. Keep the change to one concern.
3. Open a pull request. The template asks you to say what is observed and what is modelled.
4. CI on pull requests runs `npm run typecheck` and `npm test`. Both have to pass.

Do not commit `.env`, sqlite files, or `dist/`. `.env.example` is the exception: names only.

## Tests

```bash
npm test            # Vitest. This is what CI runs.
npm run typecheck   # app, server, and test tsconfigs
npm run verify      # typecheck, unit tests, production build, Playwright
```

Playwright (`npm run test:e2e`) is not part of the pull-request workflow. It needs browser binaries and a local web server. Unit tests cover the demand model, conservation, the live-feed parser, ROI constants, and the Cloudflare CPU and rate-limit guards (`src/engine/cloudflareLimits.test.ts`).

If you change `demandSupplyEngine.ts` or `getLiveTotals`, keep the conservation checks in the existing tests passing: for each direction, demand is boarded plus lost (inbound also counts who is still waiting). Do not add a third money model that is the sum of a different formula.

## Style

There is no ESLint config in the repo. Match the file you are editing.

- TypeScript. Three projects: `tsconfig.app.json`, `tsconfig.server.json`, `tsconfig.test.json`.
- Route geometry imports are `.json`. Vite does not treat `.geojson` as an import.
- Maps that move a marker use imperative Leaflet `setLatLng()`. React-Leaflet `<Marker position>` does not reliably follow prop changes.
- On a real plate (`/fleet`, `/fleet/raw`, `/research`, `/study`, and a live bus row), show what the tracker sent. If a figure is filled from the demand model, the code path has to record a basis (`apc-count`, `scheduled-run`, `hour-average`, `line-occupancy`, `no-model` in `liveOps.ts`). Do not invent a driver name. The feed does not carry one.
- The operations wall type floor is in the design notes: labels and figures stay readable on a 50-inch screen. Do not add 9–11px captions there.
- Comments explain a constraint the next reader will trip on (a lying GPS clock, a rate-limit binding Pages will reject). They do not restate the line.

## Good first reads

| Question | File |
|---|---|
| Why is this number on the wall? | `src/engine/demandSupplyEngine.ts`, then `src/engine/simulation.ts` |
| Where does a live position come from? | `shared/pksbFeed.ts`, `functions/api/live-buses.ts` |
| What may I put next to a real plate? | `src/engine/liveOps.ts` |
| What stops a research scrape? | `shared/researchLimit.ts`, `wrangler.research.toml` |

Design intent for the operations screens is in `DESIGN.md`. Project history and constraints are in `AGENTS.md`.
