/**
 * Realistic peak-day flight schedule for Phuket International Airport (HKT).
 * Based on Dec 30 traffic patterns (~380 flights, ~65,000 passengers).
 * Data sourced from FlightConnections, Airports of Thailand, and airline schedules.
 */

import type { FlightInfo } from "@shared/types";
import { getBangkokNowMinutes } from "./time";

type FlightTemplate = {
  flightNo: string;
  airline: string;
  origin: string;
  scheduledMinutes: number; // minutes from midnight
  estimatedPax: number;
  type: "arrival" | "departure";
};

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Peak day: Dec 30 — 190 arrivals, 190 departures
// Curated sample of ~80 representative flights (the most visible for the simulation)
const PEAK_DAY_FLIGHTS: FlightTemplate[] = [
  // ===== ARRIVALS =====
  // 05:00-07:00 — Early morning (Europe overnight, first domestic)
  { flightNo: "TG201", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 305, estimatedPax: 174, type: "arrival" },
  { flightNo: "FD3021", airline: "Thai AirAsia", origin: "Bangkok (DMK)", scheduledMinutes: 320, estimatedPax: 186, type: "arrival" },
  { flightNo: "AY107", airline: "Finnair", origin: "Helsinki (HEL)", scheduledMinutes: 340, estimatedPax: 298, type: "arrival" },
  { flightNo: "QR838", airline: "Qatar Airways", origin: "Doha (DOH)", scheduledMinutes: 355, estimatedPax: 280, type: "arrival" },
  { flightNo: "SL800", airline: "Thai Lion Air", origin: "Bangkok (DMK)", scheduledMinutes: 370, estimatedPax: 189, type: "arrival" },
  { flightNo: "EK378", airline: "Emirates", origin: "Dubai (DXB)", scheduledMinutes: 390, estimatedPax: 385, type: "arrival" },
  // 07:00-09:00 — Peak morning (BKK shuttles, Singapore, Malaysia)
  { flightNo: "TG203", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 420, estimatedPax: 174, type: "arrival" },
  { flightNo: "PG270", airline: "Bangkok Airways", origin: "Bangkok (BKK)", scheduledMinutes: 435, estimatedPax: 144, type: "arrival" },
  { flightNo: "SQ720", airline: "Singapore Airlines", origin: "Singapore (SIN)", scheduledMinutes: 445, estimatedPax: 303, type: "arrival" },
  { flightNo: "FD3023", airline: "Thai AirAsia", origin: "Bangkok (DMK)", scheduledMinutes: 460, estimatedPax: 186, type: "arrival" },
  { flightNo: "AK800", airline: "AirAsia", origin: "Kuala Lumpur (KUL)", scheduledMinutes: 475, estimatedPax: 186, type: "arrival" },
  { flightNo: "VZ300", airline: "Thai Vietjet", origin: "Bangkok (BKK)", scheduledMinutes: 490, estimatedPax: 220, type: "arrival" },
  { flightNo: "SL802", airline: "Thai Lion Air", origin: "Bangkok (DMK)", scheduledMinutes: 505, estimatedPax: 189, type: "arrival" },
  { flightNo: "DD520", airline: "Nok Air", origin: "Bangkok (DMK)", scheduledMinutes: 520, estimatedPax: 174, type: "arrival" },
  // 09:00-11:00 — China/Korea wave
  { flightNo: "CA821", airline: "Air China", origin: "Beijing (PEK)", scheduledMinutes: 545, estimatedPax: 280, type: "arrival" },
  { flightNo: "MU2071", airline: "China Eastern", origin: "Shanghai (PVG)", scheduledMinutes: 560, estimatedPax: 280, type: "arrival" },
  { flightNo: "TG207", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 575, estimatedPax: 174, type: "arrival" },
  { flightNo: "9C8901", airline: "Spring Airlines", origin: "Shanghai (PVG)", scheduledMinutes: 590, estimatedPax: 186, type: "arrival" },
  { flightNo: "CX771", airline: "Cathay Pacific", origin: "Hong Kong (HKG)", scheduledMinutes: 605, estimatedPax: 280, type: "arrival" },
  { flightNo: "KE667", airline: "Korean Air", origin: "Seoul (ICN)", scheduledMinutes: 620, estimatedPax: 280, type: "arrival" },
  { flightNo: "FD3025", airline: "Thai AirAsia", origin: "Bangkok (DMK)", scheduledMinutes: 635, estimatedPax: 186, type: "arrival" },
  { flightNo: "3U8751", airline: "Sichuan Airlines", origin: "Chengdu (CTU)", scheduledMinutes: 650, estimatedPax: 280, type: "arrival" },
  // 11:00-13:00 — Midday (SE Asia, domestic)
  { flightNo: "TG209", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 665, estimatedPax: 174, type: "arrival" },
  { flightNo: "VJ801", airline: "VietJet Air", origin: "Ho Chi Minh (SGN)", scheduledMinutes: 680, estimatedPax: 186, type: "arrival" },
  { flightNo: "PG272", airline: "Bangkok Airways", origin: "Ko Samui (USM)", scheduledMinutes: 695, estimatedPax: 70, type: "arrival" },
  { flightNo: "TR530", airline: "Scoot", origin: "Singapore (SIN)", scheduledMinutes: 710, estimatedPax: 280, type: "arrival" },
  { flightNo: "SL804", airline: "Thai Lion Air", origin: "Bangkok (DMK)", scheduledMinutes: 730, estimatedPax: 189, type: "arrival" },
  { flightNo: "6E1401", airline: "IndiGo", origin: "Delhi (DEL)", scheduledMinutes: 750, estimatedPax: 186, type: "arrival" },
  // 13:00-15:00 — Afternoon
  { flightNo: "TG211", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 780, estimatedPax: 174, type: "arrival" },
  { flightNo: "FD3027", airline: "Thai AirAsia", origin: "Bangkok (DMK)", scheduledMinutes: 800, estimatedPax: 186, type: "arrival" },
  { flightNo: "CZ6081", airline: "China Southern", origin: "Guangzhou (CAN)", scheduledMinutes: 820, estimatedPax: 280, type: "arrival" },
  { flightNo: "MH781", airline: "Malaysia Airlines", origin: "Kuala Lumpur (KUL)", scheduledMinutes: 840, estimatedPax: 280, type: "arrival" },
  { flightNo: "UO631", airline: "HK Express", origin: "Hong Kong (HKG)", scheduledMinutes: 860, estimatedPax: 186, type: "arrival" },
  // 15:00-17:00 — Afternoon peak (Europe charter, Russia)
  { flightNo: "TG213", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 900, estimatedPax: 174, type: "arrival" },
  { flightNo: "ZF2401", airline: "Azur Air", origin: "Moscow (SVO)", scheduledMinutes: 920, estimatedPax: 350, type: "arrival" },
  { flightNo: "SU271", airline: "Aeroflot", origin: "Moscow (SVO)", scheduledMinutes: 940, estimatedPax: 310, type: "arrival" },
  { flightNo: "DE2177", airline: "Condor", origin: "Frankfurt (FRA)", scheduledMinutes: 955, estimatedPax: 280, type: "arrival" },
  { flightNo: "S7761", airline: "S7 Airlines", origin: "Novosibirsk (OVB)", scheduledMinutes: 970, estimatedPax: 186, type: "arrival" },
  { flightNo: "PG274", airline: "Bangkok Airways", origin: "Bangkok (BKK)", scheduledMinutes: 985, estimatedPax: 144, type: "arrival" },
  // 17:00-19:00 — Evening (Russia charters, late domestic)
  { flightNo: "ZF2403", airline: "Azur Air", origin: "Yekaterinburg (SVX)", scheduledMinutes: 1020, estimatedPax: 350, type: "arrival" },
  { flightNo: "FD3029", airline: "Thai AirAsia", origin: "Bangkok (DMK)", scheduledMinutes: 1040, estimatedPax: 186, type: "arrival" },
  { flightNo: "TG215", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 1060, estimatedPax: 174, type: "arrival" },
  { flightNo: "NO531", airline: "Neos", origin: "Milan (MXP)", scheduledMinutes: 1080, estimatedPax: 280, type: "arrival" },
  { flightNo: "SL806", airline: "Thai Lion Air", origin: "Bangkok (DMK)", scheduledMinutes: 1100, estimatedPax: 189, type: "arrival" },
  // 19:00-22:00 — Late evening
  { flightNo: "VZ306", airline: "Thai Vietjet", origin: "Bangkok (BKK)", scheduledMinutes: 1140, estimatedPax: 220, type: "arrival" },
  { flightNo: "ZF2405", airline: "Azur Air", origin: "Vladivostok (VVO)", scheduledMinutes: 1200, estimatedPax: 280, type: "arrival" },
  { flightNo: "TG217", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 1260, estimatedPax: 174, type: "arrival" },

  // ===== DEPARTURES =====
  { flightNo: "TG202", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 395, estimatedPax: 174, type: "departure" },
  { flightNo: "FD3022", airline: "Thai AirAsia", origin: "Bangkok (DMK)", scheduledMinutes: 420, estimatedPax: 186, type: "departure" },
  { flightNo: "SQ721", airline: "Singapore Airlines", origin: "Singapore (SIN)", scheduledMinutes: 540, estimatedPax: 303, type: "departure" },
  { flightNo: "TG204", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 570, estimatedPax: 174, type: "departure" },
  { flightNo: "AK801", airline: "AirAsia", origin: "Kuala Lumpur (KUL)", scheduledMinutes: 585, estimatedPax: 186, type: "departure" },
  { flightNo: "CA822", airline: "Air China", origin: "Beijing (PEK)", scheduledMinutes: 660, estimatedPax: 280, type: "departure" },
  { flightNo: "CX772", airline: "Cathay Pacific", origin: "Hong Kong (HKG)", scheduledMinutes: 720, estimatedPax: 280, type: "departure" },
  { flightNo: "KE668", airline: "Korean Air", origin: "Seoul (ICN)", scheduledMinutes: 750, estimatedPax: 280, type: "departure" },
  { flightNo: "TG208", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 780, estimatedPax: 174, type: "departure" },
  { flightNo: "MU2072", airline: "China Eastern", origin: "Shanghai (PVG)", scheduledMinutes: 810, estimatedPax: 280, type: "departure" },
  { flightNo: "EK379", airline: "Emirates", origin: "Dubai (DXB)", scheduledMinutes: 850, estimatedPax: 385, type: "departure" },
  { flightNo: "TG212", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 900, estimatedPax: 174, type: "departure" },
  { flightNo: "QR839", airline: "Qatar Airways", origin: "Doha (DOH)", scheduledMinutes: 960, estimatedPax: 280, type: "departure" },
  { flightNo: "FD3028", airline: "Thai AirAsia", origin: "Bangkok (DMK)", scheduledMinutes: 1020, estimatedPax: 186, type: "departure" },
  { flightNo: "TG214", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 1080, estimatedPax: 174, type: "departure" },
  { flightNo: "ZF2402", airline: "Azur Air", origin: "Moscow (SVO)", scheduledMinutes: 1140, estimatedPax: 350, type: "departure" },
  { flightNo: "SL807", airline: "Thai Lion Air", origin: "Bangkok (DMK)", scheduledMinutes: 1200, estimatedPax: 189, type: "departure" },
  { flightNo: "TG218", airline: "Thai Airways", origin: "Bangkok (BKK)", scheduledMinutes: 1350, estimatedPax: 174, type: "departure" },
];

