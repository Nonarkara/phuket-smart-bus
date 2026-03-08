import type { DataSourceStatus, Lang } from "@shared/types";
import { pick, ui } from "@/lib/i18n";

type Props = {
  lang: Lang;
  sources: DataSourceStatus[];
};

export function SourcePills({ lang, sources }: Props) {
  const sourceLabels = {
    bus: pick(ui.sourceBus, lang),
    traffic: pick(ui.sourceTraffic, lang),
    weather: pick(ui.sourceWeather, lang)
  } satisfies Record<DataSourceStatus["source"], string>;

  return (
    <div className="source-pills">
      {sources.map((source) => (
        <div key={source.source} className={`source-pill is-${source.state}`}>
          <span className="source-pill__name">{sourceLabels[source.source]}</span>
          <span className="source-pill__detail">{pick(source.detail, lang)}</span>
        </div>
      ))}
    </div>
  );
}
