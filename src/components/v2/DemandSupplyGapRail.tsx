import type { OpsFlight } from "../../engine/opsFlightSchedule";
import type { HourlyBalance } from "../../engine/v2OpsPanel";
import { scrubToHour } from "./DemandPanel";
import { DemandSupplyBalanceChart } from "./DemandSupplyBalanceChart";

type Props = {
  rows: HourlyBalance[];
  simMinutes: number;
  flights: OpsFlight[];
  /**
   * Where the SEATS came from, when that is not the published timetable.
   * In LIVE the supply in force is today's recorded departures plus what is
   * still due — so the number says so, rather than passing for a timetable
   * figure it is not.
   */
  supplyBasis?: string;
};

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function directionLabel(row: HourlyBalance) {
  if (row.inGapPax > 0 && row.outGapPax > 0) return "both directions";
  if (row.inGapPax > 0) return "airport → island";
  if (row.outGapPax > 0) return "island → airport";
  return "timetable covers demand";
}

/** The numbers the equation and the hour list both read from. */
function derive(rows: HourlyBalance[], simMinutes: number, flights: OpsFlight[]) {
  const hour = Math.floor(simMinutes / 60) % 24;
  const now = rows.find((row) => row.hour === hour) ?? rows[0];
  if (!now) return null;
  const demand = now.busEligiblePax + now.outEligiblePax;
  const seats = now.busSeats + now.outSeats;
  const arrivals = flights.filter((flight) => flight.type === "arr").length;
  // Every hour left in the day, not a fixed slice of 7 — a fixed count left a
  // dead gap under the footer at midday, when a dozen hours remain, and would
  // have overflowed near midnight when only one or two do. The list's own
  // scroll (.v2-hour-plan__rows) absorbs whatever doesn't fit; the section
  // itself flex-grows to fill the rail, so the footer always sits flush with
  // the bottom instead of floating above blank space.
  const windowRows = rows.filter((row) => row.hour >= hour);
  return { hour, now, demand, seats, arrivals, departures: flights.length - arrivals, windowRows };
}

/**
 * THE OPERATOR'S FIRST READ — the equation, and nothing else.
 *
 * The side rail is 527px tall and it has to answer three questions on the
 * first screen: how much did we lose today, what do I do about it right now,
 * and which bus is it. This is the second of the three.
 *
 * It used to be one block with the hour-by-hour analysis — a chart, a
 * twelve-row scrub list and the investor read — and all of it sat BETWEEN
 * the headline and the fleet table. The rail therefore held 1,652px of
 * content in 527px, and the fleet table, the thing the rail exists for,
 * finished 1,482px below the fold. Nothing on the surface said it was down
 * there.
 */
export function OperatingEquation({ rows, simMinutes, flights, supplyBasis }: Props) {
  const d = derive(rows, simMinutes, flights);
  if (!d) return null;
  const { hour, now, demand, seats, arrivals, departures } = d;
  const scheduledBuses = Math.round(seats / 25);

  return (
    <section className="v2-equation-block" aria-label={`${demand} riders minus ${seats} seats equals ${now.busesToAdd} buses to add`}>
      <header className="v2-decision-rail__head">
        <span>Operating equation · {hourLabel(hour)}</span>
      </header>
      <div className="v2-equation">
        <section className="v2-equation__term v2-equation__term--demand">
          <span className="v2-equation__step">01 · Demand</span>
          <strong>{demand}</strong>
          <p>{now.busEligiblePax} from arrivals<br />{now.outEligiblePax} going to flights</p>
          <small>{arrivals} arr · {departures} dep today</small>
        </section>
        <span className="v2-equation__operator" aria-hidden="true">−</span>
        <section className="v2-equation__term v2-equation__term--supply">
          <span className="v2-equation__step">02 · Supply</span>
          <strong>{seats}</strong>
          <p>{now.busSeats} seats out<br />{now.outSeats} seats back</p>
          <small>{supplyBasis ? `${scheduledBuses} bus departures · ${supplyBasis}` : `${scheduledBuses} scheduled bus departures`}</small>
        </section>
        <span className="v2-equation__operator" aria-hidden="true">=</span>
        <section className={`v2-equation__term v2-equation__term--gap ${now.busesToAdd > 0 ? "is-short" : "is-covered"}`}>
          <span className="v2-equation__step">03 · Gap</span>
          <strong>{now.busesToAdd}</strong>
          <p>{now.busesToAdd === 1 ? "bus" : "buses"} to add</p>
          <small>{directionLabel(now)}</small>
        </section>
      </div>
    </section>
  );
}

/**
 * THE SHAPE OF THE DAY — the analysis, one scroll below the first read.
 *
 * The hour-by-hour balance chart, a scrub list of the hours still to come,
 * and the investor read that says what is modelled and what is not. It is
 * here because it is worth a scroll, not because it is worth a screen.
 */
export function HourAnalysis({ rows, simMinutes }: Props) {
  const d = derive(rows, simMinutes, []);
  if (!d) return null;
  const { hour, now, windowRows } = d;
  const windowLabel = windowRows.length === 1 ? "Next hour" : `Next ${windowRows.length} hours`;

  return (
    <aside className="v2-decision-rail" aria-label="Demand, supply and bus gap by hour">
      <DemandSupplyBalanceChart rows={rows} simMinutes={simMinutes} variant="rail" />

      <section className="v2-hour-plan">
        <header>
          <span>{windowLabel}</span>
          <small>Tap an hour to replay it</small>
        </header>
        <div className="v2-hour-plan__legend" aria-hidden="true">
          <span>Time</span><span>Riders</span><span>Buses</span><span>Add</span>
        </div>
        <div className="v2-hour-plan__rows">
          {windowRows.map((row) => {
            const rowDemand = row.busEligiblePax + row.outEligiblePax;
            const rowSeats = row.busSeats + row.outSeats;
            return (
              <button
                key={row.hour}
                className={`${row.hour === hour ? "is-now" : ""} ${row.busesToAdd > 0 ? "is-short" : ""}`}
                type="button"
                onClick={() => scrubToHour(row.hour)}
                title={`${directionLabel(row)} · ฿${row.missedThb.toLocaleString()} missed`}
              >
                <strong>{hourLabel(row.hour)}</strong>
                <span>{rowDemand}</span>
                <span>{Math.round(rowSeats / 25)}</span>
                <b>{row.busesToAdd > 0 ? `+${row.busesToAdd}` : "OK"}</b>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="v2-decision-rail__source">
        <strong>Investor read</strong>
        <p>
          Add buses only where the gap is. Each boarded rider is one fewer single-occupancy trip;
          CO₂ here is modelled avoided emissions — a carbon-credit claim still needs a registry pathway.
          Bus times are the published PKSB timetable. Flight demand is a labelled research model.
        </p>
        <p className="v2-decision-rail__now">
          Right now the gap is {now.busesToAdd} {now.busesToAdd === 1 ? "bus" : "buses"} · {directionLabel(now)}.
        </p>
      </footer>
    </aside>
  );
}
