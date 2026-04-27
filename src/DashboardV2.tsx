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
import { computeSimState, getDayInfo, type SimState, type RegionData } from "./engine/simulation";
import {
  buildFlightHourBuckets,
  getOpsFlightSchedule,
  type FlightHourBucket,
  type OpsFlight
} from "./engine/opsFlightSchedule";
import { getDirectionPolyline } from "./engine/routes";
import { interpolateCoordinate, interpolateHeading } from "./lib/vehicleAnimation";
import { AnalyticsPanel } from "./components/AnalyticsPanel";

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

function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 100_000 ? 1 : 0
  }).format(value);
}

function InsightCard({
  eyebrow,
  headline,
  detail,
  tone = "neutral"
}: {
  eyebrow: string;
  headline: string;
  detail: string;
  tone?: "neutral" | "demand" | "supply";
}) {
  return (
    <section className={`v2-insight v2-insight--${tone}`}>
      <span className="v2-insight__eyebrow">{eyebrow}</span>
      <strong className="v2-insight__headline">{headline}</strong>
      <p className="v2-insight__detail">{detail}</p>
    </section>
  );
}

function buildBusMarkerIcon(vehicle: SimState["vehicles"][number]) {
  return L.divIcon({
    className: "v2-bus-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="v2-bus ${vehicle.status === "moving" ? "is-moving" : ""}" style="--heading: ${vehicle.heading}deg">
      <div class="v2-bus__arrow"></div>
      <div class="v2-bus__body">${vehicle.pax}</div>
    </div>`
  });
}

const V2_MARKER_GLIDE_MS = 950;

function interpolateBusVehicle(
  from: SimState["vehicles"][number],
  to: SimState["vehicles"][number],
  progress: number
) {
  const [lat, lng] = interpolateCoordinate([from.lat, from.lng], [to.lat, to.lng], progress);

  return {
    ...to,
    lat,
    lng,
    heading: interpolateHeading(from.heading, to.heading, progress),
  };
}

function syncBusMarker(marker: L.Marker, vehicle: SimState["vehicles"][number]) {
  marker.setLatLng([vehicle.lat, vehicle.lng]);
  marker.setTooltipContent(`${vehicle.plate} · ${vehicle.pax}/${25} pax · ${vehicle.route}`);

  const element = marker.getElement();
  if (!element) return;

  const bus = element.querySelector<HTMLElement>(".v2-bus");
  const body = element.querySelector<HTMLElement>(".v2-bus__body");
  if (bus) {
    bus.classList.toggle("is-moving", vehicle.status === "moving");
    bus.style.setProperty("--heading", `${vehicle.heading}deg`);
  }
  if (body) {
    body.textContent = String(vehicle.pax);
  }
}

// ---------------------------------------------------------------------------
// Vehicle Layer — imperative Leaflet markers
// ---------------------------------------------------------------------------

function VehicleLayer({ vehicles }: { vehicles: SimState["vehicles"] }) {
  const map = useMap();
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const renderedVehicles = useRef<Map<string, SimState["vehicles"][number]>>(new Map());
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const ensureMarker = (vehicle: SimState["vehicles"][number]) => {
      const existing = markers.current.get(vehicle.id);
      if (existing) return existing;

      const marker = L.marker([vehicle.lat, vehicle.lng], { icon: buildBusMarkerIcon(vehicle) }).addTo(map);
      marker.bindTooltip(`${vehicle.plate} · ${vehicle.pax}/${25} pax · ${vehicle.route}`, { direction: "top" });
      markers.current.set(vehicle.id, marker);
      return marker;
    };

    const applyFrame = (frameVehicles: SimState["vehicles"]) => {
      const nextRendered = new Map<string, SimState["vehicles"][number]>();

      for (const vehicle of frameVehicles) {
        const marker = ensureMarker(vehicle);
        syncBusMarker(marker, vehicle);
        nextRendered.set(vehicle.id, vehicle);
      }

      renderedVehicles.current = nextRendered;
    };

    const seen = new Set(vehicles.map((vehicle) => vehicle.id));
    for (const [key, marker] of markers.current) {
      if (!seen.has(key)) {
        map.removeLayer(marker);
        markers.current.delete(key);
      }
    }

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const previous = renderedVehicles.current;
    const frameDuration = previous.size > 0 ? V2_MARKER_GLIDE_MS : 0;
    if (frameDuration === 0) {
      applyFrame(vehicles);
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / frameDuration);
      const frame = vehicles.map((vehicle) => {
        const current = previous.get(vehicle.id);
        return current ? interpolateBusVehicle(current, vehicle, progress) : vehicle;
      });

      applyFrame(frame);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(step);
  }, [map, vehicles]);

  useEffect(() => () => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }
    markers.current.forEach((marker) => map.removeLayer(marker));
    markers.current.clear();
    renderedVehicles.current.clear();
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
        <>
          <Polyline positions={airportPoly} pathOptions={{ color: "rgba(22,184,176,0.18)", weight: 12, opacity: 1 }} />
          <Polyline positions={airportPoly} pathOptions={{ color: "#16b8b0", weight: 4, opacity: 0.9 }} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Demand rail — full-day flight schedule and hourly pulse
// ---------------------------------------------------------------------------

function classifyFlightRow(flight: OpsFlight, simMinutes: number) {
  const delta = flight.schedMin - simMinutes;
  if (Math.abs(delta) <= 12) return "active";
  if (delta < -12) return "past";
  return "future";
}

function HourlyFlightPulse({ buckets, simMinutes }: { buckets: FlightHourBucket[]; simMinutes: number }) {
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

function FlightScheduleRail({ flights, simMinutes }: { flights: OpsFlight[]; simMinutes: number }) {
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
          return (
            <div
              key={`${flight.flightNo}-${flight.schedMin}-${flight.type}`}
              ref={rowRef}
              className={`v2-schedule__row v2-schedule__row--${status}`}
            >
              <span className="v2-schedule__time">{flight.timeLabel}</span>
              <span className={`v2-schedule__type v2-schedule__type--${flight.type}`}>
                {flight.type === "arr" ? "IN" : "OUT"}
              </span>
              <span className="v2-schedule__flight">{flight.flightNo}</span>
              <span className="v2-schedule__city">{flight.city}</span>
              <span className="v2-schedule__pax">{flight.pax}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DestinationResponse({
  breakdown
}: {
  breakdown: SimState["destBreakdown"];
}) {
  const visible = breakdown.filter((destination) => destination.served > 0);
  const peakServed = Math.max(...visible.map((destination) => destination.served), 1);

  if (visible.length === 0) {
    return <p className="v2-dest-row__empty">Waiting for first passengers...</p>;
  }

  return (
    <div className="v2-destinations">
      <h3 className="v2-destinations__title">Response by Destination</h3>
      {visible.map((destination) => (
        <div key={destination.name} className="v2-dest-card">
          <div className="v2-dest-card__meta">
            <span className="v2-dest-row__name">{destination.name}</span>
            <span className="v2-dest-row__served">{destination.served} pax</span>
          </div>
          <div className="v2-dest-card__track">
            <div
              className="v2-dest-card__fill"
              style={{ width: `${(destination.served / peakServed) * 100}%` }}
            />
          </div>
          <span className="v2-dest-row__rev">฿{destination.revenue.toLocaleString()}</span>
        </div>
      ))}
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
  const [dailyFlights] = useState(() => getOpsFlightSchedule());
  const [hourlyFlights] = useState(() => buildFlightHourBuckets(dailyFlights));
  const arrivalsToday = dailyFlights.filter((flight) => flight.type === "arr");
  const departuresToday = dailyFlights.filter((flight) => flight.type === "dep");
  const currentHourBucket = hourlyFlights[Math.floor(state.simMinutes / 60) % 24] ?? hourlyFlights[0];
  const nextIncomingFlight = arrivalsToday.find((flight) => flight.schedMin >= state.simMinutes) ?? arrivalsToday.at(-1) ?? null;
  const nextPeakBucket = hourlyFlights
    .filter((bucket) => bucket.hour >= Math.floor(state.simMinutes / 60) && bucket.arrivalPax > 0)
    .sort((left, right) => right.arrivalPax - left.arrivalPax)[0] ?? currentHourBucket;
  const responsePct = state.paxWantBus > 0 ? Math.round((state.paxBoarded / state.paxWantBus) * 100) : 100;
  const liveCapture = state.paxWantBus > 0 ? Math.round((state.paxDelivered / state.paxWantBus) * 100) : 0;
  const serviceGap = Math.max(0, state.paxWantBus - state.paxBoarded);
  const currentDemandPax = currentHourBucket?.arrivalPax ?? 0;
  const currentDeparturePax = currentHourBucket?.departurePax ?? 0;
  const avgSavingsPerRider = state.paxDelivered > 0 ? Math.round(state.savingsThb / state.paxDelivered) : 0;

  useEffect(() => {
    const id = setInterval(() => {
      setState(computeSimState());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="v2">
      {/* Header */}
      <header className="v2-header">
        <div className="v2-header__brand">
          <span className="v2-header__eyebrow">Airport Ops Console</span>
          <h1>Phuket Smart Bus</h1>
          <span className="v2-header__sub">Demand-Supply Intelligence</span>
        </div>
        <div className="v2-header__story">
          <span className="v2-header__story-label">Right now</span>
          <strong className="v2-header__story-value">{currentDemandPax.toLocaleString()} arriving pax this hour</strong>
          <span className="v2-header__story-detail">{state.paxAtAirport} waiting for buses · {responsePct}% boarding capture</span>
        </div>
        <div className="v2-header__clock">
          <span className="v2-header__live">●</span>
          <span className="v2-header__day">{getDayInfo().label}</span>
          <span className="v2-header__time">{state.clockLabel} BKK</span>
          <span className="v2-header__speed">30× simulation</span>
        </div>
        <div className="v2-header__meta">
          <span>{arrivalsToday.length} arrivals</span>
          <span>{departuresToday.length} departures</span>
          <span>HKT · {getDayInfo().label} pattern</span>
        </div>
      </header>

      {/* Main grid: left panel + map + right panel */}
      <main className="v2-body">
        {/* Left: Demand side (flights → passengers) */}
        <aside className="v2-panel v2-panel--demand">
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

          <RegionChart data={state.regionBreakdown} maxPax={Math.max(...state.regionBreakdown.map(r => r.pax), 1)} />

          <FlightScheduleRail flights={dailyFlights} simMinutes={state.simMinutes} />
        </aside>

        {/* Center: Map */}
        <section className="v2-map">
          <div className="v2-map__hero">
            <div className="v2-map__hero-card">
              <span className="v2-map__hero-label">Demand Queue</span>
              <strong className="v2-map__hero-value">{state.paxAtAirport}</strong>
              <span className="v2-map__hero-detail">waiting at airport curb</span>
            </div>
            <div className="v2-map__hero-card">
              <span className="v2-map__hero-label">Supply Rolling</span>
              <strong className="v2-map__hero-value">{state.busesMoving}</strong>
              <span className="v2-map__hero-detail">buses moving now</span>
            </div>
            <div className="v2-map__hero-card">
              <span className="v2-map__hero-label">Live Gap</span>
              <strong className="v2-map__hero-value">{serviceGap}</strong>
              <span className="v2-map__hero-detail">still not boarded</span>
            </div>
          </div>
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
            <span className="v2-map__next">Demand this hour: {currentDemandPax.toLocaleString()} in · {currentDeparturePax.toLocaleString()} out</span>
            {state.nextDeparture !== null && (
              <span className="v2-map__next">Next departure: {state.nextDeparture} min</span>
            )}
          </div>
        </section>

        {/* Right: Supply side (buses → revenue → impact) */}
        <aside className="v2-panel v2-panel--supply">
          <h2 className="v2-panel__title">Supply & Impact</h2>

          <InsightCard
            eyebrow="Service Response"
            headline={`${responsePct}% of bus demand has boarding capacity`}
            detail={`Delivered riders are at ${liveCapture}% of live demand so far. ${state.activeBuses} buses are active, next dispatch in ${state.nextDeparture ?? 0} minutes.`}
            tone="supply"
          />

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
              <div className="v2-kpi__val"><span className="counter">฿{formatCurrencyCompact(state.savingsThb)}</span></div>
              <div className="v2-kpi__label">Saved vs Grab/taxi</div>
            </div>
            <div className="v2-kpi">
              <div className="v2-kpi__val"><span className="counter">{Math.round(state.avgOccupancy * 100)}%</span></div>
              <div className="v2-kpi__label">Average occupancy</div>
            </div>
            <div className="v2-kpi">
              <div className="v2-kpi__val"><span className="counter">฿{avgSavingsPerRider}</span></div>
              <div className="v2-kpi__label">Saved per rider</div>
            </div>
            <div className="v2-kpi">
              <div className="v2-kpi__val"><span className="counter">{state.nextDeparture ?? 0} min</span></div>
              <div className="v2-kpi__label">Next airport dispatch</div>
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

          <DestinationResponse breakdown={state.destBreakdown} />
        </aside>
      </main>

      {/* Bottom: Live demand–supply chart paired with the accumulator bar */}
      <footer className="v2-footer">
        <AnalyticsPanel lang="en" />
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
