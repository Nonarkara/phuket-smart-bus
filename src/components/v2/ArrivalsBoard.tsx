/**
 * ArrivalsBoard — the demand column of the operations wall.
 *
 * Reads top to bottom in the order an operator asks the questions:
 *   1. How big is today?         → flights · passengers · countries (headline)
 *   2. What is landing NOW?      → next 45 min, real flight numbers + aircraft
 *   3. Who is flying in?         → by country, with the 7-day rhythm beside it
 *   4. When does the day peak?   → 24-hour arrivals/departures bars + NOW
 *
 * Everything is a sum over the published schedule for the active weekday.
 * The bus-catchable figure uses the same per-origin capture heuristic the
 * simulator uses, so this board and the money bar can never disagree.
 */

import { useMemo } from "react";
import { buildFlightHourBuckets, getDayLabel, type OpsFlight } from "../../engine/opsFlightSchedule";
import { captureRateFor } from "../../engine/travelBehavior";
import { countryFor, getCountryBoard, getCountryTotals } from "../../engine/flightsByCountry";
import { FARE_THB } from "../../engine/demandSupplyEngine";

interface Props {
  flights: OpsFlight[];
  simMinutes: number;
  simDay: number;
  /** In LIVE mode the board says so — that is the difference between a
   *  scheduled fact and a replayed one. */
  live: boolean;
}

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const LOOKAHEAD_MIN = 45;
const MAX_COUNTRY_ROWS = 6;
const MAX_UPCOMING = 3;

