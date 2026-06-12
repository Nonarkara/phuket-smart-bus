/**
 * Aircraft registry — the "what airplane is the airline sending" layer.
 *
 * This is the data an airport operations API (AeroDataBox, FlightAware,
 * AOT's own feed) returns per flight: aircraft type + seat configuration.
 * From seats we derive load factor, and from load factor the demand story
 * becomes traceable: airline → aircraft → seats → pax → bus demand.
 *
 * Static registry today, API-ready shape for Phase 2 — when AOT grants the
 * real HKT feed, only the source swaps; every consumer keeps these types.
 *
 * Seat counts are real published configurations (airline-typical single
 * config or the densest variant for charters).
 */

export type Aircraft = {
  /** ICAO type code, e.g. "A333" */
  code: string;
  /** Marketing name, e.g. "Airbus A330-300" */
  name: string;
  /** Typical seat count for the airlines that fly this type into HKT */
  seats: number;
};

const AIRCRAFT: Record<string, Aircraft> = {
  A320: { code: "A320", name: "Airbus A320", seats: 180 },
  A20N: { code: "A20N", name: "Airbus A320neo", seats: 186 },
  A321: { code: "A321", name: "Airbus A321", seats: 230 },
  A333: { code: "A333", name: "Airbus A330-300", seats: 290 },
  A359: { code: "A359", name: "Airbus A350-900", seats: 325 },
  B738: { code: "B738", name: "Boeing 737-800", seats: 189 },
  B739: { code: "B739", name: "Boeing 737-900ER", seats: 215 },
  B77W: { code: "B77W", name: "Boeing 777-300ER", seats: 396 },
  B788: { code: "B788", name: "Boeing 787-8", seats: 248 },
  B789: { code: "B789", name: "Boeing 787-9", seats: 296 },
  AT76: { code: "AT76", name: "ATR 72-600", seats: 70 },
};

/**
 * Which aircraft each airline actually flies into HKT.
 * Ordered smallest → largest; the assignment picks the smallest type
 * that fits the flight's estimated pax (so a 350-pax Azur charter gets
 * the 777, a 144-pax Bangkok Airways hop gets the A320).
 */
const AIRLINE_FLEET: Record<string, string[]> = {
  "Thai Airways": ["A320", "A333", "B77W"],
  "Bangkok Airways": ["AT76", "A320"],
  "Thai AirAsia": ["A320", "A321"],
  "AirAsia": ["A320", "A321"],
  "AirAsia Malaysia": ["A320", "A321"],
  "Thai Lion Air": ["B738", "B739"],
  "Nok Air": ["B738"],
  "Thai Vietjet": ["A320", "A321"],
  "Thai Vietjet Air": ["A320", "A321"],
  "VietJet Air": ["A320", "A321"],
  "Singapore Airlines": ["B738", "A359", "B77W"],
  "Scoot": ["B788", "B789"],
  "Emirates": ["B77W", "A359"],
  "Qatar Airways": ["A333", "B77W"],
  "Etihad Airways": ["B789"],
  "Finnair": ["A333", "A359"],
  "Aeroflot": ["A333", "B77W"],
  "Azur Air": ["B739", "B77W"],
  "S7 Airlines": ["A320", "B738"],
  "Ural Airlines": ["A321"],
  "Air China": ["A333", "B789"],
  "China Eastern": ["A333", "B789"],
  "China Southern": ["A333", "B789"],
  "Spring Airlines": ["A320", "A321"],
  "Sichuan Airlines": ["A333"],
  "Juneyao Airlines": ["B789"],
  "HK Express": ["A320", "A321"],
  "Cathay Pacific": ["A333", "A359"],
  "Korean Air": ["A333", "B789"],
  "Asiana Airlines": ["A333"],
  "T'way Air": ["B738"],
  "Jeju Air": ["B738"],
  "IndiGo": ["A320", "A321"],
  "Air India Express": ["B738"],
  "Malaysia Airlines": ["B738", "A333"],
  "Batik Air Malaysia": ["B738"],
  "Condor": ["A333", "B77W"],
  "Neos": ["B788", "B789"],
  "Edelweiss Air": ["A333"],
  "Lufthansa": ["A359"],
  "Turkish Airlines": ["A333", "B77W"],
  "El Al": ["B789"],
  "Gulf Air": ["B789"],
  "Oman Air": ["B789"],
  "SriLankan Airlines": ["A333"],
  "Vietnam Airlines": ["A321"],
  "Cebu Pacific": ["A320", "A321"],
  "Myanmar Airways International": ["A320"],
};

const DEFAULT_LADDER = ["A320", "A321", "A333", "B77W"];

/**
 * Deterministic assignment: smallest aircraft in the airline's HKT fleet
 * whose seat count covers the estimated pax at ≤ 95% load. Falls back to
 * the largest type the airline flies (charter-full).
 */
export function assignAircraft(airline: string, estimatedPax: number): Aircraft {
  const ladder = AIRLINE_FLEET[airline] ?? DEFAULT_LADDER;
  for (const code of ladder) {
    const ac = AIRCRAFT[code];
    if (ac && estimatedPax <= ac.seats * 0.95) return ac;
  }
  return AIRCRAFT[ladder[ladder.length - 1]] ?? AIRCRAFT.A321;
}

/** Load factor as 0–100 (pax over configured seats, capped at 100). */
export function loadFactorPct(pax: number, seats: number): number {
  if (seats <= 0) return 0;
  return Math.min(100, Math.round((pax / seats) * 100));
}
