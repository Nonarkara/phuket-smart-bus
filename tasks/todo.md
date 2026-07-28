# Voice + graphics pass on the toolkit research hub — 2026-07-28

## Outcome
The site had grown to 6,248 lines across 18 components (ToolkitHub's 5-tab
restructure, built by other agents over the prior 5 days). User's ask: cut
the showing-off academic jargon and longwinded prose, make it sound more
like Dr Non — direct, witty, clear — while staying professional. Also fix
graphics/artifacts. Then check other agents' work, then CDPT.

## What was found and fixed

### Voice
- `PhuketContext.tsx` (782 lines, worst offender): "orographic-lift" (3x
  narrative occurrences — kept the 1 legitimate citation-metadata use),
  "comparative Austronesian linguistics", a citation-reconciliation
  paragraph that read like a bibliography defending itself, a "The
  compound:" fragment, an over-hedged "not X but Y" sentence. Rewrote all
  of it plainly without losing any fact.
- `ComparativeResearch.tsx` + `LegalFramework.tsx`: both opened with an
  invented "professors at USL Transport Institute" strawman — a
  specific-sounding fictional source is worse than no source. Cut it,
  reframed as a plain skeptic's-claim structure (which the content already
  answers well).
- `LandingPage.tsx`: tightened one 7-item comma-run sentence.
- `VegasDemandCase.tsx`, `CollaborationHistory.tsx`, `PhuketBusSystems.tsx`,
  `AddBusCalculator.tsx`, `DataProvenance.tsx`, `LiveSystemTicker.tsx`,
  `PhuketSystemMap.tsx`, `ReferencesTab.tsx`: read them all — already close
  to house voice (some genuinely good lines: "Dotted lines are boats,
  because a ferry should not drive across the Andaman Sea."). Left alone.

### Graphics/artifacts
- Real bug: `LiveSystemTicker` (persistent bottom-right live badge) was a
  fixed ~320×70px card that permanently covered whatever page content
  scrolled under that corner — including the hero's 4th stat card on first
  load (unreadable) and body text lower down (confirmed via screenshot).
  Reworked to a compact ~120×34px pill (clock + missed-money only),
  expanding to full detail on hover/focus/tap via CSS-only popover. Also
  hidden until scroll > 480px so it never blocks the first thing anyone
  sees.
- Dead code: `isMonsoon` variable computed and discarded in `MonsoonChart`
  (found while editing the same function for prose) — removed.

### Dead code (found during the language check, in scope because polishing
invisible code wastes effort and duplicate half-abandoned files are
exactly the kind of mess this task exists to clean up)
- `ToolkitShowcase.tsx` (838 lines) — confirmed via grep, zero references
  anywhere in the app. `ToolkitHub.tsx` replaced it days ago; its content
  (method/causality/proof/deal research panels) was already absorbed into
  the new chapter components. The orphaned file just sat there. Deleted.

### Other agents' work — checked
- `fix/audit-v2-improvements`: fully merged into main already (prior
  session). No new work.
- `feat/depa-polish` was 16 commits ahead of the tracked
  `depa-usdot.nonarkara.org` branch — the live site had been deployed
  straight from this worktree via ad-hoc wrangler calls without ever
  updating the branch ref. Fast-forwarded `depa-usdot.nonarkara.org` to
  match (a strict fast-forward, verified before doing it) so the branch
  name means what it says again.
- `feat/landing-page`, `feat/passenger-app`, `feat/phuket-context-intro`,
  `feat/vegas-demand-case`: all fully merged into `feat/depa-polish`
  already (0 unique commits each) — the consolidation already happened,
  nothing pending there.
- Stray leftover on `main` (untracked, not this branch): a file literally
  named `src/components/toolkit/toolkit` containing what should have been
  `toolkit-hub.css` — a botched redirect from an earlier agent. Flagged,
  not touched (different branch, out of scope this round).

## Verification
Typecheck clean. 152/152 tests. Build clean (1.49 MB JS, 341 KB CSS).
Live-bundle byte-hash matches local build exactly. Confirmed on the live
site: ticker pill is compact and hidden until scroll, "USL Transport" and
narrative "orographic" strings both gone, dead ToolkitShowcase strings
gone.

## Shipped
- Commit `e57dfa1` on `feat/depa-polish`, fast-forwarded onto
  `depa-usdot.nonarkara.org`, both pushed to origin.
- Deployed via `wrangler pages deploy --branch=depa-usdot.nonarkara.org`.
- Live: https://depa-usdot.nonarkara.org/ — bundle `index-DXxar6Jh.js`,
  byte-identical to the local build.
