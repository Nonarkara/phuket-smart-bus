/**
 * PaperTab — the preprint, readable in place and downloadable.
 *
 * Everything on this tab comes from the manifest the paper's build writes
 * (paper/src/build.ts → public/papers/data-before-rail/manifest.json): the
 * title, the authors, the abstract, the record's span, the file sizes. The
 * tab never states a number the PDF does not, because it never states a
 * number of its own. The hub fetches and validates the manifest
 * (loadPaperManifest) and only offers this tab once it has one.
 *
 * The reader: a browser that can show a PDF inline (navigator.pdfViewerEnabled
 * — desktop Chrome, Edge, Firefox, Safari) gets the PDF itself in a frame;
 * one that cannot (most phones) gets the pages as images, each a link to its
 * full-size page. Either way the download is one tap away.
 *
 * Order: the record's head (title, authors, the download) first; then the
 * paper; then the abstract, the data and the citation. On a wide screen the
 * paper sits beside the record and stays in view; on a narrow one it comes
 * straight after the download, not three screens down.
 */
import { useRef, useState } from "react";

export const PAPER_DIR = `${import.meta.env.BASE_URL}papers/data-before-rail/`;

export type PaperManifest = {
  title: string;
  version: string;
  issued: string;
  status: string;
  authors: { name: string; nameTh?: string; affiliations: number[] }[];
  affiliations: { n: number; en: string; th?: string }[];
  keywords: string[];
  abstract: string[];
  record: { firstDay: string; lastDay: string; serviceDays: number; fixes: number };
  citation: string;
  pdf: { file: string; bytes: number; sha256: string; pages: number };
  pages: string[];
  data: { file: string; rows: number }[];
};

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A manifest is only shown if every field the tab reads is the right shape. */
export function isPaperManifest(m: unknown): m is PaperManifest {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  const pdf = x.pdf as Record<string, unknown> | undefined;
  const rec = x.record as Record<string, unknown> | undefined;
  return (
    isStr(x.title) && isStr(x.version) && isStr(x.issued) && isStr(x.status) && isStr(x.citation) &&
    Array.isArray(x.authors) && x.authors.every((a) => a && isStr(a.name) && Array.isArray(a.affiliations)) &&
    Array.isArray(x.affiliations) && x.affiliations.every((a) => a && isNum(a.n) && isStr(a.en)) &&
    Array.isArray(x.abstract) && x.abstract.every(isStr) &&
    !!rec && isStr(rec.firstDay) && isStr(rec.lastDay) && isNum(rec.serviceDays) && isNum(rec.fixes) &&
    !!pdf && isStr(pdf.file) && /^[\w.-]+\.pdf$/.test(pdf.file) && isNum(pdf.bytes) && isNum(pdf.pages) &&
    Array.isArray(x.pages) && x.pages.every((p) => isStr(p) && /^pages\/[\w.-]+\.jpg$/.test(p)) &&
    Array.isArray(x.data) && x.data.every((d) => d && isStr(d.file) && /^data\/[\w.-]+\.csv$/.test(d.file) && isNum(d.rows))
  );
}

/**
 * The manifest, or null if no paper is published. A missing file on this
 * host comes back as the app shell (HTML, 200 or 404), so only a JSON
 * response that validates counts.
 */
