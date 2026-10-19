# Rule catalog (generated)

Generated from `lib/rules.mjs` and `lib/render.mjs` by `node bin/non-slop.mjs rules --md`. Do not edit by hand.

Severity: **P0** anyone notices · **P1** a designer notices · **P2** polish. A hit is a question; a stack of hits is slop. Rules marked *access* can't be allowed away: if STYLE.md lists them they show as ASK-OWNER (raise it, don't change it). A rule marked **REVIEW** is listed and not scored. The scanner does not rewrite it. `generic-promise` is that writing check: an empty promise, not a banned word. A phrase under Allow, or a phrase or marker under Protected voice, is not flagged.

## Static scan (`non-slop scan`)

### Type

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `default-font` | P1 | Primary face is a reach-for-it default (Inter, Roboto, Poppins, Geist, system-ui stack…) | Choose a face for this product and say why in STYLE.md. House starting point: Jost; Josefin Sans or League Spartan for display; Prompt or Kanit (non-looped) for Thai. | The default is the brief (e.g. system-ui so the font disappears into the OS). List it under STYLE.md → Allow → font. |
| `tasteful-font` | P2 | The second-order 'tasteful free font' (Fraunces, Instrument Serif, Playfair…) picked because it isn't Inter | Fine if it fits the subject; otherwise choose from the subject's world and record the reason. | Listed in STYLE.md. |
| `eyebrow-caps` | P2 | Tracked all-caps eyebrow labels used as template chrome (≥3) | Drop the label or make it carry real information in sentence case. | A wayfinding or signage system that really uses caps. |
| `type-scale` | P2 | More than 8 font sizes in one stylesheet (no type scale) | State a scale (e.g. 1.25 or 1.333) and map every size to a step; ≤8 sizes. | STYLE.md lists it |
| `font-not-loaded` | P1 | A named web font is declared but never loaded (silent fallback) | Load it (@font-face, a <link>, next/font or @fontsource) or remove it from the stack. | STYLE.md lists it |

### Colour

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `purple-gradient` | P0 | Purple/indigo/violet gradient: the canonical colour nobody chose | One flat brand colour from the subject's world; a gradient only with a job (photo veil, data ramp). | A gradient named in STYLE.md. |
| `gradient-text` | P0 | Gradient-filled headline text | Solid ink; let size and weight make the headline win. | Listed in STYLE.md. |
| `default-purple` | P1 | Tailwind indigo/violet/purple as the accent (#6366f1, #8b5cf6, bg-indigo-600…) | Pick the accent from the subject (a flag, a material, a map layer) and give it one job. | Purple is the brand and STYLE.md says so. |
| `neon-glow` | P2 | Coloured glow shadows (0 0 30px <saturated colour>) | Remove; separate with space or a hairline. | STYLE.md lists it |
| `cream-terracotta` | P1 | Cream ground + terracotta accent: the second-order 'tasteful' default | If it isn't your brand, derive ground and accent from the subject. | It is your house paper and ink: list both colours in STYLE.md → Allow → colour (Non's warm paper is a choice). |
| `dark-command-centre` | P1 | Dark 'command centre' by default: navy/near-black ground plus glow, glass or gradient | Light by default. Dark only when the product is used in the dark, and then without glow or glass. | The product is used in the dark, or STYLE.md says dark. |

### Boxes and depth

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `glass` | P1 | Glassmorphism (backdrop blur) by reflex | Solid surfaces. If text sits on a photo, use a flat veil for legibility. | A blur with a job (legibility over live video) named in STYLE.md. |
| `shadow-everything` | P1 | Fake depth: ≥8 drop shadows in one file (house limit is 3 per screen) | Separate with space and hairlines; keep shadows for things that really float (menus, dialogs). | STYLE.md lists it |
| `rounded-card-kit` | P1 | The card kit: rounded-xl/2xl + shadow on every box (≥3) | Let most content sit on the page. One radius system; most boxes need none. | STYLE.md lists it |
| `radius-soup` | P2 | ≥5 different corner radii in one stylesheet (no radius system) | One radius (or none) for the product, plus full-round only for true pills/avatars. | STYLE.md lists it |
| `pill-clutter` | P2 | ≥10 pills/badges in one file (house limit is 5 per screen) | Use words in running text or a plain list; keep pills for real, filterable states. | STYLE.md lists it |
| `accent-border-card` | P2 | Coloured left-border 'accent' cards (≥2) | Drop the stripe; if it encodes a state, say the state in words too. | A real status colour system (severity, line colour) named in STYLE.md. |
| `icon-tile` | P2 | Icon in a tinted rounded square, repeated (≥3) | Drop the tile; an icon earns its place only if it is read faster than the word. | STYLE.md lists it |
| `shadcn-untouched` | P1 | shadcn/ui theme left at its defaults | Set --primary, --radius and the neutrals from your own tokens. | STYLE.md lists it |

