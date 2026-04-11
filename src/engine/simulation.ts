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
};

// Peak day (Dec 30): ~190 arrivals. We model the most visible ones.
const FLIGHTS: Flight[] = [
  // Morning wave 06:00-09:00
  { flightNo: "TG201", airline: "Thai Airways", origin: "Bangkok", pax: 174, arrMin: 365, type: "arr" },
  { flightNo: "FD3021", airline: "AirAsia", origin: "Bangkok", pax: 186, arrMin: 380, type: "arr" },
  { flightNo: "QR838", airline: "Qatar Airways", origin: "Doha", pax: 280, arrMin: 400, type: "arr" },
  { flightNo: "EK378", airline: "Emirates", origin: "Dubai", pax: 385, arrMin: 420, type: "arr" },
  { flightNo: "SQ720", airline: "Singapore Airlines", origin: "Singapore", pax: 303, arrMin: 445, type: "arr" },
  { flightNo: "AK800", airline: "AirAsia", origin: "Kuala Lumpur", pax: 186, arrMin: 475, type: "arr" },
  { flightNo: "PG270", airline: "Bangkok Airways", origin: "Bangkok", pax: 144, arrMin: 490, type: "arr" },
  { flightNo: "SL802", airline: "Thai Lion Air", origin: "Bangkok", pax: 189, arrMin: 510, type: "arr" },
  // Mid-morning 09:00-12:00
  { flightNo: "CA821", airline: "Air China", origin: "Beijing", pax: 280, arrMin: 545, type: "arr" },
  { flightNo: "MU2071", airline: "China Eastern", origin: "Shanghai", pax: 280, arrMin: 570, type: "arr" },
  { flightNo: "CX771", airline: "Cathay Pacific", origin: "Hong Kong", pax: 280, arrMin: 610, type: "arr" },
  { flightNo: "KE667", airline: "Korean Air", origin: "Seoul", pax: 280, arrMin: 635, type: "arr" },
  { flightNo: "9C8901", airline: "Spring Airlines", origin: "Shanghai", pax: 186, arrMin: 655, type: "arr" },
  { flightNo: "TG207", airline: "Thai Airways", origin: "Bangkok", pax: 174, arrMin: 680, type: "arr" },
  // Afternoon 12:00-16:00
  { flightNo: "TR530", airline: "Scoot", origin: "Singapore", pax: 280, arrMin: 720, type: "arr" },
  { flightNo: "6E1401", airline: "IndiGo", origin: "Delhi", pax: 186, arrMin: 760, type: "arr" },
  { flightNo: "TG211", airline: "Thai Airways", origin: "Bangkok", pax: 174, arrMin: 800, type: "arr" },
  { flightNo: "CZ6081", airline: "China Southern", origin: "Guangzhou", pax: 280, arrMin: 840, type: "arr" },
  { flightNo: "MH781", airline: "Malaysia Airlines", origin: "Kuala Lumpur", pax: 280, arrMin: 870, type: "arr" },
  // Evening 16:00-21:00
  { flightNo: "ZF2401", airline: "Azur Air", origin: "Moscow", pax: 350, arrMin: 960, type: "arr" },
  { flightNo: "SU271", airline: "Aeroflot", origin: "Moscow", pax: 310, arrMin: 990, type: "arr" },
  { flightNo: "DE2177", airline: "Condor", origin: "Frankfurt", pax: 280, arrMin: 1020, type: "arr" },
  { flightNo: "S7761", airline: "S7 Airlines", origin: "Novosibirsk", pax: 186, arrMin: 1050, type: "arr" },
  { flightNo: "NO531", airline: "Neos", origin: "Milan", pax: 280, arrMin: 1080, type: "arr" },
  { flightNo: "ZF2403", airline: "Azur Air", origin: "Yekaterinburg", pax: 350, arrMin: 1110, type: "arr" },
  { flightNo: "TG217", airline: "Thai Airways", origin: "Bangkok", pax: 174, arrMin: 1200, type: "arr" },
];

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
