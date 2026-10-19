# STYLE.md: deliberate choices. Do not strip.

Owner: <name>. Last checked: <YYYY-MM-DD>.

Everything here was chosen on purpose. Agents and reviewers read this before any design review, never remove or "fix" what it lists, and ask the owner if a choice seems to cause a real problem (contrast, legibility, a broken layout). This file beats every generic rule, including Non-Slop's.

## Type
- Display: <face>, <why>.
- Body: <face>. Thai: <non-looped face>. Chinese: <face>.
- <third family, if any, and its job, e.g. "JetBrains Mono for numbers">

## Colour
- Ground <#hex> (<name>), ink <#hex>, accent <#hex> for <its one job>.
- <more colours, each with a job, or why there are many>

## Devices
- <e.g. "Em dashes and semicolons in prose: the author's voice.">
- <e.g. "Ornament ❦ between essay sections.">
- <e.g. "Emoji in personal posts and playful lists; never as UI icons.">

## Layout
- <e.g. "Single 62ch reading column with wide blank margins on essays. The empty space is the point.">

## Voice
- EN: <register>. TH: <register>. ZH: <register, Simplified>.

## Protected voice
<!-- Machine-readable: the scanner does not flag these. Historical lines, quotations,
     unusual metaphors, and the story of this project. One per line.
     A phrase under ## Allow is protected the same way.
     - phrase "exact sentence or fragment": why it stays
     - marker "distinctive fragment": why it marks this voice -->
<!-- - phrase "the water came up the soi at four": opening of the field note -->
<!-- - marker "Sanzo Wada": this page is about his colour book -->

## Allow
<!-- Machine-readable: the scanner reports these as ALLOWED. One per line: kind, target, reason.
     Rule ids: `node .non-slop/bin/non-slop.mjs rules`. Access rules can't be allowed away.
     A ## Signature section in AGENTS.md is read too, even while these lines stay commented out.
     Style.md in any case, and a STYLE.md in a subfolder, count. -->
<!-- - rule void: essay pages are a reading column with deliberate margins -->
<!-- - rule cream-terracotta: warm paper and brick red are the house colours -->
<!-- - rule emoji-icons in src/kids/**: playful register for children -->
<!-- - font "Source Serif 4": display face, chosen -->
<!-- - colour #fbf7ef: warm paper ground -->
<!-- - phrase "unlock a vibrant world of colour": the poster line, kept on purpose -->