function fmtClock(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function ArrivalsBoard({ flights, simMinutes, simDay, live }: Props) {
  const totals = useMemo(() => getCountryTotals(simDay), [simDay]);
  const countries = useMemo(() => getCountryBoard(simDay), [simDay]);
  const hours = useMemo(() => buildFlightHourBuckets(flights), [flights]);
  const catchable = useMemo(
    () => flights.reduce((s, f) => s + (f.type === "arr" ? Math.round(f.pax * captureRateFor(f.city)) : 0), 0),
    [flights]
  );

  const nowMin = simMinutes;
  const upcoming = flights
    .filter((f) => f.schedMin >= nowMin - 3 && f.schedMin <= nowMin + LOOKAHEAD_MIN)
    .sort((a, b) => a.schedMin - b.schedMin)
    .slice(0, MAX_UPCOMING);

  const topRows = countries.slice(0, MAX_COUNTRY_ROWS);
  const rest = countries.slice(MAX_COUNTRY_ROWS);
  const restArrivals = rest.reduce((s, r) => s + r.arrivals, 0);
  const restPax = rest.reduce((s, r) => s + r.arrPax, 0);
  const maxRowPax = Math.max(1, ...topRows.map((r) => r.arrPax));
  const maxWeekly = Math.max(1, ...topRows.flatMap((r) => r.arrivalsByDow));

  const maxHourPax = Math.max(1, ...hours.map((h) => h.arrivalPax + h.departurePax));
  const peakHour = hours.reduce((p, h) => (h.arrivalPax > p.arrivalPax ? h : p), hours[0]);
  const currentHour = Math.floor(nowMin / 60) % 24;

  return (
    <section className="ax-arr" aria-label="Airport demand today">
      {/* 1 · headline */}
      <header className="ax-arr__head">
        <span
          className="ax-eyebrow"
          title="Published airline schedule — real flight numbers, carriers and airframes. Pax = seats × load factor."
        >
          Phuket Airport HKT · {getDayLabel(simDay)} · {live ? "today, live" : "replay"}
        </span>
        <div className="ax-arr__headline">
          <strong className="ax-num ax-num--xl">{totals.arrivals}</strong>
          <span className="ax-arr__headline-word">arrivals</span>
          <strong className="ax-num ax-num--xl ax-num--dim">{totals.departures}</strong>
          <span className="ax-arr__headline-word">departures</span>
        </div>
        <p className="ax-arr__lede">
          <b>{totals.arrPax.toLocaleString()}</b> passengers landing from <b>{totals.countries}</b> countries ·{" "}
          <b>{totals.international}</b> international, <b>{totals.domestic}</b> domestic ·{" "}
          <b className="ax-accent">{catchable.toLocaleString()}</b> likely bus riders (฿{(catchable * FARE_THB).toLocaleString()})
        </p>
      </header>

      {/* 2 · landing now */}
      <div className="ax-arr__now">
        <div className="ax-arr__section-head">
          <span className="ax-eyebrow">Next {LOOKAHEAD_MIN} min · {fmtClock(nowMin)}</span>
          <span className="ax-arr__count">{upcoming.length} movement{upcoming.length === 1 ? "" : "s"}</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="ax-arr__empty">Nothing scheduled in the next {LOOKAHEAD_MIN} minutes.</p>
        ) : (
          <ul className="ax-flightlist">
            {upcoming.map((f) => {
              const c = countryFor(f.city);
              const capture = f.type === "arr" ? Math.round(f.pax * captureRateFor(f.city)) : 0;
              const delta = Math.round(f.schedMin - nowMin);
              return (
                <li key={`${f.flightNo}-${f.schedMin}-${f.type}`} className={`ax-flight ax-flight--${f.type}`}>
                  <span className="ax-flight__when">
                    <span className="ax-flight__time">{f.timeLabel}</span>
                    <span className={`ax-flight__dir ax-flight__dir--${f.type}`}>{f.type === "arr" ? "▼ IN" : "▲ OUT"}</span>
                  </span>
                  <span className="ax-flight__what">
                    <span className="ax-flight__line1">
                      <span className="ax-flight__no">{f.flightNo}</span>
                      <span className="ax-flight__city">
                        <span className="ax-flag" aria-hidden="true">{c.flag}</span>
                        {f.type === "arr" ? "from" : "to"} {f.city}
                      </span>
                    </span>
                    <span className="ax-flight__meta">{f.airline} · {f.aircraftCode} · {f.pax} pax</span>
                  </span>
                  <span className="ax-flight__so">
                    <span className="ax-flight__eta">{delta <= 0 ? "now" : `in ${delta} min`}</span>
                    {capture > 0 ? <span className="ax-flight__bus">+{capture} for the bus</span> : <span className="ax-flight__bus ax-flight__bus--none">—</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 3 · by country */}
      <div className="ax-arr__countries">
        <div className="ax-arr__section-head">
          <span className="ax-eyebrow">Who is flying in · by country</span>
          <span className="ax-arr__count ax-arr__count--week">
            planes / day, Mon → Sun
          </span>
        </div>
        <ol className="ax-country">
          {topRows.map((r) => (
            <li key={r.code} className="ax-country__row">
              <span className="ax-country__name">
                <span className="ax-flag" aria-hidden="true">{r.flag}</span>
                {r.name}
              </span>
              <span className="ax-country__planes">
                <strong className="ax-num">{r.arrivals}</strong>
                <small>plane{r.arrivals === 1 ? "" : "s"}</small>
              </span>
              <span className="ax-country__pax">
                {r.arrPax.toLocaleString()} pax
                <i className="ax-country__bar" aria-hidden="true"><b style={{ width: `${(r.arrPax / maxRowPax) * 100}%` }} /></i>
              </span>
              <span className="ax-country__week" aria-label="arrival flights per weekday">
                {DOW_ORDER.map((d) => (
                  <i
                    key={d}
                    className={d === simDay ? "is-today" : ""}
                    style={{ "--h": `${Math.max(0.12, r.arrivalsByDow[d] / maxWeekly)}` } as React.CSSProperties}
                    title={`${DOW_SHORT[d]} · ${r.arrivalsByDow[d]} arrivals · ${r.arrPaxByDow[d]} pax`}
                  >
                    <b>{r.arrivalsByDow[d]}</b>
                  </i>
                ))}
              </span>
            </li>
          ))}
          {rest.length > 0 && (
            <li className="ax-country__row ax-country__row--rest">
              <span className="ax-country__name">+ {rest.length} more countries</span>
              <span className="ax-country__planes"><strong className="ax-num">{restArrivals}</strong><small>planes</small></span>
              <span className="ax-country__pax">
                {restPax.toLocaleString()} pax
                <i className="ax-country__bar" aria-hidden="true"><b style={{ width: `${(restPax / maxRowPax) * 100}%` }} /></i>
              </span>
              <span className="ax-country__week" />
            </li>
          )}
        </ol>
      </div>

      {/* 4 · 24-hour shape */}
      <div className="ax-arr__hours">
        <div className="ax-arr__section-head">
          <span className="ax-eyebrow">Hour by hour · passengers</span>
          <span className="ax-arr__count">
            peak {String(peakHour.hour).padStart(2, "0")}:00 · {peakHour.arrivalPax.toLocaleString()} landing
          </span>
        </div>
        <div className="ax-hours" role="img" aria-label="Arriving and departing passengers per hour">
          {hours.map((h) => (
            <div
              key={h.hour}
              className={`ax-hours__col ${h.hour === currentHour ? "is-now" : ""} ${h.hour === peakHour.hour ? "is-peak" : ""}`}
              title={`${String(h.hour).padStart(2, "0")}:00 · ${h.arrivals} in (${h.arrivalPax} pax) · ${h.departures} out (${h.departurePax} pax)`}
            >
              <span className="ax-hours__bars">
                <i className="ax-hours__arr" style={{ height: `${(h.arrivalPax / maxHourPax) * 100}%` }} />
                <i className="ax-hours__dep" style={{ height: `${(h.departurePax / maxHourPax) * 100}%` }} />
              </span>
              <span className="ax-hours__label">{h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : ""}</span>
            </div>
          ))}
          <span
            className="ax-hours__now"
            style={{ left: `${((nowMin % 1440) / 1440) * 100}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="ax-hours__legend">
          <span><i className="ax-hours__arr" /> landing</span>
          <span><i className="ax-hours__dep" /> departing</span>
          <span><i className="ax-hours__nowkey" /> now</span>
        </div>
      </div>
    </section>
  );
}
