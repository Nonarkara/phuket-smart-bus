import { describe, it, expect } from "vitest";
import type { LiveBus } from "@shared/pksbFeed";
import {
  getTrumanScoreboard,
  generateTrumanScenes,
  buildTrumanActorDossier,
  GRAB_AVERAGE_FARE_THB,
} from "./trumanEngine";

const MOCK_BUSES: LiveBus[] = [
  {
    plate: "10-1227ภูเก็ต",
    lat: 8.1102,
    lng: 98.3075,
    speedKph: 28,
    heading: 180,
    routeId: "rawai-airport",
    destination: "Rawai Beach",
    updatedAt: new Date().toISOString(),
    feed: "keyless",
    paxOnBoard: 8,
    odometerM: 145000000,
  },
  {
    plate: "10-1228ภูเก็ต",
    lat: 7.8841,
    lng: 98.3957,
    speedKph: 0,
    heading: 90,
    routeId: "patong-old-bus-station",
    destination: "Phuket Town",
    updatedAt: new Date().toISOString(),
    feed: "keyless",
    paxOnBoard: 0,
    odometerM: 120000000,
  },
  {
    plate: "10-1229ภูเก็ต",
    lat: 7.892,
    lng: 98.298,
    speedKph: 42,
    heading: 270,
    routeId: "rawai-airport",
    destination: "Airport",
    updatedAt: new Date().toISOString(),
    feed: "bus-news-2",
    paxOnBoard: 12,
    odometerM: 98000000,
  },
];

describe("trumanEngine", () => {
  it("computes Truman Scoreboard metrics from live buses and demand state", () => {
    const scoreboard = getTrumanScoreboard(MOCK_BUSES, 240, 5600);

    expect(scoreboard.busesReporting).toBe(3);
    expect(scoreboard.busesMoving).toBe(2);
    expect(scoreboard.busesStanding).toBe(1);
    expect(scoreboard.realKmToday).toBe(240);
    expect(scoreboard.realRevenueThb).toBe(5600);
    expect(scoreboard.curbQueueNow).toBeGreaterThanOrEqual(0);
    expect(scoreboard.potentialRevenueThb).toBeGreaterThanOrEqual(scoreboard.realRevenueThb);
    expect(scoreboard.potentialMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(scoreboard.grabLeakageThb).toBe(scoreboard.paxAbandonedToday * GRAB_AVERAGE_FARE_THB);
  });

  it("generates entertaining Truman scenes observing real buses alongside airport demand", () => {
    const DAYTIME = new Date("2026-10-05T14:30:00+07:00").getTime();
    const daytimeBuses = MOCK_BUSES.map((b) => ({
      ...b,
      updatedAt: new Date(DAYTIME).toISOString(),
    }));
    const scenes = generateTrumanScenes(daytimeBuses, DAYTIME);

    expect(scenes.length).toBe(3);
    expect(scenes[0]!.plate).toBe("10-1227ภูเก็ต");
    expect(scenes[0]!.driver.nameEn).toBeTruthy();
    expect(scenes[0]!.realityText).toContain("Airport");
    expect(scenes[2]!.realityText).toContain("Cruising");
    expect(scenes[0]!.channel).toBe("CAM 01");
    expect(scenes[2]!.opportunityThb).toBeGreaterThan(0);
  });

  it("builds an actor dossier with driver profile, reality stats, and director notes", () => {
    const dossier = buildTrumanActorDossier(MOCK_BUSES[0]!, 3, 115);

    expect(dossier.plate).toBe("10-1227ภูเก็ต");
    expect(dossier.driver.nameEn).toBeTruthy();
    expect(dossier.driver.faceDataUri).toContain("data:image/svg+xml");
    expect(dossier.speedKph).toBe(28);
    expect(dossier.tripsToday).toBe(3);
    expect(dossier.kmToday).toBe(115);
    expect(dossier.realEarningsThb).toBeGreaterThan(0);
    expect(dossier.potentialEarningsThb).toBeGreaterThanOrEqual(dossier.realEarningsThb);
    expect(dossier.directorNote).toBeTruthy();
  });

  it("gracefully handles an empty fleet list", () => {
    const scoreboard = getTrumanScoreboard([], 0, 0);
    expect(scoreboard.busesReporting).toBe(0);
    expect(scoreboard.busesMoving).toBe(0);
    expect(scoreboard.realRevenueThb).toBe(0);

    const scenes = generateTrumanScenes([]);
    expect(scenes).toEqual([]);
  });
});
