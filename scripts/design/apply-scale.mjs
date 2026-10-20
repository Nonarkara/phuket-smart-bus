#!/usr/bin/env node
/**
 * Apply the type scale to the surfaces that live in src/styles.css.
 *
 * This is the whole job, in one place: the token blocks, the collapse, the
 * order. It is idempotent — running it twice changes nothing the second
 * time — and it prints the resulting ramp per surface so the effect is
 * visible in the same run that caused it.
 *
 *   node scripts/design/apply-scale.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FILE = "src/styles.css";

// ── the scales ───────────────────────────────────────────────────────────────
//
// `inside` names a selector whose opening brace the token block is placed
// after (the tokens belong to that rule, so they scope to its subtree).
// `before` names a selector the whole rule is placed before — used where the
// scale belongs to a class that does not exist yet.
const SCALES = {
  roi: {
    inside: ".roi-page {",
    occurrence: "first",
    values: { display: "36px", hero: "26px", figure: "24px", lead: "22px", title: "18px", body: "16px", label: "14px", micro: "11px" },
    comment: "the roi-* rules"
  },
  governor: {
    inside: ".governor {",
    occurrence: "first",
    values: { display: "52px", hero: "28px", figure: "26px", title: "22px", lead: "20px", body: "14px", label: "12px", micro: "11px" },
    comment: "the governor-* rules"
  },
  ops: {
    inside: ".v2--operations {",
    occurrence: "first",
    group: "v2",
    values: { display: "52px", hero: "30px", figure: "24px", title: "20px", lead: "18px", body: "15px", label: "14px", micro: "13px" },
    comment: "the v2-* rules"
  },
  capacity: {
    before: ".v2--operations .v2-alert-banner {",
    rule: ".v2--operations.capacity",
    values: { display: "72px", hero: "56px", figure: "40px", title: "32px", lead: "24px", body: "18px", label: "14px", micro: "12px" },
    comment: "the capacity-* rules"
  }
};

// ── 1. the token blocks ──────────────────────────────────────────────────────
let css = readFileSync(FILE, "utf8");

const block = (s, indent = "  ") =>
  `\n${indent}/* Type scale — the eight names, this surface's values. Every font-size in\n` +
  `${indent}   ${s.comment} is one of these. See STYLE.md, "The type scale". */\n` +
  Object.entries(s.values)
    .map(([k, v]) => `${indent}--t-${k}:${" ".repeat(Math.max(1, 10 - k.length))}${v};`)
    .join("\n") +
  "\n";

for (const [key, s] of Object.entries(SCALES)) {
  const marker = "Type scale — the eight names";
  if (s.inside) {
    // The LAST occurrence: .v2--operations appears as a block once and as a
    // descendant selector many times.
    // The FIRST occurrence is the rule; a later one is usually the copy
    // inside a media query, and a token block there only applies at that
    // width.
    const at = s.occurrence === "first" ? css.indexOf(s.inside) : css.lastIndexOf(s.inside);
    if (at === -1) {
      console.error(`error: the selector ${s.inside} is not in ${FILE}`);
      process.exit(1);
    }
    const insertAt = at + s.inside.length;
    // Look NEAR the insertion point, not in the whole file: another
    // surface's block earlier in the file carries the same marker.
    if (css.slice(Math.max(0, insertAt - 600), insertAt).includes(marker)) {
      console.log(`  ${key}: the token block is already there`);
      continue;
    }
    css = css.slice(0, insertAt) + block(s) + css.slice(insertAt);
    console.log(`  ${key}: token block inserted`);
  } else {
    const at = css.indexOf(s.before);
    if (at === -1) {
      console.error(`error: the anchor ${s.before} is not in ${FILE}`);
      process.exit(1);
    }
    if (css.slice(Math.max(0, at - 600), at).includes(marker)) {
      console.log(`  ${key}: the token block is already there`);
      continue;
    }
    css =
      css.slice(0, at) +
      `/* The capacity screen is an operations surface (it carries the\n` +
      `   v2--operations class) with its own scale: it is a one-screen command,\n` +
      `   so its hero numbers are the page's subject and they are bigger than the\n` +
      `   wall's. Two classes on one element, so this beats .v2--operations\n` +
      `   whatever the source order. */\n` +
      `${s.rule} {${block(s)}\n}\n\n` +
      css.slice(at);
    console.log(`  ${key}: token rule inserted`);
  }
}
writeFileSync(FILE, css);

// ── 2. the collapse ──────────────────────────────────────────────────────────
for (const [key, s] of Object.entries(SCALES)) {
  const group = s.group || key;
  const scale = Object.entries(s.values)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  console.log(`\n--- ${key} ---`);
  execFileSync("node", ["scripts/design/retype.mjs", "--file", FILE, "--group", group, "--scale", scale], {
    stdio: "inherit"
  });
}
