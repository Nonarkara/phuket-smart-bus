import type { LatLngTuple } from "@shared/types";
import {
  mergeLiveFeeds,
  normalizeTrackerTime,
  parseKeylessFeed,
  parsePksbFeed,
  plateKey,
  resolveKeylessFixTime,
  type LiveBus,
  type PksbRawRecord,
} from "@shared/pksbFeed";
import {
  applySnapshot,
  bangkokDate,
  bangkokDow,
  distanceToPolylineM,
  emptyLedger,
  estimateTripRiders,
  summarizeLedger,
  type LiveLedger,
} from "./liveOps";
import { getDayModelFor, BUS_CAPACITY, FARE_THB } from "./demandSupplyEngine";
import { getDirectionPolyline } from "./routes";

// The genuine captured token-feed row the server tests already use.
const realTokenRow: PksbRawRecord = {
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

const AIRPORT_LINE = getDirectionPolyline("rawai-airport", [8.108, 98.317]);
const PATONG_LINE = getDirectionPolyline("patong-old-bus-station", [7.884101493, 98.39575082]);
const DRAGON_LINE = getDirectionPolyline("dragon-line", [7.885774, 98.39478]);

function bus(at: LatLngTuple, atMs: number, extra: Partial<LiveBus> = {}): LiveBus {
  return {
    id: "10-2001", plate: "10-2001", vehicleId: "10-2001ภูเก็ต",
    lat: at[0], lng: at[1], heading: 180, speedKph: 40,
    routeId: null, destination: "", paxOnBoard: null,
    updatedAt: new Date(atMs).toISOString(),
    ...extra,
  };
}

/** Drive one bus along a polyline: dwell `dwell` fixes at the start, then
 *  `steps` evenly spaced fixes to the end, one fix per `everyMs`. */
function drive(
  l: LiveLedger,
  poly: LatLngTuple[],
  startMs: number,
  opts: { dwell?: number; steps?: number; everyMs?: number; pax?: (i: number) => number | null; plate?: string } = {},
): { ledger: LiveLedger; endMs: number } {
  const { dwell = 3, steps = 60, everyMs = MIN, pax = () => null, plate = "10-2001" } = opts;
  let t = startMs;
  let i = 0;
  const fix = (p: LatLngTuple) => {
    l = applySnapshot(l, [bus(p, t, { plate, id: plate, paxOnBoard: pax(i) })], t);
    i += 1;
    t += everyMs;
  };
  for (let d = 0; d < dwell; d++) fix(poly[0]!);
  for (let s = 1; s <= steps; s++) fix(poly[Math.round((s / steps) * (poly.length - 1))]!);
  return { ledger: l, endMs: t };
}

describe("tracker parsing", () => {
  it("keyless rows, as the tracker really sends them: Bangkok clock stamped Z, speed in tenths, odometer", () => {
    // Captured 2026-09-29 04:08 UTC (11:08 Bangkok), bus 10-1240 driving.
    const captured = {
      licence: "10-1240ภูเก็ต",
      lat: "7.828499",
      lon: "98.343725",
      speed: "529",
      data: JSON.stringify({
        Online: 1, Speed: 529, HangXiang: 16, Satellites: 12, LiCheng: 52076500,
        GPSTime: "2026-09-29T11:08:13.000Z", RecvTime: "2026-09-29T11:08:13.000Z", UpdateTime: "2026-09-29T04:08:15.000Z",
        PeopleCur: 0, CurPeople: 0, PeopleUp: 0, PeopleDown: 0, IncrPeople: 0,
      }),
    };
    const [b] = parseKeylessFeed([captured], Date.parse("2026-09-29T04:08:42Z"));
    expect(b).toMatchObject({
      plate: "10-1240", vehicleId: "10-1240ภูเก็ต", lat: 7.828499, lng: 98.343725, heading: 16, routeId: null,
      updatedAt: "2026-09-29T04:08:13.000Z", // not 11:08Z — that's 7 h in the future
      speedKph: 52.9, // not 529 km/h
      odometerM: 52076500,
      online: true,
      paxOnBoard: 0, paxUp: 0, paxDown: 0,
    });
  });

  it("a fix two days stale resolves against the server's receive time, not against now", () => {
    // 10-1229, parked since 27 Sep. "Nearest now" would pick the later, wrong reading.
    expect(resolveKeylessFixTime("2026-09-27T09:08:04.000Z", "2026-09-27T02:11:08.000Z", Date.parse("2026-09-29T04:08:42Z")))
      .toBe("2026-09-27T02:08:04.000Z");
    // No UpdateTime on the row: anchored on now, never in the future.
    expect(resolveKeylessFixTime("2026-09-29T11:08:13.000Z", undefined, Date.parse("2026-09-29T04:08:42Z")))
      .toBe("2026-09-29T04:08:13.000Z");
    // If the vendor ever sends true UTC, the anchor still picks it.
    expect(resolveKeylessFixTime("2026-09-29T04:08:13.000Z", "2026-09-29T04:08:15.000Z", Date.parse("2026-09-29T04:08:42Z")))
      .toBe("2026-09-29T04:08:13.000Z");
  });

  it("keyless rows: survives truncated inner JSON, drops the 0,0 depot sentinel and plateless rows", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    const rows = parseKeylessFeed({ data: [
      { licence: "10-1", lat: "7.9", lon: "98.3", data: "{this is not json" },
      { licence: "10-2", lat: "0", lon: "0" },
      { lat: "7.9", lon: "98.3" },
    ] }, now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ plate: "10-1", heading: 0, paxOnBoard: null, updatedAt: new Date(now).toISOString() });
  });

  it("token rows: parses the real captured row, swapping [lng, lat]", () => {
    const [parsed] = parsePksbFeed([realTokenRow]);
    expect(parsed).toMatchObject({ plate: "10-1223", lat: 7.906158, lng: 98.356406, routeId: "patong-old-bus-station", destination: "Patong" });
  });

  it("plates join across feeds whatever the suffix", () => {
    expect(plateKey("10-1230ภูเก็ต")).toBe("10-1230");
    expect(plateKey("10-1230 ภูเก็ต")).toBe("10-1230");
    const keyless = { ...bus([7.9, 98.3], T0), plate: "10-1230", paxOnBoard: 7 };
    const token = { ...bus([7.91, 98.31], T0), plate: "10-1230", routeId: "rawai-airport" as const, destination: "Rawai" };
    const onlyToken = { ...token, plate: "10-1999" };
    const merged = mergeLiveFeeds([keyless], [token, onlyToken]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ plate: "10-1230", lat: 7.9, paxOnBoard: 7, routeId: "rawai-airport", destination: "Rawai" });
  });

  it("resolves zone-less timestamps whether they are Bangkok or UTC wall time", () => {
    const now = Date.parse("2026-09-24T09:00:30+07:00");
    expect(normalizeTrackerTime("2026-09-24T09:00:00.588467", now)).toBe("2026-09-24T02:00:00.588Z");
    expect(normalizeTrackerTime("2026-09-24T02:00:00.588467", now)).toBe("2026-09-24T02:00:00.588Z");
    expect(normalizeTrackerTime("2026-09-24T09:00:00+07:00", now)).toBe("2026-09-24T02:00:00.000Z");
    expect(normalizeTrackerTime("not a time", now)).toBeNull();
  });

  it("rolls the ledger date at Bangkok midnight, not UTC midnight", () => {
    expect(bangkokDate(Date.parse("2026-09-24T16:59:00Z"))).toBe("2026-09-24");
    expect(bangkokDate(Date.parse("2026-09-24T17:01:00Z"))).toBe("2026-09-25");
    expect(bangkokDow(T0)).toBe(4);
  });
});

