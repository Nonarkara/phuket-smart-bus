/**
 * Toolkit i18n — language state, translation catalog, and helpers.
 *
 * The research hub uses its own catalog because the strings are dense
 * research prose, not tourist-app UI labels. Language state persists to
 * localStorage (key "pksb-toolkit-lang") so it carries across sessions.
 */

import { useState, useEffect, useCallback } from "react";
import type { Lang } from "@shared/types";

// ---------------------------------------------------------------------------
// Language state hook
// ---------------------------------------------------------------------------

const LANG_KEY = "pksb-toolkit-lang";
const SUPPORTED: Lang[] = ["en", "th", "zh", "ko"];

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";

  // URL param ?lang=th takes top priority
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get("lang");
  if (urlLang && SUPPORTED.includes(urlLang as Lang)) return urlLang as Lang;

  // Then localStorage
  try {
    const stored = window.localStorage?.getItem?.(LANG_KEY);
    if (stored && SUPPORTED.includes(stored as Lang)) return stored as Lang;
  } catch {
    // privacy mode / cross-origin
  }

  // Then browser locale
  const browserLang = typeof navigator !== "undefined" ? navigator.language?.substring(0, 2) : undefined;
  if (browserLang && SUPPORTED.includes(browserLang as Lang)) return browserLang as Lang;

  return "en";
}

export function useToolkitLang(): {
  lang: Lang;
  setLang: (lang: Lang) => void;
} {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage?.setItem?.(LANG_KEY, next);
    } catch {
      // best effort
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", next);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_KEY && e.newValue && SUPPORTED.includes(e.newValue as Lang)) {
        setLangState(e.newValue as Lang);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { lang, setLang };
}

// ---------------------------------------------------------------------------
// Translation helper — typed lookup
// ---------------------------------------------------------------------------

export function t(catalog: Record<string, Record<Lang, string>>, key: string, lang: Lang): string {
  const entry = catalog[key];
  if (!entry) return key; // graceful fallback during incremental migration
  return entry[lang] ?? entry.en;
}

// ---------------------------------------------------------------------------
// Language toggle options for the UI
// ---------------------------------------------------------------------------

export const TOOLKIT_LANG_OPTIONS: { code: Lang; label: string; nativeName: string }[] = [
  { code: "en", label: "EN", nativeName: "English" },
  { code: "th", label: "ไทย", nativeName: "ภาษาไทย" },
  { code: "zh", label: "中文", nativeName: "中文" },
  { code: "ko", label: "한국어", nativeName: "한국어" },
];