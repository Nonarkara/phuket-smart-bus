/**
 * ToolkitDocument — the primary source, in its own words.
 *
 * Every chapter on this site is a working translation of one real document:
 * "Transit Service Planning for Sustainable Tourism Travel — Insights from
 * Phuket and Las Vegas," published under the U.S.-ASEAN Smart Cities
 * Mobility Program. This section doesn't paraphrase it again — it shows the
 * toolkit's own structure, quotes it directly (short, attributed), lists
 * its own endnotes verbatim, and links the actual 23-page PDF. If a reader
 * only trusts primary sources, this is the page for them.
 */

const TOOLKIT_URL = `${import.meta.env.BASE_URL}toolkit-source.pdf`;

const CHAPTERS = [
  {
    n: "01",
    title: "Introduction",
    pages: "p.1–2",
    summary: "What the U.S.-ASEAN Smart Cities Mobility Program is, who ran it, and the five things every tourist city wants: less traffic, more safety, lower emissions, cheaper rides, and cheaper buses to run."
  },
  {
    n: "02",
    title: "Sustainable Tourism Travel: Defining the Problem",
    pages: "p.3–4",
    summary: "Why Phuket and Las Vegas are different problems, not the same problem twice — how visitors arrive, where they come from, who regulates the buses — laid out side by side in one table."
  },
  {
    n: "03",
    title: "Methods for Identifying, Understanding, and Engaging Stakeholders",
    pages: "p.5–12",
    summary: "The toolkit's actual method, step by step: find out who the stakeholders are, survey real travelers (with real Phuket prices), build rider personas, then run workshops that rank ideas by impact against effort."
  },
  {
    n: "04",
    title: "Results from a Case Study in Phuket, Thailand",
    pages: "p.12–19",
    summary: "What the Phuket case study found: who's in charge of what, a map of where riders actually go, eight rider personas, and fifteen recommendations ranked by how much they'd help versus how hard they'd be."
  },
  {
    n: "05",
    title: "Lessons Learned and Recommendations",
    pages: "p.18–21",
    summary: "What the research team would tell the next city: keep the stakeholder list open to changes, don't cut corners on the survey, and good teamwork alone won't save a bus service without real data on demand."
  }
];

const PULL_QUOTES = [
  {
    text: "Together, these partners examined how transit systems can better serve tourist-heavy corridors while maintaining accessibility, efficiency, and quality of service.",
    location: "Introduction, p.1"
  },
  {
    text: "In Phuket, the emergence of Phuket Smart Bus as a privately led initiative reflected unmet demand for higher-quality public transport that was not being addressed through conventional public-sector mechanisms.",
    location: "Lessons from Governance Roles, p.20"
  },
  {
    text: "Institutional collaboration alone is insufficient without adequate data and demand intelligence.",
    location: "Lessons Learned, p.21"
  }
];

const ENDNOTES = [
  {
    n: 1,
    text: "Alexander, L., Jiang, S., Murga, M., & González, M. C. (2015) “Origin–destination trips by purpose and time of day inferred from mobile phone data.” Transportation Research Part C: Emerging Technologies, 58, 240–250. Toole, J. L., Colak, S., Sturt, B., Alexander, L. P., Evsukoff, A., & González, M. C. (2015) “The path most traveled: Travel demand estimation using big data resources.” Transportation Research Part C: Emerging Technologies, 58, 162–177."
  },
  {
    n: 2,
    text: "See, e.g., M. Boarnet, “Land Use, Travel Behavior, and Disaggregate Travel Data,” in Geography of Urban Transportation, 4th ed., G. Giuliano and S. Hanson, Guilford Press, 2017; and M. Boarnet, “Longer View: A Broader Context for Land Use and Travel Behavior, and a Research Agenda,” Journal of the American Planning Association, vol. 77, no. 3, 2011, pp. 197–213; Pronello, C., & Camusso, C. (2011) “Users’ needs and attitudes towards sustainable urban mobility.” Transport Policy, 18(1), 60–65; Stopher, P. R., & Greaves, S. P. (2007) “Household travel surveys: Where are we going?” Transportation Research Part A, 41(5), 367–381."
  },
  {
    n: 3,
    text: "Airports of Thailand Public Company Limited (AOT). Annual Report 2024. Bangkok, Thailand, 2024; Airports of Thailand Public Company Limited (AOT). Annual Report 2025. Bangkok, Thailand, 2025."
  }
];

export function ToolkitDocument() {
  return (
    <section className="td-section" id="toolkit-document" aria-labelledby="toolkit-document-title">
      <header className="td-section__head">
        <p className="tk-kicker">Field notes · the primary source</p>
        <h2 id="toolkit-document-title">This whole site is a working translation of one 23-page PDF.</h2>
        <p className="td-section__standfirst">
          <em>Transit Service Planning for Sustainable Tourism Travel — Insights from Phuket and Las Vegas</em> is
          the real document: published under the U.S.-ASEAN Smart Cities Mobility Program, led by the U.S.
          Department of Transportation, researched with METRANS Transportation Consortium at USC and Chulalongkorn
          University's Transportation Institute. Every persona, every cost figure, every recommendation on this
          site traces back to it. This page shows its own structure, in its own words — read our version of it
          elsewhere on this site, or open the original below.
        </p>
        <div className="td-download">
          <a className="lp-btn lp-btn--primary" href={TOOLKIT_URL} download>
            Download the toolkit (PDF, 5.8 MB) <span>↓</span>
          </a>
          <span className="td-download__meta">23 pages · US-ASEAN Smart Cities Mobility Program · METRANS UPP, 2026</span>
        </div>
      </header>

      <div className="td-body">
        <figure className="td-cover">
          <img
            src={`${import.meta.env.BASE_URL}toolkit/toolkit-cover.jpg`}
            alt="Cover page of the printed toolkit: Transit Service Planning for Sustainable Tourism Travel — Insights from Phuket and Las Vegas"
            loading="lazy"
          />
          <figcaption>The actual cover, page 1 of 23.</figcaption>
        </figure>

        <div className="td-toc">
          <h3 className="td-subhead">What's actually in it</h3>
          <ol className="td-chapters">
            {CHAPTERS.map((c) => (
              <li key={c.n}>
                <span className="td-chapters__n">{c.n}</span>
                <div>
                  <strong>{c.title}</strong>
                  <small>{c.pages}</small>
                  <p>{c.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="td-quotes">
        <h3 className="td-subhead">In the toolkit's own words</h3>
        {PULL_QUOTES.map((q) => (
          <blockquote key={q.location}>
            <p>&ldquo;{q.text}&rdquo;</p>
            <cite>— {q.location}</cite>
          </blockquote>
        ))}
      </div>

      <div className="td-endnotes">
        <h3 className="td-subhead">Endnotes, as printed</h3>
        <p className="td-intro-note">
          The toolkit cites three sources directly. We cite far more (every fact on this site carries its own
          source), but these three are the toolkit's own bibliography — reproduced exactly, not summarised.
        </p>
        <ol className="td-endnotes__list">
          {ENDNOTES.map((e) => (
            <li key={e.n}>
              <span>{e.n}</span>
              <p>{e.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <p className="td-next">
        <span className="tk-kicker">A note on credit</span>
        The research, the survey design, the personas, the fifteen recommendations — that work belongs to the
        USASCP team, RTC Southern Nevada, Chulalongkorn University, and the Phuket stakeholders who sat through
        the workshops. This site is what happened after: turning a finished report into a system you can run.
        Both things can be true. Read the report. Then watch the bus move.
      </p>
    </section>
  );
}

export default ToolkitDocument;
