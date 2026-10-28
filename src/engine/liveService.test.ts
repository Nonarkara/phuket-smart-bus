/**
 * The service model — the record against the plan.
 *
 * These are the numbers an operator reads off the wall and acts on, so each
 * one is pinned here: the frame (a service day starts at 03:00, so a 00:30
 * arrival is 1470 and not −1380), what the supply in force is made of, and
 * the difference between "recorded" and "planned".
 */
import { describe, expect, it } from "vitest";
import type { ServiceDay, ServiceTrip } from "@shared/research";
import {
  airportService,
  directionService,
  liveSupplyFrom,
  parseFleetTotals,
  parseServiceDay,
  toServiceFrame,
  type LiveServiceDay,
} from "./liveService";
import { getPublishedAirportTrips, setLiveAirportSupply } from "./fleetSimulator";

const trip = (plate: string, dir: "fwd" | "rev" | "lap", departMin: number, arriveMin: number, minutes: number): ServiceTrip => ({
  plate,
  dir,
  departMin,
  arriveMin,
  minutes,
});

const day = (lines: ServiceDay["lines"], extra: Partial<LiveServiceDay> = {}): LiveServiceDay => ({
  date: "2026-10-28",
  finished: false,
  computedAt: "2026-10-28T12:00:00.000Z",
  fixes: 1000,
  lines,
  unassigned: 24,
  fleet: null,
  ...extra,
});

describe("the service-day frame", () => {
  it("maps the wall clock into the frame, so 03:00 is 180 and 00:30 is 1470", () => {
    expect(toServiceFrame(180)).toBe(180); //  03:00 — the day starts
    expect(toServiceFrame(1170)).toBe(1170); // 19:30 — after the day starts
    expect(toServiceFrame(1440)).toBe(1440); // 00:00 — 24:00 of the service day
    expect(toServiceFrame(60)).toBe(1500); //  01:00 — belongs to the next morning
    expect(toServiceFrame(179)).toBe(1619); //  02:59 — belongs to the day that began yesterday
  });
});

describe("directionService — the plan against the record", () => {
  const published = [
    { departMin: 495, arriveMin: 615, minutes: 120 },
    { departMin: 600, arriveMin: 730, minutes: 130 },
    { departMin: 700, arriveMin: 830, minutes: 130 },
  ];
  const recorded = [trip("10-1200", "fwd", 573, 704, 131), trip("10-1201", "fwd", 602, 727, 125)];

  it("counts what ran, and what is still due", () => {
    const d = directionService(published, recorded, 600); // 10:00
    expect(d.published).toEqual([495, 600, 700]);
    expect(d.recorded).toEqual([573, 602]);
    expect(d.stillDue).toBe(1); // the 700 departure is still ahead
    expect(d.nextPublishedMin).toBe(700);
    expect(d.lastRecordedMin).toBe(602);
  });

  it("measures the recorded trip against the published one, in minutes", () => {
    const d = directionService(published, recorded, 600);
    expect(d.recordedTripMin).toBe(128); // (131 + 125) / 2
    expect(d.publishedTripMin).toBe(130);
  });

  it("measures the cadence of both", () => {
    const d = directionService(published, recorded, 600);
    // Published gaps: 495 → 600 is 105, 600 → 700 is 100. The median of two
    // is their mean.
    expect(d.publishedGapMin).toBe(102.5);
    expect(d.recordedGapMin).toBe(29);
  });

  it("reports nothing rather than zero when the record is empty", () => {
    const d = directionService(published, [], 600);
    expect(d.recorded).toEqual([]);
    expect(d.recordedTripMin).toBeNull();
    expect(d.recordedGapMin).toBeNull();
    expect(d.lastRecordedMin).toBeNull();
  });
});

describe("liveSupplyFrom — the supply in force", () => {
  const airport = {
    routeId: "rawai-airport",
    name: "Airport ↔ Rawai",
    from: "Airport",
    to: "Rawai",
    loop: false,
    lengthM: 54_252,
    buses: 11,
    trips: [
      trip("10-1200", "fwd", 573, 704, 131),
      trip("10-1201", "rev", 406, 534, 128),
    ],
  };

  it("is the recorded departures plus the published ones still ahead", () => {
    const supply = liveSupplyFrom(day([airport]), 600); // 10:00
    expect(supply).not.toBeNull();
    const published = getPublishedAirportTrips();
    const publishedSouthAhead = published.southbound.filter((t) => toServiceFrame(t.departMin) > 600).map((t) => t.departMin);
    expect(supply!.southbound).toEqual([573, ...publishedSouthAhead].sort((a, b) => a - b));
    expect(supply!.southbound).toContain(573);
    expect(supply!.southbound.length).toBe(1 + publishedSouthAhead.length);
  });

  it("drops a published departure once its time has passed and no trip recorded it", () => {
    const supply = liveSupplyFrom(day([airport]), 600)!;
    const published = getPublishedAirportTrips();
    const past = published.southbound.filter((t) => toServiceFrame(t.departMin) <= 600);
    for (const t of past) expect(supply.southbound).not.toContain(t.departMin);
  });

  it("carries the northbound trips with the minute they reached the curb", () => {
    const supply = liveSupplyFrom(day([airport]), 600)!;
    expect(supply.northbound[0]).toEqual({ originDepMin: 406, airportArriveMin: 534 });
  });

  it("is null when the record has no airport line at all", () => {
    expect(liveSupplyFrom(day([]), 600)).toBeNull();
  });
});

