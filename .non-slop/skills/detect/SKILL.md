---
name: non-slop-detect
description: >-
  Use after building or when auditing any UI for AI design slop. Runs the static scan and
  the rendered check, judges the visual tells a scanner can't see, and fixes hits in order,
  keeping everything STYLE.md lists. Layer 2 of Non-Slop.
---
# Detect: find the defaults, keep the choices

A finding means "a default nobody chose", never "an AI made this". Read `STYLE.md` before you start; a hit on a listed choice is **ALLOWED** and is not fixed.

## 1. Scan the source

```bash
node .non-slop/bin/non-slop.mjs scan .            # or: npx github:Nonarkara/Non-Slop scan .
node .non-slop/bin/non-slop.mjs scan https://example.org   # a live page's HTML + CSS
```

Every rule, its fix and when to keep it: [CATALOG.md](CATALOG.md) (generated from the code). Verdict: **SLOP** at ≥8 points, or a P0 stacked with another P0/P1, or P0/P1 hits in ≥3 categories; **REVIEW** at 3–7. Points count each rule once, so ten shadows are one finding, not ten. A `generic-promise` hit is a different **REVIEW**: it quotes one empty sentence, adds no points, and does not rewrite the file. A phrase under Allow, or a phrase or marker under Protected voice, is not flagged.

Keeping a choice: list it in `STYLE.md` under `## Allow` (`- rule glass: live video needs a legibility veil`), in a `## Signature` section of `AGENTS.md` (same list; an empty `STYLE.md` does not hide it), or inline with `non-slop-allow: glass -- reason` on the line or the line above. A `STYLE.md` in a subfolder counts for the files under it, and allows from folders above still count. `Style.md` is the same file as `STYLE.md`. Access rules (contrast, focus, alt, unnamed controls, lang, zoom, reduced motion) can't be allowed away; they show as **ASK-OWNER**.

## 2. Render it

```bash
npm i -D playwright && npx playwright install chromium   # once
node .non-slop/bin/non-slop.mjs render http://localhost:3000
```

Screens at 1440, 1024, 390 and a 320px reflow check; contrast on every visible text element; phone tap targets; Tab through 14 controls to see focus; map share and bar heights; a **silhouette** thumbnail. Weights come from measuring 31 flood apps in Oct 2026 (in-sample precision 0.95, recall 0.91 at REVIEW). It sent 2 of 5 professional map apps to REVIEW, so a REVIEW is a reason to look, not a fail.

## 3. Look (what no scanner sees)

Open the screenshots. Squint. Then check these by eye:

| Tell | What it looks like | Fix |
|---|---|---|
| Nothing wins | Every block the same weight; squinting shows no focal point | Pick the one thing; make it 1.5–2× the next level |
| Silhouette of any SaaS page | Centred block, three equal boxes, logo strip, three tiers, four-column footer | Rebuild the hierarchy around the product's own artefact (map, table, document) |
| Accidental void | Phone-width column on a desktop; a blank half while loading; one tall column stretching its row | Give the space to the content; show the real skeleton or last good data with its time |
| Stretched small things | A tile with "8" at 240px wide; a lone last card spanning the row; full-width desktop buttons | Content-width; ruled strip for stats; full-width only in a phone column |
| Uniform rhythm | Same padding everywhere; same gap for nav, cards and sections | A spacing scale with real steps: tight inside, loose between |
| Cards in cards; chip soup | Boxes nesting boxes; a status chip on every row | Text sits on the page; a chip only for a state someone filters by |
| Timid palette | Five colours used in equal amounts, none meaning anything | One dominant ground, one ink, one accent with a job |
| Stock sequence | 01 / 02 / 03 on things that aren't steps; hero → logos → features → stats → pricing → CTA | Numbers only for real sequences; order sections by the reader's questions |
| Scattered motion | Every card fades up; hover lifts on everything | One orchestrated moment, or motion that answers an action |
| Stock imagery | Diverse-team-at-laptop, glossy 3D blobs, Memphis people, AI art | Real photos, data or drawings; nothing is better than generic |
| Drift | Font, radius, nav or footer changes between pages | Build every page from the same tokens |
| Placeholder truth | "Loading…" forever, N/A, mock or simulated data on a public page | Real data with its date, or say plainly that it's missing |

Never flag: em dashes, semicolons, a serif, warm paper, a single emoji in prose, humour, ornament the owner chose, a deliberate reading column with wide margins, an accessible table or a familiar back link, a phrase or marker listed under Protected voice, text inside a blockquote or q, or an ordinary word that happens to appear in an empty-promise phrase.

## 4. Fix in order

1. P0 failures, then access failures that are still FAIL. **ASK-OWNER** means the owner already listed it: ask, don't edit. 2. The hierarchy (what wins). 3. Stretch and void. 4. Boxes, shadows, radii, pills (subtract). 5. Copy. For a `generic-promise` hit, quote the sentence, say why it is empty, and propose the smallest edit. Do not paste a rewrite from the scan. 6. P2 polish. After each pass, re-scan and re-render. For every removal ask: **does this make the page more generic?** If yes, put it back.

## 5. Report

```
Scan: <verdict> (points, P0/P1/P2)   Render: <verdict> (points)
Fixed: <id> <file:line> — what changed
Kept on purpose: <id or element> — STYLE.md line / reason
Open: <id> — why it stays, or the question for the owner
Screens: <paths>   Silhouette: <path> — one sentence on what it shows
```
