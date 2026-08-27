/**
 * FlightTimeline — the headline 24-hour board for the operations console.
 *
 * The existing FlightScheduleRail in DemandPanel is a long list that the
 * operator scrolls. This component answers the question at a glance:
 * "what's coming into the airport right now, and how many of those people
 * could the bus system actually catch?"
 *
 * Visual: a horizontal 24-hour bar chart with:
 *   - arrivals as rising green columns, departures as rising amber columns
 *   - pax as the column height, with a `+N bus` overlay on the column
 *     showing how many of those pax the engine projects will take the bus
 *   - a vertical "now" cursor that follows the sim clock
 *   - the current hour is enlarged with the actual flight numbers listed
 *     below it (so the operator sees the real callsigns, not just bars)
 *   - a footer line that totals the day: "380 flights · 47,810 pax · could
 *     capture 1,920"
 *
 * The "could capture" figure comes from `captureRateFor(city)` per flight
 * — same engine the simulator uses, so the operator's number matches the
 * sim's number exactly.
 */

import { useEffect, useRef, useState } from "react";
import type { OpsFlight } from "../../engine/opsFlightSchedule";
import { captureRateFor } from "../../engine/travelBehavior";
import { Counter } from "./V2Shared";

interface FlightTimelineProps {
  flights: OpsFlight[];
  simMinutes: number;
}

const HOUR_WIDTH_PX = 44;
const HOUR_GAP_PX = 1;
const ROW_GAP_PX = 0;

interface HourCol {
  hour: number;
  arrivals: number;
  departures: number;
  arrPax: number;
  depPax: number;
  capturePax: number;
  captureThb: number;
  flights: OpsFlight[];
  /** Flights scheduled within ±30 minutes of this hour for the "active" callout. */
  activeFlights: OpsFlight[];
}

function buildHourCols(flights: OpsFlight[]): HourCol[] {
  const cols: HourCol[] = []
  for (let hour = 0; hour < 24; hour++) {
    cols.push({
      hour,
      arrivals: 0,
      departures: 0,
      arrPax: 0,
      depPax: 0,
      capturePax: 0,
      captureThb: 0,
      flights: [],
      activeFlights: [],
    })
  }
  for (const flight of flights) {
    const hour = Math.floor(flight.schedMin / 60) % 24
    const col = cols[hour]
    if (flight.type === "arr") {
      col.arrivals += 1
      col.arrPax += flight.pax
    } else {
      col.departures += 1
      col.depPax += flight.pax
    }
    const capture = flight.type === "arr"
      ? Math.round(flight.pax * captureRateFor(flight.city))
      : 0
    col.capturePax += capture
    col.captureThb += capture * 100  // ฿100/boarding
    col.flights.push(flight)
  }
  // Active flights = any flight within 30 min of the hour
  for (const col of cols) {
    col.activeFlights = col.flights.filter((f) => Math.abs(f.schedMin - col.hour * 60) <= 30)
  }
  return cols
}

const FARE_THB = 100