/**
 * Nationality breakdown for arriving passengers (peak December day).
 * Based on 2024 arrival statistics weighted for high season.
 */
export const NATIONALITY_BREAKDOWN = {
  russian: 0.22,
  chinese: 0.15,
  indian: 0.09,
  australian: 0.07,
  british: 0.06,
  german: 0.06,
  malaysian: 0.05,
  korean: 0.04,
  french: 0.04,
  thai_domestic: 0.12,
  other: 0.10,
};

/** Get flights within a ±3 hour window of the current time. */
export function getFlightsAroundNow(now = new Date()): FlightInfo[] {
  const nowMin = getBangkokNowMinutes(now);
  const windowMin = 180; // ±3 hours

  return PEAK_DAY_FLIGHTS
    .filter((f) => {
      const diff = Math.abs(f.scheduledMinutes - nowMin);
      return diff <= windowMin || diff >= (1440 - windowMin);
    })
    .map((f) => ({
      flightNo: f.flightNo,
      airline: f.airline,
      origin: f.origin,
      scheduledTime: fmt(f.scheduledMinutes),
      estimatedPax: f.estimatedPax,
      type: f.type,
    }));
}

/** Get all flights for the day (for ops dashboard). */
export function getAllFlights(): FlightInfo[] {
  return PEAK_DAY_FLIGHTS.map((f) => ({
    flightNo: f.flightNo,
    airline: f.airline,
    origin: f.origin,
    scheduledTime: fmt(f.scheduledMinutes),
    estimatedPax: f.estimatedPax,
    type: f.type,
  }));
}

/** Hourly arrival passenger count for demand forecasting. */
export function getHourlyArrivalPax(): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const f of PEAK_DAY_FLIGHTS) {
    if (f.type === "arrival") {
      const h = Math.floor(f.scheduledMinutes / 60);
      if (h >= 0 && h < 24) hours[h] += f.estimatedPax;
    }
  }
  return hours;
}
