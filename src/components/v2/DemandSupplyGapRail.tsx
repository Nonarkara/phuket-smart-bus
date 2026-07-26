import type { OpsFlight } from "../../engine/opsFlightSchedule";
import type { HourlyBalance } from "../../engine/v2OpsPanel";
import { scrubToHour } from "./DemandPanel";

type Props = {
  rows: HourlyBalance[];
  simMinutes: number;
  flights: OpsFlight[];
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

/** The operator's first read: one equation, then the hours it applies to. */
export function DemandSupplyGapRail({ rows, simMinutes, flights }: Props) {
  const hour = Math.floor(simMinutes / 60) % 24;
  const now = rows.find((row) => row.hour === hour) ?? rows[0];
  if (!now) return null;

  const demand = now.busEligiblePax + now.outEligiblePax;
  const seats = now.busSeats + now.outSeats;
  const scheduledBuses = Math.round(seats / 25);
  const windowRows = rows.filter((row) => row.hour >= hour).slice(0, 7);
  const arrivals = flights.filter((flight) => flight.type === "arr").length;
  const departures = flights.length - arrivals;

  return (
    <aside className="v2-decision-rail" aria-label="Demand, supply and bus gap">
      <header className="v2-decision-rail__head">
        <span>Operating equation · {hourLabel(hour)}</span>
        <h2>What arrives. What leaves. What is missing.</h2>
        <p>
          Flights create likely riders. The timetable creates seats. The gap is the
          number of whole buses that would have carried the people left behind.
        </p>
      </header>

      <div className="v2-equation" aria-label={`${demand} riders minus ${seats} seats equals ${now.busesToAdd} buses to add`}>
        <section className="v2-equation__term v2-equation__term--demand">
          <span className="v2-equation__step">01 · Demand</span>
          <strong>{demand}</strong>
          <p>{now.busEligiblePax} from arrivals<br />{now.outEligiblePax} going to flights</p>
          <small>{arrivals} arrivals · {departures} departures today</small>
        </section>
        <span className="v2-equation__operator" aria-hidden="true">−</span>
        <section className="v2-equation__term v2-equation__term--supply">
          <span className="v2-equation__step">02 · Supply</span>
          <strong>{seats}</strong>
          <p>{now.busSeats} seats out<br />{now.outSeats} seats back</p>
          <small>{scheduledBuses} scheduled bus departures</small>
        </section>
        <span className="v2-equation__operator" aria-hidden="true">=</span>
        <section className={`v2-equation__term v2-equation__term--gap ${now.busesToAdd > 0 ? "is-short" : "is-covered"}`}>
          <span className="v2-equation__step">03 · Gap</span>
          <strong>{now.busesToAdd}</strong>
          <p>{now.busesToAdd === 1 ? "bus" : "buses"} to add</p>
          <small>{directionLabel(now)}</small>
        </section>
      </div>

      <section className="v2-hour-plan">
        <header>
          <span>Next seven hours</span>
          <small>Tap an hour to replay it</small>
        </header>
        <div className="v2-hour-plan__legend" aria-hidden="true">
          <span>Time</span><span>Riders</span><span>Buses</span><span>Add</span>
        </div>
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
      </section>

      <footer className="v2-decision-rail__source">
        <strong>What is real?</strong>
        <p>Bus times are the published PKSB timetable. Flight demand is a labelled research model. Amber aircraft on the map are live ADS-B observations.</p>
      </footer>
    </aside>
  );
}
