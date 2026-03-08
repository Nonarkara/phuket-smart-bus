import type { Lang } from "@shared/types";

type Props = {
  lang: Lang;
  onChange: (lang: Lang) => void;
};

export function LanguageToggle({ lang, onChange }: Props) {
  return (
    <div className="lang-toggle" aria-label="Language switch">
      <button
        className={lang === "en" ? "lang-toggle__button is-active" : "lang-toggle__button"}
        onClick={() => onChange("en")}
        type="button"
      >
        EN
      </button>
      <button
        className={lang === "th" ? "lang-toggle__button is-active" : "lang-toggle__button"}
        onClick={() => onChange("th")}
        type="button"
      >
        TH
      </button>
    </div>
  );
}
