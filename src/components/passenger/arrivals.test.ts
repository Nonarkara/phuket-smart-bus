import type { LiveBus } from "@shared/pksbFeed";
import { LINES } from "../v2/fleetRows";
import { arrivalsAt, buildPace, directionOf, minPerKm, nearestStop, placeBuses } from "./arrivals";

const airport = LINES.find((l) => l.routeId === "rawai-airport")!;
const NOW = Date.parse("2026-10-16T05:00:00Z"); // 12:00 Bangkok

function busAt(plate: string, alongM: number, extra: Partial<LiveBus> = {}): LiveBus {
  // put the bus on the polyline vertex nearest alongM
  const i = airport.cum.findIndex((c) => c >= alongM);
  const [lat, lng] = airport.poly[Math.max(0, i)]!;
  return {
    id: plate, plate, vehicleId: plate, lat: lat!, lng: lng!, heading: 0, speedKph: 30,
    routeId: "rawai-airport", destination: "", paxOnBoard: null,
    updatedAt: new Date(NOW - 30_000).toISOString(), feed: "token", ...extra,
  };
}

// 10 trips Airport→Rawai departing 12:00 Bangkok, each 108.5 min over 54.25 km → 2 min/km
const days = [{
  date: "2026-10-15",
  lines: [{ routeId: "rawai-airport", trips: Array.from({ length: 10 }, (_, k) => ({
    plate: `p${k}`, dir: "fwd", departMs: NOW - 86_400_000, arriveMs: 0, minutes: (airport.lengthM / 1000) * 2,
  })) }],
}];

describe("rider arrivals", () => {
  it("pace is the median minutes per km of recorded trips", () => {
    const pace = buildPace(days);
    expect(minPerKm(pace, "rawai-airport", "fwd", 12)).toBeCloseTo(2, 5);
    // no trips toward the airport recorded → falls back to the line, never invents
    expect(minPerKm(pace, "rawai-airport", "rev", 12)).toBeCloseTo(2, 5);
    expect(minPerKm(buildPace([]), "rawai-airport", "fwd", 12)).toBeNull();
  });

  it("a bus 5 km before the stop, heading to it, arrives in 5 km × pace", () => {
    const stopIdx = airport.stops.findIndex((s) => s.alongM > 20_000);
    const stop = airport.stops[stopIdx]!;
    const bus = busAt("A", stop.alongM - 5_000, { destination: "Rawai" });
    const placed = placeBuses([bus], NOW, (b) => b.routeId, new Map(), () => null);
    const a = arrivalsAt(placed, { routeId: "rawai-airport", index: stopIdx }, buildPace(days), NOW);
    expect(a.fwd).toHaveLength(1);
    expect(a.fwd[0]!.awayM).toBeGreaterThan(4_700);
    expect(a.fwd[0]!.awayM).toBeLessThan(5_300);
    expect(a.fwd[0]!.etaMin!).toBeCloseTo((a.fwd[0]!.awayM / 1000) * 2, 5);
    expect(a.rev).toHaveLength(0);
  });

  it("a bus already past the stop is not coming; without pace, minutes stay unknown", () => {
    const stopIdx = airport.stops.findIndex((s) => s.alongM > 20_000);
    const stop = airport.stops[stopIdx]!;
    const past = busAt("P", stop.alongM + 3_000, { destination: "Rawai" });
    const coming = busAt("C", stop.alongM - 2_000, { destination: "Rawai" });
    const placed = placeBuses([past, coming], NOW, (b) => b.routeId, new Map(), () => null);
    const a = arrivalsAt(placed, { routeId: "rawai-airport", index: stopIdx }, buildPace([]), NOW);
    expect(a.fwd.map((x) => x.plate)).toEqual(["C"]);
    expect(a.fwd[0]!.etaMin).toBeNull();
  });

  it("silent buses (no fix for 15 min) never appear", () => {
    const old = busAt("Q", 1_000, { destination: "Rawai", updatedAt: new Date(NOW - 20 * 60_000).toISOString() });
    expect(placeBuses([old], NOW, (b) => b.routeId, new Map(), () => null)).toHaveLength(0);
  });

  it("direction: tracker text, then movement, then last terminal", () => {
    const b = busAt("D", 10_000);
    expect(directionOf({ ...b, destination: "Airport" }, airport, 10_000, undefined, null)).toBe("rev");
    expect(directionOf(b, airport, 10_000, 9_900, null)).toBe("fwd");
    expect(directionOf(b, airport, 10_000, 10_100, null)).toBe("rev");
    expect(directionOf(b, airport, 10_000, 10_010, "Rawai")).toBe("rev");
    expect(directionOf(b, airport, 10_000, undefined, null)).toBeNull();
  });

  it("nearest stop to the airport terminal is the airport stop", () => {
    const s = nearestStop(8.1085, 98.3066);
    expect(LINES.find((l) => l.routeId === s.routeId)!.stops[s.index]!.name).toBe("Phuket Airport");
  });
});

