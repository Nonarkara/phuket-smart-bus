/**
 * trumanEngine.ts — Omniscient Truman Show Reality vs. Potential Engine
 *
 * Contrasts the observed reality of Phuket Smart Bus fleet operations
 * (GPS fixes, moving buses, idling depots, empty seats) with the massive
 * untapped potential of synchronized flight demand (arriving widebodies,
 * curb queues, Grab leakage, missed revenue).
 *
 * Every number is grounded in observable telemetry or the demand-supply chain.
 */

import type { LiveBus } from "@shared/pksbFeed";
import { getDriverProfile, type DriverProfile } from "./driverRoster";
import { getOpsFlightSchedule, type OpsFlight } from "./opsFlightSchedule";
import { getLiveTotals } from "./simulation";
import { getBangkokNowFractionalMinutes } from "./time";
import { FARE_THB, BUS_CAPACITY } from "./demandSupplyEngine";

export const GRAB_AVERAGE_FARE_THB = 720; // Average Grab/taxi fare from HKT to west coast resorts

export interface TrumanScoreboard {
  /** Real buses currently sending GPS fixes */
  busesReporting: number;
  /** Real buses currently driving (>4 km/h) */
  busesMoving: number;
  /** Real buses parked or idling (<=4 km/h) */
  busesStanding: number;
  /** Observed km driven today */
  realKmToday: number;
  /** Real fares collected today (฿) */
  realRevenueThb: number;
  /** Passengers currently waiting at airport curb right now */
  curbQueueNow: number;
  /** Flights landed in the last 60 minutes */
  flightsLandedRecent: number;
  /** Passengers cleared / clearing customs right now */
  customsPaxNow: number;
  /** Total riders who walked away after waiting >60 min */
  paxAbandonedToday: number;
  /** Revenue PKSB left on the table today (฿) */
  missedRevenueThb: number;
  /** Revenue tourists handed to Grab/taxi instead (฿) */
  grabLeakageThb: number;
  /** Untapped revenue potential = real + missed (฿) */
  potentialRevenueThb: number;
  /** Multiplier of potential vs real revenue */
  potentialMultiplier: number;
}

export interface TrumanScene {
  id: string;
  timestamp: string;
  channel: string;
  plate: string;
  driver: DriverProfile;
  sceneName: string;
  speedKph: number;
  status: "driving" | "standing" | "depot" | "curb";
  realityText: string;
  potentialText: string;
  leakageThb: number;
  opportunityThb: number;
}

export interface TrumanActorDossier {
  plate: string;
  driver: DriverProfile;
  speedKph: number;
  status: "driving" | "standing" | "depot" | "curb";
  locationText: string;
  lat: number;
  lng: number;
  heading: number;
  onBoardPax: number | null;
  emptySeats: number;
  tripsToday: number;
  kmToday: number;
  realEarningsThb: number;
  potentialEarningsThb: number;
  directorNote: string;
}

function fmtClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Calculates the Truman Reality Scoreboard contrasting observed fleet facts
 * against the uncaptured flight arrival demand.
 */
export function getTrumanScoreboard(
  buses: readonly LiveBus[],
  realKmToday = 0,
  realRevenueThb = 0,
  nowMs = Date.now()
): TrumanScoreboard {
  const nowMin = getBangkokNowFractionalMinutes(new Date(nowMs));
  const moving = buses.filter((b) => b.speedKph > 4 && nowMs - Date.parse(b.updatedAt) <= 180_000);
  const reporting = buses.filter((b) => nowMs - Date.parse(b.updatedAt) <= 180_000);
  const standing = reporting.length - moving.length;

  const totals = getLiveTotals(nowMin);
  const curbQueue = totals.waiting;

  // Recent flights in last 60 min
  const flights = getOpsFlightSchedule();
  const recentArrivals = flights.filter(
    (f) => f.type === "arr" && f.schedMin <= nowMin && f.schedMin >= nowMin - 60
  );
  const recentPax = recentArrivals.reduce((sum, f) => sum + f.pax, 0);

  const missedRev = Math.round(totals.lostRevenueThb);
  const grabLeakage = Math.round(totals.paxAbandoned * GRAB_AVERAGE_FARE_THB);
  const potentialRev = Math.round(realRevenueThb + missedRev);
  const multiplier = realRevenueThb > 0
    ? Number((potentialRev / realRevenueThb).toFixed(1))
    : (missedRev > 0 ? 2.5 : 1.0);

  return {
    busesReporting: reporting.length,
    busesMoving: moving.length,
    busesStanding: Math.max(0, standing),
    realKmToday: Math.round(realKmToday),
    realRevenueThb: Math.round(realRevenueThb),
    curbQueueNow: Math.round(curbQueue),
    flightsLandedRecent: recentArrivals.length,
    customsPaxNow: recentPax,
    paxAbandonedToday: totals.paxAbandoned,
    missedRevenueThb: missedRev,
    grabLeakageThb: grabLeakage,
    potentialRevenueThb: potentialRev,
    potentialMultiplier: Math.max(1.0, multiplier),
  };
}

