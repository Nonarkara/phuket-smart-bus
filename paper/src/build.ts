/**
 * npx tsx paper/src/build.ts [buildDir] [outDir]
 *
 * Prints the preprint from the analysis output (paper/build by default, as
 * written by analyze.ts) into the published folder the Paper tab reads
 * (public/papers/data-before-rail by default):
 *
 *   <slug>.pdf        the paper, A4, two columns, tagged, with metadata
 *   pages/p-N.jpg     one image per page, for browsers with no PDF viewer
 *   data/*.csv        the derived tables every figure and table is drawn from
 *   manifest.json     what the tab shows: title, authors, abstract, the
 *                     record's span, the files, and a hash of the PDF
 *
 * The PDF is printed by the same Chromium the design gates use. Fonts are
 * embedded from the local @fontsource packages, so the PDF never asks a CDN
 * for anything, and the build FAILS if the PDF carries any font that is not
 * one of the three the paper sets — a fallback face means a glyph the paper's
 * fonts do not have, and that is a defect to fix in the copy, not to ship.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import type { Results } from "./analysis";
import { PAPER, renderPaper } from "./paper";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const buildDir = resolve(process.argv[2] ?? join(root, "paper/build"));
const outDir = resolve(process.argv[3] ?? join(root, "public/papers/data-before-rail"));
const issued = process.env.PAPER_ISSUED ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

const need = ["results.json", "marey.json", "trips.csv"].map((f) => join(buildDir, f));
for (const f of need) {
  if (!existsSync(f)) {
    console.error(`missing ${f} — run: npx tsx paper/src/analyze.ts`);
    process.exit(1);
  }
}
const results = JSON.parse(readFileSync(need[0]!, "utf8")) as Results;
const marey = JSON.parse(readFileSync(need[1]!, "utf8"));

function readCsv(path: string): Record<string, string>[] {
  const [head, ...rows] = readFileSync(path, "utf8").trim().split("\n");
  if (!head) return [];
  const cols = head.split(",");
  // The derived tables carry no quoted commas (dates, plates, route ids, numbers).
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i]!, v])));
}
const trips = readCsv(need[2]!).map((t) => ({ dir: t.dir!, minutes: Number(t.minutes), routeId: t.routeId! }));

// ── fonts, embedded ────────────────────────────────────────────────────────
const FONTS: { family: string; pkg: string; subsets: string[]; faces: [number, "normal" | "italic"][] }[] = [
  { family: "Source Serif 4", pkg: "source-serif-4", subsets: ["latin", "latin-ext"], faces: [[400, "normal"], [400, "italic"], [600, "normal"], [600, "italic"]] },
  { family: "Source Sans 3", pkg: "source-sans-3", subsets: ["latin", "latin-ext"], faces: [[400, "normal"], [400, "italic"], [600, "normal"], [600, "italic"]] },
  { family: "IBM Plex Sans Thai", pkg: "ibm-plex-sans-thai", subsets: ["thai", "latin"], faces: [[400, "normal"], [600, "normal"]] },
];
function unicodeRange(pkg: string, subset: string): string {
  const css = readFileSync(join(root, "node_modules/@fontsource", pkg, "400.css"), "utf8");
  const block = css.split("@font-face").find((b) => b.includes(`-${subset}-400-normal.woff2`));
  return block?.match(/unicode-range:\s*([^;]+);/)?.[1] ?? "U+0000-FFFF";
}
const fontCss = FONTS.flatMap((f) => f.subsets.flatMap((sub) => f.faces.map(([w, style]) => {
  const file = join(root, "node_modules/@fontsource", f.pkg, "files", `${f.pkg}-${sub}-${w}-${style}.woff2`);
  if (!existsSync(file)) return "";
  const b64 = readFileSync(file).toString("base64");
  return `@font-face{font-family:"${f.family}";font-style:${style};font-weight:${w};src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${unicodeRange(f.pkg, sub)};}`;
}))).join("\n");

// ── HTML → PDF ─────────────────────────────────────────────────────────────
const css = readFileSync(join(root, "paper/paper.css"), "utf8");
const html = renderPaper({ results, marey, trips, fontCss, css, issued });
mkdirSync(buildDir, { recursive: true });
writeFileSync(join(buildDir, "paper.html"), html);

const slug = `thiengburanathum-arkaraprasertkul-${issued.slice(0, 4)}-data-before-rail-${PAPER.version}`;
const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }));
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(async () => { await document.fonts.ready; });
const printed = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
await browser.close();

const doc = await PDFDocument.load(printed);
doc.setTitle(PAPER.title, { showInWindowTitleBar: true });
doc.setAuthor(PAPER.authors.map((a) => a.name).join("; "));
doc.setSubject("Preprint, not peer reviewed. An open-GPS audit of Phuket Smart Bus against its published timetable.");
doc.setKeywords(PAPER.keywords);
doc.setCreator("phuket-smart-bus paper build (paper/src/build.ts)");
doc.setProducer("Chromium + pdf-lib");
doc.setLanguage("en");
const when = new Date(`${issued}T12:00:00+07:00`);
doc.setCreationDate(when);
doc.setModificationDate(when);
const bytes = await doc.save();

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "pages"), { recursive: true });
mkdirSync(join(outDir, "data"), { recursive: true });
const pdfName = `${slug}.pdf`;
const pdfPath = join(outDir, pdfName);
writeFileSync(pdfPath, bytes);

// A fallback face is a glyph the paper's fonts do not have. Fail, and say which.
const fonts = execFileSync("pdffonts", [pdfPath], { encoding: "utf8" }).split("\n").slice(2).filter(Boolean).map((l) => l.split(/\s+/)[0]!);
const allowed = /SourceSerif4|SourceSans3|IBMPlexSansThai/i;
const stray = [...new Set(fonts.filter((f) => !allowed.test(f.replace(/^[A-Z]{6}\+/, ""))))];
if (stray.length) {
  console.error(`the PDF embeds fonts outside the paper's three: ${stray.join(", ")} — a character in the copy is missing from the subsets; find it in paper/build/paper.html`);
  process.exit(2);
}

// Page images for browsers that cannot show a PDF inline (most phones).
execFileSync("pdftoppm", ["-jpeg", "-jpegopt", "quality=84", "-scale-to-x", "1240", "-scale-to-y", "-1", pdfPath, join(outDir, "pages", "p")]);
const pages = readdirSync(join(outDir, "pages")).filter((f) => f.endsWith(".jpg")).sort();

const data = ["trips.csv", "departures.csv", "service-days.csv", "town-bus-days.csv"].filter((f) => existsSync(join(buildDir, f)));
for (const f of data) copyFileSync(join(buildDir, f), join(outDir, "data", f));

const plain = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const abstractParas = [...html.matchAll(/<section class="abstract">[\s\S]*?<\/section>/g)][0]?.[0].match(/<p>[\s\S]*?<\/p>/g)?.map(plain) ?? [];
const year = issued.slice(0, 4);
const manifest = {
  title: PAPER.title,
  version: PAPER.version,
  issued,
  status: "Preprint · not peer reviewed",
  authors: PAPER.authors.map((a) => ({ name: a.name, nameTh: a.nameTh, affiliations: a.affiliations })),
  affiliations: PAPER.affiliations,
  keywords: PAPER.keywords,
  abstract: abstractParas,
  record: { firstDay: results.record.firstDay, lastDay: results.record.lastDay, serviceDays: results.record.serviceDays, fixes: results.record.fixes },
  citation: `Thiengburanathum P, Arkaraprasertkul N. ${PAPER.title}. Preprint ${PAPER.version}. ${year} [issued ${issued}]. Available from: https://bus.nonarkara.org/toolkit#paper`,
  pdf: { file: pdfName, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), pages: pages.length },
  pages: pages.map((f) => `pages/${f}`),
  data: data.map((f) => ({ file: `data/${f}`, rows: Math.max(0, readFileSync(join(outDir, "data", f), "utf8").trim().split("\n").length - 1) })),
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`${pdfName}: ${pages.length} pages, ${(bytes.length / 1024).toFixed(0)} kB → ${outDir}`);
