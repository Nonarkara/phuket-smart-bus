/**
 * v2 Simulation Engine: The Complete Demand-Supply Chain
 *
 * Flights land → Passengers arrive → Some need ground transport →
 * Buses collect them at stops → Revenue earned → CO2 saved vs taxis
 *
 * Every number on screen traces back to this chain. Nothing decorative.
 */

import type { LatLngTuple } from "@shared/types";
import { getDirectionPolyline } from "./routes";
import { haversineDistanceMeters } from "./geo";
import { getOpsFlightSchedule, getDayLabel, getDayVolumeFactor, getSimulationDay } from "./opsFlightSchedule";

// ---------------------------------------------------------------------------
// Time — single source of truth lives in fleetSimulator.getSimulatedMinutes.
// Importing here keeps the chart, the right-bar metrics, and the bus
// markers running on exactly the same clock. Two clocks = drift = the
// chart says "served 50 pax" while the buses haven't moved yet.
// ---------------------------------------------------------------------------

import { getSimulatedMinutes, getAirportDepartures, getAirportboundTrips } from "./fleetSimulator";
import {
  atMinute,
  getDayModel,
  getHourlyCorridor,
  BUS_CAPACITY,
  CUSTOMS_MIN,
  CUSTOMS_MAX
} from "./demandSupplyEngine";
import { regionFor } from "./travelBehavior";

const SVC_START = 360; // 06:00 — chart axis floor (matches fleetSimulator)
const SVC_END = 1350;  // 22:30 — matches fleetSimulator SERVICE_END (PKSB last departure 23:30, last arrival ~22:30)

export function simNow(): number {
  return getSimulatedMinutes();
}