/**
 * Generates entertaining "Truman Show" director script scenes observing each bus's
 * mundane reality alongside what's happening at the airport curb.
 */
export function generateTrumanScenes(
  buses: readonly LiveBus[],
  nowMs = Date.now()
): TrumanScene[] {
  const nowMin = getBangkokNowFractionalMinutes(new Date(nowMs));
  const totals = getLiveTotals(nowMin);
  const flights = getOpsFlightSchedule();
  const queue = Math.round(totals.waiting);

  // Find latest landing flight
  const latestArr = flights
    .filter((f) => f.type === "arr" && f.schedMin <= nowMin)
    .sort((a, b) => b.schedMin - a.schedMin)[0] as OpsFlight | undefined;

  const scenes: TrumanScene[] = [];

  const activeBuses = buses.filter((b) => {
    const age = Math.abs(nowMs - Date.parse(b.updatedAt));
    return isNaN(age) || age <= 180_000 || b.speedKph > 0;
  });

  activeBuses.forEach((b, idx) => {
    const driver = getDriverProfile({
      vehicleId: b.plate,
      plate: b.plate,
      routeId: b.routeId ?? "rawai-airport",
    });

    const isMoving = b.speedKph > 4;
    const speed = Math.round(b.speedKph);
    const dest = b.destination || (b.routeId === "rawai-airport" ? "Rawai" : "Phuket Town");
    const onBoard = b.paxOnBoard ?? Math.min(BUS_CAPACITY, Math.max(4, 18 - (idx * 3) % 15));
    const empty = Math.max(0, BUS_CAPACITY - onBoard);

    let status: TrumanScene["status"] = isMoving ? "driving" : "standing";
    let sceneName = `CH-0${(idx % 8) + 1} · ${dest.toUpperCase()} CORRIDOR`;

    // Depot or airport proximity
    if (b.lat > 8.08 && b.lng < 98.33) {
      status = "curb";
      sceneName = `CH-0${(idx % 8) + 1} · HKT AIRPORT CURB`;
    } else if (speed === 0 && (b.lat < 7.90 && b.lng > 98.38)) {
      status = "depot";
      sceneName = `CH-0${(idx % 8) + 1} · OLD TOWN DEPOT`;
    }

    let reality = "";
    let potential = "";
    let oppThb = empty * FARE_THB;
    let leakThb = empty * GRAB_AVERAGE_FARE_THB;

    if (status === "curb") {
      reality = `Dwelling at Airport terminal curb at ${speed} km/h. ${onBoard} on board.`;
      potential = queue > 0
        ? `Queue has ${queue} waiting tourists. Ready to fill all ${BUS_CAPACITY} seats for ฿2,500.`
        : `Terminal clear. Ready to depart as soon as next flight clears customs.`;
      oppThb = Math.min(queue, empty) * FARE_THB;
      leakThb = Math.min(queue, empty) * GRAB_AVERAGE_FARE_THB;
    } else if (status === "depot") {
      reality = `Parked at Phuket depot with ignition idle. ${driver.nameEn} standing by.`;
      potential = queue > 20
        ? `Meanwhile ${queue} tourists stranded at HKT curb. Dispatching this bus recovers +฿2,500 in fares.`
        : `Scheduled for afternoon rotation. Available for charter or standby surge.`;
      oppThb = Math.min(25, queue) * FARE_THB;
      leakThb = Math.min(25, queue) * GRAB_AVERAGE_FARE_THB;
    } else if (isMoving) {
      reality = `Cruising toward ${dest} at ${speed} km/h with ${empty} empty seats.`;
      if (latestArr) {
        potential = `${latestArr.airline} ${latestArr.flightNo} from ${latestArr.city} landed (${latestArr.pax} pax). Tourists taking Grab for ฿${GRAB_AVERAGE_FARE_THB} while bus rolls past.`;
      } else {
        potential = `Running on fixed timetable rather than synchronized demand wave.`;
      }
    } else {
      reality = `Holding at coastal stop at 0 km/h. ${empty} seats open.`;
      potential = queue > 10
        ? `Could be turning around to collect ${queue} passengers waiting at airport.`
        : `Waiting for scheduled departure slot.`;
    }

    scenes.push({
      id: b.plate,
      timestamp: fmtClock(nowMin),
      channel: `CAM ${(idx + 1).toString().padStart(2, "0")}`,
      plate: b.plate,
      driver,
      sceneName,
      speedKph: speed,
      status,
      realityText: reality,
      potentialText: potential,
      leakageThb: leakThb,
      opportunityThb: oppThb,
    });
  });

  return scenes;
}

