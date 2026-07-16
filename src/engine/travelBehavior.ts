/**
 * Travel-behavior heuristics — who actually rides an airport bus?
 *
 * Not everyone who lands wants a ฿100 bus seat. Capture depends on where the
 * passenger flew in from, because origin is the best cheap proxy for travel
 * style. These are STEREOTYPES USED AS HEURISTICS — stated openly, sourced
 * from observable Phuket ground-transport behavior, and each one is a knob
 * the operator can recalibrate the day real ridership data exists.
 *
 * The fleet-wide weighted average (SE-Asia-heavy arrival mix) lands near 5% —
 * the operator's own planning figure — replacing the old flat 12% that
 * ignored who was on the plane.
 *
 * Same rate applies to the return leg: the tourist who rode the bus in rides
 * it back; the family that rented a car at arrivals drives it back.
 */

/** City → region. One map for capture heuristics AND display grouping. */
export const REGION_MAP: Record<string, string> = {
  "Bangkok": "SE Asia", "Singapore": "SE Asia", "Kuala Lumpur": "SE Asia",
  "Beijing": "China", "Shanghai": "China", "Guangzhou": "China", "Hong Kong": "China",
  "Seoul": "East Asia", "Tokyo": "East Asia",
  "Moscow": "Russia/CIS", "Novosibirsk": "Russia/CIS", "Yekaterinburg": "Russia/CIS",
  "Delhi": "India",
  "Doha": "Middle East", "Dubai": "Middle East",
  "Frankfurt": "Europe", "Milan": "Europe", "London": "Europe",
};

export function regionFor(city: string): string {
  return REGION_MAP[city] ?? "Other";
}

/** Share of pax from each region who take the bus. The heuristics, stated:
 *  - SE Asia (Bangkok/KL/SIN, budget carriers): backpackers, solo travelers,
 *    price-sensitive, light luggage → highest bus propensity.
 *  - China: tour groups arrive on chartered coaches; the independent-traveler
 *    minority rides public transit.
 *  - East Asia (Seoul/Tokyo): transit-culture travelers, but comfort-seeking
 *    couples/families skew to booked transfers.
 *  - Russia/CIS: 2-week package tourists, hotel transfer bundled in the deal.
 *  - Europe: families and couples rent cars or pre-book private transfers —
 *    exactly the "landing from European countries → renting cars" pattern.
 *  - India: family groups, negotiate taxis/vans at the curb.
 *  - Middle East: large families, private vans.
 */
export const BUS_CAPTURE_BY_REGION: Record<string, number> = {
  "SE Asia": 0.07,
  "China": 0.04,
  "East Asia": 0.05,
  "Russia/CIS": 0.03,
  "Europe": 0.03,
  "India": 0.05,
  "Middle East": 0.03,
  "Other": 0.04,
};

/** Capture rate for one flight, by its origin/destination city. */
export function captureRateFor(city: string): number {
  return BUS_CAPTURE_BY_REGION[regionFor(city)] ?? BUS_CAPTURE_BY_REGION["Other"];
}

/** Departing pax must be at the airport this many minutes before takeoff. */
export const CHECK_IN_LEAD_MIN = 60;

/** Nobody rides a bus that lands them at the airport more than 3h early —
 *  earlier feasible buses than that are not real alternatives. */
export const MAX_EARLY_ARRIVAL_MIN = 180;