export function simClock(): string {
  const m = simNow();
  const h = Math.floor(m / 60) % 24;
  const mm = Math.floor(m % 60);
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Flight Schedule — real airlines, real origins, real pax counts
// ---------------------------------------------------------------------------

export type Flight = {
  flightNo: string;
  airline: string;
  origin: string;
  pax: number;
  arrMin: number; // minutes from midnight
  type: "arr" | "dep";
  terminal?: string;
};

// Flights come from getOpsFlightSchedule() — the fuzzed schedule for the
// ACTIVE simulation day. Memoized per dow so the day picker invalidates
// this along with everything downstream. Single source of truth for both
// the flight rail (DashboardV2) and the demand-supply chain.
const flightsByDow = new Map<number, { all: Flight[]; svc: Flight[] }>();

function dayFlights(): { all: Flight[]; svc: Flight[] } {
  const dow = getSimulationDay();
  let f = flightsByDow.get(dow);
  if (!f) {
    const all = getOpsFlightSchedule().map((flight) => ({
      flightNo: flight.flightNo,
      airline: flight.airline,
      origin: flight.city,
      pax: flight.pax,
      arrMin: flight.schedMin,
      type: flight.type,
      terminal: flight.terminal
    }));
    const svc = all.filter(
      (flight) => flight.type === "arr" && flight.arrMin >= SVC_START - CUSTOMS_MAX && flight.arrMin <= SVC_END
    );
    f = { all, svc };
    flightsByDow.set(dow, f);
  }
  return f;
}

export function getDayInfo(): { label: string; volumeFactor: number } {
  return { label: getDayLabel(), volumeFactor: getDayVolumeFactor() };
}

// ---------------------------------------------------------------------------
// Demand Model: flights → passengers needing buses
// ---------------------------------------------------------------------------

// Bus capture varies by passenger origin (heuristic table in
// travelBehavior.ts — Europeans rent cars, Bangkok budget carriers ride).
// The demand-supply engine applies it per flight; nothing here duplicates it.

// Customs + baggage ramp — sourced from demandSupplyEngine (CUSTOMS_MIN/MAX
// are the engine's ramp window; keeping one copy so the chart axis floor
// here and the queue absorption there can never disagree).

/** In-service arrivals for the active day (see dayFlights above). */
function FLIGHTS(): Flight[] {
  return dayFlights().svc;
}

// Destination split (where bus passengers want to go)
// routeId declares which Smart Bus line carries them — all airport arrivals ride the rawai-airport line
export type Destination = { name: string; pct: number; travelMin: number; grabThb: number; busThb: number; routeId: string };

export const DESTINATIONS: Destination[] = [
  { name: "Patong Beach",   pct: 0.35, travelMin: 100, grabThb: 800, busThb: 100, routeId: "rawai-airport" },
  { name: "Karon/Kata",     pct: 0.20, travelMin:  75, grabThb: 700, busThb: 100, routeId: "rawai-airport" },
  { name: "Phuket Town",    pct: 0.18, travelMin:  56, grabThb: 500, busThb: 100, routeId: "rawai-airport" },
  { name: "Kamala/Surin",   pct: 0.12, travelMin:  80, grabThb: 750, busThb: 100, routeId: "rawai-airport" },
  { name: "Rawai/Nai Harn", pct: 0.08, travelMin:  95, grabThb: 900, busThb: 100, routeId: "rawai-airport" },
  { name: "Laguna/Bang Tao",pct: 0.07, travelMin:  40, grabThb: 450, busThb: 100, routeId: "rawai-airport" },
];

// Bus capacity per vehicle (all land buses seat 25, dragon seats 15) —
// sourced from demandSupplyEngine.BUS_CAPACITY so the engine's queue caps
// and the live-totals capacity denominator cannot drift.

/** Memoized schedule data — schedules are static for the session. */
let _cachedAirportDepartures: number[] | null = null;
function airportDepartures(): number[] {
  if (!_cachedAirportDepartures) _cachedAirportDepartures = getAirportDepartures().sort((a, b) => a - b);
  return _cachedAirportDepartures;
}


// ---------------------------------------------------------------------------
// Regional origin mapping — city→region lives in travelBehavior.ts (single
// source shared with the capture heuristics); colors are display-only here.
// ---------------------------------------------------------------------------

const REGION_COLORS: Record<string, string> = {
  "SE Asia": "#16b8b0",
  "China": "#e53935",
  "East Asia": "#7c4dff",
  "Russia/CIS": "#1e88e5",
  "India": "#ff9800",
  "Middle East": "#ffd54f",
  "Europe": "#43a047",
};

// ---------------------------------------------------------------------------
// Line profitability model
// ---------------------------------------------------------------------------

export type LineMetrics = {
  lineId: string;
  lineName: string;
  passengersServed: number;
  revenueThb: number;
  operatingCostThb: number;
  profitThb: number;
  profitMargin: number; // 0-100
  carbonSavedKg: number;
  kmDriven: number;
};

const LINE_CONFIG: Record<string, { name: string; kmDaily: number; fare: number; capacity: number; tripDurationMinutes: number }> = {
  "rawai-airport":         { name: "Airport → Patong", kmDaily: 600, fare: 100, capacity: 25, tripDurationMinutes: 95 },  // official PKSB timetable
  "patong-old-bus-station":{ name: "Patong → Old Town", kmDaily: 200, fare: 100, capacity: 25, tripDurationMinutes: 35 }, // Patong → Bus Terminal 1
  "dragon-line":           { name: "Dragon Loop",       kmDaily:  50, fare: 100, capacity: 15, tripDurationMinutes: 50 }, // estimated loop time
};

// Realistic per-bus cost from the same financial model the /roi page uses.
// ROI_CONSTANTS.operatingCostPerBusYear = ฿800,000 (PKSB 2024 statement +
// BMTA benchmarks: ฿340k fuel + ฿310k driver + ฿80k maintenance + ฿70k
// insurance). Spread over 365 × 16 service hours = ฿137/hour/bus.
// The line P&L is now derived from the SAME number that drives the
// investor-facing payback calculation on /roi — no parallel cost model.
const HOURLY_OPEX_PER_BUS_THB = 800_000 / 365 / 16;

// CO₂ factors — sourced from roi.ROI_CONSTANTS (APTA "Public Transportation's
// Role in Responding to Climate Change" 2018 update) so the /ops dashboard
// and the /roi investor pitch can never disagree by a few kg. Re-exported
// here as names so the getLiveTotals math reads like its source.
import { ROI_CONSTANTS } from "./roi";
const CO2_KG_PER_PAX_KM_CAR = ROI_CONSTANTS.co2KgPerPaxKmCar; // 0.21
const CO2_KG_PER_PAX_KM_BUS = ROI_CONSTANTS.co2KgPerPaxKmBus; // 0.06
const CO2_KG_PER_PAX_KM_SAVED = CO2_KG_PER_PAX_KM_CAR - CO2_KG_PER_PAX_KM_BUS; // 0.15

// Average trip distance, weighted across the destination clusters. Same
// number the /roi page uses — keeps the live CO₂ math identical to the
// pitch.
const AVG_TRIP_KM = ROI_CONSTANTS.avgTripKm; // 28 km

// Buses assigned per line (matches the fleet roster in fleetSimulator.ts).
// Used to scale each line's daily opex.
const BUSES_PER_LINE: Record<string, number> = {
  "rawai-airport":           10,
  "patong-old-bus-station":   7,
  "dragon-line":              3
};

function getRegion(origin: string): string {
  return regionFor(origin);
}

export type RegionData = { region: string; pax: number; pct: number; color: string };

// ---------------------------------------------------------------------------
// Core simulation state — computed from the chain
// ---------------------------------------------------------------------------

export type SimState = {
  clockLabel: string;
  simMinutes: number;

  // Flights
  landedFlights: Flight[];
  nextFlight: Flight | null;
  nextFlightMin: number | null;
  totalArrPax: number;
  lastLandedFlight: Flight | null; // most recently landed (for ticker animation)
  regionBreakdown: RegionData[];

  // Demand
  paxAtAirport: number; // waiting for transport
  paxWantBus: number;   // subset who'd take bus
  paxBoarded: number;   // cumulative boarded today
  paxDelivered: number; // cumulative delivered to destination
  paxAbandoned: number; // gave up after 60 min in the queue → took Grab
  lostRevenueThb: number; // paxAbandoned × ฿100 — revenue lost to capacity

  // Supply
  activeBuses: number;
  busesMoving: number;
  busesDwelling: number;
  nextDeparture: number | null; // minutes until next bus leaves airport
  avgOccupancy: number; // 0-1

  // Impact (derived, not decorative)
  revenueThb: number;      // paxDelivered × 100 THB
  grabEquivThb: number;    // what those same passengers would have paid by Grab
  savingsThb: number;      // grabEquiv - revenue (money saved by passengers)
  co2SavedKg: number;      // paxDelivered × avgTripKm × (0.21 − 0.06) = × 0.15
  co2TaxiKg: number;       // what taxis would have emitted (paxDelivered × 28 × 0.21)
  tripsCompleted: number;
  kmDriven: number;

  // Per-destination breakdown
  destBreakdown: { name: string; served: number; revenue: number; grabSaved: number }[];

  // Vehicle positions for the map
  vehicles: { id: string; lat: number; lng: number; heading: number; status: "moving" | "dwelling"; route: string; pax: number; plate: string }[];
};

// ---------------------------------------------------------------------------
// Live totals — the streaming money/pax numbers as a PURE function of the
// minute. This is the single source the per-frame animation loop ref-writes
// AND the source computeSimState() consumes for the same fields, so the
// buttery 60fps numbers and the 4Hz panel snapshot can never disagree.
// Cheap: one O(1) atMinute() read + a couple of small array scans.
// ---------------------------------------------------------------------------
export type LiveTotals = {
  simMinutes: number;
  waiting: number;
  /** Combined both directions (arriving pax riding out + departing pax riding back). */
  paxWantBus: number;
  paxBoarded: number;
  paxDelivered: number;
  paxAbandoned: number;
  revenueThb: number;      // earned = delivered × ฿100, both directions
  lostRevenueThb: number;  // walked away/took Grab = lost × ฿100, both directions
  co2TaxiKg: number;
  co2SavedKg: number;
  tripsCompleted: number;
  kmDriven: number;
  nextDeparture: number | null;
  departedBusCount: number;
};

export function getLiveTotals(nowMin: number): LiveTotals {
  const eng = atMinute(nowMin);
  const deps = airportDepartures();
  const departedBuses = deps.filter((d) => d <= nowMin);
  // Weighted average trip duration across destinations. The dominant trip
  // (Airport → Patong via Surin/Kamala) is 100 min, with shorter hops to
  // Old Town and Laguna; 75 min is the round-trip-aware average.
  const avgTripMin = 75;
  const nextDep = deps.find((d) => d > nowMin);
  // Combined both directions: arriving pax ride out, departing pax ride back.
  // The engine's `atMinute` exposes both cumulatives; the per-frame
  // ref-writer and the 4Hz panel snapshot consume the same numbers, so
  // there is no path by which the buttery live figures and the analytic
  // snapshot can disagree.
  const paxDelivered = eng.deliveredCum + eng.outDeliveredCum;
  const paxAbandoned = eng.abandonedCum + eng.outLostCum;
  // CO₂ counterfactual: kg of CO₂ that would have been emitted by taxis
  // for the same pax-km. co2SavedKg is the bus vs taxi delta.
  const co2TaxiKg = Math.round(paxDelivered * AVG_TRIP_KM * CO2_KG_PER_PAX_KM_CAR);
  const co2BusKg = Math.round(paxDelivered * AVG_TRIP_KM * CO2_KG_PER_PAX_KM_BUS);
  const tripsCompleted = departedBuses.filter((d) => d + avgTripMin <= nowMin).length;
  // kmDriven — accumulated distance based on the SOUTHBOUND timetable. A
  // completed trip counts its full AVG_TRIP_KM (~35 km from the line
  // config weighted by the destination mix); a bus still mid-trip counts
  // half — the partial-trip approximation. Northbound distance is
  // included in the line P&L (getLineMetrics) and the bottom accumulator
  // strip averages across both directions via the destination mix, so we
  // don't double-count here.
  const kmDriven = tripsCompleted * Math.round(AVG_TRIP_KM) + (departedBuses.length - tripsCompleted) * Math.round(AVG_TRIP_KM / 2);
  return {
    simMinutes: nowMin,
    waiting: eng.waiting,
    paxWantBus: eng.demandCum + eng.outDemandCum,
    paxBoarded: eng.boardedCum + eng.outBoardedCum,
    paxDelivered,
    paxAbandoned,
    revenueThb: paxDelivered * 100,
    lostRevenueThb: paxAbandoned * 100,
    co2TaxiKg,
    co2SavedKg: co2TaxiKg - co2BusKg,
    tripsCompleted,
    kmDriven,
    nextDeparture: nextDep ? Math.round(nextDep - nowMin) : null,
    departedBusCount: departedBuses.length,
  };
}

export function computeSimState(): SimState {
  const now = simNow();
  const clockLabel = simClock();

  // 1. Which flights have landed by now?
  const landed = FLIGHTS().filter(f => f.type === "arr" && f.arrMin <= now);
  const totalArrPax = landed.reduce((s, f) => s + f.pax, 0);

  // 1b. Most recently landed flight (for ticker animation)
  const lastLandedFlight = landed.length > 0
    ? landed.reduce((a, b) => a.arrMin > b.arrMin ? a : b)
    : null;

  // 1c. Regional breakdown of arrived passengers
  const regionMap = new Map<string, number>();
  for (const f of landed) {
    const region = getRegion(f.origin);
    regionMap.set(region, (regionMap.get(region) ?? 0) + f.pax);
  }
  const regionBreakdown: RegionData[] = Array.from(regionMap.entries())
    .map(([region, pax]) => ({
      region,
      pax,
      pct: totalArrPax > 0 ? Math.round((pax / totalArrPax) * 100) : 0,
      color: REGION_COLORS[region] ?? "#888",
    }))
    .sort((a, b) => b.pax - a.pax);

  // 2. Next flight
  const upcoming = FLIGHTS().filter(f => f.type === "arr" && f.arrMin > now).sort((a, b) => a.arrMin - b.arrMin);
  const nextFlight = upcoming[0] ?? null;
  const nextFlightMin = nextFlight ? Math.round(nextFlight.arrMin - now) : null;

  // 3–8. Demand, boarding, delivery, queue — ALL from getLiveTotals (the
  // SSOT the 60fps ref-writer also uses), which is COMBINED across both
  // directions: arriving pax riding out + departing pax riding back. One
  // function computes every pax/money figure, so the coarse panel snapshot
  // and the buttery live numbers can never drift — and neither can pax vs ฿.
  const live = getLiveTotals(now);
  const paxWantBus = live.paxWantBus;
  const paxBoarded = live.paxBoarded;
  const paxDelivered = live.paxDelivered;
  const paxAbandoned = live.paxAbandoned;
  const paxAtAirport = live.waiting;      // inbound curb queue right now

  const deps = airportDepartures();
  const departedBuses = deps.filter(d => d <= now);
  // Occupancy denominator matches the combined boarded numerator: seats
  // dispatched in BOTH directions so far (southbound + northbound trips).
  const northboundDeparted = getAirportboundTrips().filter(t => t.originDepMin <= now).length;
  const totalBusCapacity = (departedBuses.length + northboundDeparted) * BUS_CAPACITY;
  const avgTripMin = 75; // weighted average across destinations

  // 9. Next departure
  const nextDeparture = live.nextDeparture;

  // 10. Impact metrics — DERIVED from actual served passengers
  const avgGrabFare = DESTINATIONS.reduce((s, d) => s + d.grabThb * d.pct, 0); // ~720 THB
  const revenueThb = live.revenueThb;
  const grabEquivThb = Math.round(paxDelivered * avgGrabFare);
  const savingsThb = grabEquivThb - revenueThb;
  const co2TaxiKg = live.co2TaxiKg;
  const co2SavedKg = live.co2SavedKg;

  // 11. Trip and km stats
  const tripsCompleted = live.tripsCompleted;
  const kmDriven = live.kmDriven; // partial trips folded in by getLiveTotals

  // 12. Destination breakdown
  const destBreakdown = DESTINATIONS.map(d => ({
    name: d.name,
    served: Math.round(paxDelivered * d.pct),
    revenue: Math.round(paxDelivered * d.pct * 100),
    grabSaved: Math.round(paxDelivered * d.pct * (d.grabThb - 100)),
  }));

  // 13. Active buses and occupancy
  const activeBuses = departedBuses.filter(d => d + avgTripMin + 15 > now).length; // still in service
  const busesMoving = departedBuses.filter(d => d <= now && d + avgTripMin > now).length;
  const busesDwelling = activeBuses - busesMoving;
  // Average occupancy = cumulative pax boarded ÷ cumulative seat capacity dispatched.
  // Apples-to-apples. The earlier formula divided cumulative pax by CURRENT active
  // capacity, which inflated as the day progressed and got clamped to 100%.
  const avgOccupancy = totalBusCapacity > 0
    ? Math.min(1, paxBoarded / totalBusCapacity)
    : 0;

  // 14. Vehicle positions — synthetic airport-line markers carrying the
  // engine's REAL per-trip boarded counts (no more plate-join fallbacks).
  const vehicles = buildVehiclePositions(now);

  return {
    clockLabel, simMinutes: now,
    landedFlights: landed, nextFlight, nextFlightMin, totalArrPax, lastLandedFlight, regionBreakdown,
    paxAtAirport, paxWantBus, paxBoarded, paxDelivered,
    paxAbandoned, lostRevenueThb: paxAbandoned * 100,
    activeBuses, busesMoving, busesDwelling, nextDeparture, avgOccupancy,
    revenueThb, grabEquivThb, savingsThb, co2SavedKg, co2TaxiKg,
    tripsCompleted, kmDriven,
    destBreakdown, vehicles,
  };
}

// ---------------------------------------------------------------------------
// Per-line profitability metrics
// ---------------------------------------------------------------------------

// Local-route occupancy for lines that don't carry airport arrivals.
// Patong and Dragon serve independent commuter/tourist demand — modelled as a
// fixed fraction of their seat capacity per completed trip.
const LOCAL_OCCUPANCY: Record<string, number> = {
  "patong-old-bus-station": 0.42, // daytime local commuter average (Phuket survey est.)
  "dragon-line":            0.31, // tourist loop — lighter, point-to-point riders
};

export function getLineMetrics(): LineMetrics[] {
  const state = computeSimState();
  const now = simNow();

  // Airport line gets 100% of airport-arrival pax (all DESTINATIONS → rawai-airport).
  // Patong and Dragon have independent local ridership computed from completed trips
  // × average occupancy — not from airport passenger flow.
  const airportAlloc = DESTINATIONS.reduce((sum, d) => sum + d.pct, 0); // = 1.0

  return Object.entries(LINE_CONFIG).map(([lineId, config]) => {
    // Operating hours and trips completed so far
    const hoursOperating = now >= 360 ? (now - 360) / 60 : 0;
    const trips = Math.max(1, Math.ceil(hoursOperating * 60 / config.tripDurationMinutes));

    // Passengers: airport line uses BOARDED count (fare collected at entry,
    // not delivery — a bus that picked up 25 pax has earned ฿2,500 even if
    // those pax are still 60 minutes from their destination). Local lines
    // use trip × occupancy with a 2-hour ramp-up.
    const localOcc = LOCAL_OCCUPANCY[lineId];
    const passengersServed = localOcc !== undefined
      ? Math.round(trips * config.capacity * localOcc * Math.min(1, hoursOperating / 2))
      : Math.round(state.paxBoarded * airportAlloc);

    // Revenue from fares
    const revenueThb = passengersServed * config.fare;

    // Operating cost — derived from the SAME ฿800k/bus/year benchmark
    // that drives the /roi payback calculation. Scales linearly with
    // hours operating and number of buses on this line.
    const busesOnLine = BUSES_PER_LINE[lineId] ?? 1;
    const operatingCostThb = Math.round(busesOnLine * HOURLY_OPEX_PER_BUS_THB * hoursOperating);

    // Profit
    const profitThb = revenueThb - operatingCostThb;
    const profitMargin = revenueThb > 0 ? Math.round((profitThb / revenueThb) * 100) : 0;

    // Carbon footprint
    const avgTripKm = config.kmDaily / Math.max(1, trips);
    const carbonSavedKg = Math.round(passengersServed * avgTripKm * (0.21 - 0.06));

    return {
      lineId,
      lineName: config.name,
      passengersServed,
      revenueThb,
      operatingCostThb,
      profitThb,
      profitMargin,
      carbonSavedKg,
      kmDriven: config.kmDaily,
    };
  });
}

// ---------------------------------------------------------------------------
// Vehicle positions — reuse the polyline snapping from v1
// ---------------------------------------------------------------------------

function getPlate(busIdx: number): string {
  return `กข ${1001 + busIdx} ภูเก็ต`;
}

// Get the airport→rawai polyline for positioning buses
let cachedPolyline: LatLngTuple[] | null = null;
let cachedCumMeters: number[] | null = null;

function getPolyline(): { poly: LatLngTuple[]; cum: number[] } {
  if (cachedPolyline && cachedCumMeters) return { poly: cachedPolyline, cum: cachedCumMeters };
  try {
    const poly = getDirectionPolyline("rawai-airport", [8.108, 98.317]); // airport coords
    const cum = [0];
    for (let i = 1; i < poly.length; i++) {
      cum.push(cum[i - 1] + haversineDistanceMeters(poly[i - 1], poly[i]));
    }
    cachedPolyline = poly;
    cachedCumMeters = cum;
    return { poly, cum };
  } catch {
    return { poly: [[8.108, 98.317], [7.772, 98.322]], cum: [0, 40000] };
  }
}

function posOnPoly(meters: number, poly: LatLngTuple[], cum: number[]): { lat: number; lng: number; heading: number } {
  const total = cum[cum.length - 1];
  const d = Math.max(0, Math.min(total, meters));
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const segLen = cum[hi] - cum[lo];
  const r = segLen > 0 ? (d - cum[lo]) / segLen : 0;
  const a = poly[lo], b = poly[hi];
  const lat = a[0] + (b[0] - a[0]) * r;
  const lng = a[1] + (b[1] - a[1]) * r;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180, la2 = (b[0] * Math.PI) / 180;
  const heading = ((Math.atan2(Math.sin(dLon) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon)) * 180) / Math.PI + 360) % 360;
  return { lat, lng, heading };
}

