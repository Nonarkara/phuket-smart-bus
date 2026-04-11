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

export const OPS_FLIGHT_SCHEDULE: OpsFlight[] = peakDay.flights
  .map((flight) => ({
    flightNo: flight.flightNumber,
    airline: flight.airline,
    city: flight.city,
    airportCode: flight.origin ?? flight.destination ?? "",
    pax: flight.estimatedPax,
    schedMin: parseMinutes(flight.scheduledTime),
    timeLabel: flight.scheduledTime,
    type: flight.type === "arrival" ? ("arr" as const) : ("dep" as const),
    terminal: flight.terminal
  }))
  .sort((left, right) => left.schedMin - right.schedMin || (left.type === "arr" ? -1 : 1));

export function getOpsFlightSchedule() {
  return OPS_FLIGHT_SCHEDULE;
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
