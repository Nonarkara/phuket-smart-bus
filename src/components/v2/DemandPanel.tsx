import { useEffect, useRef } from "react";
import { Counter, InsightCard } from "./V2Shared";
import { pause, setSimulatedMinutes } from "../../engine/fleetSimulator";
import type { SimState, RegionData } from "../../engine/simulation";
import type { OpsFlight, FlightHourBucket } from "../../engine/opsFlightSchedule";
import type { HourlyBalance } from "../../engine/v2OpsPanel";
import { HourlyBalanceChart } from "./HourlyBalanceChart";

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
  /** Pre-computed 24-hour demand/supply/capture rows for the new
   *  HourlyBalanceChart. The chart includes seat counts so operators
   *  see immediately when bus supply falls short of arriving demand. */
  hourlyBalance?: HourlyBalance[];
}

export function DemandPanel({
  state,
  serviceGap,
  currentDemandPax,
  nextIncomingFlight,
  nextPeakBucket,
  hourlyFlights,
  dailyFlights,
  hourlyBalance,
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

      {hourlyBalance ? (
        <HourlyBalanceChart rows={hourlyBalance} simMinutes={state.simMinutes} />
      ) : null}

      <RegionChart data={state.regionBreakdown} maxPax={Math.max(...state.regionBreakdown.map((r) => r.pax), 1)} />

      <FlightScheduleRail flights={dailyFlights} simMinutes={state.simMinutes} />
    </aside>
  );
}
