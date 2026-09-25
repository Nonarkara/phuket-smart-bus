import { normalizeTrackerTime, parsePksbFeed, type LiveBus, type PksbRawRecord } from "@shared/pksbFeed";
import {
  applySnapshot,
  bangkokDate,
  bangkokDow,
  emptyLedger,
  estimateTripRiders,
  summarizeLedger,
} from "./liveOps";
import { getDayModelFor, BUS_CAPACITY, FARE_THB } from "./demandSupplyEngine";

// The genuine captured tracker row the server tests already use.
const realRow: PksbRawRecord = {
  id: 1,
  licence: "10-1223",
  date: "2026-03-08T14:26:48.689912",
  buffer: "Patong",
  data: {
    azm: 294.7,
    pos: [98.356406, 7.906158],
    spd: 50,
    time: "2026-03-08T14:26:48.588467",
    buffer: "Patong",
    determineBusDirection: ["The bus is heading from Phuket Bus Terminal 1 to Patong", 7483.75, "Patong", 868.0, 129],
    vhc: { id: "007103AF3C", lc: "10-1223" },
  },
};

// Thursday 24 Sep 2026, Bangkok (UTC+7).
const T0 = Date.parse("2026-09-24T09:00:00+07:00");
const MIN = 60_000;

function bus(overrides: Partial<LiveBus> & { atMs: number }): LiveBus {
  const { atMs, ...rest } = overrides;
  return {
    id: "1",
    plate: "10-2001",
    vehicleId: "DEV1",
    lat: 8.1,
    lng: 98.3,
    heading: 180,
    speedKph: 40,
    routeId: "rawai-airport",
    destination: "Rawai",
    directionText: null,
    distanceToDestinationM: null,
    updatedAt: new Date(atMs).toISOString(),
    ...rest,
  };
}

describe("PKSB tracker parsing", () => {
  it("parses the real captured row, swapping [lng, lat]", () => {
    const [parsed] = parsePksbFeed([realRow]);
    expect(parsed).toMatchObject({
      plate: "10-1223",
      lat: 7.906158,
      lng: 98.356406,
      routeId: "patong-old-bus-station",
      destination: "Patong",
      speedKph: 50,
    });
  });

  it("resolves the tracker's zone-less timestamps whether they are Bangkok or UTC wall time", () => {
    const now = Date.parse("2026-09-24T09:00:30+07:00");
    // Bangkok wall time, microseconds included (the real feed's format).
    expect(normalizeTrackerTime("2026-09-24T09:00:00.588467", now)).toBe("2026-09-24T02:00:00.588Z");
    // The same instant written as UTC wall time.
    expect(normalizeTrackerTime("2026-09-24T02:00:00.588467", now)).toBe("2026-09-24T02:00:00.588Z");
    // Explicit zones are respected as given; garbage is rejected.
    expect(normalizeTrackerTime("2026-09-24T09:00:00+07:00", now)).toBe("2026-09-24T02:00:00.000Z");
    expect(normalizeTrackerTime("not a time", now)).toBeNull();
    expect(normalizeTrackerTime(undefined, now)).toBeNull();
  });

  it("drops off-island glitch fixes and malformed rows instead of throwing", () => {
    const glitch = { ...realRow, data: { ...realRow.data, pos: [0, 0] as [number, number] } };
    expect(parsePksbFeed([glitch, { nonsense: true }, null, realRow])).toHaveLength(1);
    expect(parsePksbFeed({ detail: "not a list" })).toEqual([]);
  });
});

describe("Bangkok calendar", () => {
  it("rolls the date at Bangkok midnight, not UTC midnight", () => {
    expect(bangkokDate(Date.parse("2026-09-24T16:59:00Z"))).toBe("2026-09-24");
    expect(bangkokDate(Date.parse("2026-09-24T17:01:00Z"))).toBe("2026-09-25");
    expect(bangkokDow(T0)).toBe(4);
  });
});

