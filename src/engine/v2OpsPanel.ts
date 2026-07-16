/**
 * v2 Operations Panel helpers — derived entirely from the engine.
 *
 * Two views on top of the same day model:
 *
 *   getHourlyBalance(hour) — three numbers per hour:
 *     arrivalPax    · raw arriving passengers that hour
 *     busEligible   · 12% who join the bus queue (engine demand curve)
 *     busSeats      · airport-line seats departing that hour
 *     + status pill (SHORTFALL / TIGHT / BALANCED / SURPLUS)
 *
 *   getOperatorFleetRow(vehicle) — one row per in-service vehicle:
 *     plate, route, status, load %, position, ETA, problem flag.
 *
 * No values are decorative; every field traces to demandSupplyEngine,
 * opsFlightSchedule or fleetSimulator — the same chain that produces the
 * accum bar at the bottom of the screen.
 */

import type { VehiclePosition } from "@shared/types";
import { getOpsFlightSchedule, getSimulationDay } from "./opsFlightSchedule";
import { getSimulatedMinutes, getVehiclesNow } from "./fleetSimulator";
import {
  atMinute,
  getDayModel,
  getHourlyCorridor,
  getTripLoad,
  getReturnTripLoad,
  BUS_CAPACITY
} from "./demandSupplyEngine";

// ---------------------------------------------------------------------------
// Hourly Demand-Supply Balance — the chart that makes over/under-supply obvious
// ---------------------------------------------------------------------------

export type HourlyBalanceStatus = "shortfall" | "tight" | "balanced" | "surplus";

export type HourlyBalance = {
  hour: number;
  arrivalPax: number;     // raw arriving pax this hour (pre-capture, context line)
  // Inbound leg: airport → island
  busEligiblePax: number; // engine queue joins this hour (region-based capture)
  busSeats: number;       // southbound seats this hour
  capturedPax: number;    // actually boarded this hour (engine)
  abandonedPax: number;   // gave up after 60 min (engine)
  // Return leg: island → airport (departing flights)
  outEligiblePax: number; // needed a bus-to-airport this hour
  outSeats: number;       // northbound seats this hour
  outCapturedPax: number;
  outLostPax: number;
  // Verdict + money. Gaps are tracked PER DIRECTION — an hour can need a
  // southbound bus while northbound seats run empty; a combined number
  // would hide exactly the "underdemanded" hours the operator asked about.
  gapPax: number;         // net: total demand − total seats
  emptySeatsPax: number;  // Σ per-direction surplus seats this hour
  missedThb: number;      // (abandoned + outLost) × ฿100 this hour
  earnedThb: number;      // (captured + outCaptured) × ฿100 this hour
  status: HourlyBalanceStatus;
};

const SHORTFALL_THRESHOLD = 25; // pax gap that triggers "shortfall"

/** Direction-aware verdict: a shortage in EITHER direction needs a bus
 *  (that's where ฿100/boarding is being missed); only when neither is
 *  short can the hour read as light/balanced. */
function classify(inGap: number, outGap: number, demand: number, seats: number): HourlyBalanceStatus {
  if (demand === 0 && seats === 0) return "balanced";
  const worst = Math.max(inGap, outGap);
  if (worst > SHORTFALL_THRESHOLD) return "shortfall";
  if (worst > 0) return "tight";
  if (Math.min(inGap, outGap) < -SHORTFALL_THRESHOLD) return "surplus";
  return "balanced";
}

/** Memoized per day-of-week — the /ops day picker switches the active day. */
const balanceByDow = new Map<number, HourlyBalance[]>();

export function getHourlyBalance(): HourlyBalance[] {
  const dow = getSimulationDay();
  const hit = balanceByDow.get(dow);
  if (hit) return hit;

  // Raw arriving pax per hour — what came in on flights, ignoring the
  // customs ramp. Gives the "demand" bar a fixed shape independent of the
  // bus engine's distributed absorption.
  const arrivals = getOpsFlightSchedule().filter((f) => f.type === "arr");
  const arrivalByHour = new Array<number>(24).fill(0);
  for (const f of arrivals) {
    const h = Math.floor(f.schedMin / 60) % 24;
    arrivalByHour[h] += f.pax;
  }

  // Demand & supply for BOTH directions come straight from the engine —
  // no parallel math, no flat capture rate.
  const corridor = getHourlyCorridor();

  const built = corridor.map((c) => {
    const inGap = c.demandPax - c.seats;
    const outGap = c.outDemandPax - c.outSeats;
    const totalDemand = c.demandPax + c.outDemandPax;
    const totalSeats = c.seats + c.outSeats;
    return {
      hour: c.hour,
      arrivalPax: arrivalByHour[c.hour],
      busEligiblePax: c.demandPax,
      busSeats: c.seats,
      capturedPax: c.boardedPax,
      abandonedPax: c.abandonedPax,
      outEligiblePax: c.outDemandPax,
      outSeats: c.outSeats,
      outCapturedPax: c.outBoardedPax,
      outLostPax: c.outLostPax,
      gapPax: totalDemand - totalSeats,
      emptySeatsPax: Math.max(0, -inGap) + Math.max(0, -outGap),
      missedThb: c.missedThb,
      earnedThb: c.revenueThb,
      status: classify(inGap, outGap, totalDemand, totalSeats)
    };
  });
  balanceByDow.set(dow, built);
  return built;
}

