/**
 * Flights by country — who is flying into Phuket, per weekday.
 *
 * The flight schedule is REAL: published airlines, real flight numbers, the
 * airframes those airlines actually fly, HKT's published times. This module
 * groups it by the passenger's country of origin so the wall screen can say,
 * in one glance, "Monday: 46 planes from Thailand, 9 from China, 5 from
 * Russia…" — and, in the seven-cell strip beside each country, how that
 * changes across the week.
 *
 * Every number here is a sum over `getOpsFlightScheduleFor(dow)`; nothing is
 * typed in by hand. When the real HKT feed arrives, this file does not change.
 */

import { getOpsFlightScheduleFor, getSimulationDay, type OpsFlight } from "./opsFlightSchedule";

export type CountryInfo = { code: string; name: string; flag: string; domestic?: boolean };

/** City → country. Boats are grouped under "Andaman islands" so the board
 *  can still account for every arrival row in the schedule. */
export const CITY_COUNTRY: Record<string, CountryInfo> = {
  // Thailand (domestic)
  "Bangkok": { code: "TH", name: "Thailand", flag: "🇹🇭", domestic: true },
  "Chiang Mai": { code: "TH", name: "Thailand", flag: "🇹🇭", domestic: true },
  "Ko Samui": { code: "TH", name: "Thailand", flag: "🇹🇭", domestic: true },
  "Hat Yai": { code: "TH", name: "Thailand", flag: "🇹🇭", domestic: true },
  "Surat Thani": { code: "TH", name: "Thailand", flag: "🇹🇭", domestic: true },
  "Khon Kaen": { code: "TH", name: "Thailand", flag: "🇹🇭", domestic: true },
  "Nakhon Si Thammarat": { code: "TH", name: "Thailand", flag: "🇹🇭", domestic: true },
  "Udon Thani": { code: "TH", name: "Thailand", flag: "🇹🇭", domestic: true },
  // China
  "Shanghai": { code: "CN", name: "China", flag: "🇨🇳" },
  "Beijing": { code: "CN", name: "China", flag: "🇨🇳" },
  "Guangzhou": { code: "CN", name: "China", flag: "🇨🇳" },
  "Kunming": { code: "CN", name: "China", flag: "🇨🇳" },
  "Chengdu": { code: "CN", name: "China", flag: "🇨🇳" },
  "Chongqing": { code: "CN", name: "China", flag: "🇨🇳" },
  "Hong Kong": { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  "Taipei": { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  // Russia
  "Moscow": { code: "RU", name: "Russia", flag: "🇷🇺" },
  "Moscow Vnukovo": { code: "RU", name: "Russia", flag: "🇷🇺" },
  "St Petersburg": { code: "RU", name: "Russia", flag: "🇷🇺" },
  "Novosibirsk": { code: "RU", name: "Russia", flag: "🇷🇺" },
  "Yekaterinburg": { code: "RU", name: "Russia", flag: "🇷🇺" },
  // Rest of Asia
  "Singapore": { code: "SG", name: "Singapore", flag: "🇸🇬" },
  "Kuala Lumpur": { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  "Seoul": { code: "KR", name: "Korea", flag: "🇰🇷" },
  "Tokyo": { code: "JP", name: "Japan", flag: "🇯🇵" },
  "Delhi": { code: "IN", name: "India", flag: "🇮🇳" },
  "Mumbai": { code: "IN", name: "India", flag: "🇮🇳" },
  "Ho Chi Minh City": { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  "Hanoi": { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  "Da Nang": { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  "Jakarta": { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  "Bali": { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  "Yangon": { code: "MM", name: "Myanmar", flag: "🇲🇲" },
  // Middle East
  "Dubai": { code: "AE", name: "UAE", flag: "🇦🇪" },
  "Doha": { code: "QA", name: "Qatar", flag: "🇶🇦" },
  // Europe
  "Frankfurt": { code: "DE", name: "Germany", flag: "🇩🇪" },
  "Milan": { code: "IT", name: "Italy", flag: "🇮🇹" },
  "London": { code: "GB", name: "UK", flag: "🇬🇧" },
  // Oceania
  "Perth": { code: "AU", name: "Australia", flag: "🇦🇺" },
  "Sydney": { code: "AU", name: "Australia", flag: "🇦🇺" },
  // Boats (charter rows in the schedule)
  "Phi Phi Island": { code: "SEA", name: "Islands (boat)", flag: "⛴" },
  "Koh Yao Noi": { code: "SEA", name: "Islands (boat)", flag: "⛴" },
  "Racha Island": { code: "SEA", name: "Islands (boat)", flag: "⛴" },
};

const UNKNOWN: CountryInfo = { code: "??", name: "Other", flag: "✈" };

export function countryFor(city: string): CountryInfo {
  return CITY_COUNTRY[city] ?? UNKNOWN;
}

export type CountryRow = CountryInfo & {
  /** Arrival flights on the active day. */
  arrivals: number;
  /** Departure flights on the active day. */
  departures: number;
  /** Arriving passengers on the active day. */
  arrPax: number;
  /** Departing passengers on the active day. */
  depPax: number;
  /** Arrival flights per JS weekday (0 = SUN … 6 = SAT). */
  arrivalsByDow: number[];
  /** Arriving pax per JS weekday. */
  arrPaxByDow: number[];
  /** Distinct airlines flying this country ↔ HKT on the active day. */
  airlines: string[];
};

function emptyRow(info: CountryInfo): CountryRow {
  return {
    ...info,
    arrivals: 0,
    departures: 0,
    arrPax: 0,
    depPax: 0,
    arrivalsByDow: new Array<number>(7).fill(0),
    arrPaxByDow: new Array<number>(7).fill(0),
    airlines: [],
  };
}

const boardByDow = new Map<number, CountryRow[]>();

/** Country rows for one weekday, sorted by arriving passengers (desc). The
 *  seven-day strips are filled for every row so the board can show the
 *  weekly rhythm next to today's count. */
export function getCountryBoard(dow = getSimulationDay()): CountryRow[] {
  const hit = boardByDow.get(dow);
  if (hit) return hit;

  const rows = new Map<string, CountryRow>();
  const rowFor = (flight: OpsFlight) => {
    const info = countryFor(flight.city);
    let row = rows.get(info.code);
    if (!row) {
      row = emptyRow(info);
      rows.set(info.code, row);
    }
    return row;
  };

  // Today's counts.
  for (const f of getOpsFlightScheduleFor(dow)) {
    const row = rowFor(f);
    if (f.type === "arr") {
      row.arrivals += 1;
      row.arrPax += f.pax;
    } else {
      row.departures += 1;
      row.depPax += f.pax;
    }
    if (!row.airlines.includes(f.airline)) row.airlines.push(f.airline);
  }
  // Weekly strip — arrivals only (that is what fills the bus queue).
  for (let d = 0; d < 7; d++) {
    for (const f of getOpsFlightScheduleFor(d)) {
      if (f.type !== "arr") continue;
      const row = rowFor(f);
      row.arrivalsByDow[d] += 1;
      row.arrPaxByDow[d] += f.pax;
    }
  }

  const built = [...rows.values()].sort((a, b) => b.arrPax - a.arrPax || b.arrivals - a.arrivals);
  boardByDow.set(dow, built);
  return built;
}

export type CountryTotals = {
  arrivals: number;
  departures: number;
  arrPax: number;
  depPax: number;
  countries: number;
  international: number; // arrival flights from abroad
  domestic: number;      // arrival flights within Thailand
};

export function getCountryTotals(dow = getSimulationDay()): CountryTotals {
  const rows = getCountryBoard(dow);
  const t: CountryTotals = { arrivals: 0, departures: 0, arrPax: 0, depPax: 0, countries: 0, international: 0, domestic: 0 };
  for (const r of rows) {
    t.arrivals += r.arrivals;
    t.departures += r.departures;
    t.arrPax += r.arrPax;
    t.depPax += r.depPax;
    if (r.arrivals > 0) t.countries += 1;
    if (r.domestic) t.domestic += r.arrivals;
    else t.international += r.arrivals;
  }
  return t;
}
