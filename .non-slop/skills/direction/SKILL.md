---
name: non-slop-direction
description: >-
  Use before designing or building any page, site, dashboard, deck or visual. Writes the
  five-line brief, derives a visual direction from the subject, sets tokens, and picks a
  domain preset (civic dashboards default to operational, map-first). Layer 1 of Non-Slop.
---
# Direction: decide before CSS

Slop is what fills every decision you didn't make. This layer makes the decisions first, in writing, so the code has something to follow.

## Step 1. Read what already exists

`STYLE.md`, the design system or tokens, sibling pages, the brand. **If a direction exists, it is the direction**: extend it, don't replace it. Only a repo with nothing gets a new one.

## Step 2. The brief (five lines, real answers)

| Line | Ask | Weak answer | Real answer |
|---|---|---|---|
| Who | Who is using it, where, on what device, in which language? | "users" | "Krabi district officers on a phone in the rain, Thai first" |
| One job | The single thing the page must let them do | "explore data" | "see which gauges are over the bank right now and since when" |
| Hierarchy | What wins first, second, third | "everything important" | "1 map of gauges, 2 the time of the last reading, 3 the warning text" |
| Constraints | Languages, data shape, bandwidth, offline, access needs | — | "EN/TH/ZH; 2 gauges in some provinces; 3G; screen readers" |
| Direction | A metaphor from the subject's own world, not a style label | "clean modern" | "a river gauge board: painted staff gauge, water-level blue, bank-full red line" |

## Step 3. Ground the direction in the subject

Take the visual decisions from what the product is made of: its materials, documents, instruments, signage, maps and vernacular. Write them down as:

- **Colour:** 4–6 named values, each with a job (ground, ink, accent, data domains). One accent is the default when nothing else is decided.
- **Type:** the faces and their roles. If the repo has no type choice yet, the house starting point is a Bauhaus/Bayer-style geometric face: **Jost**, with Josefin Sans or League Spartan for display and **Prompt or Kanit** (non-looped) for Thai; a matching geometric sans for Chinese. Usually two families; a third is fine with a stated job (mono for data, a reading serif).
- **Layout:** one sentence and a rough wireframe. Say what the empty space is for.
- **One signature:** the single memorable, product-relevant decision. Spend boldness there; keep the rest quiet.

Then **review the plan against the defaults.** For each decision ask: would I have made this for any similar page? If yes, it's a default; change it and say why. Watch for the second-order defaults too: cream + terracotta, near-black + acid green, broadsheet hairlines, tracked all-caps eyebrows, "01 / 02 / 03" on things that aren't a sequence. Any of them is fine *if the subject or STYLE.md asks for it*.

## Step 4. Tokens before components

Semantic colours (`--ink`, `--ground`, `--accent`, `--danger`, data domains), spacing scale (4/8-based), type scale (≤8 sizes, a stated ratio), one radius system (one radius, or none), shadow policy (≤3 per screen, only for things that float), states for every control (hover, focus-visible, active, disabled, loading, empty, error), breakpoints (start narrow: 320, 390, 1024, 1440), motion (≤250 ms, transform/opacity, `prefers-reduced-motion`). Contrast is checked on every real background (WCAG AA: 4.5:1 text, 3:1 large text and UI). If the colour work uses Palette, keep its roles and unequal proportions and check colour-vision deficiency in its preview.

## Step 5. Pick a preset

Presets set defaults for the brief. STYLE.md and the brief override them.

**Operational decision-making (default for any dashboard or map).** Someone has to act now. Map-first surgical table: the map ≥60% of the first screen, bars ≤56px, panels docked and sized to content, nothing covers the map on load. Every number has its time and source next to it. Observed and projected states look different (solid vs hatched, "now" vs "by 14:00, medium confidence"). Few-sensor areas say so on the card instead of looking calm. Stale data shows its age, not a spinner. Dense is fine; decoration isn't.

**Public transparency.** A citizen wants to check something and trust it. Plain-language headline answer first, then the evidence: the table, the map, the download, the method and the date. Sources and caveats are on the page, not in a modal. All three languages are equal. Big type, high contrast, works on an old phone. No persuasion copy.

**Executive situational awareness.** A leader has 30 seconds. One sentence of status ("22 gauges over the bank; worst: Satun, Trang"), then 3–5 numbers with trend and comparison, then the map or list to drill into. No vanity metrics, no traffic-light soup, no equal-weight KPI grid: one thing wins. Prints to one A4 page.

**Editorial / essay.** One reading column of 45–75ch with deliberate margins (that space is not void). Type carries the voice; ornament, semicolons and em dashes are the author's. Images are real. Copy edits follow `skills/writing/`: help the reader do something or understand the subject, and leave a sentence that is the writer's.

**Tool / app.** The task is the hero: the input or the result is on the first screen. Familiar controls stay familiar. Empty, loading and error states are designed, with a next step.

**Landing page (only when one is really needed).** Open with the most characteristic artefact of the product (the real screenshot, the table, the map), not a slogan. One primary action. No logo clouds, fake stats or three-card feature grids.

## Practices folded in from Ruttl's eleven

Paraphrased from Harsh Vijay, *11 Website Design Best Practices To Follow In 2026* (ruttl.com, read 19 Oct 2026); see CREDITS.md. Kept as decisions, not marketing:

1. Start narrow: design the phone first and keep essential tasks reachable at 320px.
2. Consistency: same action, same label and behaviour on every page (tokens make this cheap).
3. Access is part of the design (see Step 4 and the review gate).
4. Rank attention on purpose: size, contrast, space, position, weight.
5. Learned conventions stay: logo links home, nav where people look, links look like links. Invent in the content, not the controls.
6. Identity holds across pages: the same faces, colours, imagery and voice.
7. Test the whole task with a first-time person, not just the screen.
8. Words are useful: short, active, specific to the reader's goal.
9. The next action is concrete: verb + object, with the result stated.
10. Set a budget for bytes, fonts and motion before adding them; measure on a real device and network.
11. Change one thing at a time and watch what people do; don't invent an A/B winner from a handful of sessions.

Not adopted: the article's conversion-first framing, its "powerful action verbs" advice and its statistics. A reading or operating surface doesn't need a sales CTA.
