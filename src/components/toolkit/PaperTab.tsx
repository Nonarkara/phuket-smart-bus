/**
 * PaperTab — the preprint, readable in place and downloadable.
 *
 * Everything on this tab comes from the manifest the paper's build writes
 * (paper/src/build.ts → public/papers/data-before-rail/manifest.json): the
 * title, the authors, the abstract, the record's span, the file sizes. The
 * tab never states a number the PDF does not, because it never states a
 * number of its own.
 *
 * The reader: a browser that can show a PDF inline (navigator.pdfViewerEnabled
 * — desktop Chrome, Edge, Firefox, Safari) gets the PDF itself in a frame;
 * one that cannot (most phones) gets the pages as images, which the build
 * renders from the same PDF. Either way the download is one tap away.
 */
import { useEffect, useState } from "react";

const DIR = `${import.meta.env.BASE_URL}papers/data-before-rail/`;

type Manifest = {
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

export function PaperTab() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [failed, setFailed] = useState(false);
  const [inline] = useState(canShowPdf);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${DIR}manifest.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: Manifest) => live && setManifest(m))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <section className="paper paper--empty" id="paper">
        <p className="tk-kicker">Preprint</p>
        <p className="paper__state">The paper could not be loaded. Try again in a moment.</p>
      </section>
    );
  }
  if (!manifest) {
    return (
      <section className="paper paper--empty" id="paper" aria-busy="true">
        <p className="tk-kicker">Preprint</p>
        <p className="paper__state">Loading the paper…</p>
      </section>
    );
  }

  const m = manifest;
  const pdfUrl = `${DIR}${m.pdf.file}`;
  const cite = async () => {
    try {
      await navigator.clipboard.writeText(m.citation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="paper" id="paper" aria-labelledby="paper-title">
      <div className="paper__record">
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
          <button type="button" className="paper__cite" onClick={cite} aria-live="polite">
            {copied ? "Citation copied" : "Copy the citation"}
          </button>
        </div>

        <h3 className="paper__head">Abstract</h3>
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

        <h3 className="paper__head">The record</h3>
        <p className="paper__note">
          {m.record.fixes.toLocaleString("en-GB")} GPS fixes over {m.record.serviceDays} service days,{" "}
          {longDate(m.record.firstDay)} to {longDate(m.record.lastDay)}, from the operator’s two public trackers.
          No modelled or simulated figure is attributed to a real bus.
        </p>
        <ul className="paper__data">
          {m.data.map((d) => {
            const name = d.file.split("/").pop()!;
            return (
              <li key={d.file}>
                <a href={`${DIR}${d.file}`} download>
                  {DATA_LABEL[name] ?? name}
                </a>
                <span>{d.rows.toLocaleString("en-GB")} rows · CSV</span>
              </li>
            );
          })}
        </ul>

        <h3 className="paper__head">Cite as</h3>
        <p className="paper__note paper__citation">{m.citation}</p>
      </div>

      <div className="paper__reader">
        {inline ? (
          <iframe className="paper__frame" src={`${pdfUrl}#view=FitH`} title={`${m.title} (PDF)`} />
        ) : (
          <ol className="paper__pages" aria-label={`${m.title}, ${m.pdf.pages} pages`}>
            {m.pages.map((src, i) => (
              <li key={src}>
                <img src={`${DIR}${src}`} alt={`Page ${i + 1} of ${m.pdf.pages}`} width={1240} height={1754} loading={i < 2 ? "eager" : "lazy"} decoding="async" />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
