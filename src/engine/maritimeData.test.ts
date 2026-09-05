import { describe, it, expect } from "vitest";
import { evaluateMaritimeSafety, getMaritimeOverview, PHUKET_PIERS } from "./maritimeData";

describe("maritimeData", () => {
  it("clears all boats with GREEN flag under calm sea conditions", () => {
    const safety = evaluateMaritimeSafety(0.8, 15);
    expect(safety.flag).toBe("green");
    expect(safety.smallBoatsAllowed).toBe(true);
    expect(safety.ferriesAllowed).toBe(true);
    expect(safety.statusLabelEn).toContain("GREEN FLAG");
  });

  it("issues YELLOW flag caution for waves between 1.4m and 2.0m", () => {
    const safety = evaluateMaritimeSafety(1.6, 25);
    expect(safety.flag).toBe("yellow");
    expect(safety.smallBoatsAllowed).toBe(true);
    expect(safety.ferriesAllowed).toBe(true);
    expect(safety.statusLabelEn).toContain("YELLOW FLAG");
  });

  it("strictly prohibits small boats with RED flag when waves exceed 2.0m", () => {
    const safety = evaluateMaritimeSafety(2.4, 30);
    expect(safety.flag).toBe("red");
    expect(safety.smallBoatsAllowed).toBe(false);
    expect(safety.statusLabelEn).toContain("SMALL BOATS PROHIBITED FROM LEAVING SHORE");
    expect(safety.statusLabelTh).toContain("ห้ามเรือเล็กออกจากฝั่งเด็ดขาด");
  });

  it("triggers RED flag when wind gusts exceed 42 km/h even if waves are moderate", () => {
    const safety = evaluateMaritimeSafety(1.2, 45);
    expect(safety.flag).toBe("red");
    expect(safety.smallBoatsAllowed).toBe(false);
  });

  it("computes pier statuses correctly across Phuket's 4 major tourist piers", () => {
    const overview = getMaritimeOverview(2.2, 35, true);
    expect(overview.piers.length).toBe(4);
    expect(overview.flag).toBe("red");
    expect(overview.smallBoatsAllowed).toBe(false);

    // Open sea piers like Rassada should have higher swell than sheltered bay like Bang Rong
    const rassada = overview.piers.find((p) => p.pierId === "rassada")!;
    const bangRong = overview.piers.find((p) => p.pierId === "bang-rong")!;
    expect(rassada.waveHeightM).toBeGreaterThan(bangRong.waveHeightM);
  });
});