// ---------------------------------------------------------------------------
// Per-vehicle operations row — every bus with status, load, problem flag
// ---------------------------------------------------------------------------

export type BusProblem = "RUNNING_EMPTY" | "STUCK" | "IDLE_QUEUED" | "FULL" | null;

export type OperatorFleetRow = {
  vehicleId: string;
  plate: string;
  routeId: string;
  direction: string;
  status: "MOVING" | "IDLE" | "LAYOVER" | "PRE_TRIP";
  load: number;          // seated pax right now
  capacity: number;      // BUS_CAPACITY or 15 for dragon-line
  loadPct: number;       // 0–100
  tripStartMin: number | null;
  ageMin: number | null;
  tripProgressPct: number | null; // 0–100 along trip
  etaMin: number | null; // minutes until scheduled terminus
  freshness: "fresh" | "stale";
  /** Operator-flagged problem (alert level). FULL is informational,
   *  surfaced separately on the row but NOT counted in the alert
   *  pill — an over-full bus is exactly what we want during a peak. */
  problem: BusProblem;
  /** True when the bus is at ≥92% capacity — surfaced as the FULL
   *  tag so operators see capacity utilisation without it spamming
   *  the alert total. */
  full: boolean;
  problemDetail: string;
  // For DevTools-friendly tooltip — keeps the data here, not in JSX
  summary: string;
};

const NOMINAL_TRIP_MIN: Record<string, number> = {
  "rawai-airport": 95,
  "patong-old-bus-station": 35,
  "dragon-line": 50
};

/** Bus routes — ferries are not buses. The operator panel must not show
 *  vessels with their passenger counts; that produced "AW Master I ·
 *  rassada-phi-phi · 25/25 MOVING" which is a boat, not a bus. */
const LAND_BUS_ROUTES = new Set<string>(Object.keys(NOMINAL_TRIP_MIN));

function isBusRoute(routeId: string): boolean {
  return LAND_BUS_ROUTES.has(routeId);
}

function busCapacity(routeId: string): number {
  if (routeId === "dragon-line") return 15;
  return BUS_CAPACITY;
}

function loadForVehicle(v: VehiclePosition): number {
  if (v.routeId === "rawai-airport" && v.tripStartMin != null) {
    // Both airport-line directions carry ENGINE loads now: southbound buses
    // board the arrival queue; northbound buses carry departing pax racing
    // their check-in deadline.
    const load = v.directionLabel === "Bus to Airport"
      ? getReturnTripLoad(v.tripStartMin)
      : getTripLoad(v.tripStartMin);
    if (load !== null) return load;
  }
  // Local lines / no trip start: deterministic local estimate
  const cap = busCapacity(v.routeId);
  const occ = v.routeId === "patong-old-bus-station"
    ? 0.42
    : v.routeId === "dragon-line"
      ? 0.31
      : 0.35;
  return Math.round(cap * occ);
}

let lastVehicles = new Map<string, VehiclePosition>();
let lastFetchTick = -1;

/** The operator panel reads from getVehiclesNow() — but the rest of the
 *  dashboard also calls it on every tick. Memoize per synthetic tick so
 *  both consumers see a stable snapshot. */
function getVehiclesCached(): VehiclePosition[] {
  const tick = Math.floor(performance.now() / 250);
  if (tick !== lastFetchTick) {
    lastVehicles = new Map(getVehiclesNow().map((v) => [v.vehicleId, v]));
    lastFetchTick = tick;
  }
  return [...lastVehicles.values()];
}

