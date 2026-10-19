---
name: non-slop-review
description: >-
  Use before merging or shipping any UI change, as the reviewer, never as the builder.
  An independent gate: renders the page, checks the task, access, states, languages and
  the map-first rule, and lists what was kept on purpose. Layer 3 of Non-Slop.
---
# Review: a different pair of eyes, every time

**If you built it, you can't review it.** Hand it to another agent or a person. A review by the builder is not a review, whatever it says.

## Inputs

The brief (who, one job, hierarchy, constraints, direction), `STYLE.md`, the PR diff, a URL or local build, the scan and render output. Missing brief → that is finding #1.

## The gate (all must pass or be explained)

**1. Style kept.** Read `STYLE.md` first. List every deliberate choice you saw. Anything the PR removed that was listed, or that was clearly chosen, is a blocking finding. Ask of every removal: did it make the page more generic?

**2. The task.** As a first-time user, do the page's one job. Is the primary action obvious without explanation? Can you finish in ≤3 interactions? Is there a way back and a clear "what next"? Does every button say what it does (verb + object), and does the result use the same word?

**3. Hierarchy and silhouette.** Squint at 1440, 1024 and 390. One thing wins. The silhouette could only be this product. Each card, border, gradient, icon and animation earns its place; if removing one loses neither meaning nor identity, it goes.

**4. Map-first (map or data products).** Map ≥60% of the first desktop screen and the first phone screen; bars ≤56px; nothing covers the map on load; numbers next to their places; observed vs projected states look different.

**5. Access.** Keyboard: Tab reaches everything in a sensible order, focus is always visible, no traps, Esc closes things. Contrast AA on every real background (including over maps and photos). Phone targets ≥44×44px. Zoom isn't blocked; 320px reflows without sideways scroll (a genuinely 2-D map or table may scroll inside itself). Images have alt in the page's language. Reduced motion is respected. Semantic HTML: headings in order, buttons are buttons, labels on inputs.

**6. States and real data.** Empty, loading (skeleton or last good data with its time, never a blank half), error (what happened and how to fix it, no apology), offline/stale, no-results, long labels, 10× the rows, missing values. No fake, mock or placeholder numbers on a public page.

**7. Languages.** EN, TH and ZH all present where the repo promises them; `lang` set; Thai in a non-looped face with room for its line height; Chinese Simplified unless stated; each reads as its own text, not a machine echo. Say plainly if no fluent reader has checked it.

**8. Speed.** Images sized and in modern formats; fonts subset and few; no motion or video without a budget. Note device/network if you measured.

**9. Trust.** Sources and dates on data. AI-assisted content is labelled where it matters. No AI-generated visuals. Sources credited. No AI-likeness percentage, and no sentence roughened on purpose so it looks human (`skills/writing/`).

**10. Small interactions.** Walk the controls. These are reviewer checks. The scanner does not judge optical alignment or a second click. Corner radius, shadow recipes, and banned words are not in this list: those belong to the owner, in `STYLE.md`.

- **Readable labels.** The words on a control can be read at the size on the page, and they say the action (verb + object). An icon with no words still has a name a person can discover.
- **Icon alignment.** An icon beside a label sits on the text optically. A triangle, arrow, or asymmetric mark often needs a small nudge. Do not change the radius or the shadow to do it.
- **Focus states.** Focus is visible on the small controls too: the icon button, the dismiss, the control inside a label. Not only the big links.
- **Loading states.** A slow action shows that it is working. The control does not look idle and ready while the first action is still going.
- **Repeated clicks / double-submit.** A second click does not send the form twice, write two records, or open two dialogs. Ignore it, queue it, or disable the control until the first one finishes, and show that if the wait is long.

**11. Real-task trial. The scanner cannot judge this.** A clean scan is not a pass, and a REVIEW or OK verdict says nothing about whether a person can finish the job.

Someone who does not know the codebase does the page's one job with no hints and no one pointing. That is a person, or a test agent that did not build the page. The builder does not run this trial.

The brief names the task. The shape is: find X, download Y, and get back to where you started. House example, when the product is a gauge: find the Bang Mod station, download the CSV, and return to the gauge.

Record who ran it, whether they finished without a hint, where they hesitated, and whether they got back.

## Severity

**Blocking:** deleted a STYLE.md choice; task can't be finished; access failure; map rule broken on a map product; fake data; AI visuals; a second click writes twice on a public form; the real-task trial has not been run on anything public, civic, or shipped to real users. **Major:** SLOP verdict; hierarchy doesn't survive real data; a missing state; a label that cannot be read; a loading state that still accepts another submit. **Minor:** P2 polish, wording, a `generic-promise` sentence that still needs a smaller edit. A sketch may mark the trial "not run" instead of blocking.

## Report format

```
Verdict: PASS | PASS WITH NOTES | BLOCK
Reviewer: <agent/person, not the builder>   Looked at: <URL/build, widths, languages>
Kept on purpose: <list, with STYLE.md lines>
Blocking: <finding — evidence (screenshot/file:line) — smallest fix>
Major / Minor: <same>
Small interactions: labels / icon alignment / focus / loading / double-submit — <ok or finding>
Trial (the scanner cannot judge this): <who ran it: non-technical person or a different test agent> — find <X>, download <Y>, return. Result: <done without hints | hesitated at … | not run>
Not verified: <what you couldn't check, e.g. fluent Thai reading, real device>
```

Name the evidence for every claim. Don't score taste. Don't invent measurements, users or praise.

Pillars adapted from Microsoft's frontend-design-review skill (frictionless insight to action, quality craft, trustworthy building; framework by @Quirinevwm). See CREDITS.md.