function buildVehiclePositions(nowMin: number): SimState["vehicles"] {
  const { poly, cum } = getPolyline();
  const totalMeters = cum[cum.length - 1];
  const tripDuration = 95; // minutes for full route

  const vehicles: SimState["vehicles"] = [];
  const trips = getDayModel().trips;

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const age = nowMin - trip.depMin;

    // Skip buses that finished their trip + layover
    if (age > tripDuration + 20) continue;
    if (age < -5) continue; // prestart

    let status: "moving" | "dwelling" = "dwelling";
    let meters = 0;

    if (age <= 0) {
      meters = 0; // at airport, waiting
    } else if (age >= tripDuration) {
      meters = totalMeters; // at Rawai, layover
    } else {
      const progress = age / tripDuration;
      meters = progress * totalMeters;
      status = "moving";
    }

    const pos = posOnPoly(meters, poly, cum);
    vehicles.push({
      id: `bus-${i}`,
      lat: pos.lat,
      lng: pos.lng,
      heading: pos.heading,
      status,
      route: "Airport → Rawai",
      // The engine's per-trip boarding count — what THIS bus actually
      // picked up from the queue, not a capacity-division guess.
      pax: trip.boarded,
      plate: getPlate(i),
    });
  }

  return vehicles;
}

// ---------------------------------------------------------------------------
// Utility: get recent and upcoming flights for the feed
// ---------------------------------------------------------------------------

