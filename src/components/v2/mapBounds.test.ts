import { describe, expect, it } from "vitest";
import { ISLAND_BOUNDS, CORRIDOR_BOUNDS, CORRIDOR_LANDMARKS } from "./fleetRows";

/** Latitude span of a [[lat,lng],[lat,lng]] box, in degrees. */
const latSpan = (b: [[number, number], [number, number]]) => b[1][0] - b[0][0];
const lngSpan = (b: [[number, number], [number, number]]) => b[1][1] - b[0][1];
/** Containment: every point of `inner` lies within `outer`. */
const contains = (outer: [[number, number], [number, number]], inner: [[number, number], [number, number]]) =>
  outer[0][0] <= inner[0][0] && outer[0][1] <= inner[0][1] &&
  outer[1][0] >= inner[1][0] && outer[1][1] >= inner[1][1];

describe("map framing bounds", () => {
  // Regression: ISLAND_BOUNDS used to be derived from the PKSB route polylines
  // (Airport -> Rawai) while claiming to be the island. It was therefore ~36 km
  // long against a real 48 km island, so the map framed the bus lines and left
  // both ends of the coastline permanently off-screen. Nothing caught it,
  // because a wrong constant that is still "a box" looks fine in review.
  it("ISLAND_BOUNDS covers the whole island, not just the bus corridor", () => {
    // Phuket: ~543 km², 48 km north-south and 21 km at its widest.
    // 48 km / 111.32 km-per-degree = 0.431deg of latitude.
    expect(latSpan(ISLAND_BOUNDS)).toBeGreaterThan(0.42);
    // 21 km / (111.32 * cos(7.94deg)) = 0.19deg of longitude.
    expect(lngSpan(ISLAND_BOUNDS)).toBeGreaterThan(0.18);
  });

  it("ISLAND_BOUNDS contains every orientation landmark", () => {
    // If a landmark sat outside the island box, framing the island would push
    // it off-screen — the exact failure being fixed here.
    for (const lm of CORRIDOR_LANDMARKS) {
      expect(
        ISLAND_BOUNDS[0][0] <= lm.lat && lm.lat <= ISLAND_BOUNDS[1][0],
        `${lm.id} lat ${lm.lat} outside ${JSON.stringify(ISLAND_BOUNDS)}`,
      ).toBe(true);
      expect(
        ISLAND_BOUNDS[0][1] <= lm.lng && lm.lng <= ISLAND_BOUNDS[1][1],
        `${lm.id} lng ${lm.lng} outside ${JSON.stringify(ISLAND_BOUNDS)}`,
      ).toBe(true);
    }
  });

  it("the corridor is strictly narrower than the island, so the two frames differ", () => {
    // Guards the rename: if CORRIDOR_BOUNDS ever collapses to the island box
    // again, the "Corridor" chip silently becomes a duplicate of "Island".
    expect(latSpan(CORRIDOR_BOUNDS)).toBeLessThan(latSpan(ISLAND_BOUNDS));
    expect(contains(ISLAND_BOUNDS, CORRIDOR_BOUNDS)).toBe(true);
  });
});