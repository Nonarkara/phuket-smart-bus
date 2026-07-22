import { useState } from "react";

const PROGRAM_URL = "https://www.usascp.org/programs/transportationprogram/";
const UPP_URL = "https://www.metrans.org/upp";

const MODE_LENS = [
  ["A", "Accessibility", "Can a first-time visitor find it, understand it and board it without borrowing local knowledge?"],
  ["B", "Budget", "Does the price make sense beside the taxi, rental car and all the costs people forget to count?"],
  ["C", "Comfort", "Air-con, luggage space, a clean seat and a driver you trust. Basic is not the same as optional."],
  ["D", "Duration", "Not merely fast: predictable. A known 95 minutes can beat an unknown 60."],
  ["E", "Experience", "The trip can be part of the holiday, not the administrative punishment before it."],
  ["F", "Freedom", "No parking hunt, rental deposit, fuel stop, damage argument or unfamiliar road in the rain."],
] as const;

const EXTENSIONS = [
  ["G", "Green", "Lower-carbon mobility matters—after the service has first earned people’s confidence."],
  ["H", "Hip", "A bus people want to be seen using has a demand advantage. Yes, image is transport policy too."],
] as const;

const PHASES = [
  {
    year: "2022",
    verb: "Meet",
    title: "Trust before templates",
    city: "Jakarta · foundation phase",
    summary: "City pairs met in person, compared systems and named the mobility problems worth staying in the room for.",
    detail: "Participant biographies, discussion guides and breakouts made a diplomatic initiative into a working network. The first output was not a report. It was enough trust to have a second conversation."
  },
  {
    year: "2023",
    verb: "Plan",
    title: "From introductions to workplans",
    city: "Los Angeles · consolidation phase",
    summary: "The programme shifted toward modal integration, pedestrian safety, public transit, ridership behaviour and implementable city-pair priorities.",
    detail: "Continuity mattered. Returning participants carried institutional memory from Jakarta, while U.S. agencies and operators gave the workplans something practical to push against."
  },
  {
    year: "2024",
    verb: "Test",
    title: "Research met local reality",
    city: "Phuket ↔ Las Vegas · Boston workshop",
    summary: "Phuket and Las Vegas chose tourism travel behaviour and mode choice, then worked through sampling, stakeholder engagement and research design.",
    detail: "The useful disagreement was methodological: surveys produce comparability, but fatigue and polite answers can hide motivation. Local partners pushed qualitative observation and lived experience back into the design."
  },
  {
    year: "2025",
    verb: "Sift",
    title: "Living documents, not dead files",
    city: "Distributed · consolidation phase",
    summary: "Shared repositories, datasets and workplans preserved the argument while findings were refined and toolkit drafting advanced.",
    detail: "This was the quiet year that makes the public year possible: checking assumptions, reconciling viewpoints and converting workshop memory into reusable method."
  },
  {
    year: "2026",
    verb: "Share",
    title: "Four toolkits leave the room",
    city: "METRANS · legacy phase",
    summary: "Four city-pair toolkits and a webinar series moved the programme from private collaboration into public professional infrastructure.",
    detail: "Phuket–Las Vegas became a guide to tourism-transit planning. This site takes the next step: it connects the guide to a system where assumptions can move, break and improve."
  }
] as const;

const LESSONS = [
  ["01", "Stay long enough", "Repeated contact created the trust needed for useful disagreement. One workshop can introduce people; it cannot produce institutional memory."],
  ["02", "Name the stubborn problem", "Peer learning became productive when each city pair stopped discussing ‘smart mobility’ in general and chose one shared problem."],
  ["03", "Mix the room", "Operators, regulators, universities, tourism businesses and civic organisations each hold a different piece of the same trip."],
  ["04", "Do not worship the survey", "A questionnaire can measure an answer without understanding it. Observation, interviews and operational data explain the why."],
  ["05", "Local knowledge is data", "Rules on hotel stops, informal services and institutional relationships change what is feasible. A generic best practice cannot see them."],
  ["06", "Co-design before the conclusion", "Stakeholders should shape the question, test the personas and rank the actions—not clap politely at the final slide."],
  ["07", "Universities are bridges", "They supplied method, continuity and the useful habit of documenting why a decision was made."],
  ["08", "Leave an instrument behind", "Toolkits and webinars extend memory. A working simulator goes further: it lets the next team challenge the assumptions directly."],
] as const;

const PEOPLE = [
  ["Roshan Desai", "Programme leadership", "U.S. Department of Transportation"],
  ["Stephanie Fischer", "Programme coordination", "U.S. Department of Transportation"],
  ["Anthony Jones", "Programme coordination", "U.S. Department of Transportation"],
  ["Joseph Traini", "Programme coordination", "U.S. Department of Transportation"],
  ["Prof. Marlon Boarnet", "Research and knowledge translation", "USC · METRANS Transportation Consortium"],
  ["Andre Comandon", "University Partnership Programme", "METRANS Transportation Consortium"],
  ["Dr. Non Arkaraprasertkul", "Phuket partnership and system translation", "Digital Economy Promotion Agency"],
  ["Ton Jaitong", "Colleague, capacity builder and friend", "Thailand · in memoriam"],
] as const;