describe("airportService — the day's numbers", () => {
  const lines: ServiceDay["lines"] = [
    {
      routeId: "rawai-airport",
      name: "Airport ↔ Rawai",
      from: "Airport",
      to: "Rawai",
      loop: false,
      lengthM: 54_252,
      buses: 11,
      trips: [trip("10-1200", "fwd", 573, 704, 131), trip("10-1201", "rev", 406, 534, 128)],
    },
    {
      routeId: "patong-old-bus-station",
      name: "Old Town ↔ Patong",
      from: "Old Town",
      to: "Patong",
      loop: false,
      lengthM: 29_333,
      buses: 6,
      trips: [trip("10-1300", "fwd", 500, 560, 60)],
    },
  ];

  it("counts the buses and the trips the record holds", () => {
    const s = airportService(day(lines), 600);
    expect(s.tripsRecorded).toBe(3);
    expect(s.busesSeen).toBe(11 + 6 + 24); // on lines + the town fleet
    expect(s.lines.map((l) => l.routeId)).toEqual(["rawai-airport", "patong-old-bus-station"]);
  });

  it("splits the airport line by direction", () => {
    const s = airportService(day(lines), 600);
    expect(s.southbound.recorded).toEqual([573]);
    expect(s.northbound.recorded).toEqual([406]);
  });
});

describe("parseServiceDay — the endpoint's answer", () => {
  it("reads a good body", () => {
    const parsed = parseServiceDay({
      ok: true,
      date: "2026-10-28",
      finished: false,
      computedAt: "2026-10-28T12:00:00.000Z",
      fixes: 26_022,
      unassigned: 24,
      lines: [
        {
          routeId: "rawai-airport",
          name: "Airport ↔ Rawai",
          from: "Airport",
          to: "Rawai",
          loop: false,
          lengthM: 54_252,
          buses: 11,
          trips: [{ plate: "10-1200", dir: "fwd", departMin: 573, arriveMin: 704, minutes: 131 }],
        },
      ],
      fleet: { date: "2026-10-28", vehicles: 43, km: 4371.2, kmBasis: "mixed", runs: 220, coveragePct: 99.9 },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.fixes).toBe(26_022);
    expect(parsed!.lines[0]!.trips[0]!.departMin).toBe(573);
    expect(parsed!.fleet?.km).toBe(4371.2);
  });

  it("refuses a body it cannot trust", () => {
    expect(parseServiceDay(null)).toBeNull();
    expect(parseServiceDay({ ok: false, error: "nope" })).toBeNull();
    expect(parseServiceDay({ ok: true, date: "2026-10-28" })).toBeNull();
    expect(parseServiceDay({ ok: true, date: "2026-10-28", lines: [{ routeId: "x", trips: [{ plate: "1" }] }] })).toBeNull();
    expect(parseServiceDay({ ok: true, date: "2026-10-28", lines: [{ routeId: "x", trips: [{ plate: "1", departMin: "no", arriveMin: 1 }] }] })).toBeNull();
  });

  it("keeps the collector's day as null when there is none", () => {
    expect(parseFleetTotals(null)).toBeNull();
    expect(parseFleetTotals({ date: "2026-10-28", km: null })).toEqual({
      date: "2026-10-28",
      vehicles: null,
      moved: null,
      km: null,
      kmBasis: null,
      runs: null,
      hoursMoving: null,
      reachedAirport: null,
      noFix: null,
      countersReporting: null,
      coveragePct: null,
      updatedAt: null,
    });
  });
});

describe("the live supply slot in the engine", () => {
  it("does not override the replay while the real clock is not in force", async () => {
    const { setClockOverride } = await import("./fleetSimulator");
    setClockOverride(null);
    setLiveAirportSupply({
      date: "2026-10-28",
      dow: 3,
      southbound: [573, 603],
      northbound: [{ originDepMin: 406, airportArriveMin: 534 }],
      medianTripMin: 131,
    });
    const { getAirportDepartures } = await import("./fleetSimulator");
    // The replay supply (per weekday) stands in; the live slot is ignored.
    expect(getAirportDepartures(3)).not.toEqual([573, 603]);
  });

  it("takes over the moment the real clock is in force", async () => {
    const { setClockOverride, getAirportDepartures, getAirportboundTrips } = await import("./fleetSimulator");
    setClockOverride(() => 600);
    expect(getAirportDepartures(3)).toEqual([573, 603]);
    expect(getAirportboundTrips(3)).toEqual([{ originDepMin: 406, airportArriveMin: 534 }]);
    setClockOverride(null);
    setLiveAirportSupply(null);
  });

  it("does not judge the service by its weekday — LIVE is one day", async () => {
    // At 01:00 the service being run is the one that began the previous
    // morning at 03:00, so its weekday is not the weekday the demand model
    // runs. The mode decides which supply is in force, not the label.
    const { setClockOverride, getAirportDepartures } = await import("./fleetSimulator");
    setLiveAirportSupply({
      date: "2026-10-27",
      dow: 2,
      southbound: [573, 603],
      northbound: [],
      medianTripMin: 131,
    });
    setClockOverride(() => 60); // 01:00
    expect(getAirportDepartures(3)).toEqual([573, 603]);
    setClockOverride(null);
    setLiveAirportSupply(null);
  });
});

describe("the service date", () => {
  it("is the day that began at 03:00, not the calendar date", async () => {
    const { bangkokServiceDate } = await import("./time");
    // 2026-10-28 02:00 Bangkok = 2026-10-27 19:00 UTC → still Tuesday's day.
    expect(bangkokServiceDate(Date.parse("2026-10-27T19:00:00Z"))).toBe("2026-10-27");
    // 2026-10-28 04:00 Bangkok → Wednesday's day has begun.
    expect(bangkokServiceDate(Date.parse("2026-10-27T21:00:00Z"))).toBe("2026-10-28");
  });
});