export function getFlightFeed(): { recent: Flight[]; upcoming: Flight[] } {
  const now = simNow();
  const recent = FLIGHTS().filter(f => f.type === "arr" && f.arrMin <= now && f.arrMin > now - 60)
    .sort((a, b) => b.arrMin - a.arrMin)
    .slice(0, 5);
  const upcoming = FLIGHTS().filter(f => f.type === "arr" && f.arrMin > now)
    .sort((a, b) => a.arrMin - b.arrMin)
    .slice(0, 5);
  return { recent, upcoming };
}

// ---------------------------------------------------------------------------
// Hourly demand vs supply — the core of the demand-supply chart
// ---------------------------------------------------------------------------

export type HourlyDemandSupply = {
  hour: number;            // 0–23, but only 6–22 are meaningful
  arrivalPax: number;      // raw arriving passengers from flights
  busDemandPax: number;    // engine queue joins this hour (region-based capture)
  busSeatsAvailable: number; // scheduled bus capacity at this hour
  servedPax: number;       // actually boarded this hour (engine)
  unmetPax: number;        // abandoned this hour (engine)
  revenueThb: number;      // servedPax × fare — INBOUND leg only
};

// Memoized per day-of-week — multiple consumers poll this every second;
// recomputing 24 buckets every call wastes work. The day picker switches
// getSimulationDay(), which switches which memo entry is served.
const hourlyByDow = new Map<number, HourlyDemandSupply[]>();

