/**
 * ToolkitHub — the tabbed research hub.
 *
 * A small number of reading paths keeps the research deep without turning
 * the page into a document archive. URL hashes remain deep-linkable.
 *
 * Tabs:
 *   1. Overview   — "How to Build a Public Transit System" (LandingPage + live proof + brief)
 *   2. Phuket     — island context + bus systems + regulatory landscape
 *   3. Evidence   — Vegas case + global benchmarks
 *   4. Build      — method + prototype + feasibility + law
 *   5. Field notes — collaboration history + sources
 */

import { useEffect, useState, type ReactNode } from "react";
import type { Lang } from "@shared/types";
import { LandingPage } from "./LandingPage";
import { PhuketContext } from "./PhuketContext";
import { PhuketBusSystems } from "./PhuketBusSystems";
import { VegasDemandCase } from "./VegasDemandCase";
import { ComparativeResearch } from "./ComparativeResearch";
import { CollaborationHistory } from "./CollaborationHistory";
import { LegalFramework } from "./LegalFramework";
import { FeasibilityStudy, DesignThinkingStudy, TryLiveSystem } from "./ToolkitStudy";
import { AbcdefFramework, ProgramArchive } from "./ProgramArchive";
import { ReferencesTab } from "./ReferencesTab";
import { useToolkitLang, TOOLKIT_LANG_OPTIONS } from "./i18n";
import { HUB } from "./translations";
import "./toolkit-showcase.css";
import "./toolkit-study.css";
import "./toolkit-hub.css";

const BUS_URL = "https://bus.nonarkara.org/";

type TabId = "overview" | "phuket" | "evidence" | "build" | "fieldnotes";

function getTabFromHash(): TabId {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace("#", "");
  const validTabs: TabId[] = ["overview", "phuket", "evidence", "build", "fieldnotes"];
  // Direct tab match
  if (validTabs.includes(hash as TabId)) return hash as TabId;
  // Section anchors that belong to specific tabs
  if (hash === "phuket" || hash === "bus-systems" || hash === "system-map") return "phuket";
  if (hash === "evidence" || hash === "comparative" || hash === "vegas-demand") return "evidence";
  if (hash === "build" || hash === "brief" || hash === "method" || hash === "proof" || hash === "pain-map" || hash === "abcdef" || hash === "feasibility" || hash === "legal" || hash === "deal" || hash === "finance") return "build";
  if (hash === "fieldnotes" || hash === "history" || hash === "programme" || hash === "field-notes" || hash === "references") return "fieldnotes";
  return "overview";
}

function tr(key: string, lang: Lang): string {
  return HUB[key]?.[lang] ?? HUB[key]?.en ?? key;
}

export default function ToolkitHub() {
  const [activeTab, setActiveTab] = useState<TabId>(() => getTabFromHash());
  const { lang, setLang } = useToolkitLang();

  const TABS: { id: TabId; label: string; short: string; kicker: string }[] = [
    { id: "overview", label: tr("tabOverview", lang), short: tr("tabOverviewShort", lang), kicker: tr("tabOverviewKicker", lang) },
    { id: "phuket", label: tr("tabPhuket", lang), short: tr("tabPhuketShort", lang), kicker: tr("tabPhuketKicker", lang) },
    { id: "evidence", label: tr("tabEvidence", lang), short: tr("tabEvidenceShort", lang), kicker: tr("tabEvidenceKicker", lang) },
    { id: "build", label: tr("tabBuild", lang), short: tr("tabBuildShort", lang), kicker: tr("tabBuildKicker", lang) },
    { id: "fieldnotes", label: tr("tabFieldNotes", lang), short: tr("tabFieldNotesShort", lang), kicker: tr("tabFieldNotesKicker", lang) }
  ];

  useEffect(() => {
    document.documentElement.classList.add("toolkit-site-mode");
    document.body.classList.add("toolkit-site-mode");
    const oldTitle = document.title;
    document.title = tr("docTitle", lang);
    return () => {
      document.documentElement.classList.remove("toolkit-site-mode");
      document.body.classList.remove("toolkit-site-mode");
      document.title = oldTitle;
    };
  }, [lang]);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash || hash === "overview") return;
    if (hash === activeTab) {
      const frame = requestAnimationFrame(() => window.scrollTo(0, 0));
      return () => cancelAnimationFrame(frame);
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  function selectTab(tabId: TabId) {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `#${tabId}`);
      window.scrollTo(0, 0);
    }
  }

  return (
    <div className="toolkit-site toolkit-hub">
      {/* Top navigation — brand + tab bar */}
      <header className="hub-nav" role="banner">
        <div className="hub-nav__brand-row">
          <a className="hub-nav__brand" href="#overview" aria-label={tr("homeAria", lang)} onClick={(e) => { e.preventDefault(); selectTab("overview"); }}>
            <span className="hub-nav__hosts" aria-label="Hosted by depa and Smart City Thailand Office">
              <img
                className="hub-nav__host-logo hub-nav__host-logo--depa"
                src={`${import.meta.env.BASE_URL}brand/depa.jpg`}
                alt="Digital Economy Promotion Agency (depa)"
                width={118}
                height={80}
              />
              <span className="hub-nav__hosts-rule" aria-hidden="true" />
              <img
                className="hub-nav__host-logo hub-nav__host-logo--sct"
                src={`${import.meta.env.BASE_URL}brand/smart-city-thailand.jpg`}
                alt="Smart City Thailand Office"
                width={80}
                height={80}
              />
            </span>
            <div className="hub-nav__title-group">
              <strong>{tr("brandTitle", lang)}</strong>
              <small>{tr("brandSubtitle", lang)}</small>
            </div>
          </a>
          <div className="hub-nav__actions">
            <div className="hub-nav__lang" role="group" aria-label="Language">
              {TOOLKIT_LANG_OPTIONS.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  className={`hub-lang-btn ${lang === code ? "is-active" : ""}`}
                  onClick={() => setLang(code)}
                >
                  {label}
                </button>
              ))}
            </div>
            <a className="hub-nav__live" href={BUS_URL}>{tr("liveSystemLink", lang)}</a>
          </div>
        </div>
        <nav className="hub-tabs" role="tablist" aria-label="Research sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={`hub-tab ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => selectTab(tab.id)}
            >
              <span className="hub-tab__label">{tab.label}</span>
              <span className="hub-tab__short">{tab.short}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Active panel */}
      <main
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="hub-panel"
      >
        <TabContent tabId={activeTab} lang={lang} />
      </main>

      {/* Footer */}
      <footer className="hub-footer">
        <div className="hub-footer__inner">
          <p>
            <strong>{tr("footerCredit", lang).split("·")[0]}</strong> · {tr("footerCredit", lang).split("·").slice(1).join("·")}
          </p>
          <p>
            {tr("footerTagline", lang)}{" "}
            <a href={BUS_URL}>{tr("footerSeeRunning", lang)} <span>↗</span></a>
          </p>
        </div>
      </footer>
    </div>
  );
}

  function TabContent({ tabId, lang }: { tabId: TabId; lang: Lang }): ReactNode {
  switch (tabId) {
    case "overview":
      return <OverviewTab lang={lang} />;
    case "phuket":
      return <PhuketTab lang={lang} />;
    case "evidence":
      return <EvidenceTab lang={lang} />;
    case "build":
      return <BuildTab lang={lang} />;
    case "fieldnotes":
      return <FieldNotesTab lang={lang} />;
    default:
      return <OverviewTab lang={lang} />;
  }
}

