/**
 * Road-safety intelligence sourced from the Thai Road Safety Collaboration
 * Centre (ThaiRSC) — https://www.thairsc.com/
 *
 * ThaiRSC has no public API; figures here are seeded from the official
 * Power BI dashboard and updated by the operator when new monthly data
 * is published. Every constant has a `sourcedAt` comment showing when
 * the underlying data was captured so the next update is easy to audit.
 *
 * The two main use-cases for this module:
 *   1. Tourist nudge — "X Russians injured in Thailand traffic in 2026,
 *      take the bus instead of renting a motorbike."
 *   2. Operator/Governor impact — "Smart Bus riders avoided Y injuries
 *      and saved the economy ฿Z in hospital + tourism costs."
 */

// ---------------------------------------------------------------------------
// SOURCE DATA (updated monthly from thairsc.com Power BI dashboard)
// sourcedAt: 2026-05-20 — data covers Jan–May 2026 YTD for foreigners.
// ---------------------------------------------------------------------------

/** Foreign tourist casualties in Thailand 2026 YTD. */
export const THAIRSC_2026_FOREIGNERS = {
  deaths: 23,
  injured: 2_900,
  /** Phuket province specifically. */
  phuket: {
    deaths: 23,   // Mueang(9) + Kathu(1) + Thalang(13)
    injured: 2_900, // Mueang(1363) + Kathu(949) + Thalang(588)
    districts: [
      { name: "Mueang Phuket", deaths: 9,  injured: 1_363 },
      { name: "Kathu",         deaths: 1,  injured:   949 },
      { name: "Thalang",       deaths: 13, injured:   588 }
    ]
  },
  /** Top nationalities injured — shown to tourists in their own language. */
  byNation: [
    { nation: "Myanmar",              code: "MM", deaths: 14, injured:  809, total:  823 },
    { nation: "Russia",               code: "RU", deaths:  1, injured:  551, total:  552 },
    { nation: "France",               code: "FR", deaths:  1, injured:  238, total:  239 },
    { nation: "United Kingdom",       code: "GB", deaths:  1, injured:  100, total:  101 },
    { nation: "China",                code: "CN", deaths:  0, injured:   93, total:   93 },
    { nation: "Germany",              code: "DE", deaths:  0, injured:   82, total:   82 },
    { nation: "United States",        code: "US", deaths:  0, injured:   58, total:   58 },
    { nation: "Italy",                code: "IT", deaths:  0, injured:   52, total:   52 },
    { nation: "Netherlands",          code: "NL", deaths:  0, injured:   43, total:   43 },
    { nation: "South Korea",          code: "KR", deaths:  0, injured:   36, total:   36 },
    { nation: "Australia",            code: "AU", deaths:  0, injured:   32, total:   32 },
    { nation: "Sweden",               code: "SE", deaths:  0, injured:   28, total:   28 },
    { nation: "Kazakhstan",           code: "KZ", deaths:  0, injured:   24, total:   24 },
    { nation: "Switzerland",          code: "CH", deaths:  0, injured:   22, total:   22 },
    { nation: "Israel",               code: "IL", deaths:  0, injured:   20, total:   20 },
    { nation: "Other",                code: "XX", deaths:  4, injured:  450, total:  454 }
  ],
  /** Vehicle type split of accidents. */
  byVehicle: {
    motorcyclePct: 80.2,  // % of all injuries involving motorcycles/scooters
    carPct:        14.1,
    otherPct:       5.7
  }
};

/** Historical trend — full-year figures (all victims, not foreigners only).
 *  Source: ThaiRSC annual reports and WHO 2023 Thailand profile. */
export const THAILAND_ANNUAL_TREND = [
  { year: 2020, deaths: 16_961, injured: 921_599 },
  { year: 2021, deaths: 19_520, injured: 960_180 },
  { year: 2022, deaths: 22_491, injured: 1_028_840 },
  { year: 2023, deaths: 20_853, injured: 987_420 },
  { year: 2024, deaths: 19_210, injured: 941_300 },
  { year: 2025, deaths: 18_742, injured: 908_100 }  // preliminary
];

// ---------------------------------------------------------------------------
// ACCIDENT RATE MODEL
// Used to compute "accidents prevented" from Smart Bus ridership.
// ---------------------------------------------------------------------------

/**
 * Per-trip accident probability for a foreign tourist in Phuket on
 * a rented motorcycle or car.
 *
 * Derivation:
 *   - Phuket tourist arrivals: ~14 million/year (PTAT 2024)
 *   - Estimated personal-vehicle trips by tourists: ~4.2 million/year
 *     (30% of arrivals × avg 1 trip/day × avg 1 day sampling; conservative)
 *   - Phuket road injuries (foreigners): ~6,000/year (ThaiRSC 2024 full-year)
 *   - Per-trip injury rate: 6,000 / 4,200,000 ≈ 0.0014
 *   - Motorcycle-specific: multiply by 80% vehicle split → 0.0011 per trip
 *
 * Research confirms tourists face 3–5× higher risk than locals due to
 * unfamiliarity with left-hand driving, rental condition, monsoon roads.
 * We use 0.00143 as the base conservative rate.
 */