### Layout

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `centered-hero` | P1 | Centred hero: headline + subhead + two buttons, all centred | Open with the most characteristic thing in the subject (the map, the number, the photo, the table); one primary action. | STYLE.md lists it |
| `card-grid-3` | P1 | Three (or four) identical cards in a row as the default composition | Vary weight: one thing leads; or use a list/table if the items are parallel. | The content really is three parallel things of equal weight (rare). |
| `modal-on-load` | P1 | A modal, wall or cookie-style overlay on first load | Answer the question first; onboarding and disclaimers go inline or on demand. | A legal gate you are required to show. |

### Motion

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `effect-library` | P2 | Stock effect components (Aceternity / Magic UI: spotlight, meteors, beams, aurora…) | Remove; one orchestrated moment beats a kit of effects. | STYLE.md lists it |
| `bounce-easing` | P2 | Bounce/elastic easing | Ease-out, 150–250 ms, transform/opacity only. | A playful product where bounce is the voice (STYLE.md). |
| `fade-up-everything` | P2 | The same fade-up-on-scroll on every section (≥4) | One orchestrated moment, or none; motion should answer an action. | STYLE.md lists it |
| `count-up` | P2 | Count-up stat animation | Show the real number, with its date and source. | STYLE.md lists it |

### Icons

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `emoji-icons` | P1 | Emoji used as UI icons (buttons, nav, headings, labels, icon props) | Use a word, or one real icon set used sparingly. | Emoji in prose, personal posts or a playful list are voice, not icons: they are not flagged. |
| `sparkle-ai` | P2 | Sparkle/wand icon to mean 'AI' | Name what the feature does. | STYLE.md lists it |

### Copy

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `hype-copy` | P2 | Filler marketing words (seamless, unlock, supercharge, revolutionise, elevate, cutting-edge…) | Say what it does, with a noun from this product and a real number. | Quotation or a sentence that is about the word. A phrase or marker in STYLE.md → Protected voice (or Allow → phrase) is not flagged. Non's own essays are not scanned (Markdown is skipped). |
| `generic-promise` | P2 · REVIEW | Empty promise with no subject and no number (a world of colour, a journey, a future that is here) | Do not rewrite this automatically. Quote the sentence, say what it promises without a subject or a number, and propose the smallest edit that names the real thing. Do not invent a number. | A quotation (blockquote or q), or a phrase or marker listed in STYLE.md → Protected voice or Allow → phrase. One ordinary word is not this rule. The hit is REVIEW: it is not scored and nothing rewrites it. |
| `fake-proof` | P1 | Fake social proof or round-number stats (Trusted by 10,000+ teams, 99.9% uptime, ★★★★★) | Real numbers with date and source, or nothing. | The number is real and sourced on the page. A quotation (blockquote or q) is not flagged. |
| `generic-cta` | P2 | Generic button labels (Get Started, Learn More, Click Here, Submit) | Verb + object: 'Check my street', 'Download the CSV'. | STYLE.md lists it |
| `placeholder-content` | P1 | Placeholder people, media or text (Lorem ipsum, John Doe, Acme, picsum, pravatar, Unsplash random) | Use real content early, including long labels and missing data. | STYLE.md lists it |

### Imagery

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `ai-visual` | P0 | AI-generated imagery (DALL·E, Midjourney, Replicate, Ideogram, Leonardo hosts or file names) | Use real photos, data, drawings or nothing. House rule: no AI-generated visuals. | STYLE.md lists it |
| `generator-signature` | P1 | Generator signature left in (v0, Lovable, Bolt, GPT Engineer) | Remove the tag/badge/script. | STYLE.md lists it |

