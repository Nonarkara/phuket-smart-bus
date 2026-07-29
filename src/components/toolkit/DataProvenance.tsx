/**
 * DataProvenance — the academic-rigor footer.
 *
 * A small panel at the bottom of the research sections that shows when
 * each major data point was last verified against a public source.
 * The point is to let a careful reader (academic, lender, journalist)
 * check the freshness of every number in the page.
 *
 * Dates are conservative: "last verified" means a human pulled the source
 * and confirmed the figure. Where a number is updated by the simulation
 * (engine output), the "computed" date is the simulation's clock.
 */

type Claim = {
  number: string;
  figure: string;
  source: string;
  sourceHref: string;
  verified: string; // YYYY-MM-DD
  freshness: "Live" | "Annual" | "Quarterly";
};

const CLAIMS: Claim[] = [
  {
    number: "HKT passenger movements 2024",
    figure: "17,215,315 (10,573,403 international + 6,641,912 domestic)",
    source: "AOT 2024 Annual Report (Wikipedia · Phuket International Airport)",
    sourceHref: "https://en.wikipedia.org/wiki/Phuket_International_Airport",
    verified: "2026-07-15",
    freshness: "Annual"
  },
  {
    number: "HKT passenger movements 2025",
    figure: "17.4M (10M international + 6.6M domestic · 106,581 flights)",
    source: "The Thaiger / C9 Hotelworks (citing AOT 2025 monthly series)",
    sourceHref: "https://thethaiger.com/news/national/phuket-airport-sees-flight-and-passenger-surge-in-2025-recovery",
    verified: "2026-07-15",
    freshness: "Annual"
  },
  {
    number: "Top nationalities 2025",
    figure: "Russia 1,119,849 · India 621,063 · China 545,006 · Australia 274,330 · UK 257,607",
    source: "Phuket Immigration Office (reported via Phuket Notizie)",
    sourceHref: "https://www.facebook.com/groups/PhuketNotizie/posts/25835073792753949/",
    verified: "2026-07-15",
    freshness: "Annual"
  },
  {
    number: "Thailand road-death rate",
    figure: "25.4 per 100,000 (2021) · 18,218 deaths/year · 9th highest globally",
    source: "WHO Global Status Report on Road Safety 2023 (Thailand Country Office)",
    sourceHref: "https://www.who.int/thailand/our-work/road-safety",
    verified: "2026-07-15",
    freshness: "Annual"
  },
  {
    number: "Phuket road deaths 2025",
    figure: "114 deaths · 27,502 injuries (calendar year)",
    source: "ThaiRSC · reported by The Phuket News",
    sourceHref: "https://thethaiger.com/news/phuket/phuket-records-four-road-deaths-new-year-seven-days-of-danger",
    verified: "2026-07-15",
    freshness: "Annual"
  },
  {
    number: "Las Vegas Deuce ridership 2023",
    figure: "5,754,225 boardings (24-hr service · year-round)",
    source: "Wikipedia · The Deuce (transit bus service)",
    sourceHref: "https://en.wikipedia.org/wiki/The_Deuce_(transit_bus_service)",
    verified: "2026-07-15",
    freshness: "Annual"
  },
  {
    number: "Las Vegas Strip corridor profit 2008–2015",
    figure: "≈ US$6M/year profit (RTC's own reporting)",
    source: "The Nevada Independent · 22 Jul 2019",
    sourceHref: "https://thenevadaindependent.com/article/as-passenger-counts-dwindle-on-strip-buses-the-rtc-eyes-innovation-while-closely-monitoring-financials",
    verified: "2026-07-15",
    freshness: "Annual"
  },
  {
    number: "Bus-capture rate (engine)",
    figure: "≈ 5% fleet-wide weighted · SE Asia 7% · Europe 3% (heuristic table)",
    source: "This repository · engine/travelBehavior.ts",
    sourceHref: "https://github.com/Nonarkara/phuket-smart-bus/blob/main/src/engine/travelBehavior.ts",
    verified: "2026-07-15",
    freshness: "Live"
  },
  {
    number: "PKSB Airport Line timetable",
    figure: "≈ 25 departures/day · first 05:30 · last 23:30 · 95 min trip",
    source: "Phuket Smart Bus Co. (PKSB) · official schedule",
    sourceHref: "https://www.pkbsbus.com/",
    verified: "2026-07-15",
    freshness: "Live"
  },
  {
    number: "Monsoon rainfall (Phuket)",
    figure: "2,200 mm/year · 70% in May–Oct · Sep 349.7 mm 30-yr norm",
    source: "Thai Meteorological Department (TMD) 30-year normals",
    sourceHref: "https://www.thephuketnews.com/phuket-rainfall-hits-records-98341.php",
    verified: "2026-07-15",
    freshness: "Quarterly"
  },
  {
    number: "2004 Indian Ocean tsunami (Phuket)",
    figure: "279 dead · 1,111 injured · 620 missing",
    source: "Thailand Department of Disaster Prevention and Mitigation (DDPM), March 2005",
    sourceHref: "https://old.un.or.th/pdf/ddpm_tsunami.pdf",
    verified: "2026-07-15",
    freshness: "Annual"
  }
];

export function DataProvenance() {
  return (
    <section className="dp-section" aria-labelledby="dp-title">
      <header className="dp-section__head">
        <p className="tk-kicker">Source register · for the careful reader</p>
        <h2 id="dp-title">Every figure, where it came from, when it was last checked.</h2>
        <p>
          The numbers above are the load-bearing claims of the argument. This
          table shows the source for each, the verification date, and how
          often the figure is re-checked. "Live" means the simulation
          computes the number on every clock tick; "Annual" means a
          published yearly report; "Quarterly" means a regular
          public-data release.
        </p>
        <p className="dp-section__method">
          <strong>How to use this table.</strong> If a number looks
          wrong, find its row, follow the source link, and check
          whether the public figure has moved since the verification
          date. If it has, the change is usually the world moving
          faster than the research, not the research being wrong.
        </p>
      </header>
      <div className="dp-table-wrap" role="region" aria-label="Source register" tabIndex={0}>
        <table className="dp-table">
          <caption className="dp-table__caption">Source register · load-bearing numbers</caption>
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col">Value</th>
              <th scope="col">Source</th>
              <th scope="col">Last verified</th>
              <th scope="col">Cycle</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMS.map((c) => (
              <tr key={c.number}>
                <th scope="row">{c.number}</th>
                <td>{c.figure}</td>
                <td>
                  <a href={c.sourceHref} target="_blank" rel="noreferrer">
                    {c.source} <span aria-hidden="true">↗</span>
                  </a>
                </td>
                <td><time dateTime={c.verified}>{c.verified}</time></td>
                <td>
                  <span className={`dp-freshness dp-freshness--${c.freshness.toLowerCase()}`}>
                    {c.freshness}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dp-cite">
        <strong>How to cite this system.</strong>{" "}
        Arkaraprasertkul, N. <em>How to Build a Public Transit System: The Case of Phuket Smart Bus</em>,
        depa × USASCP, 2026.{" "}
        <a href="https://depa-usdot.nonarkara.org/">https://depa-usdot.nonarkara.org/</a>{" "}
        (accessed <time dateTime="2026-07-26">26 July 2026</time>). This is a citation for the working
        system, not a substitute for citing the research behind it — see{" "}
        <a href="#toolkit-document">the toolkit itself</a>, in Field Notes, for the original.
      </p>
    </section>
  );
}

export default DataProvenance;
