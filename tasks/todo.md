# RS&DE audit: collapsible research panels for the toolkit showcase — 2026-07-23

## Outcome
Every substantive section of the depa-usdot.nonarkara.org showcase gets a
collapsible "Research & Data" disclosure: real numbers (some pulled straight
from the /ops Toolkit tab's SSOT data, some freshly researched), a small
infographic where it earns its place, and 2-4 verified academic/industry
citations with real URLs. Bold design stays; adds an academic backbone
underneath. Voice: direct, witty, clear — not dry academese.

## Conservation law
Every claim on a collapsible panel traces to either (a) an array already
exported from ToolkitPanel.tsx (SSOT, no duplication) or (b) a citation with
a real, verified URL from this session's research agents. Nothing invented.

## Plan
- [x] 1. Read ToolkitPanel.tsx fully — catalogue reusable SSOT data (TENETS,
      HYPOTHESES, CITY_CONTRAST, OBJECTIVES, PERSONAS, THEMES, RECS, LEDGER,
      DATA_WANTED, GAPS, CausalMap stories)
- [x] 2. Launch 4 parallel research agents: mode-choice theory, causal
      inference + transit natural experiments, design-thinking/co-design
      methodology, outcome-based transit financing
- [x] 3. Export the data arrays from ToolkitPanel.tsx (SSOT, named exports)
- [x] 4. Build `<ResearchPanel>` — native `<details>/<summary>` disclosure,
      Axiom/tk-red house style, mono numerics, zero new deps
- [x] 5. Wire 7 panels: AbcdefFramework (mode-choice + city contrast),
      tk-method (methodology), DesignThinkingStudy (personas + impact-effort
      bars), tk-causality (3 causal stories), tk-proof (finding→model→code
      ledger), FeasibilityStudy (data wanted + honest gaps), tk-deal
      (DSCR/outcomes financing)
- [x] 6. Typecheck clean, 139/139 tests, build clean; verified in browser —
      all 7 panels render with correct counts, native toggle works, dark-
      section color overrides correct, is-user persona highlight correct
- [x] 7. Check other agents' code (worktrees/branches) — fix/audit-v2-
      improvements and heuristic-goldberg fully merged into main already
      (prior session); codex/wild-y6tj is a stale March-2026 experiment,
      flagged not merged, four commits behind the current architecture
- [ ] 8. CDPT: commit, push depa-usdot.nonarkara.org, deploy, verify live

## Review
- Shipped: 7 collapsible "Research & data" panels across the toolkit
  showcase, each with real stats (mostly pulled straight from the /ops
  Toolkit tab's SSOT arrays — PERSONAS, THEMES, RECS, LEDGER, DATA_WANTED,
  GAPS, CITY_CONTRAST, CAUSAL_STORIES — now exported once, imported
  everywhere) plus 2-5 freshly-researched, URL-verified academic/industry
  citations per panel (McFadden/Ben-Akiva discrete choice, TCRP 166 &amp; 36,
  Design Council Double Diamond, Lewin action research, Cochran sampling,
  Pearl/Rubin causal inference, a real Kansas City zero-fare natural
  experiment, World Bank/ADB results-based financing, FTA farebox recovery
  data, LSTA green loan principles, World Bank PPP DSCR norms).
- Explicitly flagged rather than overclaimed: ABCDEF is our own synthesis,
  not a validated model; the "Hip" letter rests on thin literature; no
  transit-specific social impact bond exists yet (Peterborough is the
  general model only); Houston's 2015 redesign has real numbers but no
  peer-reviewed causal study behind it, so it was left out entirely.
- Live: (fill after deploy)
