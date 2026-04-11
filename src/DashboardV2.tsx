/**
 * Phuket Smart Bus v2 — One Page, One Story
 *
 * The simulation IS the product. Watch a day unfold:
 * Flights land → Passengers arrive → Buses collect them → Revenue accumulates
 *
 * Every number traces back to the demand-supply chain. Nothing decorative.
 */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import type { LatLngTuple } from "@shared/types";
import { computeSimState, getFlightFeed, type SimState, type Flight, type RegionData, DESTINATIONS } from "./engine/simulation";
import { getDirectionPolyline } from "./engine/routes";

// ---------------------------------------------------------------------------
// Animated counter — numbers roll up, not snap
// ---------------------------------------------------------------------------

function Counter({ value, prefix, suffix }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const diff = value - from;
    if (diff === 0) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 1200);
      setDisplay(Math.round(from + diff * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="counter">{prefix}{display.toLocaleString()}{suffix}</span>;
}

// ---------------------------------------------------------------------------
// Vehicle Layer — imperative Leaflet markers
// ---------------------------------------------------------------------------

function VehicleLayer({ vehicles }: { vehicles: SimState["vehicles"] }) {
  const map = useMap();
  const markers = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    const TICK = 1500;

    function tick() {
      const state = computeSimState();
      const seen = new Set<string>();

      for (const v of state.vehicles) {
        const key = v.id;
        seen.add(key);
        const existing = markers.current.get(key);
        if (existing) {
          existing.setLatLng([v.lat, v.lng]);
        } else {
          const icon = L.divIcon({
            className: "v2-bus-icon",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            html: `<div class="v2-bus ${v.status === "moving" ? "is-moving" : ""}" style="--heading: ${v.heading}deg">
              <div class="v2-bus__body">${v.pax}</div>
            </div>`,
          });
          const m = L.marker([v.lat, v.lng], { icon }).addTo(map);
          m.bindTooltip(`${v.plate} · ${v.pax}/${25} pax · ${v.route}`, { direction: "top" });
          markers.current.set(key, m);
        }
      }

      for (const [key, m] of markers.current) {
        if (!seen.has(key)) {
          map.removeLayer(m);
          markers.current.delete(key);
        }
      }
    }

    tick();
    const id = setInterval(tick, TICK);
    return () => {
      clearInterval(id);
      markers.current.forEach(m => map.removeLayer(m));
      markers.current.clear();
    };
  }, [map]);

  return null;
}

// ---------------------------------------------------------------------------
// Route polyline
// ---------------------------------------------------------------------------

