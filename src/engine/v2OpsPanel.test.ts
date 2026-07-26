import { BUS_CAPACITY } from "./demandSupplyEngine";
import { getHourlyBalance } from "./v2OpsPanel";

describe("operations demand/supply gap", () => {
  it("prices the shortfall as whole buses independently in each direction", () => {
    for (const row of getHourlyBalance()) {
      const expected = Math.ceil(Math.max(0, row.inGapPax) / BUS_CAPACITY)
        + Math.ceil(Math.max(0, row.outGapPax) / BUS_CAPACITY);
      expect(row.busesToAdd).toBe(expected);
    }
  });
});