describe("a bus that is not moving gets no minutes", () => {
  // Regression: pace was applied to a standing bus as though it were moving,
  // so a bus sitting in traffic 36 km away showed a confident "97 min" that was
  // optimistic precisely when the rider most needed the number to hold.
  const stop = { routeId: "rawai-airport", index: 3 } as const;

  it("shows distance only while the bus is standing short of the stop", () => {
    const pace = buildPace(days);
    const moving = busAt("p1", 5_000);
    const still = busAt("p2", 5_000, { speedKph: 0 });
    const placed = [
      { bus: moving, line: airport, alongM: 5_000, dir: "fwd" as const },
      { bus: still, line: airport, alongM: 5_000, dir: "fwd" as const },
    ];
    const out = arrivalsAt(placed, stop, pace, NOW);
    const rows = out.fwd;
    const stillRow = rows.find((r) => r.plate === "p2")!;
    const movingRow = rows.find((r) => r.plate === "p1")!;

    expect(stillRow.state).toBe("standing");
    expect(stillRow.etaMin).toBeNull();          // no backed figure
    expect(stillRow.awayM).toBeGreaterThan(0);   // distance still shown
    expect(movingRow.etaMin).toBeGreaterThan(0); // a moving bus still gets one
  });

  it("still reports zero minutes for a standing bus that is AT the stop", () => {
    const pace = buildPace(days);
    const atStop = busAt("p3", 5_000, { speedKph: 0 });
    const s = airport.stops[stop.index]!;
    const placed = [{ bus: atStop, line: airport, alongM: s.alongM, dir: "fwd" as const }];
    expect(arrivalsAt(placed, stop, pace, NOW).fwd[0]!.etaMin).toBe(0);
  });
});

describe("a standing bus at a terminal is waiting there, not stuck", () => {
  const stop = { routeId: "rawai-airport", index: 3 } as const;

  it("names the terminal it is standing at", () => {
    const pace = buildPace(days);
    // 300 m short of the Rawai end, standing, heading for the airport
    const atRawai = busAt("r1", airport.lengthM - 300, { speedKph: 0 });
    const placed = [{ bus: atRawai, line: airport, alongM: airport.lengthM - 300, dir: "rev" as const }];
    const a = arrivalsAt(placed, stop, pace, NOW).rev[0]!;
    expect(a.terminal).toBe("Rawai");
    expect(a.etaMin).toBeNull();
  });

  it("a bus standing mid-route is just standing, and a moving bus at a terminal is not waiting", () => {
    const pace = buildPace(days);
    const mid = busAt("m1", 20_000, { speedKph: 0 });
    const leaving = busAt("m2", airport.lengthM - 300, { speedKph: 30 });
    const out = arrivalsAt([
      { bus: mid, line: airport, alongM: 20_000, dir: "rev" as const },
      { bus: leaving, line: airport, alongM: airport.lengthM - 300, dir: "rev" as const },
    ], stop, pace, NOW).rev;
    expect(out.find((r) => r.plate === "m1")!.terminal).toBeNull();
    expect(out.find((r) => r.plate === "m2")!.terminal).toBeNull();
  });
});
