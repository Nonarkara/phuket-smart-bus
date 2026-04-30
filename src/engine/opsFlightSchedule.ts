import peakDayFlights from "../../server/data/fixtures/peak-day-flights.json";

export type OpsFlight = {
  flightNo: string;
  airline: string;
  city: string;
  airportCode: string;
  pax: number;
  schedMin: number;
  timeLabel: string;
  type: "arr" | "dep";
  terminal: string;
  mode: "flight" | "boat";
};

type PeakDayFlightFixture = {
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin?: string;
  destination?: string;
  city: string;
  scheduledTime: string;
  type: "arrival" | "departure";
  terminal: string;
  estimatedPax: number;
};

type PeakDayFixture = {
  date: string;
  airport: string;
  totalFlights: number;
  flights: PeakDayFlightFixture[];
};

export type FlightHourBucket = {
  hour: number;
  arrivals: number;
  departures: number;
  arrivalPax: number;
  departurePax: number;
};

function parseMinutes(label: string) {
  const [hours, minutes] = label.split(":").map(Number);
  return hours * 60 + minutes;
}

const peakDay = peakDayFlights as PeakDayFixture;

export const BASE_OPS_FLIGHTS: OpsFlight[] = peakDay.flights
  .map((flight) => ({
    flightNo: flight.flightNumber,
    airline: flight.airline,
    city: flight.city,
    airportCode: flight.origin ?? flight.destination ?? "",
    pax: flight.estimatedPax,
    schedMin: parseMinutes(flight.scheduledTime),
    timeLabel: flight.scheduledTime,
    type: flight.type === "arrival" ? ("arr" as const) : ("dep" as const),
    terminal: flight.terminal,
    mode: "flight" as const
  }))
  .sort((left, right) => left.schedMin - right.schedMin || (left.type === "arr" ? -1 : 1));

// ---------------------------------------------------------------------------
// Day-of-week fuzz — same calendar day renders the same numbers, different
// dates shift volume, schedule and origin mix. Tuesday is quiet, Saturday
// peaks, Sunday returns the weekend traffic. Seed = today's date so the
// result is deterministic within a calendar day.
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DOW_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const DOW_VOLUME = [1.10, 0.95, 0.85, 0.85, 1.00, 1.05, 1.18];
const DOW_CHARTERS: Array<Array<{ flightNo: string; airline: string; city: string; airportCode: string; pax: number; mode?: "flight" | "boat" }>> = [
  [{ flightNo: "SQ732", airline: "Singapore Airlines", city: "Singapore", airportCode: "SIN", pax: 198 }],
  [
    { flightNo: "Rassada Ferry", airline: "Andaman Wave Master", city: "Phi Phi Island", airportCode: "PP", pax: 250, mode: "boat" },
    { flightNo: "Bang Rong Speedboat", airline: "Local Speedboat", city: "Koh Yao Noi", airportCode: "KYN", pax: 35, mode: "boat" }
  ],
  [{ flightNo: "CZ8347", airline: "China Southern", city: "Guangzhou", airportCode: "CAN", pax: 234 }],
  [{ flightNo: "6E1054", airline: "IndiGo", city: "Delhi", airportCode: "DEL", pax: 186 }],
  [
    { flightNo: "Rassada Ferry", airline: "Phi Phi Cruiser", city: "Phi Phi Island", airportCode: "PP", pax: 320, mode: "boat" }
  ],
  [{ flightNo: "SU272", airline: "Aeroflot", city: "Moscow", airportCode: "SVO", pax: 312 }],
  [
    { flightNo: "ZF1845", airline: "Azur Air", city: "Yekaterinburg", airportCode: "SVX", pax: 298 },
    { flightNo: "KE637",  airline: "Korean Air", city: "Seoul", airportCode: "ICN", pax: 224 },
    { flightNo: "Chalong Boat", airline: "Racha Boat", city: "Racha Island", airportCode: "RAC", pax: 45, mode: "boat" }
  ]
];

function todaySeed() {
  const d = new Date();
  const dow = d.getDay();
  const startOfYear = new Date(d.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((d.getTime() - startOfYear) / 86_400_000);
  const seed = d.getFullYear() * 1000 + dayOfYear * 7 + dow;
  return { seed, dow };
}

const TODAY = todaySeed();
const rng = mulberry32(TODAY.seed);

function fmtTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.max(0, Math.floor(min % 60));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function applyDailyFuzz(base: OpsFlight[]): OpsFlight[] {
  const factor = DOW_VOLUME[TODAY.dow];
  const out: OpsFlight[] = [];
  for (const f of base) {
    if (rng() < 0.05) continue; // 5% cancellation
    const paxJitter = 1 + (rng() - 0.5) * 0.30; // ±15%
    const timeJitter = Math.round((rng() - 0.5) * 20); // ±10 min
    const schedMin = Math.max(0, f.schedMin + timeJitter);
    out.push({
      ...f,
      pax: Math.max(0, Math.round(f.pax * factor * paxJitter)),
      schedMin,
      timeLabel: fmtTime(schedMin)
    });
  }
  for (const c of DOW_CHARTERS[TODAY.dow]) {
    const schedMin = Math.round(420 + rng() * 900); // 07:00–22:00
    out.push({
      flightNo: c.flightNo,
      airline: c.airline,
      city: c.city,
      airportCode: c.airportCode,
      pax: Math.round(c.pax * (1 + (rng() - 0.5) * 0.20)),
      schedMin,
      timeLabel: fmtTime(schedMin),
      type: "arr",
      terminal: c.mode === "boat" ? "PIER" : "T1",
      mode: c.mode ?? "flight"
    });
  }
  return out.sort((a, b) => a.schedMin - b.schedMin || (a.type === "arr" ? -1 : 1));
}

export const OPS_FLIGHT_SCHEDULE: OpsFlight[] = applyDailyFuzz(BASE_OPS_FLIGHTS);

export function getOpsFlightSchedule() {
  return OPS_FLIGHT_SCHEDULE;
}

export function getDayLabel(): string {
  return DOW_LABELS[TODAY.dow];
}

export function getDayVolumeFactor(): number {
  return DOW_VOLUME[TODAY.dow];
}

export function buildFlightHourBuckets(flights = OPS_FLIGHT_SCHEDULE): FlightHourBucket[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    arrivals: 0,
    departures: 0,
    arrivalPax: 0,
    departurePax: 0
  }));

  for (const flight of flights) {
    const bucket = buckets[Math.floor(flight.schedMin / 60)];
    if (!bucket) continue;

    if (flight.type === "arr") {
      bucket.arrivals += 1;
      bucket.arrivalPax += flight.pax;
    } else {
      bucket.departures += 1;
      bucket.departurePax += flight.pax;
    }
  }

  return buckets;
}
