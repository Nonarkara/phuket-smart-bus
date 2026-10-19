// non-slop-skip-file: scanner code, not UI
// Generates skills/detect/CATALOG.md from the rule tables, so the docs can't drift from the code.
import { RULES } from "./rules.mjs";
import { RENDER_RULES } from "./render.mjs";
export function catalogMarkdown() {
  const cats = { type: "Type", colour: "Colour", depth: "Boxes and depth", layout: "Layout", motion: "Motion", icons: "Icons", copy: "Copy", imagery: "Imagery", a11y: "Access", lang: "Languages", speed: "Speed" };
  let md = `# Rule catalog (generated)\n\nGenerated from \`lib/rules.mjs\` and \`lib/render.mjs\` by \`node bin/non-slop.mjs rules --md\`. Do not edit by hand.\n\nSeverity: **P0** anyone notices · **P1** a designer notices · **P2** polish. A hit is a question; a stack of hits is slop. Rules marked *access* can't be allowed away: if STYLE.md lists them they show as ASK-OWNER (raise it, don't change it). A rule marked **REVIEW** is listed and not scored. The scanner does not rewrite it. \`generic-promise\` is that writing check: an empty promise, not a banned word. A phrase under Allow, or a phrase or marker under Protected voice, is not flagged.\n\n## Static scan (\`non-slop scan\`)\n`;
  for (const [k, name] of Object.entries(cats)) {
    const rs = RULES.filter((r) => r.cat === k); if (!rs.length) continue;
    md += `\n### ${name}\n\n| id | sev | what | fix | keep it when |\n|---|---|---|---|---|\n`;
    for (const r of rs) md += `| \`${r.id}\` | ${r.review ? r.sev + " · REVIEW" : r.sev} | ${r.title.replace(/\|/g, "\\|")} | ${r.fix.replace(/\|/g, "\\|")} | ${r.noAllow ? "*access: ask the owner*" : (r.keep || "STYLE.md lists it").replace(/\|/g, "\\|")} |\n`;
  }
  md += `\n## Rendered check (\`non-slop render\`)\n\nPoints: ≥6 SLOP, 3–5 REVIEW. Weights and thresholds come from the Oct 2026 measurement of 31 citizen-built flood apps (in-sample: precision 0.95, recall 0.91 at REVIEW).\n\n| id | points | what |\n|---|---|---|\n`;
  for (const r of RENDER_RULES) md += `| \`${r.id}\` | ${r.w}${r.a11y ? " (access)" : ""} | ${r.desc} |\n`;
  return md;
}
