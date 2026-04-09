import { getSeasonalMultiplier, isHighSeason } from "./environmentSimulator";
import { getSimulatedMinutes } from "./fleetSimulator";

// Hourly demand curve (passengers per hour, peak day baseline)
const HOURLY_DEMAND = [
  0, 0, 0, 0, 0, 0,        // 00-05: no service
  180, 320, 480, 520, 440,  // 06-10: morning ramp
  380, 360, 400, 450, 480,  // 11-15: midday
  520, 560, 480, 360, 240,  // 16-20: evening peak
  120, 60, 0                // 21-23: wind down
];

const CO2_KG_PER_PAX_KM = 0.15;
const AVG_TRIP_KM = 8.2;
const AVG_CONGESTION_MINUTES_SAVED_PER_PAX = 4.2;
const SCOOTER_ACCIDENT_RATE_PER_PAX = 0.000012; // Annual equivalent
const AVG_FARE_THB = 85; // Weighted avg: 100 THB airport line (majority) + 50 THB local lines

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
  const currentMinutes = getSimulatedMinutes(); // uses 10x accelerated time
  const currentHour = Math.floor(currentMinutes / 60) % 24;
  const minuteFraction = (currentMinutes % 60) / 60;
  const seasonal = getSeasonalMultiplier(month);
  const highSeason = isHighSeason(month);

  // Accumulate riders from midnight to now
  let ridersToday = 0;
  for (let h = 0; h < currentHour; h++) {
    ridersToday += (HOURLY_DEMAND[h] ?? 0) * seasonal;
  }
  // Partial current hour
  ridersToday += (HOURLY_DEMAND[currentHour] ?? 0) * seasonal * minuteFraction;
  ridersToday = Math.round(ridersToday);

  const co2SavedKg = Math.round(ridersToday * AVG_TRIP_KM * CO2_KG_PER_PAX_KM * 10) / 10;
  const congestionMinutes = Math.round(ridersToday * AVG_CONGESTION_MINUTES_SAVED_PER_PAX);
  const accidentReduction = ridersToday * SCOOTER_ACCIDENT_RATE_PER_PAX;
  const revenue = Math.round(ridersToday * AVG_FARE_THB);

  // Annual projections (extrapolate from today's pace)
  const dailyProjection = ridersToday > 0 && currentHour > 6
    ? ridersToday / (currentHour / 24)
    : HOURLY_DEMAND.reduce((s, v) => s + v, 0) * seasonal;
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
