import type { Advisory, Lang } from "@shared/types";
import { formatUpdateTime, pick, ui } from "@/lib/i18n";

type Props = {
  lang: Lang;
  advisories: Advisory[];
  emptyState: string;
};

export function AdvisoryStack({ lang, advisories, emptyState }: Props) {
  const severityLabel = {
    warning: pick(ui.advisoryWarning, lang),
    caution: pick(ui.advisoryCaution, lang),
    info: pick(ui.advisoryInfo, lang)
  } satisfies Record<Advisory["severity"], string>;

  if (advisories.length === 0) {
    return <div className="empty-card">{emptyState}</div>;
  }

  return (
    <div className="advisory-stack">
      {advisories.map((advisory) => (
        <article key={advisory.id} className={`advisory-card is-${advisory.severity}`}>
          <div className="advisory-card__meta">
            <span className={`advisory-badge is-${advisory.severity}`}>
              {severityLabel[advisory.severity]}
            </span>
            <span>{advisory.source}</span>
            <span>{formatUpdateTime(advisory.updatedAt, lang)}</span>
          </div>
          <h3>{pick(advisory.title, lang)}</h3>
          <p>{pick(advisory.message, lang)}</p>
          <strong>{pick(advisory.recommendation, lang)}</strong>
        </article>
      ))}
    </div>
  );
}
