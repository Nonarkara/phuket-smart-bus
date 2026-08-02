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
 *   5. Field notes — one chronological chronicle (journey, toolkit, system, people) + sources
 */

import { useEffect, useState, type ReactNode } from "react";
import { LandingPage } from "./LandingPage";
import { PhuketContext } from "./PhuketContext";
import { PhuketBusSystems } from "./PhuketBusSystems";
import { VegasDemandCase } from "./VegasDemandCase";
import { ComparativeResearch } from "./ComparativeResearch";
import { FieldChronicle } from "./FieldChronicle";
import { LegalFramework } from "./LegalFramework";
import { FeasibilityStudy, DesignThinkingStudy, TryLiveSystem } from "./ToolkitStudy";
import { AbcdefFramework } from "./ProgramArchive";
import { ReferencesTab } from "./ReferencesTab";
import { LiveSystemTicker } from "./LiveSystemTicker";
import { DataProvenance } from "./DataProvenance";
import "./toolkit-showcase.css";
import "./toolkit-study.css";
import "./toolkit-hub.css";

const BUS_URL = "https://bus.nonarkara.org/";

const PARTNERS = ["Volpe Center", "USC", "Chulalongkorn University"];

type TabId = "overview" | "phuket" | "evidence" | "build" | "fieldnotes";

const TABS: { id: TabId; label: string; short: string; kicker: string }[] = [
  { id: "overview", label: "Overview", short: "Home", kicker: "The argument in 5 minutes" },
  { id: "phuket", label: "Phuket", short: "Phuket", kicker: "The island + the bus systems" },
  { id: "evidence", label: "Evidence", short: "Proof", kicker: "Vegas + global benchmarks" },
  { id: "build", label: "Build & Finance", short: "Build", kicker: "Method + prototype + deal" },
  { id: "fieldnotes", label: "Field Notes", short: "Notes", kicker: "People + history + sources" }
];

function getTabFromHash(): TabId {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace("#", "");
  const validTabs = TABS.map((t) => t.id);
  // Direct tab match
  if (validTabs.includes(hash as TabId)) return hash as TabId;
  // Section anchors that belong to specific tabs
  if (hash === "phuket" || hash === "bus-systems" || hash === "system-map") return "phuket";
  if (hash === "evidence" || hash === "comparative" || hash === "vegas-demand") return "evidence";
  if (hash === "build" || hash === "brief" || hash === "method" || hash === "proof" || hash === "pain-map" || hash === "abcdef" || hash === "feasibility" || hash === "legal" || hash === "deal" || hash === "finance") return "build";
  if (hash === "fieldnotes" || hash === "history" || hash === "programme" || hash === "field-notes" || hash === "references" || hash === "toolkit-document") return "fieldnotes";
  return "overview";
}

