import { getSeasonalMultiplier, isHighSeason } from "./environmentSimulator";
import { simNow, getHourlyDemandSupply } from "./simulation";

// Impact constants — must match the v2 demand-supply chain so that the
// /  right-bar numbers and the /v2 chart are reading from the same engine.
const CO2_KG_PER_PAX_KM = 0.15;
const AVG_TRIP_KM = 28; // weighted across destinations (matches simulation.ts)
const AVG_CONGESTION_MINUTES_SAVED_PER_PAX = 4.2;
const SCOOTER_ACCIDENT_RATE_PER_PAX = 0.000012; // Annual equivalent
const AVG_FARE_THB = 100; // ฿100 flat fare (matches simulation.ts)

export interface ImpactMetrics {
  ridersToday: number;
  ridersTodayFormatted: string;
  co2SavedKg: number;
  co2SavedFormatted: string;
  co2AnnualProjectionTonnes: number;
  accidentEquivalentReduction: number;
  accidentAnnualProjection: number;
  congestionMinutesSaved: number;
  congestionHoursFormatted: string;
  revenueThb: number;
  revenueFormatted: string;
  activeBuses: number;
  seasonLabel: string;
  seasonMultiplier: number;
  isHighSeason: boolean;
  perBus: {
    ridersPerBus: number;
    co2PerBus: number;
    revenuePerBus: number;
    congestionMinutesPerBus: number;
  };
}

export function getImpactMetrics(activeBuses: number, now = new Date()): ImpactMetrics {
  const month = now.getMonth() + 1;
  const currentMinutes = simNow();
  const currentHour = Math.floor(currentMinutes / 60) % 24;
  const minuteFraction = (currentMinutes % 60) / 60;
  const seasonal = getSeasonalMultiplier(month);
  const highSeason = isHighSeason(month);

  // Pull the same hour-by-hour demand-supply chain that the chart uses.
  // Sum servedPax for completed hours; pro-rate the current hour by its
  // fractional progress so the counter ticks up smoothly between hours.
  const hourly = getHourlyDemandSupply();
  let ridersToday = 0;
  for (let h = 0; h < currentHour; h++) {
    ridersToday += hourly[h]?.servedPax ?? 0;
  }
  ridersToday += (hourly[currentHour]?.servedPax ?? 0) * minuteFraction;
  ridersToday = Math.round(ridersToday * seasonal);

  const co2SavedKg = Math.round(ridersToday * AVG_TRIP_KM * CO2_KG_PER_PAX_KM * 10) / 10;
  const congestionMinutes = Math.round(ridersToday * AVG_CONGESTION_MINUTES_SAVED_PER_PAX);
  const accidentReduction = ridersToday * SCOOTER_ACCIDENT_RATE_PER_PAX;
  const revenue = Math.round(ridersToday * AVG_FARE_THB);

  // Annual projection — extrapolate today's pace forward, never the static
  // baseline. Floor on a representative day total so the projection is
  // stable in the first few sim minutes.
  const fullDayProjection = hourly.reduce((s, h) => s + h.servedPax, 0) * seasonal;
  const dailyProjection = ridersToday > 0 && currentHour > 6
    ? ridersToday / Math.max(0.05, (currentMinutes - 360) / (1320 - 360))
    : fullDayProjection;
  const co2AnnualTonnes = Math.round(dailyProjection * AVG_TRIP_KM * CO2_KG_PER_PAX_KM * 365 / 1000);
  const accidentAnnual = Math.round(dailyProjection * SCOOTER_ACCIDENT_RATE_PER_PAX * 365);

  const effectiveBuses = Math.max(1, activeBuses);

  const seasonLabels: Record<number, string> = {
    1: "Peak Season", 2: "Peak Season", 3: "Hot Season", 4: "Hot Season",
    5: "Green Season", 6: "Green Season", 7: "Green Season", 8: "Green Season",
    9: "Green Season", 10: "Shoulder Season", 11: "High Season", 12: "Peak Season"
  };

  return {
    ridersToday,
    ridersTodayFormatted: ridersToday.toLocaleString(),
    co2SavedKg,
    co2SavedFormatted: co2SavedKg >= 1000 ? `${(co2SavedKg / 1000).toFixed(1)}t` : `${co2SavedKg.toFixed(0)} kg`,
    co2AnnualProjectionTonnes: co2AnnualTonnes,
    accidentEquivalentReduction: Math.round(accidentReduction * 1000) / 1000,
    accidentAnnualProjection: accidentAnnual,
    congestionMinutesSaved: congestionMinutes,
    congestionHoursFormatted: `${Math.floor(congestionMinutes / 60).toLocaleString()}h ${congestionMinutes % 60}m`,
    revenueThb: revenue,
    revenueFormatted: `${(revenue / 1000).toFixed(0)}k`,
    activeBuses,
    seasonLabel: seasonLabels[month] ?? "Active",
    seasonMultiplier: seasonal,
    isHighSeason: highSeason,
    perBus: {
      ridersPerBus: Math.round(ridersToday / effectiveBuses),
      co2PerBus: Math.round(co2SavedKg / effectiveBuses * 10) / 10,
      revenuePerBus: Math.round(revenue / effectiveBuses),
      congestionMinutesPerBus: Math.round(congestionMinutes / effectiveBuses)
    }
  };
}