/* ── OVERVIEW ─────────────────────────────────────────────────────────── */
function OverviewTab({ lang }: { lang: Lang }) {
  return (
    <>
      <LandingPage lang={lang} />
      <section className="hub-section hub-section--intro">
        <div className="hub-section__intro-pad">
          <p className="tk-kicker">{tr("overviewKicker", lang)}</p>
          <h2>{tr("overviewTitle", lang)}</h2>
          <p>
            {tr("overviewBody", lang)}
          </p>
        </div>
        <nav className="hub-tab-nav" aria-label="Jump to section">
          <button onClick={() => window.location.hash = "phuket"}><span>01</span><strong>{tr("tabPhuket", lang)}</strong><small>{tr("navPhuketLabel", lang)}</small></button>
          <button onClick={() => window.location.hash = "evidence"}><span>02</span><strong>{tr("tabEvidence", lang)}</strong><small>{tr("navEvidenceLabel", lang)}</small></button>
          <button onClick={() => window.location.hash = "build"}><span>03</span><strong>{tr("tabBuild", lang)}</strong><small>{tr("navBuildLabel", lang)}</small></button>
          <button onClick={() => window.location.hash = "fieldnotes"}><span>04</span><strong>{tr("tabFieldNotes", lang)}</strong><small>{tr("navFieldNotesLabel", lang)}</small></button>
        </nav>
      </section>
    </>
  );
}

/* ── PHUKET ──────────────────────────────────────────────────────────── */
function PhuketTab({ lang }: { lang: Lang }) {
  return (
    <>
      <PhuketContext lang={lang} />
      <PhuketBusSystems lang={lang} />
    </>
  );
}

/* ── COMPARATIVE ─────────────────────────────────────────────────────── */
function EvidenceTab({ lang }: { lang: Lang }) {
  return (
    <>
      <VegasDemandCase lang={lang} />
      <ComparativeResearch lang={lang} />
    </>
  );
}

/* ── METHOD ──────────────────────────────────────────────────────────── */
function BuildTab({ lang }: { lang: Lang }) {
  return (
    <>
      <section className="hub-section">
        <div className="hub-section__intro-pad">
          <p className="tk-kicker">{tr("buildKicker", lang)}</p>
          <h2>{tr("buildTitle", lang)}</h2>
          <p>
            {tr("buildBody", lang)}
          </p>
        </div>
      </section>
      <DesignThinkingStudy />
      <AbcdefFramework />
      <TryLiveSystem busUrl={BUS_URL} />
      <FeasibilityStudy />
      <LegalFramework />
    </>
  );
}

/* ── HISTORY ─────────────────────────────────────────────────────────── */
function FieldNotesTab({ lang }: { lang: Lang }) {
  return (
    <>
      <CollaborationHistory lang={lang} />
      <ProgramArchive lang={lang} />
      <ReferencesTab lang={lang} />
    </>
  );
}