export function getHourlyDemandSupply(): HourlyDemandSupply[] {
  const dow = getSimulationDay();
  const hit = hourlyByDow.get(dow);
  if (hit) return hit;

  // Airport corridor only — the demand side of this chart is airport
  // arrivals, so the supply side must be airport-line seats. The old
  // version counted EVERY route's departures as supply, including 100-seat
  // ferries. Boats do not pick up the airport queue; that inflation is why
  // the capture numbers never reconciled.
  const corridor = getHourlyCorridor();

  // Raw arriving pax per hour (pre-capture) for the chart's context line.
  const arrivalByHour: number[] = Array.from({ length: 24 }, () => 0);
  for (const f of FLIGHTS()) {
    const bookableMin = f.arrMin + 30;
    const h = Math.floor(bookableMin / 60);
    if (h >= 0 && h < 24) arrivalByHour[h] += f.pax;
  }

  const built = corridor.map((c) => ({
    hour: c.hour,
    arrivalPax: arrivalByHour[c.hour],
    busDemandPax: c.demandPax,
    busSeatsAvailable: c.seats,
    servedPax: c.boardedPax,
    unmetPax: c.abandonedPax,
    revenueThb: c.boardedPax * 100 // inbound-only; corridor.revenueThb is combined
  }));
  hourlyByDow.set(dow, built);
  return built;
}

// ---------------------------------------------------------------------------
// Live demand-supply gap — used by the right-panel "Gap" indicator
// ---------------------------------------------------------------------------

export type SupplyGap = {
  hour: number;
  demandPax: number;
  supplySeats: number;
  gapPax: number;
  status: "surplus" | "balanced" | "shortfall";
};

export function getSupplyGaps(): SupplyGap[] {
  const hourly = getHourlyDemandSupply();
  return hourly.map((h) => {
    const gap = h.busDemandPax - h.busSeatsAvailable;
    let status: SupplyGap["status"] = "balanced";
    if (gap > 20) status = "shortfall";
    else if (gap < -20) status = "surplus";
    return {
      hour: h.hour,
      demandPax: h.busDemandPax,
      supplySeats: h.busSeatsAvailable,
      gapPax: Math.max(0, gap),
      status,
    };
  });
}
