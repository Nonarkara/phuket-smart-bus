import { describe, expect, it } from "vitest";
import { cleanText, MAX_FEED_ROWS, parseKeylessFeed, parsePksbFeed, plateKey } from "../../shared/pksbFeed";

describe("tracker text is safe to store and to put in map HTML", () => {
  it("keeps real plates and Thai destinations, strips markup", () => {
    expect(plateKey("10-1230ภูเก็ต")).toBe("10-1230");
    expect(plateKey('<img src=x onerror="alert(1)">')).not.toMatch(/[<>"=]/);
    expect(cleanText("ท่าอากาศยานภูเก็ต", 60)).toBe("ท่าอากาศยานภูเก็ต"); // combining vowels survive
    expect(cleanText("Rawai</span><script>x()</script>", 60)).toBe("Rawai/spanscriptx()/script");
    expect(cleanText("a".repeat(500), 60)).toHaveLength(60);
  });

  it("a hostile keyless row comes out with no markup in any string field", () => {
    const [bus] = parseKeylessFeed({ data: [{ licence: '"><svg onload=alert(1)>', lat: "7.9", lon: "98.3", speed: "0", data: "{}" }] }, Date.now());
    expect(bus).toBeDefined();
    for (const v of [bus!.plate, bus!.vehicleId, bus!.destination]) expect(v).not.toMatch(/[<>"'=&]/);
  });

  it("a hostile token row's destination and device id are cleaned", () => {
    const [bus] = parsePksbFeed([{
      id: 1, licence: "10-1149", date: "2026-10-15T10:00:00", buffer: "",
      data: { azm: 0, pos: [98.3, 7.9], spd: 0, time: "2026-10-15T10:00:00", gpstime: "2026-10-15T10:00:00", buffer: "",
        determineBusDirection: ["x", 0, "<b onmouseover=steal()>Rawai</b>", 0, 0], vhc: { id: "<i>dev</i>", lc: "10-1149" } },
    }], Date.parse("2026-10-15T10:01:00+07:00"));
    expect(bus!.destination).not.toMatch(/[<>=]/);
    expect(bus!.vehicleId).not.toMatch(/[<>]/);
  });

  it("an upstream flooding thousands of rows is capped", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ licence: `10-${1000 + (i % 9000)}`, lat: "7.9", lon: "98.3", speed: "0", data: "{}" }));
    expect(parseKeylessFeed({ data: rows }, Date.now()).length).toBeLessThanOrEqual(MAX_FEED_ROWS);
  });
});