describe("line identification (the keyless feed has no route)", () => {
  it("measures distance to a polyline", () => {
    expect(distanceToPolylineM(AIRPORT_LINE[1000]![0], AIRPORT_LINE[1000]![1], AIRPORT_LINE)).toBeLessThan(1);
    expect(distanceToPolylineM(7.5, 98.1, AIRPORT_LINE)).toBeGreaterThan(20_000);
  });

  it("assigns each bus to the line whose road it drives along", () => {
    let l = emptyLedger(T0);
    for (const [i, idx] of [900, 1000, 1100].entries()) {
      l = applySnapshot(l, [bus(AIRPORT_LINE[idx]!, T0 + i * MIN, { plate: "A" })], T0 + i * MIN);
    }
    for (const [i, idx] of [500, 600, 700].entries()) {
      l = applySnapshot(l, [bus(PATONG_LINE[idx]!, T0 + i * MIN, { plate: "P" })], T0 + i * MIN);
    }
    expect(l.vehicles.A!.routeId).toBe("rawai-airport");
    expect(l.vehicles.P!.routeId).toBe("patong-old-bus-station");
  });

  it("leaves a bus parked off every route unassigned", () => {
    let l = emptyLedger(T0);
    for (let i = 0; i < 5; i++) l = applySnapshot(l, [bus([7.95, 98.36], T0 + i * MIN, { speedKph: 0 })], T0 + i * MIN);
    expect(l.vehicles["10-2001"]!.routeId).toBeNull();
    expect(summarizeLedger(l, [], T0 + 4 * MIN).rows[0]).toMatchObject({ routeId: null, destination: "" });
  });
});

