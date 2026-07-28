import type { LocalizedText } from "./types.js";

export function localizedText(
  en: string,
  th: string,
  zh?: string,
  ko?: string,
  de?: string,
  fr?: string,
  es?: string
): LocalizedText {
  return {
    en,
    th,
    zh: zh ?? en,
    ko: ko ?? en,
    de: de ?? en,
    fr: fr ?? en,
    es: es ?? en
  };
}