export default function ToolkitHub() {
  const [activeTab, setActiveTab] = useState<TabId>(() => getTabFromHash());

  useEffect(() => {
    document.documentElement.classList.add("toolkit-site-mode");
    document.body.classList.add("toolkit-site-mode");
    const oldTitle = document.title;
    document.title = "How to Build a Public Transit System · The Case of Phuket Smart Bus";
    return () => {
      document.documentElement.classList.remove("toolkit-site-mode");
      document.body.classList.remove("toolkit-site-mode");
      document.title = oldTitle;
    };
  }, []);

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
      {/* Skip-to-content for keyboard / screen-reader users */}
      <a className="hub-skip" href="#panel-overview">Skip to main content</a>

      {/* Top navigation — brand + tab bar */}
      <header className="hub-nav" role="banner">
        <div className="hub-nav__brand-row">
          <a className="hub-nav__brand" href="#overview" aria-label="Home" onClick={(e) => { e.preventDefault(); selectTab("overview"); }}>
            <span className="hub-nav__hosts" aria-label="Hosted by depa, Smart City Thailand Office and the U.S. Department of Transportation">
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
              <span className="hub-nav__hosts-rule" aria-hidden="true" />
              <img
                className="hub-nav__host-logo hub-nav__host-logo--usdot"
                src={`${import.meta.env.BASE_URL}brand/usdot.svg`}
                alt="U.S. Department of Transportation"
                width={80}
                height={80}
              />
            </span>
            <div className="hub-nav__title-group">
              <strong>How to Build a Public Transit System</strong>
              <small>The Case of Phuket Smart Bus</small>
              <span className="hub-nav__partners" aria-label="With Volpe Center, USC and Chulalongkorn University">
                {PARTNERS.map((p, i) => (
                  <span key={p}>
                    {i > 0 && <b aria-hidden="true">·</b>}
                    {p}
                  </span>
                ))}
              </span>
            </div>
          </a>
          <a className="hub-nav__live" href={BUS_URL}>Live system ↗</a>
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
        <TabContent tabId={activeTab} />
      </main>

      {/* Persistent live-system ticker (bottom-right) — keeps the research
          page tied to the actual running engine. */}
      <LiveSystemTicker />

      {/* Footer */}
      <footer className="hub-footer">
        <div className="hub-footer__inner">
          <p>
            <strong>The City Systems Toolkit</strong> · depa × USDOT learning journey · built in Phuket
          </p>
          <p>
            Research asks why. Building finds out.{" "}
            <a href={BUS_URL}>See what is already running <span>↗</span></a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function TabContent({ tabId }: { tabId: TabId }): ReactNode {
  switch (tabId) {
    case "overview":
      return <OverviewTab />;
    case "phuket":
      return <PhuketTab />;
    case "evidence":
      return <EvidenceTab />;
    case "build":
      return <BuildTab />;
    case "fieldnotes":
      return <FieldNotesTab />;
    default:
      return <OverviewTab />;
  }
}

/* ── OVERVIEW ─────────────────────────────────────────────────────────── */
function OverviewTab() {
  return (
    <>
      <LandingPage />
      <DataProvenance />
      <section className="hub-section hub-section--intro">
        <div className="hub-section__intro-pad">
          <p className="tk-kicker">Start here · use the tabs above to go deeper</p>
          <h2>This is a research hub, not a slide deck.</h2>
          <p>
            The overview is the five-minute argument. Four reading paths take it deeper: the island and its transport
            system; the evidence and comparisons; the method, prototype and deal; and the people and sources behind
            the work. Every number traces back to a source or a calculation.
          </p>
        </div>
        <nav className="hub-tab-nav" aria-label="Jump to section">
          <button onClick={() => window.location.hash = "phuket"}><span>01</span><strong>Phuket</strong><small>The island + bus systems</small></button>
          <button onClick={() => window.location.hash = "evidence"}><span>02</span><strong>Evidence</strong><small>Vegas + global benchmarks</small></button>
          <button onClick={() => window.location.hash = "build"}><span>03</span><strong>Build & Finance</strong><small>Method + prototype + deal</small></button>
          <button onClick={() => window.location.hash = "fieldnotes"}><span>04</span><strong>Field Notes</strong><small>People + history + sources</small></button>
        </nav>
      </section>
    </>
  );
}

/* ── PHUKET ──────────────────────────────────────────────────────────── */
function PhuketTab() {
  return (
    <>
      <PhuketContext />
      <PhuketBusSystems />
    </>
  );
}

/* ── COMPARATIVE ─────────────────────────────────────────────────────── */
function EvidenceTab() {
  return (
    <>
      <VegasDemandCase />
      <ComparativeResearch />
    </>
  );
}

/* ── METHOD ──────────────────────────────────────────────────────────── */
function BuildTab() {
  return (
    <>
      <section className="hub-section">
        <div className="hub-section__intro-pad">
          <p className="tk-kicker">Method · how findings become instruments</p>
          <h2>Observe → Frame → Trace → Build → Operate → Learn.</h2>
          <p>
            The toolkit's method is a loop, not a line. Each step produces evidence the next step uses. The
            sections below trace the full chain: from the pain map through personas, causal tests, the working
            system and the feasibility study.
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
function FieldNotesTab() {
  return (
    <>
      <FieldChronicle />
      <ReferencesTab />
    </>
  );
}
