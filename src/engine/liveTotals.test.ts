/**
 * Trips and km on the /ops footer are BUS figures: every leg in both
 * directions, each the full Airport ↔ Rawai line. (They used to be southbound
 * only, a 75-min trip and the 28 km passenger ride.)
 */
import { getLiveTotals } from "./simulation";
import { getAirportboundTrips, getPublishedAirportDepartures } from "./fleetSimulator";

describe("getLiveTotals — bus trips and bus-km", () => {
  it("at midnight every leg that has arrived is a trip, both directions", () => {
    const t = getLiveTotals(1439.9);
    const south = getPublishedAirportDepartures().filter((d) => d + 95 <= 1439.9).length;
    const north = getAirportboundTrips().filter((x) => x.airportArriveMin <= 1439.9).length;
    expect(t.tripsCompleted).toBe(south + north);
    expect(t.tripsCompleted).toBeGreaterThan(30);
  });

  it("a completed trip is the whole ~54 km line", () => {
    const t = getLiveTotals(1439.9);
    // all legs finished by midnight except possibly the last southbound departures
    expect(t.kmDriven).toBeGreaterThanOrEqual(Math.round(t.tripsCompleted * 54.2));
  });

  it("never decreases through the day", () => {
    let trips = 0, km = 0;
    for (let m = 0; m < 1440; m += 13) {
      const t = getLiveTotals(m);
      expect(t.tripsCompleted).toBeGreaterThanOrEqual(trips);
      expect(t.kmDriven).toBeGreaterThanOrEqual(km);
      trips = t.tripsCompleted; km = t.kmDriven;
    }
  });
});

import { getOperatorFleet } from "./v2OpsPanel";
import { getHeadlineMetrics } from "./headlineMetrics";

describe("one PKSB bus count", () => {
  it("the operator fleet table never lists Orange Line competitor buses and matches the headline count", () => {
    const rows = getOperatorFleet();
    expect(rows.some((r) => r.vehicleId.startsWith("orange-"))).toBe(false);
    expect(rows.length).toBe(getHeadlineMetrics().fleet.totalBuses);
  });
});
