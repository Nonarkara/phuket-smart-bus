/**
 * The simulation runs on the departures the real buses made. These tests use
 * 11 recorded days (2–12 Oct 2026) and check the day model still conserves
 * every passenger once the published timetable is swapped for what ran.
 */
import fixture from "./__fixtures__/PBUS_2026-10-13_DATA_trips-11-days.json";
import type { SlimDay } from "@shared/insights";
import { measuredSupplyByDow, measuredSupplyFor, MIN_TRIPS } from "./measuredSupply";
import { getAirportDepartures, getPublishedAirportDepartures, setMeasuredAirportSupply } from "./fleetSimulator";
import { getDayModelFor, getFleetScenario, getWeekEconomics } from "./demandSupplyEngine";
import { setSimulationDay } from "./opsFlightSchedule";

const days = (fixture as { days: SlimDay[] }).days;

afterEach(() => setMeasuredAirportSupply({}));

describe("measured airport supply", () => {
  it("turns a recorded day into southbound departures and real airport arrivals", () => {
    const s = measuredSupplyFor(days[0]!)!;
    expect(s.date).toBe("2026-10-02");
    expect(s.southbound.length).toBeGreaterThanOrEqual(MIN_TRIPS);
    expect([...s.southbound].sort((a, b) => a - b)).toEqual(s.southbound);
    for (const t of s.northbound) expect(t.airportArriveMin).toBeGreaterThan(t.originDepMin);
    expect(s.medianTripMin!).toBeGreaterThan(95); // the real line runs slower than the timetable
  });

  it("picks the latest recorded day of each weekday", () => {
    const byDow = measuredSupplyByDow(days);
    expect(byDow[5]?.date).toBe("2026-10-09"); // Fri: 9 Oct beats 2 Oct
    expect(Object.keys(byDow).length).toBe(7);
  });

  it("a near-empty day is an outage, not a service level", () => {
    const thin: SlimDay = { date: "2026-10-20", lines: [{ routeId: "rawai-airport", trips: days[0]!.lines[0]!.trips.slice(0, 3) }] };
    expect(measuredSupplyFor(thin)).toBeNull();
  });

  it("the day model runs on the measured departures and still conserves every passenger", () => {
    const byDow = measuredSupplyByDow(days);
    setMeasuredAirportSupply(byDow);
    const dow = 5;
    setSimulationDay(dow);
    expect(getAirportDepartures(dow)).toEqual(byDow[dow]!.southbound);
    const m = getDayModelFor(dow);
    expect(m.trips.length).toBe(byDow[dow]!.southbound.length);
    for (let t = 0; t < 1441; t += 11) {
      expect(m.boardedCum[t]! + m.abandonedCum[t]! + m.waiting[t]!).toBe(m.demandCum[t]);
    }
    expect(m.outbound.totals.boarded + m.outbound.totals.lost).toBe(m.outbound.totals.demand);
    // more buses never carry fewer people
    expect(getFleetScenario(3).boarded).toBeGreaterThanOrEqual(getFleetScenario(0).boarded);
  });

  it("clearing the measured supply returns every cache to the timetable", () => {
    setMeasuredAirportSupply(measuredSupplyByDow(days));
    const measuredWeek = getWeekEconomics().week;
    setMeasuredAirportSupply({});
    expect(getAirportDepartures(5)).toEqual(getPublishedAirportDepartures());
    expect(getDayModelFor(5).trips.length).toBe(getPublishedAirportDepartures().length);
    expect(getWeekEconomics().week).not.toEqual(measuredWeek);
  });
});
