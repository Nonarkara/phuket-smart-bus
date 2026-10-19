# STYLE.md: deliberate choices. Do not strip.

Owner: Dr Non. Last checked: 2026-10-19.

Everything here was chosen on purpose. Agents and reviewers read this before any design review, never remove or "fix" what it lists, and ask the owner if a choice seems to cause a real problem (contrast, legibility, a broken layout). This file beats every generic rule, including Non-Slop's.

The reference is Braun's control surfaces and civil-aviation operations boards — engraved lettering on a device, hairlines, one orange key. Not a SaaS landing page. The subject is a bus: a real public bus on a real road, and the people who need to know when it arrives.

## Type

- Display: **Josefin Sans**. Geometric, high x-height, drawn-on-a-device feel. Used for the few display moments only.
- Body: **Source Sans 3**. Humanist, warm, legible at 17px on a phone in sunlight. Thai: **IBM Plex Sans Thai** (non-looped — Sarabun is banned). Chinese: Simplified, falls back to the system CJK face.
- **No third family. There is no monospace UI face.** JetBrains Mono was removed 2026-10-19: it set "4 min" in a code-editor face at 44px on the rider's phone and read as a developer console, which is what it is. Figures that must line up use `font-variant-numeric: tabular-nums` in the body face. Do not reintroduce a monospace as a typographic voice — weight and colour do that job.
- A monospace is allowed in exactly one place, via `--font-code` (the platform's face, never a download): `<pre>`/`<code>`, raw tracker JSON, ticket numbers. Braces and indentation have to line up there and nowhere else.

## Colour

- Ground `#fafaf7` (warm paper, not flat `#fff`), ink `#131312` (near-black with a blue undertone).
- Accent `#f59e0b` amber — the one orange key on the Braun ET66. One job: attention.
- `#a23a26` brick red is the PKSB operator's own livery red, sampled from the badge. It appears on the rider and fleet surfaces as brand, never as a second "accent" competing with amber.
- Semantic only: `#16a574` gain/surplus, `#c0392b` loss/shortfall. Colour never substitutes for a label — every state is also a word.

## Devices

- Em dashes and semicolons in prose: the author's voice, kept.
- No emoji as UI icons, anywhere. Not one.

## Layout

- The map is the operating table. It takes the largest share of the first screen and nothing covers it on load. Everything else is an instrument docked at its edge, sized to its content.
- **Empty space is a decision**, never a filler. If a block could be removed without losing meaning, it is removed.
- No box, border, shadow, radius, pill or badge unless it groups things that belong together or it encodes a state.
- The intent is three sizes on a page: display, body, micro. It is not yet true — `PassengerApp.css` alone declares 23 distinct sizes, and `styles.css` 34. Treat a fourth size on a page as a decision to justify, and shrink the ramp before adding to it. This line records the intent, not the state; the state is the type-scale scanner hit.

## Voice

- EN: plain, concrete, operational. Real plate numbers, real times, real distances. A figure that cannot be backed is not shown at all — distance alone beats an invented ETA.
- TH / ZH: each language gets its own register, not a word-for-word translation.

## Protected voice

- phrase "observed since": LIVE mode can only count what it saw; the words keep that honest
- phrase "no counter": the passenger counters have never read above zero, so riders and fares stay null — never ฿0
<!-- "as ran" was here and is gone: it appears in ~30 sentences, and a
     protected phrase suppresses the rule for every sentence containing it.
     Protected voice is for a distinctive fragment, never a recurring word. -->

## Allow

<!-- Machine-readable: the scanner reports these as ALLOWED. One per line: kind, target, reason.
     Rule ids: `node .non-slop/bin/non-slop.mjs rules`. Access rules can't be allowed away. -->

- rule cream-terracotta in src/styles.css, src/components/passenger/PassengerApp.css: warm paper is the Braun/Vignelli ground; the brick red is PKSB's actual livery red, not a taste default
- colour #fafaf7: warm paper ground, deliberately not #fff
- colour #f59e0b: the one amber, modelled on the Braun ET66's orange key
- font "Josefin Sans": display face, geometric, chosen
- font "Source Sans 3": body face, humanist, chosen
- font "IBM Plex Sans Thai": non-looped Thai, required — Sarabun is banned
- font "--font-code": monospace is correct for code and ticket identifiers; never a UI voice
- colour #a23a26: PKSB operator livery red, brand not accent

The following are deliberate, with the reason recorded so a reviewer can disagree with the reason rather than rediscover the fact:

- rule dark-command-centre in src/styles.css, src/components/v2/**: `/ops` is an operations wall on a 50"+ display in a room that runs all day. It is near-black on purpose, to reduce eye strain at that size and viewing distance. The rider's phone app, which is the other half of this product, is warm paper. Two surfaces, two rooms, two treatments — neither is a default.
- rule card-grid-3 in src/styles.css: the scanner matches `repeat(3, 1fr)` in source, so it never sees what renders. Two places: the desktop-shell environment row (air temperature, AQI, rain chance) — three parallel facts in a row, which is the correct presentation for three parallel values, and whose identical *boxed* version was removed — and the rider desktop's four stat cards, which render as a 2x2 grid. Those four are honest labelled figures (modelled riders, scheduled buses, modelled buses moving, modelled CO2), each carrying its own qualifier, so the box is doing real work; they are not three identical marketing cards.
- rule modal-on-load in src/components/toolkit/ResearchPanel.tsx: a false positive. `defaultOpen` is a prop, and both call sites pass `false` — nothing is open on load. The research panels are closed `<details>`, not overlays.
- rule img-alt in src/engine/feedSafety.test.ts: a false positive. The markup is a test fixture string asserting the guard, not shipped markup.
- rule type-scale in src/components/toolkit/*.css: the toolkit is a separate published surface with its own editorial scale and its own house rules. It is not the bus app and does not share its type ramp.

These read as hits but are not. Each is recorded so a reviewer can test the reason rather than trust it:

- rule shadow-everything in src/styles.css: the scanner counts `box-shadow` declarations in source; most resolve through `--shadow-*` vars set to `none` in `:root`. The rendered page is the check, and `/ops` renders **11** shadows (dot glows, an inset rule, map badges) — all functional, none of them fake depth. An earlier version of this line claimed 4; that was wrong and is corrected here.
- rule shadow-everything in src/components/toolkit/toolkit-showcase.css: the scanner counts `box-shadow` declarations in source; these resolve through `--shadow-*` vars set to `none` in `:root`, and the rendered page measures **4** shadows on `/ops`. Declared is not applied.
- rule shadow-everything in src/components/v2/fleetDetail.css: the scanner counts `box-shadow` declarations in source; these resolve through `--shadow-*` vars set to `none` in `:root`, and the rendered page measures **4** shadows on `/ops`. Declared is not applied.
- rule hype-copy in src/engine/*.test.ts: "seamless playback" is a Vitest `describe()` string. No user ever sees it.
- rule lang-th in src/App.tsx: the Thai here is a URL path, a search alias, a plate regex or a lookup table — data, not rendered prose. Every Thai string that reaches the screen now carries `lang`. It is a URL path segment, `/driver/กข 1001 ภูเก็ต`.
- rule lang-th in src/components/WelcomeSheet.tsx: the Thai here is a URL path, a search alias, a plate regex or a lookup table — data, not rendered prose. Every Thai string that reaches the screen now carries `lang`. It is a search alias for stop-name matching.
- rule lang-th in src/components/v2/DriverProfileSheet.tsx: the Thai here is a URL path, a search alias, a plate regex or a lookup table — data, not rendered prose. Every Thai string that reaches the screen now carries `lang`. It is a plate-suffix regex.
- rule lang-th in src/components/v2/OperatorFleetPanel.tsx: the Thai here is a URL path, a search alias, a plate regex or a lookup table — data, not rendered prose. Every Thai string that reaches the screen now carries `lang`. It is a plate-suffix regex.
- rule lang-th in src/components/DecisionPanel.tsx: the Thai here is a URL path, a search alias, a plate regex or a lookup table — data, not rendered prose. Every Thai string that reaches the screen now carries `lang`. It is a lookup table; the chips that render it carry `lang`.
- rule lang-th in src/components/StopSpotlight.tsx: the Thai here is a URL path, a search alias, a plate regex or a lookup table — data, not rendered prose. Every Thai string that reaches the screen now carries `lang`. It is a lookup table; the element that renders it carries `lang`.
- rule glass in src/styles.css: **no blur renders anywhere in this product.** Measured across all seven routes at 1440: zero elements with a computed `backdrop-filter`. The declarations this rule matches are on elements that render at 0x0 (`.v2-map__stat`, `.v2-map__next` — in the DOM, not on screen) or are explicitly `backdrop-filter: none`. Two blurs that did render were removed: `.v2-map__maritime-banner` (blur over a 92%-opaque red) and `.hero-section` on the rider desktop (`saturate(1.8) blur(10px)` over a 96%-opaque white).
