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
import { getOpsFlightSchedule } from "./opsFlightSchedule";

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

const BANGKOK_TZ = "Asia/Bangkok";
const SIM_SPEED = 20; // 20x real time — watchable but not frantic
const simAnchorMs = Date.now();

function getBangkokFractional(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: BANGKOK_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const [h, m] = fmt.format(date).split(":").map(Number);
  return h * 60 + m + date.getSeconds() / 60 + date.getMilliseconds() / 60000;
}

const anchorMinutes = getBangkokFractional(new Date(simAnchorMs));

// Service window: wrap within 06:00–22:00 so buses are always running
const SVC_START = 360; // 06:00
const SVC_END = 1320;  // 22:00
const SVC_WINDOW = SVC_END - SVC_START;

export function simNow(): number {
  const elapsed = ((Date.now() - simAnchorMs) / 60000) * SIM_SPEED;
  return SVC_START + ((anchorMinutes + elapsed - SVC_START) % SVC_WINDOW + SVC_WINDOW) % SVC_WINDOW;
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

const FULL_DAY_FLIGHTS: Flight[] = getOpsFlightSchedule().map((flight) => ({
  flightNo: flight.flightNo,
  airline: flight.airline,
  origin: flight.city,
  pax: flight.pax,
  arrMin: flight.schedMin,
  type: flight.type,
  terminal: flight.terminal
}));

// ---------------------------------------------------------------------------
// Demand Model: flights → passengers needing buses
// ---------------------------------------------------------------------------

// What % of arriving passengers would take a bus? Based on surveys:
// - Budget travelers: 25-35% (backpackers, budget airlines)
// - Mid-range: 10-15% (prefer Grab but price-sensitive)
// - Premium: 2-5% (have hotel transfers)
// Weighted average across airline mix: ~12%
const BUS_CAPTURE_RATE = 0.12;

// After landing, passengers take 20-45 min to clear customs+baggage
const CUSTOMS_MIN = 20;
const CUSTOMS_MAX = 45;

const FLIGHTS = FULL_DAY_FLIGHTS.filter(
  (flight) => flight.type === "arr" && flight.arrMin >= SVC_START - CUSTOMS_MAX && flight.arrMin <= SVC_END
);

// Destination split (where bus passengers want to go)
export type Destination = { name: string; pct: number; travelMin: number; grabThb: number; busThb: number };

export const DESTINATIONS: Destination[] = [
  { name: "Patong Beach", pct: 0.35, travelMin: 100, grabThb: 800, busThb: 100 },
  { name: "Karon/Kata", pct: 0.20, travelMin: 75, grabThb: 700, busThb: 100 },
  { name: "Phuket Town", pct: 0.18, travelMin: 56, grabThb: 500, busThb: 100 },
  { name: "Kamala/Surin", pct: 0.12, travelMin: 80, grabThb: 750, busThb: 100 },
  { name: "Rawai/Nai Harn", pct: 0.08, travelMin: 95, grabThb: 900, busThb: 100 },
  { name: "Laguna/Bang Tao", pct: 0.07, travelMin: 40, grabThb: 450, busThb: 100 },
];

// Bus timetable: departures from airport (minutes from midnight)
// From the official PKSB timetable (Airport→Rawai direction)
const AIRPORT_DEPARTURES = [
  495, 540, 600, 660, 720, 780, 840, 870, 900, 960, 1020, 1080, 1140, 1200, 1260, 1320, 1380, 1410
];

const BUS_CAPACITY = 25;
const NUM_BUSES = 20;

// ---------------------------------------------------------------------------
// Regional origin mapping
// ---------------------------------------------------------------------------

const REGION_MAP: Record<string, string> = {
  "Bangkok": "SE Asia", "Singapore": "SE Asia", "Kuala Lumpur": "SE Asia",
  "Beijing": "China", "Shanghai": "China", "Guangzhou": "China", "Hong Kong": "China",
  "Seoul": "East Asia", "Tokyo": "East Asia",
  "Moscow": "Russia/CIS", "Novosibirsk": "Russia/CIS", "Yekaterinburg": "Russia/CIS",
  "Delhi": "India",
  "Doha": "Middle East", "Dubai": "Middle East",
  "Frankfurt": "Europe", "Milan": "Europe", "London": "Europe",
};

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

const LINE_CONFIG: Record<string, { name: string; kmDaily: number; fare: number; capacity: number }> = {
  "rawai-airport": { name: "Airport → Patong", kmDaily: 600, fare: 100, capacity: 25 },
  "patong-old-bus-station": { name: "Patong → Old Town", kmDaily: 200, fare: 100, capacity: 25 },
  "dragon-line": { name: "Dragon Loop", kmDaily: 50, fare: 100, capacity: 15 },
};

const FUEL_COST_PER_KM = 0.15; // 0.15 THB/km
const DRIVER_COST_PER_DAY = 400;
const MAINTENANCE_PER_TRIP = 50;

function getRegion(origin: string): string {
  return REGION_MAP[origin] ?? "Other";
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
  co2SavedKg: number;      // paxDelivered × avgTripKm × 0.15
  co2TaxiKg: number;       // what taxis would have emitted
  tripsCompleted: number;
  kmDriven: number;

  // Per-destination breakdown
  destBreakdown: { name: string; served: number; revenue: number; grabSaved: number }[];

  // Vehicle positions for the map
  vehicles: { id: string; lat: number; lng: number; heading: number; status: "moving" | "dwelling"; route: string; pax: number; plate: string }[];
};

export function computeSimState(): SimState {
  const now = simNow();
  const clockLabel = simClock();

  // 1. Which flights have landed by now?
  const landed = FLIGHTS.filter(f => f.type === "arr" && f.arrMin <= now);
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
  const upcoming = FLIGHTS.filter(f => f.type === "arr" && f.arrMin > now).sort((a, b) => a.arrMin - b.arrMin);
  const nextFlight = upcoming[0] ?? null;
  const nextFlightMin = nextFlight ? Math.round(nextFlight.arrMin - now) : null;

  // 3. Passengers who've cleared customs and want transport (20-45 min after landing)
  const avgCustoms = (CUSTOMS_MIN + CUSTOMS_MAX) / 2;
  let paxReady = 0;
  for (const f of landed) {
    const readyAt = f.arrMin + avgCustoms;
    if (readyAt <= now) {
      paxReady += f.pax;
    } else {
      // Partial: some fast, some slow
      const progress = Math.max(0, (now - f.arrMin - CUSTOMS_MIN) / (CUSTOMS_MAX - CUSTOMS_MIN));
      paxReady += Math.round(f.pax * Math.min(1, progress));
    }
  }

  // 4. How many want the bus?
  const paxWantBus = Math.round(paxReady * BUS_CAPTURE_RATE);

  // 5. Bus departures that have happened
  const departedBuses = AIRPORT_DEPARTURES.filter(d => d <= now);
  const totalBusCapacity = departedBuses.length * BUS_CAPACITY;

  // 6. How many actually boarded? (min of demand and capacity)
  const paxBoarded = Math.min(paxWantBus, totalBusCapacity);

  // 7. How many delivered? (boarded minus those still in transit)
  const avgTripMin = 75; // weighted average across destinations
  let paxDelivered = 0;
  let cumCapacity = 0;
  for (const dep of departedBuses) {
    const busLoad = Math.min(BUS_CAPACITY, Math.max(0, paxWantBus - cumCapacity));
    cumCapacity += BUS_CAPACITY;
    const deliveryTime = dep + avgTripMin;
    if (deliveryTime <= now) {
      paxDelivered += busLoad;
    } else if (dep + 10 <= now) {
      // Partial delivery: some stops along the way
      const tripProgress = (now - dep) / avgTripMin;
      paxDelivered += Math.round(busLoad * tripProgress * 0.5); // early stops deliver fewer
    }
  }

  // 8. Waiting at airport
  const paxAtAirport = Math.max(0, paxWantBus - paxBoarded);

  // 9. Next departure
  const nextDep = AIRPORT_DEPARTURES.find(d => d > now);
  const nextDeparture = nextDep ? Math.round(nextDep - now) : null;

  // 10. Impact metrics — DERIVED from actual served passengers
  const avgGrabFare = DESTINATIONS.reduce((s, d) => s + d.grabThb * d.pct, 0); // ~720 THB
  const revenueThb = paxDelivered * 100;
  const grabEquivThb = Math.round(paxDelivered * avgGrabFare);
  const savingsThb = grabEquivThb - revenueThb;
  const avgTripKm = 28; // weighted average route distance
  const co2PerPaxKmCar = 0.21; // kg CO2 per pax-km by car (APTA)
  const co2PerPaxKmBus = 0.06; // kg CO2 per pax-km by bus (APTA)
  const co2TaxiKg = Math.round(paxDelivered * avgTripKm * co2PerPaxKmCar);
  const co2BusKg = Math.round(paxDelivered * avgTripKm * co2PerPaxKmBus);
  const co2SavedKg = co2TaxiKg - co2BusKg;

  // 11. Trip and km stats
  const tripsCompleted = departedBuses.filter(d => d + avgTripMin <= now).length;
  const kmDriven = tripsCompleted * 35 + (departedBuses.length - tripsCompleted) * 17; // partial trips

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
  const avgOccupancy = activeBuses > 0 ? Math.min(1, paxBoarded / (activeBuses * BUS_CAPACITY)) : 0;

  // 14. Vehicle positions — use the existing polyline engine
  const vehicles = buildVehiclePositions(departedBuses, now, paxWantBus);

  return {
    clockLabel, simMinutes: now,
    landedFlights: landed, nextFlight, nextFlightMin, totalArrPax, lastLandedFlight, regionBreakdown,
    paxAtAirport, paxWantBus, paxBoarded, paxDelivered,
    activeBuses, busesMoving, busesDwelling, nextDeparture, avgOccupancy,
    revenueThb, grabEquivThb, savingsThb, co2SavedKg, co2TaxiKg,
    tripsCompleted, kmDriven,
    destBreakdown, vehicles,
  };
}

// ---------------------------------------------------------------------------
// Per-line profitability metrics
// ---------------------------------------------------------------------------

export function getLineMetrics(): LineMetrics[] {
  const state = computeSimState();
  const now = simNow();

  // Allocate passengers proportionally across lines by activity
  // Airport line gets most (60% of passengers), Patong gets 25%, Dragon gets 15%
  const allocationPct = { "rawai-airport": 0.60, "patong-old-bus-station": 0.25, "dragon-line": 0.15 };

  return Object.entries(LINE_CONFIG).map(([lineId, config]) => {
    const pct = allocationPct[lineId as keyof typeof allocationPct] ?? 0;
    const passengersServed = Math.round(state.paxDelivered * pct);

    // Revenue from fares
    const revenueThb = passengersServed * config.fare;

    // Operating cost (hourly)
    const hoursOperating = now >= 360 ? (now - 360) / 60 : 0; // 06:00 start
    const trips = Math.ceil(hoursOperating * 60 / 90); // Approx trips per line per day
    const fuelCost = config.kmDaily * FUEL_COST_PER_KM;
    const driverCost = DRIVER_COST_PER_DAY * (hoursOperating / 16); // Spread across 16h day
    const maintenanceCost = trips * MAINTENANCE_PER_TRIP;
    const operatingCostThb = Math.round(fuelCost + driverCost + maintenanceCost);

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

const PLATES = Array.from({ length: NUM_BUSES }, (_, i) =>
  `กข ${1001 + i} ภูเก็ต`
);

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

function buildVehiclePositions(
  departedBuses: number[],
  nowMin: number,
  demandPax: number
): SimState["vehicles"] {
  const { poly, cum } = getPolyline();
  const totalMeters = cum[cum.length - 1];
  const tripDuration = 95; // minutes for full route

  const vehicles: SimState["vehicles"] = [];
  let cumBoarded = 0;

  for (let i = 0; i < departedBuses.length; i++) {
    const dep = departedBuses[i];
    const age = nowMin - dep;

    // Skip buses that finished their trip + layover
    if (age > tripDuration + 20) continue;
    if (age < -5) continue; // prestart

    const busIdx = i % NUM_BUSES;
    const paxOnBus = Math.min(BUS_CAPACITY, Math.max(0, demandPax - cumBoarded));
    cumBoarded += BUS_CAPACITY;

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
      id: `bus-${busIdx}`,
      lat: pos.lat,
      lng: pos.lng,
      heading: pos.heading,
      status,
      route: "Airport → Rawai",
      pax: Math.min(paxOnBus, BUS_CAPACITY),
      plate: PLATES[busIdx],
    });
  }

  return vehicles;
}

// ---------------------------------------------------------------------------
// Utility: get recent and upcoming flights for the feed
// ---------------------------------------------------------------------------

export function getFlightFeed(): { recent: Flight[]; upcoming: Flight[] } {
  const now = simNow();
  const recent = FLIGHTS.filter(f => f.type === "arr" && f.arrMin <= now && f.arrMin > now - 60)
    .sort((a, b) => b.arrMin - a.arrMin)
    .slice(0, 5);
  const upcoming = FLIGHTS.filter(f => f.type === "arr" && f.arrMin > now)
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
  busDemandPax: number;    // arrivalPax × BUS_CAPTURE_RATE
  busSeatsAvailable: number; // scheduled bus capacity at this hour
  servedPax: number;       // min(demand, supply)
  unmetPax: number;        // demand - supply when positive
  revenueThb: number;      // servedPax × fare
};

export function getHourlyDemandSupply(): HourlyDemandSupply[] {
  // 1) Bucket flight arrivals into hours, accounting for ~30 min customs lag.
  const arrivalByHour: number[] = Array.from({ length: 24 }, () => 0);
  for (const f of FLIGHTS) {
    // Bus demand appears ~30 min after touchdown (customs+baggage)
    const bookableMin = f.arrMin + 30;
    const h = Math.floor(bookableMin / 60);
    if (h >= 0 && h < 24) arrivalByHour[h] += f.pax;
  }

  // 2) Bucket scheduled bus departures into hours; each bus leaves with a full
  //    25-seat capacity. Multiple departures within the same hour stack.
  const seatsByHour: number[] = Array.from({ length: 24 }, () => 0);
  for (const dep of AIRPORT_DEPARTURES) {
    const h = Math.floor(dep / 60);
    if (h >= 0 && h < 24) seatsByHour[h] += BUS_CAPACITY;
  }

  // 3) Combine — per-hour demand vs supply.
  return arrivalByHour.map((pax, hour) => {
    const busDemandPax = Math.round(pax * BUS_CAPTURE_RATE);
    const busSeatsAvailable = seatsByHour[hour];
    const servedPax = Math.min(busDemandPax, busSeatsAvailable);
    const unmetPax = Math.max(0, busDemandPax - busSeatsAvailable);
    const revenueThb = servedPax * 100; // ฿100 fare flat
    return {
      hour,
      arrivalPax: pax,
      busDemandPax,
      busSeatsAvailable,
      servedPax,
      unmetPax,
      revenueThb
    };
  });
}