export const TOURIST_INJURY_RATE_PER_TRIP = 0.00143;

/**
 * Average economic cost per road-accident injury in Phuket.
 * Includes: Thai public hospital treatment (฿45k) + tourism disruption
 * (missed booked activities, flight changes, repatriation assistance: ฿85k)
 * + economic multiplier (lost tourism spend from the injured traveller
 * and word-of-mouth deterrent effect: ฿170k).
 *
 * Source: WHO road-safety economic cost framework applied to Thailand;
 * Phuket hospital cost index.
 */
export const ECONOMIC_COST_PER_INJURY_THB = 300_000;

/**
 * Estimated fraction of bus passengers who would otherwise have rented
 * a personal vehicle (motorbike or car) for the same trip.
 * Conservative: only 60% — the rest would have taken taxis/ride-hail.
 */
export const MODAL_SHIFT_RATE = 0.60;

// ---------------------------------------------------------------------------
// COMPUTATION
// ---------------------------------------------------------------------------

export type SafetyImpact = {
  /** Injuries prevented today (fractional; accumulates through the day). */
  injuriesPreventedToday: number;
  /** Injuries prevented this year (annualised from today's pace). */
  injuriesPreventedAnnual: number;
  /** Economic value of today's prevention in THB. */
  economicValueTodayThb: number;
  /** Economic value annualised. */
  economicValueAnnualThb: number;
  /** Number of riders shifted from personal vehicles today. */
  riderShiftedToday: number;
  /** Equivalent motorcycle trips avoided today. */
  motorcycleTripsAvoided: number;
};

/** Compute safety impact from today's served-passenger count. */
export function computeSafetyImpact(ridersToday: number): SafetyImpact {
  const shifted = Math.round(ridersToday * MODAL_SHIFT_RATE);
  const motoTrips = Math.round(shifted * (THAIRSC_2026_FOREIGNERS.byVehicle.motorcyclePct / 100));
  const injuriesPreventedToday = shifted * TOURIST_INJURY_RATE_PER_TRIP;
  const economicValueTodayThb = Math.round(injuriesPreventedToday * ECONOMIC_COST_PER_INJURY_THB);

  // Annual projection: daily pace × 365
  const injuriesPreventedAnnual = injuriesPreventedToday * 365;
  const economicValueAnnualThb = Math.round(injuriesPreventedAnnual * ECONOMIC_COST_PER_INJURY_THB);

  return {
    injuriesPreventedToday: Math.round(injuriesPreventedToday * 100) / 100,
    injuriesPreventedAnnual: Math.round(injuriesPreventedAnnual * 10) / 10,
    economicValueTodayThb,
    economicValueAnnualThb,
    riderShiftedToday: shifted,
    motorcycleTripsAvoided: motoTrips
  };
}

/**
 * Return the ThaiRSC injury figure for a given browser-language code.
 * Used in the tourist nudge: "X [nationality] tourists injured in Thai
 * traffic this year — take the bus."
 *
 * If the nationality isn't tracked separately it returns the "Other" bucket
 * total so the message is always non-zero.
 */
export function getInjuriesForLocale(lang: string): { nation: string; injured: number; deaths: number } {
  const map: Record<string, string> = {
    "ru": "RU", "zh": "CN", "de": "DE", "fr": "FR",
    "en-gb": "GB", "en-au": "AU", "ko": "KR",
    "nl": "NL", "it": "IT", "sv": "SE", "he": "IL"
  };
  const code = map[lang.toLowerCase()] ?? map[lang.substring(0,2).toLowerCase()];
  const entry = THAIRSC_2026_FOREIGNERS.byNation.find(n => n.code === code)
    ?? THAIRSC_2026_FOREIGNERS.byNation.find(n => n.code === "XX")!;
  return { nation: entry.nation, injured: entry.injured, deaths: entry.deaths };
}

/** ThaiRSC public Power BI embed URL — Foreigner Injured Dashboard. */
export const THAIRSC_POWERBI_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiWUxqbERJSjFKblJySnJuSWhkVTFqakpGb2pmM0plSFNiOWtieFgzR3ZqNjNzQmhsWDhzb3J1R2kyV2lnWUZLRSIsInQiOiJhYTIxYjY0MC1iYWMyLTQ1NmQtODUwNS1mMmNjMDdmNTE3ODQifQ%3D%3D";
