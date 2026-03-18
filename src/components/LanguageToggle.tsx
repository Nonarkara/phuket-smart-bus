import type { Lang } from "@shared/types";

const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "th", label: "TH" },
  { code: "zh", label: "中" },
  { code: "de", label: "DE" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
];

type Props = {
  lang: Lang;
  onChange: (lang: Lang) => void;
};

export function LanguageToggle({ lang, onChange }: Props) {
  return (
    <div className="lang-toggle" aria-label="Language switch">
      {LANG_OPTIONS.map(({ code, label }) => (
        <button
          key={code}
          className={lang === code ? "lang-toggle__button is-active" : "lang-toggle__button"}
          onClick={() => onChange(code)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
