import { describe, expect, it } from "vitest";
import { matchAirportDestination } from "./airportGuide.js";

describe("matchAirportDestination", () => {
  it("matches airport-line destinations in the outbound direction", () => {
    const matches = matchAirportDestination("Patong");

    expect(matches[0]?.routeId).toBe("rawai-airport");
    expect(matches[0]?.kind).toBe("direct");
    expect(matches[0]?.travelMinutes).not.toBeNull();
  });

  it("matches transfer-only town destinations onto the Patong line", () => {
    const matches = matchAirportDestination("Old Town");

    expect(matches[0]?.routeId).toBe("patong-old-bus-station");
    expect(matches[0]?.kind).toBe("transfer");
  });
});
