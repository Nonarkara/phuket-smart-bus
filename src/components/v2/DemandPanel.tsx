import { useEffect, useRef } from "react";
import { Counter, InsightCard } from "./V2Shared";
import { pause, setSimulatedMinutes } from "../../engine/fleetSimulator";
import type { SimState, RegionData } from "../../engine/simulation";
import type { OpsFlight, FlightHourBucket } from "../../engine/opsFlightSchedule";

/** Click any hour anywhere on this dashboard → jump the simulation clock
 *  there and pause, so the map shows where every bus would be at that time. */
export function scrubToHour(hour: number) {
  setSimulatedMinutes(hour * 60);
  pause();
}

// ---------------------------------------------------------------------------
// Helpers and Sub-components
// ---------------------------------------------------------------------------
function classifyFlightRow(flight: OpsFlight, simMinutes: number) {
  const delta = flight.schedMin - simMinutes;
  if (Math.abs(delta) <= 12) return "active";
  if (delta < -12) return "past";
  return "future";
}

interface HourlyFlightPulseProps {
  buckets: FlightHourBucket[];
  simMinutes: number;
}

function HourlyFlightPulse({ buckets, simMinutes }: HourlyFlightPulseProps) {
  const currentHour = Math.floor(simMinutes / 60) % 24;
  const maxPax = Math.max(...buckets.map((bucket) => Math.max(bucket.arrivalPax, bucket.departurePax)), 1);

  return (
    <div className="v2-hourly">
      <div className="v2-hourly__title">Full-Day Flight Pulse</div>
      <div className="v2-hourly__legend">
        <span className="v2-hourly__legend-item v2-hourly__legend-item--arr">Arrivals</span>
        <span className="v2-hourly__legend-item v2-hourly__legend-item--dep">Departures</span>
      </div>
      <div className="v2-hourly__rows">
        {buckets.map((bucket) => (
          <div
            key={bucket.hour}
            className={`v2-hourly__row ${bucket.hour === currentHour ? "is-current" : ""}`}
            role="button"
            tabIndex={0}
            title={`Jump to ${String(bucket.hour).padStart(2, "0")}:00 — see where every bus is`}
            onClick={() => scrubToHour(bucket.hour)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") scrubToHour(bucket.hour); }}
          >
            <span className="v2-hourly__time">{String(bucket.hour).padStart(2, "0")}:00</span>
            <div className="v2-hourly__track">
              <div
                className="v2-hourly__fill v2-hourly__fill--arr"
                style={{ width: `${(bucket.arrivalPax / maxPax) * 100}%` }}
              />
              <div
                className="v2-hourly__fill v2-hourly__fill--dep"
                style={{ width: `${(bucket.departurePax / maxPax) * 100}%` }}
              />
            </div>
            <span className="v2-hourly__meta">{bucket.arrivals}/{bucket.departures}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RegionChartProps {
  data: RegionData[];
  maxPax: number;
}

function RegionChart({ data, maxPax }: RegionChartProps) {
  return (
    <div className="v2-regions">
      <div className="v2-regions__title">Arrivals by Region</div>
      {data.map((r) => (
        <div key={r.region} className="v2-region-bar">
          <span className="v2-region-bar__label">{r.region}</span>
          <div className="v2-region-bar__track">
            <div
              className="v2-region-bar__fill"
              style={{ width: maxPax > 0 ? `${(r.pax / maxPax) * 100}%` : "0%", background: r.color }}
            />
          </div>
          <span className="v2-region-bar__val">{r.pax.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

interface FlightScheduleRailProps {
  flights: OpsFlight[];
  simMinutes: number;
}

function FlightScheduleRail({ flights, simMinutes }: FlightScheduleRailProps) {
  const focusRef = useRef<HTMLDivElement | null>(null);
  const arrivals = flights.filter((flight) => flight.type === "arr").length;
  const departures = flights.length - arrivals;
  const focusIndex = flights.findIndex((flight) => flight.schedMin >= simMinutes - 10);
  const anchoredIndex = focusIndex === -1 ? flights.length - 1 : focusIndex;

  useEffect(() => {
    focusRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [anchoredIndex]);

  return (
    <div className="v2-schedule">
      <div className="v2-schedule__header">
        <div className="v2-schedule__title">Flight Schedule</div>
        <div className="v2-schedule__meta">{arrivals} in · {departures} out</div>
      </div>
      <div className="v2-schedule__rail">
        {flights.map((flight, index) => {
          const status = classifyFlightRow(flight, simMinutes);
          const rowRef = index === anchoredIndex ? focusRef : undefined;
          // The demand trace: this flight's contribution to the bus queue.
          const busDemand = flight.type === "arr" && flight.mode === "flight"
            ? Math.round(flight.pax * 0.12)
            : 0;
          return (
            <div
              key={`${flight.flightNo}-${flight.schedMin}-${flight.type}`}
              ref={rowRef}
              className={`v2-schedule__row v2-schedule__row--${status}`}
              title={`${flight.airline} · ${flight.aircraftName} · ${flight.seats} seats · ${flight.pax} pax (${flight.loadPct}% load)${busDemand > 0 ? ` → ${busDemand} bus pax` : ""}`}
            >
              <span className="v2-schedule__time">{flight.timeLabel}</span>
              <span className={`v2-schedule__type v2-schedule__type--${flight.type}`}>
                {flight.type === "arr" ? "IN" : "OUT"}
              </span>
              <span className="v2-schedule__main">
                <span className="v2-schedule__flight">{flight.flightNo}</span>
                <span className="v2-schedule__craft">{flight.aircraftCode} · {flight.seats} seats</span>
              </span>
              <span className="v2-schedule__city">{flight.city}</span>
              <span className="v2-schedule__paxcol">
                <span className="v2-schedule__pax">{flight.pax}</span>
                <span className="v2-schedule__load">{flight.loadPct}%</span>
              </span>
              {busDemand > 0 && <span className="v2-schedule__busdemand">+{busDemand}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
interface DemandPanelProps {
  state: SimState;
  serviceGap: number;
  currentDemandPax: number;
  nextIncomingFlight: OpsFlight | null;
  nextPeakBucket: FlightHourBucket;
  hourlyFlights: FlightHourBucket[];
  dailyFlights: OpsFlight[];
}

export function DemandPanel({
  state,
  serviceGap,
  currentDemandPax,
  nextIncomingFlight,
  nextPeakBucket,
  hourlyFlights,
  dailyFlights,
}: DemandPanelProps) {
  return (
    <aside className={`v2-panel v2-panel--demand ${serviceGap > 25 ? 'is-alert' : ''}`}>
      <h2 className="v2-panel__title">Demand · HKT Airport</h2>

      <InsightCard
        eyebrow="Inbound Pressure"
        headline={`${currentDemandPax.toLocaleString()} arrivals this hour`}
        detail={
          nextIncomingFlight
            ? `Next inbound ${nextIncomingFlight.flightNo} from ${nextIncomingFlight.city} at ${nextIncomingFlight.timeLabel}. Biggest remaining surge: ${String(nextPeakBucket.hour).padStart(2, "0")}:00.`
            : "No more inbound flights in the modelled day."
        }
        tone="demand"
      />

      <div className="v2-kpi-row">
        <div className="v2-kpi">
          <div className="v2-kpi__val"><Counter value={state.totalArrPax} /></div>
          <div className="v2-kpi__label">Arrived so far</div>
        </div>
        <div className="v2-kpi v2-kpi--accent">
          <div className="v2-kpi__val"><Counter value={state.paxWantBus} /></div>
          <div className="v2-kpi__label">Likely bus demand</div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi__val"><Counter value={state.paxAtAirport} /></div>
          <div className="v2-kpi__label">Still waiting</div>
        </div>
      </div>

      <HourlyFlightPulse buckets={hourlyFlights} simMinutes={state.simMinutes} />

      <RegionChart data={state.regionBreakdown} maxPax={Math.max(...state.regionBreakdown.map((r) => r.pax), 1)} />

      <FlightScheduleRail flights={dailyFlights} simMinutes={state.simMinutes} />
    </aside>
  );
}