export async function loadPaperManifest(): Promise<PaperManifest | null> {
  try {
    const r = await fetch(`${PAPER_DIR}manifest.json`, { cache: "no-cache" });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null;
    const m: unknown = await r.json();
    return isPaperManifest(m) ? m : null;
  } catch {
    return null;
  }
}

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
const kB = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} kB`);
const DATA_LABEL: Record<string, string> = {
  "trips.csv": "Trips",
  "departures.csv": "Terminal departures",
  "service-days.csv": "Airport line, day by day",
  "town-bus-days.csv": "Town buses, bus by day",
};

function canShowPdf(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === true;
}

export function PaperTab({ manifest: m }: { manifest: PaperManifest }) {
  const [inline] = useState(canShowPdf);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "select">("idle");
  const citationRef = useRef<HTMLParagraphElement>(null);
  const pdfUrl = `${PAPER_DIR}${m.pdf.file}`;

  const cite = async () => {
    try {
      await navigator.clipboard.writeText(m.citation);
      setCopyState("copied");
    } catch {
      // No clipboard (an insecure context, a refused permission): select the
      // citation so the reader can copy it themselves, and say so.
      const el = citationRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopyState("select");
    }
    window.setTimeout(() => setCopyState("idle"), 4000);
  };

  return (
    <section className="paper" id="paper" aria-labelledby="paper-title">
      <div className="paper__head">
        <p className="tk-kicker">
          {m.status} · {m.version} · {longDate(m.issued)}
        </p>
        <h2 id="paper-title" className="paper__title">{m.title}</h2>
        <p className="paper__authors">
          {m.authors.map((a, i) => (
            <span key={a.name}>
              {i > 0 && ", "}
              {a.name}
              <sup>{a.affiliations.join(",")}</sup>
              {a.nameTh && <span lang="th"> ({a.nameTh})</span>}
            </span>
          ))}
        </p>
        <ol className="paper__affiliations">
          {m.affiliations.map((af) => (
            <li key={af.n}>
              <sup>{af.n}</sup>
              {af.en}
              {af.th && <> · <span lang="th">{af.th}</span></>}
            </li>
          ))}
        </ol>
        <div className="paper__actions">
          <a className="paper__download" href={pdfUrl} download={m.pdf.file}>
            Download the PDF
            <small>{m.pdf.pages} pages · {kB(m.pdf.bytes)}</small>
          </a>
          <button type="button" className="paper__cite" onClick={cite}>Copy the citation</button>
          <span className="paper__status" role="status">
            {copyState === "copied" ? "Citation copied." : copyState === "select" ? "Citation selected below — copy it from there." : ""}
          </span>
        </div>
      </div>

      <div className="paper__reader">
        {inline ? (
          <iframe className="paper__frame" src={`${pdfUrl}#navpanes=0&view=FitH`} title={`${m.title} (PDF)`} />
        ) : (
          <ol className="paper__pages" aria-label={`${m.title}, ${m.pdf.pages} pages`}>
            {m.pages.map((src, i) => (
              <li key={src}>
                <a href={`${PAPER_DIR}${src}`} aria-label={`Page ${i + 1} of ${m.pdf.pages}, full size`}>
                  <img src={`${PAPER_DIR}${src}`} alt={`Page ${i + 1} of ${m.pdf.pages}`} width={1240} height={1754} loading="lazy" decoding="async" />
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="paper__details">
        <h3 className="paper__label">Abstract</h3>
        <div className="paper__abstract">
          {m.abstract.map((p) => {
            // "Background. Phuket, …" → the structured-abstract label in bold.
            const label = /^(Background|Methods|Results|Conclusions)\.\s/.exec(p);
            return (
              <p key={p.slice(0, 24)}>
                {label ? <><b>{label[1]}.</b> {p.slice(label[0].length)}</> : p}
              </p>
            );
          })}
        </div>

        <h3 className="paper__label">The record</h3>
        <p className="paper__note">
          {m.record.fixes.toLocaleString("en-GB")} GPS fixes over {m.record.serviceDays} service days,{" "}
          {longDate(m.record.firstDay)} to {longDate(m.record.lastDay)}, from the operator’s public trackers.
          No modelled or simulated figure is attributed to a real bus.
        </p>
        <ul className="paper__data">
          {m.data.map((d) => {
            const name = d.file.split("/").pop()!;
            return (
              <li key={d.file}>
                <a href={`${PAPER_DIR}${d.file}`} download>
                  {DATA_LABEL[name] ?? name}
                </a>
                <span>{d.rows.toLocaleString("en-GB")} rows · CSV</span>
              </li>
            );
          })}
        </ul>

        <h3 className="paper__label">Cite as</h3>
        <p className="paper__note paper__citation" ref={citationRef}>{m.citation}</p>
      </div>
    </section>
  );
}