const NETWORK = [
  ["City pairs", "Phuket ↔ Las Vegas · Jakarta ↔ Los Angeles · Johor Bahru ↔ Portland · Phnom Penh ↔ Boston"],
  ["Universities", "USC / METRANS · CSULB · Chulalongkorn University · Institute of Technology of Cambodia · Universitas Indonesia · Universiti Teknologi Malaysia"],
  ["Phuket delivery network", "depa · Phuket City Development · Department of Land Transport Phuket · Phuket Mahanakorn · Phuket PAO · FTI · Patong Hotel Association · Thai Hotels Association Southern Chapter"],
  ["U.S. public partners", "U.S. Department of Transportation · U.S. Department of State · RTC Southern Nevada · participating city transport and public-works teams"],
] as const;

type ArchiveTab = "journey" | "lessons" | "people";

function AbcdefFramework() {
  return (
    <section className="tk-section tk-abcdef" id="abcdef">
      <div className="tk-section__intro">
        <span className="tk-kicker">The project’s mode-choice framework</span>
        <h2>ABCDEF: six tests before anyone chooses your bus.</h2>
        <p>This is our practical lens—not a USDOT acronym and not a magic formula. Each letter turns a vague promise into a question a passenger can answer. G and H are useful extensions; they cannot rescue a service that fails A to F.</p>
      </div>
      <div className="tk-abcdef__flow" aria-label="ABCDEF mode-choice framework">
        {MODE_LENS.map(([letter, title, copy]) => (
          <article key={letter}>
            <span>{letter}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <div className="tk-abcdef__extensions">
        <div><span>First earn the trip</span><strong>A → B → C → D → E → F</strong><small>Service fundamentals</small></div>
        <div className="tk-abcdef__plus">+</div>
        {EXTENSIONS.map(([letter, title, copy]) => (
          <article key={letter}><span>{letter}</span><strong>{title}</strong><p>{copy}</p></article>
        ))}
      </div>
      <p className="tk-abcdef__caveat">This is a proposition map, not a causal estimate. The live system gives us somewhere to test which letters actually change search, boarding and repeat use.</p>
    </section>
  );
}

function ProgramArchive() {
  const [activeTab, setActiveTab] = useState<ArchiveTab>("journey");
  const tabs: { id: ArchiveTab; label: string }[] = [
    { id: "journey", label: "The journey" },
    { id: "lessons", label: "What changed" },
    { id: "people", label: "People + network" },
  ];

  return (
    <section className="tk-program" id="programme" aria-labelledby="programme-title">
      <header className="tk-program__header">
        <span className="tk-kicker">USASCP Sustainable Mobility Programme · 2022–2026</span>
        <h2 id="programme-title">Four years. Eight cities. One useful habit: keep going.</h2>
        <p>The public record gives the programme’s structure. This archive adds the view from inside the email chains, workshops and living documents—where continuity, disagreement and quiet follow-through turned introductions into practical tools.</p>
        <div className="tk-program__links">
          <a href={PROGRAM_URL}>Official programme record ↗</a>
          <a href={UPP_URL}>Four published toolkits ↗</a>
        </div>
      </header>

      <div className="tk-program__spine" aria-label="Programme phases from 2022 to 2026">
        {PHASES.map((phase, index) => (
          <div key={phase.year}>
            <span>{phase.year}</span><strong>{phase.verb}</strong><small>{index === PHASES.length - 1 ? "leave a legacy" : "then keep going"}</small>
          </div>
        ))}
      </div>

      <div className="tk-program__tabs" role="tablist" aria-label="Programme archive views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`programme-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`programme-panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
          >{tab.label}</button>
        ))}
      </div>

      {activeTab === "journey" && (
        <div className="tk-program__panel tk-program__timeline" id="programme-panel-journey" role="tabpanel" aria-labelledby="programme-tab-journey">
          {PHASES.map((phase) => (
            <article key={phase.year}>
              <div><span>{phase.year}</span><strong>{phase.verb}</strong></div>
              <div><small>{phase.city}</small><h3>{phase.title}</h3></div>
              <p>{phase.summary}</p>
              <p>{phase.detail}</p>
            </article>
          ))}
        </div>
      )}

      {activeTab === "lessons" && (
        <div className="tk-program__panel tk-program__lessons" id="programme-panel-lessons" role="tabpanel" aria-labelledby="programme-tab-lessons">
          {LESSONS.map(([number, title, copy]) => (
            <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
          ))}
        </div>
      )}

      {activeTab === "people" && (
        <div className="tk-program__panel tk-program__people" id="programme-panel-people" role="tabpanel" aria-labelledby="programme-tab-people">
          <div className="tk-program__people-intro"><span>Named programme stewards in the records available to this site</span><strong>Programmes are made by people who answer the next email.</strong></div>
          <div className="tk-program__roster">
            {PEOPLE.map(([name, role, organisation]) => (
              <article key={name}><h3>{name}</h3><p>{role}</p><small>{organisation}</small></article>
            ))}
          </div>
          <div className="tk-program__network">
            {NETWORK.map(([label, members]) => <div key={label}><strong>{label}</strong><p>{members}</p></div>)}
          </div>
        </div>
      )}
    </section>
  );
}

export { AbcdefFramework, ProgramArchive };