export function FlightTimeline({ flights, simMinutes }: FlightTimelineProps) {
  const cols = buildHourCols(flights)
  const currentHour = Math.floor(simMinutes / 60) % 24
  const minutesIntoHour = simMinutes % 60

  // Day totals
  const totalFlights = flights.length
  const totalPax = cols.reduce((s, c) => s + c.arrPax + c.depPax, 0)
  const totalCapture = cols.reduce((s, c) => s + c.capturePax, 0)
  const totalCaptureThb = cols.reduce((s, c) => s + c.captureThb, 0)

  // Peak hour by arrivals
  const peakHour = cols.reduce((peak, c) => c.arrPax > peak.arrPax ? c : peak, cols[0])

  // Maximum for scale
  const maxPax = Math.max(...cols.map((c) => c.arrPax + c.depPax), 1)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Auto-scroll the rail so the current-hour column stays centered
  useEffect(() => {
    if (!scrollRef.current) return
    const offset = currentHour * (HOUR_WIDTH_PX + HOUR_GAP_PX) - scrollRef.current.clientWidth / 2 + HOUR_WIDTH_PX / 2
    scrollRef.current.scrollTo({ left: Math.max(0, offset), behavior: "smooth" })
  }, [currentHour])

  return (
    <section className="v2-flights" aria-label="Today's flights timeline">
      <header className="v2-flights__head">
        <div className="v2-flights__title">
          <span className="v2-flights__eyebrow">Flight schedule · HKT</span>
          <h2 className="v2-flights__h">Today's arrivals &amp; departures</h2>
          <p className="v2-flights__lede">
            {totalFlights} flights · {totalPax.toLocaleString()} pax · could capture{" "}
            <span className="v2-flights__captureval">
              <Counter value={totalCapture} />
            </span>{" "}
            (฿<Counter value={totalCaptureThb} />) at ฿{FARE_THB} per boarding
          </p>
        </div>
        <div className="v2-flights__legend">
          <span className="v2-flights__legend-item">
            <span className="v2-flights__swatch v2-flights__swatch--arr" />
            Arrivals ({cols.reduce((s, c) => s + c.arrivals, 0)})
          </span>
          <span className="v2-flights__legend-item">
            <span className="v2-flights__swatch v2-flights__swatch--dep" />
            Departures ({cols.reduce((s, c) => s + c.departures, 0)})
          </span>
          <span className="v2-flights__legend-item">
            <span className="v2-flights__swatch v2-flights__swatch--capture" />
            Bus-catchable
          </span>
        </div>
      </header>

      <div className="v2-flights__rail" ref={scrollRef}>
        <div
          className="v2-flights__hours"
          style={{ width: cols.length * (HOUR_WIDTH_PX + HOUR_GAP_PX) }}
        >
          {cols.map((col) => {
            const isCurrent = col.hour === currentHour
            const isPeak = col.hour === peakHour.hour && col.arrPax > 0
            const totalHeight = ((col.arrPax + col.depPax) / maxPax) * 100
            const arrHeight = totalHeight > 0 ? (col.arrPax / (col.arrPax + col.depPax)) * totalHeight : 0
            const depHeight = totalHeight - arrHeight
            const captureRatio = col.arrPax > 0 ? col.capturePax / col.arrPax : 0
            return (
              <div
                key={col.hour}
                className={`v2-flights__col ${isCurrent ? "is-current" : ""} ${isPeak ? "is-peak" : ""}`}
                style={{ width: HOUR_WIDTH_PX, marginRight: HOUR_GAP_PX, marginBottom: ROW_GAP_PX }}
              >
                <span className="v2-flights__hourlabel">
                  {String(col.hour).padStart(2, "0")}
                </span>
                <div className="v2-flights__bars">
                  {col.arrivals > 0 && (
                    <div
                      className="v2-flights__bar v2-flights__bar--arr"
                      style={{ height: `${arrHeight}%` }}
                      title={`${col.arrivals} arrivals · ${col.arrPax} pax`}
                    />
                  )}
                  {col.departures > 0 && (
                    <div
                      className="v2-flights__bar v2-flights__bar--dep"
                      style={{ height: `${depHeight}%` }}
                      title={`${col.departures} departures · ${col.depPax} pax`}
                    />
                  )}
                  {col.capturePax > 0 && (
                    <div
                      className="v2-flights__bar v2-flights__bar--capture"
                      style={{ height: `${(captureRatio * 100)}%` }}
                      title={`${col.capturePax} could be captured`}
                    />
                  )}
                </div>
                <span className="v2-flights__pax">{col.arrPax > 0 ? col.arrPax : "—"}</span>
                <span className="v2-flights__flights">{col.arrivals + col.departures || "—"}</span>
                {col.capturePax > 0 && (
                  <span className="v2-flights__capture">+{col.capturePax}</span>
                )}
              </div>
            )
          })}

          {/* The "now" cursor — absolute over the rail so it tracks the
              sim clock continuously, not just the active hour. */}
          <div
            className="v2-flights__cursor"
            style={{
              left: currentHour * (HOUR_WIDTH_PX + HOUR_GAP_PX) +
                (minutesIntoHour / 60) * HOUR_WIDTH_PX,
            }}
            aria-label={`Now: ${String(currentHour).padStart(2, "0")}:${String(minutesIntoHour).padStart(2, "0")}`}
          >
            <span className="v2-flights__cursor-label">NOW</span>
          </div>
        </div>
      </div>

      {/* Active hour callout — the real flight numbers currently in the air
          or about to land. Updates as the sim clock advances. */}
      <ActiveHourCallout col={cols[currentHour]} hour={currentHour} minutesIntoHour={minutesIntoHour} />
    </section>
  )
}

function ActiveHourCallout({ col, hour, minutesIntoHour }: { col: HourCol; hour: number; minutesIntoHour: number }) {
  // Show flights that are arriving or departing in the next 30 minutes
  const nowMin = hour * 60 + minutesIntoHour
  const upcoming = col.flights
    .filter((f) => f.schedMin >= nowMin - 5 && f.schedMin <= nowMin + 30)
    .sort((a, b) => a.schedMin - b.schedMin)
    .slice(0, 6)
  const isEmpty = upcoming.length === 0
  return (
    <div className={`v2-flights__callout ${isEmpty ? "is-empty" : ""}`}>
      <div className="v2-flights__callout-time">
        <span className="v2-flights__callout-clock">
          {String(hour).padStart(2, "0")}:{String(minutesIntoHour).padStart(2, "0")}
        </span>
        <span className="v2-flights__callout-hr">next 30 min</span>
      </div>
      {isEmpty ? (
        <p className="v2-flights__callout-empty">
          No flights scheduled in the next 30 minutes.
        </p>
      ) : (
        <ul className="v2-flights__callout-list">
          {upcoming.map((f) => {
            const capture = f.type === "arr"
              ? Math.round(f.pax * captureRateFor(f.city))
              : 0
            const delta = f.schedMin - nowMin
            const sign = delta >= 0 ? "+" : "−"
            return (
              <li key={`${f.flightNo}-${f.schedMin}-${f.type}`} className={`v2-flights__callout-item v2-flights__callout-item--${f.type}`}>
                <span className="v2-flights__callout-fno">{f.flightNo}</span>
                <span className="v2-flights__callout-type">
                  {f.type === "arr" ? "IN" : "OUT"}
                </span>
                <span className="v2-flights__callout-time-rel">
                  {sign}{String(Math.abs(delta)).padStart(2, "0")}min
                </span>
                <span className="v2-flights__callout-route">
                  {f.type === "arr" ? "from " : "to "}{f.city}
                </span>
                <span className="v2-flights__callout-aircraft">
                  {f.aircraftCode} · {f.seats} seats
                </span>
                <span className="v2-flights__callout-pax">
                  {f.pax} pax <span className="v2-flights__callout-load">{f.loadPct}%</span>
                </span>
                {capture > 0 && (
                  <span className="v2-flights__callout-capture">
                    +{capture} bus
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
