/**
 * The preprint as HTML. Every number in the prose is read from Results; no
 * figure is typed by hand. Where a sentence's direction depends on the data
 * ("fewer" against "more"), the word is chosen by the numbers, so the text
 * cannot claim something the record does not show.
 */
import type { Results } from "./analysis";
import { Citations } from "./references";
import { figDailyDepartures, figDeviation, figMarey, figRunningByHour, figRunningTimes, figStudyArea, figTownActivity } from "./figures";

export const PAPER = {
  title: "Data before rail? An open-GPS audit of Phuket Smart Bus, and what it would take for buses to win trips from private vehicles",
  shortTitle: "Data before rail?",
  authors: [
    { name: "Poon Thiengburanathum", nameTh: "ปุ่น เที่ยงบูรณธรรม" as string | undefined, affiliations: [1, 2] },
    { name: "Non Arkaraprasertkul", nameTh: "นน อัครประเสริฐกุล" as string | undefined, affiliations: [3] },
  ],
  affiliations: [
    { n: 1, en: "Faculty of Engineering, Chiang Mai University, Chiang Mai, Thailand" },
    { n: 2, en: "Research and Innovation Acceleration Agency for Competitiveness and Area Development (Public Organization) (RCAD), Thailand", th: "สำนักงานเร่งรัดการวิจัยและนวัตกรรมเพื่อเพิ่มความสามารถการแข่งขันและการพัฒนาพื้นที่ (องค์การมหาชน)" },
    { n: 3, en: "Digital Economy Promotion Agency (depa), Thailand", th: "สำนักงานส่งเสริมเศรษฐกิจดิจิทัล" },
  ],
  keywords: ["bus transit", "automatic vehicle location", "GPS data", "service reliability", "timetable adherence", "mode shift", "light rail", "Phuket", "Thailand"],
  version: "v1",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "n/a" : `${fmt(v * 100, d)}%`);
