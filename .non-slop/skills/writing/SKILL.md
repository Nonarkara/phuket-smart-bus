---
name: non-slop-writing
description: >-
  Use when editing, reviewing, or auditing words on a page, in a deck, or in a
  document. Quote the weak sentence, say why it fails the reader, and propose
  the smallest change. Preserve the writer's voice and anything STYLE.md protects.
  Layer for copy, beside direction, detect, and review.
---
# Writing: help the reader, keep the voice

**Every edit should help a reader do something or understand the subject better. Preserve meaningful choices; question generic ones.**

This sits on the same core as the rest of Non-Slop. Slop is a default nobody chose. Style is a choice somebody made. `STYLE.md` beats every generic writing rule here, including this skill. There is no banned-word list. An unusual sentence stays if someone meant it.

## Review before rewriting

Read the whole piece first. Then, for each sentence that is vague or unhelpful:

1. Quote the exact sentence.
2. Say what makes it vague or unhelpful. Usual reasons: it could move unchanged onto another product; it promises a feeling and names nothing; the reader still cannot do the next thing.
3. Propose the smallest edit. One clause, not a new paragraph. Do not smooth the voice, invent a fact, or "make it sound less AI".

If you were asked to audit, stop after the three lines. If you were asked to edit, apply that edit and list what changed. A strong sentence, a rough one, and a strange one that is clearly the writer's are left alone.

The scanner's `generic-promise` hit is status **REVIEW**. It quotes the sentence and stops. It adds no points, it does not block a commit, and it does not rewrite the file. See `skills/detect/`.

## Preserve voice

Protect historical text, quotations, unusual metaphors, and the story of how this project came to be. Do not sand them into a cleaner line.

The scanner already skips `<blockquote>` and `<q>`. Anything else the owner wants kept goes in `STYLE.md`, and the scanner does not flag a sentence that contains it:

```markdown
## Protected voice
- phrase "the water came up the soi at four": opening of the field note
- marker "Sanzo Wada": this page is about his colour book

## Allow
- phrase "unlock a vibrant world of colour": the 1932 poster line, kept in the story
```

`phrase` is a sentence or a fragment. `marker` is a shorter sign of this voice (a name, a metaphor, a piece of the story). A prose `## Voice` section is for register (EN / TH / ZH). It is not this list. A phrase under `## Allow` is protected the same way. A listed rule id still shows as **ALLOWED**, which is the usual allowlist, not a silent skip.

## Empty promises

Replace a promise that names no thing with the specific subject, and only with a number you actually have.

"Unlock a vibrant world of colour" becomes "Explore 348 colour combinations by Sanzo Wada" when 348 and the name are true. If you do not know the number, ask. Do not invent one.

The scanner flags a few promise-shaped phrases: a world of colour or possibilities, unlock a world of …, embark on a journey, the future of something is here, to new heights, dive into a world of. It does not flag the word on its own. "Unlock the gauge shed" is not this rule. Filler words such as "seamless" stay on the separate `hype-copy` rule, which is a scored question, not a ban on the word in the owner's own sentence.

## What we refuse

- **AI-likeness percentages.** A meter that says a text is some percent "AI" has no verified basis. Do not add one, cite one, or treat one as evidence. A sentence a person can point at is the evidence.
- **Mistakes added so the text looks human.** A planted typo, a fake stumble, or roughness put in on purpose is a costume. Voice is what the writer actually does, including a clean sentence.

## What we did not import

Peter Yang's no-ai-slop skill (MIT) is the source of the review-before-rewriting workflow: quote the line, say what is wrong, propose a short fix, do not rewrite on a detect pass, do not score the draft. Jakub Krehel's interface skill is not a writing source; the small-interaction checks live in `skills/review/`. Rakesh Mahanti's carousel is the idea source for the principle at the top of this file, credited as a link only.

Not taken from the writing source: a banned-word list, an em-dash quota, and any rule that flattens an unusual or contrastive sentence. Those fight `STYLE.md` and the owner's voice. See CREDITS.md.
