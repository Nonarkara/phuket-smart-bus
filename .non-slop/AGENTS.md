# Non-Slop: read this before any UI work

This applies to every agent (Claude, Codex, Cursor, Copilot, Windsurf, Gemini, Grok Bot) and every person, on every page, dashboard, deck or visual. If your model's habit disagrees with this file, this file wins. If this file disagrees with the repo's `STYLE.md`, `STYLE.md` wins.

## 0. Style is not slop

**Slop is a default nobody chose. Style is a choice somebody made.** Remove the first; protect the second.

- Read `STYLE.md` (or the `## Signature` section of `AGENTS.md`) first. Never strip, "fix" or flag anything it lists. If a listed choice seems to cause a real problem (contrast, legibility, a broken layout), ask the owner. Don't change it.
- Before you remove anything, ask: **would removing this make the page more generic? Then keep it.** Would it make the page clearer, smaller or more honest? Then remove it.
- Judge the stack, not the item. One serif headline, one emoji in prose, one gradient with a job, or one rounded corner is a choice. Inter + purple gradient + three identical cards + "seamlessly" is a fingerprint.
- AI using a device doesn't make it slop. Em dashes, semicolons, serif type, warm paper, hairlines, humour and ornament are fine; their *misuse* (stretched, repeated, meaningless) is not.
- Minimal is the floor, not the goal. A page can pass every rule and still be generic. The fix is to add something specific (a named reference, a real number, a point of view), not to delete more.
- Never "make it sound less AI" on text the owner wrote. Their voice stays.
- Every edit should help a reader do something or understand the subject better. Preserve meaningful choices; question generic ones. Quote the exact sentence and propose the smallest change before rewriting. No AI-likeness percentage, and no mistakes added so the text looks human. `skills/writing/SKILL.md`.
- No `STYLE.md` yet? Anything consistent and clearly chosen gets asked about, not deleted. Offer to start one from `templates/STYLE.md`.

## 1. Before you code: write the brief

Five lines, in the PR or the design file: **who** uses it, the page's **one job**, the **hierarchy** (what wins first, second, third), the **constraints** (languages, devices, data), and a **visual direction taken from the subject's own world** (its materials, documents, maps, vernacular), not a style label. Then review the brief against the defaults: if you'd have made the same choice for any similar page, it's a default; change it. Method and domain presets: `skills/direction/SKILL.md`.

## 2. While you code: decide, then subtract

- Reuse the repo's design system and tokens. Don't invent a new look per page. No system yet? Define semantic colours, a spacing scale, a type scale (≤8 sizes), one radius system, states (hover, focus, disabled, loading, empty, error) and breakpoints before the first component.
- **Empty space is a decision.** Decide what the space is for, usually the map, the data or the reading column, and give it that. Don't stretch small things to fill it; don't leave it dead by accident.
- **Subtract before you add.** Slop often starts as a small element (a card, a box, a chip) blown up to fill space. Before adding a box, shadow, radius or badge, remove one.
- House limits per screen, unless `STYLE.md` says otherwise: ≤15 boxes, ≤3 drop shadows, one radius system, ≤5 pills or badges, ≤8 font sizes, no emoji used as UI icons, no decorative gradient or glass added without a job, no modal on first load, light by default. These limits are about what you add. A single choice that already has a job stays; if `STYLE.md` or `## Signature` lists it, it is not stripped. Prose ≤65ch (about 30–45 Chinese characters). A small thing is never more than 2× wider or 1.6× taller than its content.
- Something must win: one obvious first look, with a real step in size (1.5–2×), weight or colour to the next level.
- Use real, realistically shaped content early: long Thai and German labels, missing data, errors, 10× the rows.
- Words: verb + object on buttons, no filler ("seamless", "unlock", "supercharge"), no fake stats, testimonials or logo clouds.
- **No AI-generated visuals** unless the owner asks for one by name. Real photos, data, drawings, or nothing.

## 3. Map-first "surgical table"

On any map or data product the map is the operating table and everything else is an instrument at its edge. The map takes **≥60% of the first desktop screen** and the first full phone screen; top and bottom bars are **≤56px**; panels are compact, docked at the edges and sized to their content; nothing covers the map on load; numbers sit next to the place they describe.

## 4. Languages

Public frontends ship in **English, Thai and Chinese** unless the repo says otherwise. Set `lang` on every block (`en`, `th`, `zh-Hans`). Thai uses a non-looped face (Prompt, Kanit) and needs room for taller lines; Chinese is Simplified unless stated. Each language gets its own register, not a word-for-word translation. Never claim a fluent-reader check that didn't happen.

## 5. After you code: scan, render, look

```bash
node .non-slop/bin/non-slop.mjs scan .                 # source tells, honours STYLE.md
node .non-slop/bin/non-slop.mjs render http://localhost:3000   # needs Playwright
```

(Inside the Non-Slop repo itself, or with npx: `npx github:Nonarkara/Non-Slop scan .`.) Then open the screenshots at 1440, 1024 and 390, and the **silhouette**: if the block outline could belong to any SaaS landing page, redesign the hierarchy, not the colours. Fix every SLOP hit that isn't ALLOWED. A hit marked **ASK-OWNER** is an access rule the owner already listed (contrast, focus, alt, an unnamed control, lang, zoom, reduced motion): raise it, don't change it. Explain or fix every REVIEW hit. The scanner is a screen, not a judge. Catalog and fixes: `skills/detect/`.

## 6. Before merge: a different reviewer

**One agent builds; a different agent or person checks. Never self-review.** The reviewer renders the page and checks keyboard paths and visible focus, contrast, tap targets ≥44px, empty/loading/error states, 320px reflow, dense real data, all three languages, the map-first rule, and whether the primary action is obvious without explanation. The review lists **what was kept on purpose** as well as what was removed. The same gate walks small interactions (readable labels, icon alignment, focus, loading, a second click that must not submit twice) and a real-task trial: a non-technical person or a different test agent finds X, downloads Y, and gets back without hints. The scanner cannot judge that trial. Gate and report format: `skills/review/SKILL.md`.

Scale the gate to the stakes: a throwaway sketch needs the scan; anything public, civic or shipped to real users needs all of it.

You are done when the brief exists, the scan and render are clean or every hit is explained, the screenshots were looked at, and an independent review passed. Not before.

## 7. Credit

Credit every source you borrow from (code, rules, images, data) in the repo's credits file, with its licence. Paraphrase anything whose licence doesn't allow copying.