describe("trips", () => {
  it("counts Airport → Rawai as one trip, priced at the scheduled run it matches", () => {
    const dow = bangkokDow(T0);
    const run = getDayModelFor(dow).trips.find((t) => t.depMin >= 9 * 60 && t.boarded > 0)!;
    const departMs = Date.parse("2026-09-24T00:00:00+07:00") + run.depMin * MIN;
    const { ledger } = drive(emptyLedger(departMs), AIRPORT_LINE, departMs - 2 * MIN, { dwell: 3, steps: 60, everyMs: 90_000 });
    expect(ledger.trips).toHaveLength(1);
    expect(ledger.trips[0]).toMatchObject({
      routeId: "rawai-airport", from: "Airport", to: "Rawai",
      basis: "scheduled-run", riders: Math.min(BUS_CAPACITY, run.boarded), fareThb: FARE_THB,
    });
    // Departure = the last fix seen at the curb (fixes land every 90 s).
    expect(Math.abs(ledger.trips[0]!.startMin! - run.depMin)).toBeLessThanOrEqual(2);
  });

  it("with a passenger counter, riders are counted boardings — not the model", () => {
    // 0 → 10 → 18 at the curb (18 boarded), 15 (3 off), 17 (+2), then everyone off at Rawai.
    const readings = [0, 10, 18, 18, 15, 17];
    const { ledger } = drive(emptyLedger(T0), AIRPORT_LINE, T0, {
      dwell: 3, steps: 60, everyMs: 90_000,
      pax: (i) => (i < readings.length ? readings[i]! : i >= 62 ? 0 : 17),
    });
    expect(ledger.trips).toHaveLength(1);
    expect(ledger.trips[0]).toMatchObject({ basis: "apc-count", riders: 20, fareThb: 100 });
    const s = summarizeLedger(ledger, [], T0);
    expect(s.ridersCounted).toBe(20);
    expect(s.fareThb).toBe(2000);
  });

  it("a round trip is two trips, the return priced from the return-leg model", () => {
    let { ledger, endMs } = drive(emptyLedger(T0), AIRPORT_LINE, T0, { everyMs: 90_000 });
    ({ ledger } = drive(ledger, [...AIRPORT_LINE].reverse(), endMs, { everyMs: 90_000 }));
    expect(ledger.trips.map((t) => `${t.from}→${t.to}`)).toEqual(["Airport→Rawai", "Rawai→Airport"]);
  });

  it("no trip for dwelling, a depot shuffle, or turning back before the far end", () => {
    // Dwell at the airport, drive a quarter of the line, come back.
    const quarter = AIRPORT_LINE.slice(0, Math.floor(AIRPORT_LINE.length / 4));
    let { ledger, endMs } = drive(emptyLedger(T0), quarter, T0, { dwell: 5, steps: 15 });
    ({ ledger } = drive(ledger, [...quarter].reverse(), endMs, { dwell: 1, steps: 15 }));
    expect(ledger.trips).toHaveLength(0);
  });

  it("counts a lap of the Dragon loop at line occupancy", () => {
    const { ledger } = drive(emptyLedger(T0), DRAGON_LINE, T0, { steps: 40, everyMs: 45_000 });
    expect(ledger.trips).toHaveLength(1);
    expect(ledger.trips[0]).toMatchObject({ routeId: "dragon-line", riders: 5, basis: "line-occupancy" });
  });
});