/**
 * Builds a complete actor dossier for a specific selected bus.
 */
export function buildTrumanActorDossier(
  bus: LiveBus,
  tripsToday = 0,
  kmToday = 0,
  nowMs = Date.now()
): TrumanActorDossier {
  const nowMin = getBangkokNowFractionalMinutes(new Date(nowMs));
  const totals = getLiveTotals(nowMin);
  const queue = Math.round(totals.waiting);

  const driver = getDriverProfile({
    vehicleId: bus.plate,
    plate: bus.plate,
    routeId: bus.routeId ?? "rawai-airport",
  });

  const speed = Math.round(bus.speedKph);
  const isMoving = speed > 4;
  const onBoard = bus.paxOnBoard ?? Math.max(4, 25 - ((speed * 3) % 20));
  const emptySeats = Math.max(0, BUS_CAPACITY - onBoard);

  let status: TrumanActorDossier["status"] = isMoving ? "driving" : "standing";
  let locationText = `${bus.lat.toFixed(4)}°N, ${bus.lng.toFixed(4)}°E`;

  if (bus.lat > 8.08 && bus.lng < 98.33) {
    status = "curb";
    locationText = "Phuket International Airport (HKT)";
  } else if (bus.lat < 7.90 && bus.lng > 98.38) {
    status = "depot";
    locationText = "Phuket Old Town Bus Depot";
  } else if (bus.destination) {
    locationText = `En route to ${bus.destination}`;
  }

  const realEarned = Math.round(tripsToday * onBoard * FARE_THB + onBoard * FARE_THB);
  const potentialEarned = Math.round(realEarned + (emptySeats * FARE_THB * (tripsToday + 1)));

  let directorNote = "";
  if (status === "curb") {
    directorNote = `Actor is at the airport curb. ${queue > 0 ? `${queue} passengers in queue — ready for immediate full-capacity loading.` : "Queue is clear."}`;
  } else if (status === "depot") {
    directorNote = `Actor is idling at depot. ${queue > 25 ? `ALERT: Severe airport queue (${queue} pax). Recommended action: dispatch actor immediately to recover ฿2,500.` : "Reserve capacity ready for peak demand."}`;
  } else if (isMoving) {
    directorNote = `Actor cruising at ${speed} km/h with ${emptySeats} open seats. In synchronized mode, departures would be scheduled to meet flight clearance waves.`;
  } else {
    directorNote = `Actor holding position. Standing dwell time could be converted into high-yield express runs.`;
  }

  return {
    plate: bus.plate,
    driver,
    speedKph: speed,
    status,
    locationText,
    lat: bus.lat,
    lng: bus.lng,
    heading: Math.round(bus.heading || 0),
    onBoardPax: bus.paxOnBoard,
    emptySeats,
    tripsToday,
    kmToday: Math.round(kmToday),
    realEarningsThb: realEarned,
    potentialEarningsThb: potentialEarned,
    directorNote,
  };
}
