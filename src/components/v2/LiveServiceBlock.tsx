import type { AirportService } from "../../engine/liveService";

type Props = {
  service: AirportService | null;
  status: "idle" | "live" | "offline";
  error: string | null;
};

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;
}

/**
 * WHAT THE SERVICE DID — the plan against the record, for the corridor the
 * product is about.
 *
 * This is the answer the wall could not give before. The tracker says where
 * the buses are; the record says which trips they actually ran and how long
 * those trips took; the published timetable says what they were told to do.
 * The three are different facts, and this block puts them side by side
 * without adding them up: the count of recorded departures is a COUNT OF
 * WHAT THE RECORD HOLDS, not a verdict on what ran, and the footnote says so
 * in the same breath.
 */
export function LiveServiceBlock({ service, status, error }: Props) {
  if (!service) {
    return (
      <section className="v2-service v2-service--empty" aria-label="Service today">
        <header className="v2-service__head">
          <span>Service today · airport line</span>
        </header>
        <p className="v2-service__empty">
          {status === "offline"
            ? `The day's record did not answer${error ? ` — ${error}` : ""}.`
            : status === "idle"
              ? "Reading the day's record…"
              : "No record yet."}
        </p>
      </section>
    );
  }

  const rows = [
    { label: "Airport → Rawai", dir: service.southbound },
    { label: "Rawai → Airport", dir: service.northbound },
  ];
  const departed = service.southbound.departed.length + service.northbound.departed.length;
  const arrived = service.southbound.arrived.length + service.northbound.arrived.length;
  const stillDue = service.southbound.stillDue + service.northbound.stillDue;
  const planned = service.southbound.published.length + service.northbound.published.length;

  return (
    <section className="v2-service" aria-label="Service today, airport line">
      <header className="v2-service__head">
        <span>Service today · airport line</span>
        <span className="v2-service__head-meta">
          {departed} departed · {arrived} arrived · {stillDue} still due · plan {planned} a day
        </span>
      </header>

      <div className="v2-service__rows" role="list">
        {rows.map((row) => (
          <div className="v2-service__row" role="listitem" key={row.label}>
            <span className="v2-service__dir">{row.label}</span>
            <span className="v2-service__ran">
              <b>{row.dir.departed.length}</b> departed
            </span>
            <span className="v2-service__trip">
              {row.dir.recordedTripMin === null ? "—" : `${Math.round(row.dir.recordedTripMin)} min`}
              {row.dir.publishedTripMin !== null && <em> plan {Math.round(row.dir.publishedTripMin)}</em>}
            </span>
          </div>
        ))}
      </div>

      <p className="v2-service__foot">
        A count of what the record holds, not a verdict on what ran. A departure is recorded as the bus
        leaves the terminal and a trip only when it arrives, so the two differ all day. A bus whose
        tracker goes quiet leaves no record at all, so both undercount the service.
      </p>
    </section>
  );
}