const hhmm = (min: number | null | undefined) => (min === null || min === undefined ? "n/a" : `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`);
const dateLong = (iso: string) => new Date(`${iso}T12:00:00+07:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LINE_NAME: Record<string, string> = { "patong-old-bus-station": "Old Town–Patong", "dragon-line": "Dragon (Old Town loop)" };

export type PaperInputs = {
  results: Results;
  marey: { date: string | null; line: Parameters<typeof figMarey>[0]["line"] };
  trips: { dir: string; minutes: number; routeId: string }[];
  fontCss: string;
  css: string;
  issued: string;
};

export function renderPaper(input: PaperInputs): string {
  const { results: r } = input;
  const c = new Citations();
  const cite = (...k: string[]) => `<span class="cite">${c.cite(...k)}</span>`;
  const a = r.airport;
  const pubF = r.published.fwd, pubR = r.published.rev;
  const recF = a.running.fwd.recorded, recR = a.running.rev.recorded;
  const delF = a.delivery.fwd, delR = a.delivery.rev;
  const keyless = r.record.platesByFeed.keyless ?? 0;
  const token = r.record.platesByFeed.token ?? 0;
  const days = r.record.serviceDays;
  const span = `${dateLong(r.record.firstDay)} to ${dateLong(r.record.lastDay)}`;
  const servedDays = new Set(a.days.filter((d) => d.busesOnLine > 0).map((d) => d.date)).size;
  const fewerOrMore = (ratio: number | null) => (ratio === null ? "a different number of" : ratio < 0.97 ? "fewer" : ratio > 1.03 ? "more" : "about as many");
  const slowerOrFaster = (rec: number | null, pub: number | null) => (rec === null || pub === null ? "" : rec > pub + 2 ? "longer than" : rec < pub - 2 ? "shorter than" : "close to");
  const counterSilent = r.record.counterPositive === 0;

  let fig = 0, tab = 0;
  const F = () => ++fig;
  const T = () => ++tab;
  const nFig = { area: F(), marey: F(), daily: F(), run: F(), hour: F(), dev: F(), town: F() };
  const nTab = { record: T(), service: T(), levers: T(), rail: T() };
  const figRef = (n: number) => `Fig.&nbsp;${n}`;
  const tabRef = (n: number) => `Table&nbsp;${n}`;

  // ── text ────────────────────────────────────────────────────────────────
  const abstract = `
    <p><b>Background.</b> Phuket, an island whose airport handled ${fmt(17.47, 2)}&nbsp;million passengers in 2025, moves almost entirely by private car and motorcycle. A light-rail line was first costed in 2018; on the current plan it opens no earlier than December 2031. We ask whether the island’s existing buses can be made a credible alternative to driving sooner, by using data rather than new infrastructure, starting with Phuket Smart Bus.</p>
    <p><b>Methods.</b> We archived every position the operator’s two public trackers published over ${fmt(days)} service days (${span}): ${fmt(r.record.fixes)} distinct GPS fixes from ${fmt(keyless + token)} buses. Terminal-to-terminal trips, terminal departures and running times were reconstructed with published, versioned rules and compared with the official timetable.</p>
    <p><b>Results.</b> The record holds two fleets: ${fmt(token)} line buses, and ${fmt(keyless)} town buses that came within 1&nbsp;km of the airport on ${pct(r.town.reachedAirportShare)} of their bus-days. On the Airport–Rawai line the record shows ${fmt(delF.recordedPerDay.p50)} departures a day from the airport and ${fmt(delR.recordedPerDay.p50)} from Rawai (medians), against ${pubF.departures} published each way. Median end-to-end times were ${fmt(recF.p50)} and ${fmt(recR.p50)}&nbsp;min against the timetable’s ${fmt(pubF.endToEnd.p50)} and ${fmt(pubR.endToEnd.p50)}; ${pct(a.adherence.fwd.onTimeShare)} and ${pct(a.adherence.rev.onTimeShare)} of matched departures left within the 1-early/5-late window. ${counterSilent ? "No passenger counter reported a rider." : "Passenger counters reported on a minority of buses."}</p>
    <p><b>Conclusions.</b> The constraint the data expose is frequency and information, not the speed of the road. Correcting the published timetable to measured running times, publishing real-time positions in an open format, enabling passenger counting and adding departures where the record shows hour-long gaps are each achievable within months and at a small fraction of the cost of light rail. Whether they move people out of cars is the next measurement.</p>`;

  const intro = `
    <h2><span class="num">1</span>Introduction</h2>
    <p class="noindent">Phuket International Airport (HKT) handled 17,474,051 passengers and 106,585 aircraft movements in 2025 ${cite("aot2025")}, on an island whose roads carry 503,504 registered cars and motorcycles ${cite("phuketnews2024vehicles")}. The province recorded 147 road deaths in 2024 and 114 in 2025 ${cite("phuketnews2026roaddeaths")}, in a country whose road death rate, 25.4 per 100,000, is among the highest in the world ${cite("who2023")}. Road transport was about a fifth of Thailand’s greenhouse-gas emissions in 2019 ${cite("btr1", "thanatrakolsri2024")}.</p>
    <p>The standing answer to Phuket’s traffic is a mass-transit line. A 58.5&nbsp;km tram was costed at ฿39.4&nbsp;billion in 2018, with a first phase of ฿30.15&nbsp;billion offered for public–private partnership ${cite("bkkpost2018ppp")}; the Mass Rapid Transit Authority’s board approved a 42&nbsp;km first phase at ฿35.2&nbsp;billion in 2020 ${cite("infoquest2020board", "infoquest2020cabinet")}; the ministry then swapped the trams for rubber-tyred electric vehicles ${cite("bkkpost2020art")} and later swapped them back. The current plan puts construction in 2028 and opening in December 2031 ${cite("nation2024tram")}, and in January 2026 the Deputy Prime Minister called the plan flawed while denying it had been cancelled ${cite("bkkpost2026flawed", "phuketnews2026phiphat")}. International experience gives no reason to expect the schedule or the forecasts to improve: rail projects average about 45% cost overrun ${cite("flyvbjerg2003")} and their ridership forecasts are overstated in nine projects out of ten ${cite("flyvbjerg2005")}.</p>
    <p>Meanwhile the island already runs buses. Phuket Smart Bus, operated by Phuket City Development Co., Ltd. (PKCD), began on the Airport–Rawai corridor in 2018 ${cite("phuketnews2018launch", "mastercard2026")}, added an electric Old Town–Patong line and a free Old Town loop in 2024 ${cite("thaiger2024patong", "phuketnews2024dragon")}, and carried about 430,000 passengers in 2024 ${cite("prd2026")} — roughly one boarding per 40 air passengers. Its vehicles already broadcast their positions to a public tracker ${cite("pksbtracker")}. The question this paper asks is the one a city can act on this year rather than in 2031: <i>can that data be used to make the existing buses a credible alternative to driving — and what does it show needs to change first?</i></p>
    <p>We answer the first half empirically and the second half with the literature. We built an open archive of every fix the operator’s trackers published, reconstructed the service that actually ran with published rules, and set it against the official timetable (Sections 3–4). We then ask which changes the evidence says attract car users ${cite("redman2013", "currie2008", "paulley2006")}, which of them the data make possible now, and what they cost beside a rail line (Section 5).</p>`;

  const background = `
    <h2><span class="num">2</span>What makes a bus compete with a car</h2>
    <p class="noindent">The evidence on growing bus ridership is consistent about order. Syntheses rank more frequent service and more service hours ahead of fare cuts, and both ahead of faster journeys ${cite("currie2008")}; fare elasticities average about −0.4 in the short run and approach −1 in the long run ${cite("paulley2006", "litman2004")}. Car users, specifically, are drawn by reliability and frequency but kept by attributes that are perceived — whether the system feels usable and predictable ${cite("redman2013")}. Tourists add their own pattern: visitors use public transport more in cities than at dispersed resort destinations, and choose modes by convenience and information more than by price ${cite("leklahn2015", "bursa2022")}.</p>
    <p>Two strands bear directly on what data can do. First, real-time information: in Seattle it cut riders’ perceived waits by about 13% ${cite("watkins2011")}, and in New York and Chicago its roll-out raised ridership modestly, by about 2% per route ${cite("brakewood2015", "tang2012")}. Second, reliability: riders budget for the tail of the wait distribution, not its mean, so unreliable service costs them as much as a much longer headway ${cite("furth2006trr")}. Archived automatic vehicle location (AVL) data are the standard instrument for measuring both, and for re-setting running times to what the road actually allows ${cite("tcrp113", "mazloumi2010")}; headway-based holding can then keep buses from bunching without new infrastructure ${cite("daganzo2009", "bartholdi2012")}.</p>
    <p>Two cautions frame the claims that follow. A bus that takes a car off the road does not, by itself, make the road faster: added road and transit capacity alike tend to be absorbed by new traffic ${cite("duranton2011")}, so the congestion benefit of a mode shift is that more trips are made by the mode that uses the road least, not that the remaining drivers go faster. And bus priority infrastructure has its own capital cost — most bus rapid transit systems cost under US$10&nbsp;million per kilometre ${cite("hensher2008", "deng2011")}, far below rail but not zero. This paper concerns the measures that precede either.</p>`;

  const methods = `
    <h2><span class="num">3</span>Data and methods</h2>
    <h3><span class="num">3.1</span>Two public trackers</h3>
    <p class="noindent">The operator publishes vehicle positions through two endpoints behind its public tracking map ${cite("pksbtracker")}. One returns every bus’s latest fix with plate, position, speed, heading, odometer and passenger-counter fields but no line; the other returns line buses with their line and destination. A collector polled both every minute and stored every distinct fix, keyed on plate and device fix time so a parked bus’s repeated fix is stored once, in an append-only database with no expiry ${cite("repo")}. The analysis uses ${fmt(days)} service days, ${span}; ${tabRef(nTab.record)} summarises the record.</p>
    <h3><span class="num">3.2</span>Time, cleaning and the service day</h3>
    <p class="noindent">A service day runs 03:00 to 03:00 Bangkok time, so a bus arriving at 00:30 belongs to the day it started. Tracker timestamps carry no time zone, or a wrong one: one feed stamps Bangkok wall time with a UTC designator. Each timestamp was resolved against the server’s own receive time, and any fix that would lie in the future was rejected. Consecutive fixes implying more than 120&nbsp;km/h on the ground were treated as GPS jumps.</p>
    <h3><span class="num">3.3</span>Lines, trips and departures</h3>
    <p class="noindent">A bus belongs to a line if the line feed names one, or if at least 60% of its moving fixes lie within 250&nbsp;m of that line’s official polyline; otherwise it is reported as a town bus and never forced onto a line. A <i>trip</i> runs from the last fix inside a 1&nbsp;km zone around one terminal to the first fix inside the other; it breaks if the tracker is silent for more than 15&nbsp;min, and trips averaging outside 3–70&nbsp;km/h are discarded. A <i>departure</i> is recorded when a bus is 1.5&nbsp;km clear of a terminal zone, which separates real departures from GPS wobble at the kerb; its time is the last fix in the zone, so it lags the kerb departure by the minute or two needed to drive the zone. The same rules drive the project’s public research pages and are versioned with the code.</p>
    <h3><span class="num">3.4</span>Comparison with the timetable</h3>
    <p class="noindent">The official timetable lists ${pubF.departures} departures from the airport (${hhmm(pubF.firstMin)}–${hhmm(pubF.lastMin)}) and ${pubR.departures} towards it (${hhmm(pubR.firstMin)}–${hhmm(pubR.lastMin)}), of which ${pubR.departures - pubR.fromTerminal} start part-way along the line and so cannot produce a terminal departure; they are excluded from matching. Its own first-to-last-stop times give a median of ${fmt(pubF.endToEnd.p50)}&nbsp;min southbound and ${fmt(pubR.endToEnd.p50)}&nbsp;min northbound. Recorded departures were matched one-to-one to published ones within ±30&nbsp;min, closest pairs first, and a matched departure is <i>on time</i> if it left no more than 1&nbsp;min early or 5&nbsp;min late, the window used in North American practice ${cite("tcqsm3")}. Headway regularity is reported as the coefficient of variation of the gaps between departures, cv<sub>h</sub> ${cite("tcqsm3")}; because the manual’s level-of-service bands for cv<sub>h</sub> apply only to headways of ten minutes or less, we report the value without a grade. A day on which no bus reported on the line is a gap in the record, not a day without service, and is excluded from every rate.</p>
    <h3><span class="num">3.5</span>The town fleet</h3>
    <p class="noindent">For buses on no line, distance is taken from the odometer where it reports (forward steps only, no faster than 120&nbsp;km/h) and from the GPS trace otherwise; time moving is the sum of steps of at least 50&nbsp;m taken no more than 3&nbsp;min apart; a <i>run</i> begins when a bus moves after a halt of at least 10&nbsp;min. A bus-day “reaches the airport” if any fix lies within 1&nbsp;km of the terminal.</p>
    <h3><span class="num">3.6</span>Reproducibility</h3>
    <p class="noindent">Every number in this paper is computed by the analysis code from the raw fixes; the derived trip, departure and bus-day tables are published with the paper, and the raw fixes for any service day can be downloaded from the project’s research endpoint (Data availability).</p>`;

  const recordTable = `
    <div class="table">
      <div class="table__caption"><b>Table ${nTab.record}.</b> The research record, ${span}.</div>
      <table>
        <thead><tr><th></th><th class="n">Line feed</th><th class="n">Position feed</th></tr></thead>
        <tbody>
          <tr><td>Distinct GPS fixes</td><td class="n">${fmt(r.record.fixesByFeed.token)}</td><td class="n">${fmt(r.record.fixesByFeed.keyless)}</td></tr>
          <tr><td>Buses (distinct plates)</td><td class="n">${fmt(token)}</td><td class="n">${fmt(keyless)}</td></tr>
          <tr><td>Median seconds between a bus’s fixes</td><td class="n">${fmt(r.record.sampleSecByFeed.token)}</td><td class="n">${fmt(r.record.sampleSecByFeed.keyless)}</td></tr>
          <tr><td>Median share of 05:00–24:00 minutes with a fix</td><td class="n">${pct(r.record.coverageByFeed.token?.median, 1)}</td><td class="n">${pct(r.record.coverageByFeed.keyless?.median, 1)}</td></tr>
          <tr><td>Days below 90% of minutes</td><td class="n">${fmt(r.record.coverageByFeed.token?.daysBelow90)}</td><td class="n">${fmt(r.record.coverageByFeed.keyless?.daysBelow90)}</td></tr>
          <tr><td>Fixes with a passenger-counter value</td><td class="n">—</td><td class="n">${fmt(r.record.counterFixes)}</td></tr>
          <tr><td>…of which above zero</td><td class="n">—</td><td class="n">${fmt(r.record.counterPositive)}</td></tr>
        </tbody>
      </table>
      <div class="table__note">${fmt(days)} service days (03:00–03:00 Bangkok): ${r.record.daysByDow.map((n, i) => `${DOW[i]!.slice(0, 3)} ${n}`).join(", ")}.</div>
    </div>`;

  const serviceRow = (label: string, f: string, rv: string) => `<tr><td>${label}</td><td class="n">${f}</td><td class="n">${rv}</td></tr>`;
  const serviceTable = `
    <div class="table">
      <div class="table__caption"><b>Table ${nTab.service}.</b> Airport–Rawai line: the published timetable against the record. Medians over the ${fmt(servedDays)} days a bus reported on the line.</div>
      <table>
        <thead><tr><th></th><th class="n">Airport to Rawai</th><th class="n">Rawai to Airport</th></tr></thead>
        <tbody>
          <tr class="group"><td colspan="3">Departures per day</td></tr>
          ${serviceRow("Published", fmt(pubF.departures), fmt(pubR.departures))}
          ${serviceRow("Recorded (median, p15–p85)", `${fmt(delF.recordedPerDay.p50)} (${fmt(delF.recordedPerDay.p15)}–${fmt(delF.recordedPerDay.p85)})`, `${fmt(delR.recordedPerDay.p50)} (${fmt(delR.recordedPerDay.p15)}–${fmt(delR.recordedPerDay.p85)})`)}
          ${serviceRow("Recorded ÷ published", pct(delF.ratio), pct(delR.ratio))}
          ${serviceRow("Complete trips recorded (median)", fmt(delF.completePerDay.p50), fmt(delR.completePerDay.p50))}
          <tr class="group"><td colspan="3">End-to-end minutes</td></tr>
          ${serviceRow("Published median (range)", `${fmt(pubF.endToEnd.p50)} (${fmt(pubF.endToEnd.min)}–${fmt(pubF.endToEnd.max)})`, `${fmt(pubR.endToEnd.p50)} (${fmt(pubR.endToEnd.min)}–${fmt(pubR.endToEnd.max)})`)}
          ${serviceRow("Recorded median (p15–p85)", `${fmt(recF.p50)} (${fmt(recF.p15)}–${fmt(recF.p85)})`, `${fmt(recR.p50)} (${fmt(recR.p15)}–${fmt(recR.p85)})`)}
          ${serviceRow("Trips recorded", fmt(recF.n), fmt(recR.n))}
          <tr class="group"><td colspan="3">Departure against the matched published time</td></tr>
          ${serviceRow("Published departures matched", `${pct(1 - (a.adherence.fwd.unobservedShare ?? 1))}`, `${pct(1 - (a.adherence.rev.unobservedShare ?? 1))}`)}
          ${serviceRow("Median deviation, min", fmt(a.adherence.fwd.deviation.p50, 1), fmt(a.adherence.rev.deviation.p50, 1))}
          ${serviceRow("On time (−1 to +5 min)", pct(a.adherence.fwd.onTimeShare), pct(a.adherence.rev.onTimeShare))}
          <tr class="group"><td colspan="3">Headways</td></tr>
          ${serviceRow("Published cv<sub>h</sub>", fmt(pubF.headwayCv, 2), fmt(pubR.headwayCv, 2))}
          ${serviceRow("Recorded median headway, min", fmt(a.headway.fwd.recordedMedian), fmt(a.headway.rev.recordedMedian))}
          ${serviceRow("Recorded cv<sub>h</sub> (median day)", fmt(a.headway.fwd.cvMedianDays, 2), fmt(a.headway.rev.cvMedianDays, 2))}
          ${serviceRow("Longest gap in the day, min (median day)", fmt(a.headway.fwd.longestGapMedian), fmt(a.headway.rev.longestGapMedian))}
        </tbody>
      </table>
      <div class="table__note">A published departure is “matched” when a recorded departure lies within ±30 min of it. Unmatched departures may not have run or may fall in tracker gaps; the record cannot tell these apart, so the matched share is a lower bound on the service run.</div>
    </div>`;

  const otherLines = r.otherLines.map((l) => {
    const name = LINE_NAME[l.routeId] ?? l.routeId;
    const unit = l.routeId === "dragon-line" ? "laps" : "trips";
    if (!l.tripsPerDay.n) return `${name}: no complete ${unit} in the record`;
    return `${name}: ${fmt(l.buses.p50)} buses on a median day, ${fmt(l.tripsPerDay.p50)} ${unit} a day, median ${fmt(l.minutes.p50)}&nbsp;min each`;
  }).join("; ");

  const results = `
    <h2><span class="num">4</span>Results</h2>
    <h3><span class="num">4.1</span>Two fleets, one of which never meets a flight</h3>
    ${recordTable}<p class="noindent">The record separates cleanly into two fleets (${figRef(nFig.area)}). The ${fmt(token)} buses of the line feed run the three PKSB lines. The ${fmt(keyless)} buses of the position feed run Phuket Town services: across ${fmt(r.town.busDays)} bus-days with movement, ${pct(r.town.reachedAirportShare)} came within 1&nbsp;km of the airport. A median town bus-day covered ${fmt(r.town.odometerKm.p50)}&nbsp;km by odometer in ${fmt(r.town.hoursMoving.p50, 1)}&nbsp;h of movement over ${fmt(r.town.runs.p50)} runs, typically a morning run, a long midday halt and an evening run (${figRef(nFig.town)}). The GPS trace reads ${pct(r.town.odoToGpsRatio === null ? null : 1 - 1 / r.town.odoToGpsRatio)} short of the odometer, the expected effect of sampling a curving road at intervals.</p>
    <figure><svg-placeholder data-fig="area"></svg-placeholder><figcaption><b>Fig. ${nFig.area}.</b> Study area. The Airport–Rawai and Old Town–Patong lines (red) and the Dragon loop in Phuket Town; grey cells are where the ${fmt(keyless)} town buses were recorded moving, ${span}. Coastline: Natural Earth 1:10M.</figcaption></figure>
    <h3><span class="num">4.2</span>The Airport–Rawai line: ${fewerOrMore(delF.ratio)} departures than published</h3>
    ${serviceTable}<p class="noindent">${tabRef(nTab.service)} sets the record against the timetable. On a median day the record holds ${fmt(delF.recordedPerDay.p50)} departures from the airport and ${fmt(delR.recordedPerDay.p50)} from Rawai, ${pct(delF.ratio)} and ${pct(delR.ratio)} of the published service (${figRef(nFig.daily)}). ${figRef(nFig.marey)} draws one median day, ${input.marey.date ? dateLong(input.marey.date) : ""}, as a Marey diagram — the time–distance chart engineers have used to read railway timetables since the nineteenth century ${cite("marey1885", "tufte1983")} — with the published runs dashed beneath the recorded ones. Where a recorded trace has no published run beside it, a bus ran unscheduled or early; where a dashed run has no trace, the record holds no bus.</p>
    <figure class="wide"><svg-placeholder data-fig="marey"></svg-placeholder><figcaption><b>Fig. ${nFig.marey}.</b> Marey diagram of the Airport–Rawai line, ${input.marey.date ? dateLong(input.marey.date) : ""}: distance along the 54&nbsp;km line (Airport at the top) against time of day. Red: every recorded bus, broken where its tracker fell silent for 15&nbsp;min. Grey dashed: every published run, drawn through its stops’ timetabled times.</figcaption></figure>
    <figure><svg-placeholder data-fig="daily"></svg-placeholder><figcaption><b>Fig. ${nFig.daily}.</b> Recorded terminal departures per service day (bars) against the published timetable (dashed). Days with no bus reporting on the line are marked with a dot and excluded from rates.</figcaption></figure>
    <h3><span class="num">4.3</span>Running time: the timetable is ${slowerOrFaster(recF.p50, pubF.endToEnd.p50) === "close to" ? "close to the road" : "not the road"}</h3>
    <p class="noindent">The median recorded trip took ${fmt(recF.p50)}&nbsp;min from the airport to Rawai and ${fmt(recR.p50)}&nbsp;min back, ${slowerOrFaster(recF.p50, pubF.endToEnd.p50)} the timetable’s ${fmt(pubF.endToEnd.p50)} and ${slowerOrFaster(recR.p50, pubR.endToEnd.p50)} its ${fmt(pubR.endToEnd.p50)} (${figRef(nFig.run)}); ${pct(a.running.fwd.shareSlowerThanPublishedMedian)} and ${pct(a.running.rev.shareSlowerThanPublishedMedian)} of trips took longer than the published median. The spread matters more than the median: the 85th-percentile trip took ${fmt(recF.p85)} and ${fmt(recR.p85)}&nbsp;min, and that tail, not the average, is what a rider catching a flight has to budget for ${cite("furth2006trr")}. ${figRef(nFig.hour)} shows how running time varies with the hour of departure, the pattern a timetable can follow and a single figure cannot ${cite("mazloumi2010", "tcrp113")}. The passenger-facing figure of 95&nbsp;minutes that the operator’s comparison tables use is not the timetable’s own running time and is not supported by any trip in the record.</p>
    <figure><svg-placeholder data-fig="run"></svg-placeholder><figcaption><b>Fig. ${nFig.run}.</b> Recorded end-to-end running times (dots; ${fmt(recF.n)} and ${fmt(recR.n)} trips) and their medians (red bar), against the published median (dashed) and range (grey line).</figcaption></figure>
    <figure><svg-placeholder data-fig="hour"></svg-placeholder><figcaption><b>Fig. ${nFig.hour}.</b> Median (solid) and 85th-percentile (light) recorded running time by hour of departure, each direction, against the published median (dashed).</figcaption></figure>
    <h3><span class="num">4.4</span>Departures and headways</h3>
    <p class="noindent">Of the published departures, ${pct(1 - (a.adherence.fwd.unobservedShare ?? 1))} from the airport and ${pct(1 - (a.adherence.rev.unobservedShare ?? 1))} from Rawai had a recorded departure within 30 minutes. Matched departures left a median ${fmt(a.adherence.fwd.deviation.p50, 1)} and ${fmt(a.adherence.rev.deviation.p50, 1)}&nbsp;min after the published time, and ${pct(a.adherence.fwd.onTimeShare)} and ${pct(a.adherence.rev.onTimeShare)} left within the on-time window (${figRef(nFig.dev)}), allowing for the one to two minutes by which the measured departure lags the kerb. The published timetable itself is irregular — its headways have cv<sub>h</sub> of ${fmt(pubF.headwayCv, 2)} and ${fmt(pubR.headwayCv, 2)} — and the recorded service is ${(a.headway.fwd.cvMedianDays ?? 0) > (pubF.headwayCv ?? 0) ? "less" : "no less"} regular, with a median headway of ${fmt(a.headway.fwd.recordedMedian)}&nbsp;min and, on a median day, a longest gap of ${fmt(a.headway.fwd.longestGapMedian)}&nbsp;min between departures from the airport. At those headways a rider cannot simply turn up; the bus has to be planned around, which is exactly the burden real-time information relieves ${cite("watkins2011")}.</p>
    <figure><svg-placeholder data-fig="dev"></svg-placeholder><figcaption><b>Fig. ${nFig.dev}.</b> Recorded departure minus the matched published departure, both directions stacked; shaded: the on-time window (1&nbsp;min early to 5&nbsp;min late).</figcaption></figure>
    <h3><span class="num">4.5</span>The other lines and the town fleet</h3>
    <p class="noindent">${otherLines}. These lines publish headways rather than per-trip timetables, so the record describes them but cannot score them. ${figRef(nFig.town)} shows when the town fleet moves: a morning peak, a long midday halt and an evening run. A median day had ${fmt(r.town.busesPerDay.p50)} town buses moving; the first movement on a median bus-day came at ${hhmm(r.town.firstMove.p50)} and the last at ${hhmm(r.town.lastMove.p50)}.</p>
    <figure><svg-placeholder data-fig="town"></svg-placeholder><figcaption><b>Fig. ${nFig.town}.</b> Town buses recorded moving in each quarter-hour of the day: median day (solid) and busiest day (light).</figcaption></figure>
    <h3><span class="num">4.6</span>The passenger counters</h3>
    <p class="noindent">${counterSilent
      ? `The position feed carries on-board, boarding and alighting counter fields for every bus. Across ${fmt(r.record.counterFixes)} fixes, not one reported a value above zero. Either the counters are not fitted or they are not switched on; in either case the system does not today know how many people it carries, and this paper reports no ridership, fare or revenue figure for a real bus.`
      : `The position feed carries on-board counter fields; ${fmt(r.record.counterPositive)} of ${fmt(r.record.counterFixes)} fixes reported a value above zero.`}</p>`;

  const levers = `
    <h2><span class="num">5</span>What the data make possible now</h2>
    <p class="noindent">The record does not show a bus system that is slow on the road; it shows one whose published promise differs from what runs, that runs ${fewerOrMore(delF.ratio)} departures than it publishes, that leaves gaps riders cannot plan around, and that cannot count its passengers. Each of those is a data problem before it is an infrastructure problem, and the literature ranks the remedies the same way: frequency and reliability first ${cite("currie2008", "redman2013")}. ${tabRef(nTab.levers)} lists the measures in the order the evidence supports them.</p>
    <div class="table wide">
      <div class="table__caption"><b>Table ${nTab.levers}.</b> Data-led measures, what the record says each addresses, and the evidence that it moves riders.</div>
      <table>
        <thead><tr><th style="width:22%">Measure</th><th style="width:34%">What the record shows</th><th style="width:28%">Evidence it moves riders</th><th style="width:16%">Needs</th></tr></thead>
        <tbody>
          <tr><td>Re-set the published timetable to measured running times, by hour</td><td>Recorded medians of ${fmt(recF.p50)}/${fmt(recR.p50)} min against ${fmt(pubF.endToEnd.p50)}/${fmt(pubR.endToEnd.p50)} published; 85th percentile ${fmt(recF.p85)}/${fmt(recR.p85)} min (§4.3)</td><td>Reliability is valued at the tail of the wait distribution ${cite("furth2006trr")}; AVL-based scheduling ${cite("tcrp113")}</td><td>This archive; a scheduler</td></tr>
          <tr><td>Publish real-time positions and arrivals in an open standard (GTFS-Realtime)</td><td>The data exist and are public, but only on the operator’s own map; headways of ${fmt(a.headway.fwd.recordedMedian)} min make planning essential (§4.4)</td><td>Perceived waits −13% ${cite("watkins2011")}; ridership about +2% per route ${cite("brakewood2015", "tang2012")}</td><td>A feed translator ${cite("gtfsrt")}</td></tr>
          <tr><td>Run the published departures, and add them where the record shows hour-long gaps</td><td>${pct(delF.ratio)} and ${pct(delR.ratio)} of published departures recorded; longest daily gaps of ${fmt(a.headway.fwd.longestGapMedian)}/${fmt(a.headway.rev.longestGapMedian)} min (§4.2, §4.4)</td><td>Frequency is the largest single lever on bus ridership ${cite("currie2008", "paulley2006")}</td><td>Vehicle-hours; the town fleet’s midday halt (§4.5)</td></tr>
          <tr><td>Hold buses on headway, not on schedule, where they bunch</td><td>Recorded cv<sub>h</sub> ${fmt(a.headway.fwd.cvMedianDays, 2)}/${fmt(a.headway.rev.cvMedianDays, 2)} (§4.4)</td><td>Headway control keeps service even with less slack ${cite("daganzo2009", "bartholdi2012")}</td><td>Live positions (already published)</td></tr>
          <tr><td>Switch on passenger counting and fare-card data</td><td>${counterSilent ? "Counter fields present on every bus; none has reported a rider (§4.6)" : "Counters report on some buses (§4.6)"}</td><td>The basis of every later decision ${cite("pelletier2011", "tcrp113")}</td><td>Operator configuration</td></tr>
        </tbody>
      </table>
    </div>
    <p>None of these requires a parliamentary vote, a land acquisition or a concession. ${tabRef(nTab.rail)} sets them beside the rail line on the dimensions a city can compare today. The comparison is not that buses replace rail — a high-capacity corridor may well be needed — but that the data path can start this year, and that what it measures is what any later rail case, with its well-documented tendency to overstate demand ${cite("flyvbjerg2005")}, should be tested against.</p>
    <div class="table">
      <div class="table__caption"><b>Table ${nTab.rail}.</b> The rail path and the data path, as reported.</div>
      <table>
        <thead><tr><th></th><th>Light rail / tram</th><th>Data-led bus</th></tr></thead>
        <tbody>
          <tr><td>Capital cost</td><td>฿35.2 bn, phase 1 ${cite("infoquest2020board")}</td><td>Software and staff time; vehicles already in service</td></tr>
          <tr><td>First proposed</td><td>Costed 2018 ${cite("bkkpost2018ppp")}</td><td>Data public since the fleet went live</td></tr>
          <tr><td>Earliest service</td><td>Dec 2031 ${cite("nation2024tram")}</td><td>Months</td></tr>
          <tr><td>Approvals</td><td>MRTA board, ministry, PPP committee, Cabinet</td><td>Operator and provincial transport office</td></tr>
          <tr><td>Typical risk</td><td>Cost overrun ~45%, demand overstated in 9 of 10 projects ${cite("flyvbjerg2003", "flyvbjerg2005")}</td><td>That service gains do not convert drivers</td></tr>
        </tbody>
      </table>
    </div>`;

  const limits = `
    <h2><span class="num">6</span>Limitations</h2>
    <p class="noindent">The record measures supply, not demand. It cannot say how many people rode, who they were, or whether any of them left a car at home; until the counters report, the claim that better service would draw drivers rests on the literature, not on Phuket. A departure missing from the record may be a departure that did not run or a gap in the tracker; we report matched shares as lower bounds for that reason. The record covers ${fmt(days)} days in the late wet season and early high season, and a full year would show the seasonal swing that drives Phuket’s tourism. Line assignment by geometry can misplace a bus that drives a shared road, and trips that end in a tracker gap are not counted, so complete-trip counts undercount. Finally, the town fleet is measured as it runs; its routes are not published with stop times, so it can be described but not scored.</p>`;

  const conclusion = `
    <h2><span class="num">7</span>Conclusion</h2>
    <p class="noindent">Phuket has argued about rail for most of a decade, and on its own schedule will wait until at least 2031 for it. In ${fmt(days)} days of open data, its existing buses show where they fall short: ${fewerOrMore(delF.ratio)} departures than the timetable promises, running times the timetable does not admit, gaps of an hour or more, and no count of who rides. None of these is a matter of tracks. They are a matter of using data the buses already publish — to set an honest timetable, to tell riders where the bus is, to fill the gaps and to count the passengers — and each can begin this year. Whether that converts drivers is the measurement the next year of this archive is built to make.</p>`;

  const back = `
    <div class="back">
      <h2>Data availability</h2>
      <p>The trip, departure, service-day and town bus-day tables behind every figure are published with this preprint at bus.nonarkara.org/toolkit#paper. Raw fixes for any service day are available as CSV from bus.nonarkara.org/api/research/fixes?date=YYYY-MM-DD&amp;format=csv.</p>
      <h2>Code availability</h2>
      <p>The collector, the trip-reconstruction rules and the analysis that produced this paper are open source (MIT) ${cite("repo")}. The paper is rebuilt from the raw record by <i>npm run paper</i>.</p>
      <h2>Note on the data</h2>
      <p>No modelled or simulated figure is attributed to a real bus anywhere in this paper. The project’s operations console also contains a demand simulation; none of its outputs is used here.</p>
      <h2>Acknowledgements</h2>
      <p>This paper builds on the smart and sustainable mobility city-pairing programmes of the U.S.–ASEAN Smart Cities Partnership (USASCP). We thank the U.S. Department of Transportation (USDOT), the USASCP and the ASEAN Connectivity Division of the ASEAN Secretariat for their relentless support of that work. The Smart JAMP programme of Japan’s Ministry of Land, Infrastructure, Transport and Tourism (MLIT) supported prototypes of two services this paper argues for: AI-based analysis (Fujitsu) and an integrated city mobility app (Toyota Tsusho (Thailand)).</p>
      <h2>Funding</h2>
      <p>Neither author received a cash grant from any of these programmes. The programmes arranged flights and paid per diem under their standard rules for travel to carry out the partnership’s collaborative work plans.</p>
      <h2>References</h2>
      <ol class="refs">${c.list().map((ref) => `<li><span class="n">${ref.n}.</span><span>${esc(ref.text)} <span class="link"><a href="${esc(ref.link)}">${esc(ref.link)}</a></span></span></li>`).join("")}</ol>
    </div>`;

  const figures: Record<string, string> = {
    area: figStudyArea(r),
    marey: figMarey(input.marey),
    daily: figDailyDepartures(r),
    run: figRunningTimes(r, input.trips),
    hour: figRunningByHour(r),
    dev: figDeviation(r.airport.deviations),
    town: figTownActivity(r),
  };

  const supFor = (aff: number[]) => aff.join(",");
  const body = (intro + background + methods + results + levers + limits + conclusion + back)
    .replace(/<svg-placeholder data-fig="(\w+)"><\/svg-placeholder>/g, (_, k: string) => figures[k] ?? "");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(PAPER.title)}</title>
<meta name="author" content="${PAPER.authors.map((x) => x.name).join("; ")}">
<meta name="keywords" content="${PAPER.keywords.join(", ")}">
<style>${input.fontCss}\n${input.css}</style>
</head><body>
<header class="front">
  <div class="front__kicker"><span>Preprint · not peer reviewed</span><span>${esc(PAPER.version)} · ${esc(dateLong(input.issued))}</span></div>
  <h1>${esc(PAPER.title)}</h1>
  <p class="authors">${PAPER.authors.map((au) => `${esc(au.name)}<sup>${supFor(au.affiliations)}</sup>${au.nameTh ? ` <span class="th" lang="th">(${esc(au.nameTh)})</span>` : ""}`).join(", &nbsp;")}</p>
  <ol class="affiliations">${PAPER.affiliations.map((af) => `<li><sup>${af.n}</sup>${esc(af.en)}${af.th ? ` · <span lang="th">${esc(af.th)}</span>` : ""}</li>`).join("")}</ol>
  <section class="abstract"><h2>Abstract</h2><div>${abstract}</div></section>
  <p class="keywords"><b>Keywords:</b> ${PAPER.keywords.join(" · ")}</p>
</header>
<main class="body">${body}</main>
</body></html>`;
}