describe("live ledger", () => {
  it("integrates GPS km and ignores jitter and impossible jumps", () => {
    let l = emptyLedger(T0);
    l = applySnapshot(l, [bus({ atMs: T0, lat: 8.1, lng: 98.3 })], T0);
    // ~1.1 km south in one minute (~67 km/h): counts.
    l = applySnapshot(l, [bus({ atMs: T0 + MIN, lat: 8.09, lng: 98.3 })], T0 + MIN);
    const afterDrive = l.vehicles["10-2001"]!.km;
    expect(afterDrive).toBeGreaterThan(1.0);
    expect(afterDrive).toBeLessThan(1.2);
    // 5 m jitter at a stop: ignored.
    l = applySnapshot(l, [bus({ atMs: T0 + 2 * MIN, lat: 8.09004, lng: 98.3 })], T0 + 2 * MIN);
    // 20 km in 15 s: a GPS jump, ignored (but the position still updates).
    l = applySnapshot(l, [bus({ atMs: T0 + 2 * MIN + 15_000, lat: 7.91, lng: 98.3 })], T0 + 2 * MIN + 15_000);
    expect(l.vehicles["10-2001"]!.km).toBeCloseTo(afterDrive, 6);
    expect(l.vehicles["10-2001"]!.lat).toBe(7.91);
  });

  it("does not count a one-fix destination flicker as a trip", () => {
    let l = emptyLedger(T0);
    l = applySnapshot(l, [bus({ atMs: T0, destination: "Rawai" })], T0);
    l = applySnapshot(l, [bus({ atMs: T0 + MIN, destination: "Airport" })], T0 + MIN);
    l = applySnapshot(l, [bus({ atMs: T0 + 2 * MIN, destination: "Rawai" })], T0 + 2 * MIN);
    expect(l.trips).toHaveLength(0);
  });

  it("counts a trip when the new destination holds for two fixes", () => {
    let l = emptyLedger(T0);
    l = applySnapshot(l, [bus({ atMs: T0, destination: "Rawai" })], T0);
    l = applySnapshot(l, [bus({ atMs: T0 + MIN, destination: "Airport" })], T0 + MIN);
    l = applySnapshot(l, [bus({ atMs: T0 + 2 * MIN, destination: "Airport" })], T0 + 2 * MIN);
    expect(l.trips).toHaveLength(1);
    expect(l.trips[0]).toMatchObject({ plate: "10-2001", to: "rawai", startMin: null });
    expect(l.vehicles["10-2001"]!.lastFlipMin).toBe(9 * 60 + 2);
  });

  it("prices an airport-line trip with the modelled load of the scheduled run it matches", () => {
    const dow = bangkokDow(T0);
    const run = getDayModelFor(dow).trips.find((t) => t.depMin >= 9 * 60 && t.boarded > 0)!;
    expect(run).toBeDefined();
    const priced = estimateTripRiders("rawai-airport", "Rawai", run.depMin + 12, dow);
    expect(priced).toEqual({ riders: Math.min(BUS_CAPACITY, run.boarded), fareThb: FARE_THB, basis: "scheduled-run" });
  });

  it("prices northbound (to the airport) trips from the return-leg model", () => {
    const dow = bangkokDow(T0);
    const run = getDayModelFor(dow).outbound.returnTrips.find((t) => t.boarded > 0)!;
    const priced = estimateTripRiders("rawai-airport", "Phuket Airport", run.originDepMin - 5, dow);
    expect(priced.basis).toBe("scheduled-run");
    expect(priced.riders).toBe(Math.min(BUS_CAPACITY, run.boarded));
  });

  it("prices local lines with the line P&L occupancy", () => {
    expect(estimateTripRiders("patong-old-bus-station", "Patong", 600, 4)).toEqual({ riders: 11, fareThb: 100, basis: "line-occupancy" });
    expect(estimateTripRiders("dragon-line", "Old Town", 600, 4)).toEqual({ riders: 5, fareThb: 100, basis: "line-occupancy" });
  });

  it("ignores stale fixes and starts a fresh ledger on a new Bangkok day", () => {
    let l = emptyLedger(T0);
    l = applySnapshot(l, [bus({ atMs: T0 - 10 * MIN })], T0);
    expect(Object.keys(l.vehicles)).toHaveLength(0);
    l = applySnapshot(l, [bus({ atMs: T0 })], T0);
    expect(Object.keys(l.vehicles)).toHaveLength(1);
    const tomorrow = T0 + 24 * 60 * MIN;
    l = applySnapshot(l, [], tomorrow);
    expect(l.date).toBe("2026-09-25");
    expect(Object.keys(l.vehicles)).toHaveLength(0);
  });

  it("summarises: fares = Σ riders × fare; reporting = fix within 3 min", () => {
    let l = emptyLedger(T0);
    const local = { plate: "10-3001", routeId: "patong-old-bus-station" as const };
    l = applySnapshot(l, [bus({ atMs: T0, ...local, destination: "Patong" })], T0);
    l = applySnapshot(l, [bus({ atMs: T0 + MIN, ...local, destination: "Terminal 1" })], T0 + MIN);
    l = applySnapshot(l, [bus({ atMs: T0 + 2 * MIN, ...local, destination: "Terminal 1" })], T0 + 2 * MIN);
    const latest = [bus({ atMs: T0 + 2 * MIN, ...local, destination: "Terminal 1", speedKph: 0 })];

    const s = summarizeLedger(l, latest, T0 + 3 * MIN);
    expect(s.tripsCompleted).toBe(1);
    expect(s.riders).toBe(11);
    expect(s.fareThb).toBe(1100);
    expect(s.busesReporting).toBe(1);
    expect(s.busesMoving).toBe(0);
    expect(s.co2SavedKg).toBe(0); // local-line ride length isn't modelled — no claim
    expect(s.observedSinceMin).toBe(9 * 60);
    expect(s.rows[0]).toMatchObject({ plate: "10-3001", trips: 1, fareThb: 1100, reporting: true });

    expect(summarizeLedger(l, latest, T0 + 10 * MIN).busesReporting).toBe(0);
  });
});
