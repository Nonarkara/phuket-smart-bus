import type { ReactNode } from "react";

export type Citation = {
  text: string;
  meta: string;
  href: string;
};

export type Stat = {
  value: string;
  label: string;
  note?: string;
};

/**
 * A collapsible "Research & data" disclosure — the academic backbone under
 * the showcase's bold editorial voice. Native <details>/<summary>: no JS,
 * no dependency, works with Cmd-F and screen readers by default.
 *
 * Every citation must resolve to a real, checkable URL. If we can't find
 * one, the claim doesn't get a citation — it gets left as our own synthesis,
 * said plainly.
 */
export function ResearchPanel({
  title,
  stats,
  citations,
  children,
  defaultOpen
}: {
  title: string;
  stats?: Stat[];
  citations?: Citation[];
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="tk-research" open={defaultOpen}>
      <summary>
        <span className="tk-research__toggle" aria-hidden="true" />
        <span className="tk-kicker">Research &amp; data</span>
        <strong>{title}</strong>
      </summary>
      <div className="tk-research__body">
        {stats && stats.length > 0 && (
          <div className="tk-research__stats">
            {stats.map((s) => (
              <div key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
                {s.note && <small>{s.note}</small>}
              </div>
            ))}
          </div>
        )}
        {children && <div className="tk-research__figure">{children}</div>}
        {citations && citations.length > 0 && (
          <div className="tk-research__cites">
            <span className="tk-kicker">Cited</span>
            <ol>
              {citations.map((c) => (
                <li key={c.href}>
                  <a href={c.href} target="_blank" rel="noreferrer">
                    {c.text} <b>↗</b>
                  </a>
                  <small>{c.meta}</small>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </details>
  );
}