describe("distance and freshness", () => {
  it("integrates GPS km and ignores jitter and impossible jumps", () => {
    let l = emptyLedger(T0);
    l = applySnapshot(l, [bus([8.1, 98.3], T0)], T0);
    l = applySnapshot(l, [bus([8.09, 98.3], T0 + MIN)], T0 + MIN); // ~1.1 km in a minute
    const afterDrive = l.vehicles["10-2001"]!.km;
    expect(afterDrive).toBeGreaterThan(1.0);
    expect(afterDrive).toBeLessThan(1.2);
    l = applySnapshot(l, [bus([8.09004, 98.3], T0 + 2 * MIN)], T0 + 2 * MIN); // 5 m jitter
    l = applySnapshot(l, [bus([7.91, 98.3], T0 + 2 * MIN + 15_000)], T0 + 2 * MIN + 15_000); // 20 km in 15 s
    expect(l.vehicles["10-2001"]!.km).toBeCloseTo(afterDrive, 6);
    expect(l.vehicles["10-2001"]!.lat).toBe(7.91);
  });

  it("ignores stale fixes and starts a fresh ledger on a new Bangkok day", () => {
    let l = emptyLedger(T0);
    l = applySnapshot(l, [bus([8.1, 98.3], T0 - 10 * MIN)], T0);
    expect(Object.keys(l.vehicles)).toHaveLength(0);
    l = applySnapshot(l, [bus([8.1, 98.3], T0)], T0);
    expect(Object.keys(l.vehicles)).toHaveLength(1);
    l = applySnapshot(l, [], T0 + 24 * 60 * MIN);
    expect(l.date).toBe("2026-09-25");
    expect(Object.keys(l.vehicles)).toHaveLength(0);
  });

  it("summarises reporting, on-board now and where each bus is heading", () => {
    let { ledger, endMs } = drive(emptyLedger(T0), AIRPORT_LINE, T0, { everyMs: 90_000 });
    const latest = [bus(AIRPORT_LINE[AIRPORT_LINE.length - 1]!, endMs - 90_000, { paxOnBoard: 4, speedKph: 0 })];
    ledger = applySnapshot(ledger, latest, endMs - 90_000);
    const s = summarizeLedger(ledger, latest, endMs);
    expect(s).toMatchObject({ busesReporting: 1, busesOnLine: 1, busesMoving: 0, paxOnBoardNow: 4, tripsCompleted: 1 });
    expect(s.rows[0]).toMatchObject({ routeId: "rawai-airport", destination: "Airport", trips: 1 });
    expect(summarizeLedger(ledger, latest, endMs + 10 * MIN).busesReporting).toBe(0);
  });
});

describe("modelled pricing (buses without a counter)", () => {
  it("northbound trips use the return-leg model", () => {
    const dow = bangkokDow(T0);
    const run = getDayModelFor(dow).outbound.returnTrips.find((t) => t.boarded > 0)!;
    const priced = estimateTripRiders("rawai-airport", "Airport", run.originDepMin - 5, dow);
    expect(priced).toEqual({ riders: Math.min(BUS_CAPACITY, run.boarded), fareThb: FARE_THB, basis: "scheduled-run" });
  });

  it("local lines use the line P&L occupancy", () => {
    expect(estimateTripRiders("patong-old-bus-station", "Patong", 600, 4)).toEqual({ riders: 11, fareThb: 100, basis: "line-occupancy" });
    expect(estimateTripRiders("dragon-line", "Old Town loop", 600, 4)).toEqual({ riders: 5, fareThb: 100, basis: "line-occupancy" });
  });
});