function RoutePolylines() {
  // Get the airport line polyline
  let airportPoly: LatLngTuple[] = [];
  try {
    airportPoly = getDirectionPolyline("rawai-airport", [8.108, 98.317]);
  } catch { /* */ }

  return (
    <>
      {airportPoly.length > 0 && (
        <Polyline positions={airportPoly} pathOptions={{ color: "#16b8b0", weight: 4, opacity: 0.7 }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Animated flight ticker — flights pop in as they land
// ---------------------------------------------------------------------------

const fmtTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

function FlightTicker({ landed, upcoming, simMinutes }: { landed: Flight[]; upcoming: Flight[]; simMinutes: number }) {
  // Show last 6 landed (newest first) + next 3 upcoming
  const recentLanded = [...landed].sort((a, b) => b.arrMin - a.arrMin).slice(0, 6);
  const nextUp = upcoming.slice(0, 3);

  return (
    <div className="v2-ticker">
      {nextUp.length > 0 && (
        <div className="v2-ticker__section">
          <div className="v2-ticker__label">INCOMING</div>
          {nextUp.map(f => (
            <div key={f.flightNo} className="v2-ticker__row v2-ticker__row--upcoming">
              <span className="v2-ticker__time">{fmtTime(f.arrMin)}</span>
              <span className="v2-ticker__flight">{f.flightNo}</span>
              <span className="v2-ticker__origin">{f.origin}</span>
              <span className="v2-ticker__pax">{f.pax}</span>
            </div>
          ))}
        </div>
      )}
      <div className="v2-ticker__section">
        <div className="v2-ticker__label">LANDED</div>
        {recentLanded.map(f => {
          const justLanded = (simMinutes - f.arrMin) < 3; // within 3 sim-minutes
          return (
            <div key={f.flightNo + f.arrMin} className={`v2-ticker__row v2-ticker__row--landed ${justLanded ? "v2-ticker__row--flash" : ""}`}>
              <span className="v2-ticker__time">{fmtTime(f.arrMin)}</span>
              <span className="v2-ticker__flight">{f.flightNo}</span>
              <span className="v2-ticker__origin">{f.origin}</span>
              <span className="v2-ticker__pax">{f.pax}</span>
            </div>
          );
        })}
        {recentLanded.length === 0 && <div className="v2-ticker__empty">Waiting for first arrival...</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Region bar chart — grows as flights land
// ---------------------------------------------------------------------------

function RegionChart({ data, maxPax }: { data: RegionData[]; maxPax: number }) {
  return (
    <div className="v2-regions">
      <div className="v2-regions__title">Arrivals by Region</div>
      {data.map(r => (
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

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function DashboardV2() {
  const [state, setState] = useState(() => computeSimState());
  const [flights, setFlights] = useState(() => getFlightFeed());

  useEffect(() => {
    const id = setInterval(() => {
      setState(computeSimState());
      setFlights(getFlightFeed());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="v2">
      {/* Header */}
      <header className="v2-header">
        <div className="v2-header__brand">
          <h1>Phuket Smart Bus</h1>
          <span className="v2-header__sub">Demand-Supply Intelligence</span>
        </div>
        <div className="v2-header__clock">
          <span className="v2-header__live">●</span>
          <span className="v2-header__time">{state.clockLabel} BKK</span>
          <span className="v2-header__speed">20× simulation</span>
        </div>
        <div className="v2-header__meta">
          <span>HKT Airport</span>
          <span>Peak Season · Dec 30</span>
        </div>
      </header>

      {/* Main grid: left panel + map + right panel */}
      <main className="v2-body">
        {/* Left: Demand side (flights → passengers) */}
        <aside className="v2-panel v2-panel--demand">
          <h2 className="v2-panel__title">Demand · HKT Airport</h2>

          <div className="v2-kpi-row">
            <div className="v2-kpi">
              <div className="v2-kpi__val"><Counter value={state.totalArrPax} /></div>
              <div className="v2-kpi__label">Arrived</div>
            </div>
            <div className="v2-kpi v2-kpi--accent">
              <div className="v2-kpi__val"><Counter value={state.paxWantBus} /></div>
              <div className="v2-kpi__label">Want bus</div>
            </div>
            <div className="v2-kpi">
              <div className="v2-kpi__val"><Counter value={state.paxAtAirport} /></div>
              <div className="v2-kpi__label">Waiting</div>
            </div>
          </div>

          <RegionChart data={state.regionBreakdown} maxPax={Math.max(...state.regionBreakdown.map(r => r.pax), 1)} />

          <FlightTicker landed={state.landedFlights} upcoming={flights.upcoming} simMinutes={state.simMinutes} />
        </aside>

        {/* Center: Map */}
        <section className="v2-map">
          <MapContainer center={[7.95, 98.35]} zoom={11} className="v2-map__canvas" zoomControl={false} scrollWheelZoom={true}>
            <TileLayer
              attribution="&copy; OSM"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <RoutePolylines />
            <VehicleLayer vehicles={state.vehicles} />
          </MapContainer>
          <div className="v2-map__overlay">
            <span className="v2-map__stat"><Counter value={state.activeBuses} /> buses · <Counter value={state.busesMoving} /> moving</span>
            {state.nextDeparture !== null && (
              <span className="v2-map__next">Next departure: {state.nextDeparture} min</span>
            )}
          </div>
        </section>

        {/* Right: Supply side (buses → revenue → impact) */}
        <aside className="v2-panel v2-panel--supply">
          <h2 className="v2-panel__title">Supply & Impact</h2>

          <div className="v2-kpi-stack">
            <div className="v2-kpi v2-kpi--green">
              <div className="v2-kpi__val"><Counter value={state.paxDelivered} /></div>
              <div className="v2-kpi__label">Passengers delivered</div>
            </div>
            <div className="v2-kpi v2-kpi--green">
              <div className="v2-kpi__val"><Counter value={state.revenueThb} prefix="฿" /></div>
              <div className="v2-kpi__label">Revenue earned</div>
            </div>
            <div className="v2-kpi">
              <div className="v2-kpi__val"><Counter value={state.savingsThb} prefix="฿" /></div>
              <div className="v2-kpi__label">Saved vs Grab/taxi</div>
            </div>
          </div>

          <div className="v2-impact">
            <h3 className="v2-impact__title">Environmental Impact</h3>
            <div className="v2-impact__row">
              <span className="v2-impact__label">CO₂ if all took taxis</span>
              <span className="v2-impact__val"><Counter value={state.co2TaxiKg} suffix=" kg" /></span>
            </div>
            <div className="v2-impact__row">
              <span className="v2-impact__label">CO₂ with Smart Bus</span>
              <span className="v2-impact__val v2-impact__val--green"><Counter value={Math.round(state.paxDelivered * 28 * 0.06)} suffix=" kg" /></span>
            </div>
            <div className="v2-impact__row v2-impact__row--highlight">
              <span className="v2-impact__label">CO₂ saved</span>
              <span className="v2-impact__val v2-impact__val--green"><Counter value={state.co2SavedKg} suffix=" kg" /></span>
            </div>
          </div>

          <div className="v2-destinations">
            <h3 className="v2-destinations__title">By Destination</h3>
            {state.destBreakdown.filter(d => d.served > 0).map(d => (
              <div key={d.name} className="v2-dest-row">
                <span className="v2-dest-row__name">{d.name}</span>
                <span className="v2-dest-row__served">{d.served} pax</span>
                <span className="v2-dest-row__rev">฿{d.revenue.toLocaleString()}</span>
              </div>
            ))}
            {state.destBreakdown.every(d => d.served === 0) && (
              <p className="v2-dest-row__empty">Waiting for first passengers...</p>
            )}
          </div>
        </aside>
      </main>

      {/* Bottom: The Accumulator Bar */}
      <footer className="v2-footer">
        <div className="v2-accum">
          <div className="v2-accum__item">
            <span className="v2-accum__val"><Counter value={state.activeBuses} /></span>
            <span className="v2-accum__label">Buses</span>
          </div>
          <div className="v2-accum__item">
            <span className="v2-accum__val"><Counter value={state.tripsCompleted} /></span>
            <span className="v2-accum__label">Trips</span>
          </div>
          <div className="v2-accum__item">
            <span className="v2-accum__val"><Counter value={state.kmDriven} /></span>
            <span className="v2-accum__label">Km</span>
          </div>
          <div className="v2-accum__item v2-accum__item--accent">
            <span className="v2-accum__val"><Counter value={state.paxDelivered} /></span>
            <span className="v2-accum__label">Pax</span>
          </div>
          <div className="v2-accum__item v2-accum__item--accent">
            <span className="v2-accum__val"><Counter value={state.revenueThb} prefix="฿" /></span>
            <span className="v2-accum__label">Revenue</span>
          </div>
          <div className="v2-accum__item v2-accum__item--green">
            <span className="v2-accum__val"><Counter value={state.co2SavedKg} suffix=" kg" /></span>
            <span className="v2-accum__label">CO₂ Saved</span>
          </div>
          <div className="v2-accum__item">
            <span className="v2-accum__val">{Math.round(state.avgOccupancy * 100)}%</span>
            <span className="v2-accum__label">Occupancy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