### Access

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `low-contrast` | P1 | Text/background pair below WCAG AA (4.5:1, or 3:1 for large text) | Darken the ink or lighten the ground until it passes; check every real background. | *access: ask the owner* |
| `reduced-motion` | P1 | Animation with no prefers-reduced-motion path | Wrap non-essential motion in @media (prefers-reduced-motion: no-preference) or use motion-safe:/useReducedMotion. | *access: ask the owner* |
| `img-alt` | P1 | Images without alt (use alt="" for decoration) | Describe what the image says, in the page's language; alt="" if decorative. | *access: ask the owner* |
| `unnamed-button` | P1 | Icon-only button with no accessible name | Add aria-label (in the page's language) or visible text. | *access: ask the owner* |
| `focus-removed` | P1 | Focus outline removed with no :focus-visible replacement anywhere | Keep a visible focus style (outline 2px, offset 2px) on every interactive element. | *access: ask the owner* |
| `viewport` | P1 | Page has <head> but no viewport meta, or blocks zoom | <meta name="viewport" content="width=device-width, initial-scale=1">; never user-scalable=no or maximum-scale=1. | *access: ask the owner* |

### Languages

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `html-lang` | P1 | <html> without lang | lang="en" / "th" / "zh-Hans" so screen readers and fonts pick the right voice and glyphs. | *access: ask the owner* |
| `lang-th` | P2 | Thai text with no lang="th" anywhere in the file | Mark Thai blocks lang="th" so the Thai face (non-looped: Prompt, Kanit) and line-breaking apply. | STYLE.md lists it |
| `lang-zh` | P2 | Chinese text with no lang="zh-Hans" (or zh-*) anywhere in the file | Mark Chinese blocks lang="zh-Hans" (Simplified unless the repo says otherwise). | STYLE.md lists it |

### Speed

| id | sev | what | fix | keep it when |
|---|---|---|---|---|
| `heavy-image` | P2 | Image over 500 KB shipped as-is | Resize to the largest displayed size and serve AVIF/WebP; set width/height. | A full-resolution download the reader asked for. |

## Rendered check (`non-slop render`)

Points: ≥6 SLOP, 3–5 REVIEW. Weights and thresholds come from the Oct 2026 measurement of 31 citizen-built flood apps (in-sample: precision 0.95, recall 0.91 at REVIEW).

| id | points | what |
|---|---|---|
| `stretch-to-fill` | 2 | Small things laid out ≥2× wider or ≥1.6× taller than their content needs (≥2 of them) |
| `rounded-same` | 2 | Rounded-everything: ≥80% of boxes rounded and ≥40% share one radius |
| `emoji-icons` | 2 | ≥3 emoji used as icons in buttons, links, headings, nav or labels |
| `dark-command-centre` | 2 | Dark first screen plus glow, gradient, glass, ≥10 pills or emoji icons |
| `void` | 2 | Accidental empty space: a flat region ≥35% of the first screen, or text squeezed into <45% of the width, with no map, no data and no reading column |
| `hero-no-data` | 2 | Hero ≥55% of the first screen with <20% map or data |
| `map-not-first` | 2 | Map product where the map takes <60% of the first screen (surgical-table rule) |
| `fat-bars` | 1 | Map product with a top or bottom bar taller than 56px |
| `shadow-everything` | 1 | ≥8 boxes with a drop shadow on one screen |
| `box-soup` | 1 | ≥30 boxes with ≥5 different corner radii |
| `pill-clutter` | 1 | ≥10 pills/badges on one screen |
| `modal-on-load` | 1 | A modal or full-screen overlay on first load |
| `gradients` | 1 | ≥3 decorative gradient fills, or gradient text |
| `glass` | 1 | ≥2 backdrop-blur layers |
| `big-number-tiles` | 1 | ≥2 big bare numbers in tiles |
| `long-lines` | 1 | Prose lines wider than ~40em (≈80+ Latin characters) |
| `type-chaos` | 1 | ≥9 distinct font sizes |
| `mobile-overflow` | 1 | Phone (390) or 320px layout scrolls sideways |
| `broken-placeholder` | 1 | Visible undefined/NaN, lorem ipsum or mock/sample data |
| `low-contrast` | 2 (access) | ≥3 text elements below WCAG AA contrast |
| `small-targets` | 1 (access) | ≥3 phone controls smaller than 44×44px |
| `focus-invisible` | 2 (access) | ≥2 controls show no visible change when reached with Tab |
| `boxed-everything` | 0 | ≥70% of first-screen text inside boxes (reported only) |
| `default-font` | 0 | Primary face is a stock default (reported only; the static scan judges fonts) |
