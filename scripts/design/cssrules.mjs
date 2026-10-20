#!/usr/bin/env node
/**
 * A CSS rule parser.
 *
 * WHY THIS EXISTS
 *   Chrome's CSSOM erases exactly the thing the design instruments need.
 *
 *   A declaration written as a shorthand —
 *     font: 500 var(--t-hero)/1.05 var(--font-display);
 *   — is stored with every longhand carrying a pending substitution, so
 *   `rule.style.fontSize` reads "", `rule.style.font` reads "", and
 *   `rule.style` enumerates `font-size = ` : present, empty. The authored
 *   text, the only place the token name still exists, is gone from the CSSOM.
 *   `rule.cssText` is no better: it serialises the same emptied longhands.
 *
 *   That is not a corner case. This codebase writes its type in the
 *   shorthand form everywhere, so every "which token does this rule name?"
 *   question was being answered with an empty string. The instruments that
 *   needed the answer were blind to most of the stylesheet — and blind in the
 *   quiet direction: they reported "clean" on a page that was broken.
 *
 *   So: read the stylesheet TEXT. Same text the browser reads, minus the
 *   erasure. Parse it, and the rules carry their declarations again.
 *
 * WHAT IT SUPPORTS
 *   @media / @supports / @layer are followed and the condition is recorded.
 *   @keyframes and @font-face are skipped. There is no native CSS nesting in
 *   this codebase (checked), so a block is either declarations or rules.
 *
 * USAGE
 *   import { parseCss } from "./cssrules.mjs";
 *   const rules = parseCss(text);
 *   // rules: [{ selector, decls: [{prop, value, important}], conditions, order }]
 */
import fs from "node:fs";
import path from "node:path";

/** Split a declaration block into {prop, value, important} records. */
function parseDecls(body) {
  const out = [];
  let buf = "";
  let depth = 0;
  let quote = null;

  const flush = () => {
    const t = buf.trim();
    buf = "";
    if (!t) return;
    const i = t.indexOf(":");
    if (i === -1) return;
    const prop = t.slice(0, i).trim().toLowerCase();
    if (!prop) return;
    let value = t.slice(i + 1).trim();
    let important = false;
    const bang = /!\s*important$/i.exec(value);
    if (bang) {
      important = true;
      value = value.slice(0, bang.index).trim();
    }
    out.push({ prop, value, important });
  };

  for (const ch of body) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === ";" && depth === 0) {
      flush();
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}

/** Strip comments, keeping the text otherwise intact. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

const FOLLOWED_AT_RULES = new Set(["@media", "@supports", "@layer", "@container"]);

/**
 * Parse CSS text into a flat list of rules.
 * @param {string} text
 * @returns {Array<{selector: string, decls: Array<{prop: string, value: string, important: boolean}>, conditions: string[], order: number}>}
 */
export function parseCss(text) {
  const src = stripComments(String(text || ""));
  const out = [];
  let order = 0;

  // Walk the source directly so nested at-rule blocks are handled by recursion.
  const walk = (text, conditions) => {
    let i = 0;
    while (i < text.length) {
      const brace = text.indexOf("{", i);
      if (brace === -1) break;
      const prelude = text.slice(i, brace).trim();
      let depth = 1;
      let j = brace + 1;
      while (j < text.length && depth > 0) {
        const ch = text[j];
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        j++;
      }
      const body = text.slice(brace + 1, j - 1);

      if (prelude.startsWith("@")) {
        const name = (prelude.split(/\s/)[0] || "").toLowerCase();
        if (FOLLOWED_AT_RULES.has(name)) walk(body, conditions.concat(prelude));
        // @keyframes, @font-face, @page … carry no type scope. Skipped.
      } else if (prelude) {
        const decls = parseDecls(body);
        for (const raw of prelude.split(",")) {
          const selector = raw.trim();
          if (!selector) continue;
          out.push({ selector, decls, conditions: conditions.slice(), order: order++ });
        }
      }
      i = j;
    }
  };

  walk(src, []);
  return out;
}

/** The type-relevant declaration of a rule: its size, however it was written. */
export function sizeDecl(rule) {
  for (const d of rule.decls) {
    if (d.prop === "font-size") {
      return { prop: "font-size", value: d.value, size: d.value, important: d.important };
    }
  }
  for (const d of rule.decls) {
    if (d.prop === "font") {
      // The shorthand: "500 var(--t-hero)/1.05 var(--font-display)".
      // The size is the part before the "/" line-height, minus weight/style.
      const v = d.value.replace(/^.*\/\s*/, "");
      const parts = v.split(/\s+/).filter(Boolean);
      const size = parts.find((p) => /var\(|px|rem|em|%|clamp|calc/.test(p) && !/^var\(--font/.test(p));
      return { prop: "font", value: d.value, size, important: d.important };
    }
  }
  return null;
}

/** Every `--t-*` name a rule's size declaration names. */
export function tokenNames(rule) {
  const sd = sizeDecl(rule);
  if (!sd) return [];
  const hay = sd.size || sd.value || "";
  return [...hay.matchAll(/var\(\s*(--t-[a-z]+)/g)].map((m) => m[1]);
}

/** Every `--t-*` name a rule DEFINES. */
export function definedTokens(rule) {
  return rule.decls
    .filter((d) => d.prop.startsWith("--t-"))
    .map((d) => d.prop);
}

/** Read every stylesheet under the given roots. */
export function readStylesheets(roots) {
  const files = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".css")) files.push(p);
    }
  };
  for (const r of roots) walk(r);
  return files;
}
