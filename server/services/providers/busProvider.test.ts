import { inferRoute, normalizeRecord } from "./busProvider.js";

const rawRecord = {
  id: 1,
  licence: "10-1223",
  date: "2026-03-08T14:26:48.689912",
  buffer: "Patong",
  data: {
    azm: 294.7,
    pos: [98.356406, 7.906158] as [number, number],
    spd: 50,
    time: "2026-03-08T14:26:48.588467",
    buffer: "Patong",
    determineBusDirection: [
      "The bus is heading from Phuket Bus Terminal 1 to Patong",
      7483.75,
      "Patong",
      868.0,
      129
    ] as [string, number, string, number, number],
    vhc: {
      id: "007103AF3C",
      lc: "10-1223"
    }
  }
};

describe("busProvider", () => {
  it("infers the Phuket route from buffer hints", () => {
    expect(inferRoute(rawRecord)).toBe("patong-old-bus-station");
  });

  it("normalizes raw live feed records for the frontend", () => {
    const vehicle = normalizeRecord(rawRecord);

    expect(vehicle).not.toBeNull();
    expect(vehicle?.routeId).toBe("patong-old-bus-station");
    expect(vehicle?.coordinates).toEqual([7.906158, 98.356406]);
    expect(vehicle?.destination.en).toContain("Patong");
  });
});