export function getOperatorFleet(): OperatorFleetRow[] {
  const nowMin = getSimulatedMinutes();
  const waiting = atMinute(nowMin).waiting;
  const vehicles = getVehiclesCached().filter((v) => isBusRoute(v.routeId));

  return vehicles
    .map((v): OperatorFleetRow => {
      const cap = busCapacity(v.routeId);
      const load = loadForVehicle(v);
      const loadPct = Math.round((load / cap) * 100);
      const tripStart = v.tripStartMin ?? null;
      const ageMin = tripStart != null ? nowMin - tripStart : null;
      const tripDuration = NOMINAL_TRIP_MIN[v.routeId] ?? 95;
      const tripProgressPct = tripStart != null && ageMin != null
        ? Math.max(0, Math.min(100, Math.round((ageMin / tripDuration) * 100)))
        : null;
      const etaMin = tripStart != null && ageMin != null
        ? Math.max(-99, Math.round(tripDuration - ageMin))
        : null;

      let status: OperatorFleetRow["status"];
      if (tripStart == null) status = "LAYOVER";
      else if (ageMin! < 0) status = "PRE_TRIP";
      else if (ageMin! > tripDuration + 15) status = "LAYOVER";
      else if (v.status === "moving") status = "MOVING";
      else if (ageMin! < 5) status = "PRE_TRIP";
      else status = "IDLE";

      const full = load >= Math.round(cap * 0.92);
      let problem: BusProblem = null;
      let problemDetail = "";
      if (full) {
        // FULL is informational, not an alert — surfaced as a separate tag
        problem = null;
        problemDetail = `${load}/${cap} seats filled`;
      }
      if (status === "IDLE" && ageMin != null && ageMin > 12 && ageMin < tripDuration && load < cap * 0.3 && waiting > 15) {
        // Dwelling deep into a trip with empty seats while passengers wait → STUCK
        problem = "STUCK";
        problemDetail = `Stopped ${Math.round(ageMin - 12)} min onto trip · ${waiting} waiting at curb`;
      } else if (status === "MOVING" && load < cap * 0.25 && waiting > 25) {
        problem = "RUNNING_EMPTY";
        problemDetail = `${load}/${cap} seats · ${waiting} waiting at curb`;
      } else if (status === "IDLE" && load === 0 && waiting > 10) {
        problem = "IDLE_QUEUED";
        problemDetail = `Empty bus at airport — ${waiting} waiting`;
      }

      return {
        vehicleId: v.vehicleId,
        plate: v.licensePlate,
        routeId: v.routeId,
        direction: v.directionLabel || "—",
        status,
        load,
        capacity: cap,
        loadPct,
        tripStartMin: tripStart,
        ageMin,
        tripProgressPct,
        etaMin,
        freshness: v.freshness,
        problem,
        full,
        problemDetail,
        summary: `${v.licensePlate} · ${load}/${cap} pax (${loadPct}%) · ${v.status === "moving" ? "moving" : "dwelling"} · ${v.directionLabel ?? "—"}`
      };
    })
    .sort((a, b) => {
      // Problem vehicles first (worst at top), then moving, then by plate
      const ap = a.problem ? 0 : 1;
      const bp = b.problem ? 0 : 1;
      if (ap !== bp) return ap - bp;
      if (a.status === "MOVING" && b.status !== "MOVING") return -1;
      if (b.status === "MOVING" && a.status !== "MOVING") return 1;
      return a.plate.localeCompare(b.plate);
    });
}

// ---------------------------------------------------------------------------
// Queue timeline — every 5-min snapshot the engine has already computed
// ---------------------------------------------------------------------------

export type QueueTimelinePoint = {
  min: number;
  waiting: number;
  demandCum: number;
  boardedCum: number;
  abandonedCum: number;
};

export function getQueueTimeline(): QueueTimelinePoint[] {
  return getDayModel().snapshots;
}

// ---------------------------------------------------------------------------
// Peak badge — best/worst hours for the header chip
// ---------------------------------------------------------------------------

export type HourPeak = {
  worstShortfallHour: number | null;
  worstShortfallGap: number;
  biggestSurplusHour: number | null;
  biggestSurplus: number;
  totalShortfallHours: number;
};

export function getHourPeaks(): HourPeak {
  const rows = getHourlyBalance();
  let worstShortfallHour: number | null = null;
  let worstShortfallGap = 0;
  let biggestSurplusHour: number | null = null;
  let biggestSurplus = 0;
  let totalShortfallHours = 0;
  for (const r of rows) {
    if (r.gapPax > worstShortfallGap) {
      worstShortfallGap = r.gapPax;
      worstShortfallHour = r.hour;
    }
    if (-r.gapPax > biggestSurplus) {
      biggestSurplus = -r.gapPax;
      biggestSurplusHour = r.hour;
    }
    if (r.status === "shortfall") totalShortfallHours += 1;
  }
  return { worstShortfallHour, worstShortfallGap, biggestSurplusHour, biggestSurplus, totalShortfallHours };
}
