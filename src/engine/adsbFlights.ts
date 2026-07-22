/**
 * Live ADS-B around Phuket (HKT) — airplanes.live point query.
 * Same upstream Globalmonitor uses for the Thailand theater Phuket point.
 *
 * Conservation: each marker = one hex from the last successful poll.
 * Empty / failed poll → keep last-good (never invent positions).
 */

export type AdsbAircraft = {
  hex: string;
  callsign: string;
  lat: number;
  lon: number;
  altitudeFt: number | null;
  speedKts: number | null;
  heading: number;
  onGround: boolean;
  military: boolean;
};

export type AdsbSnapshot = {
  aircraft: AdsbAircraft[];
  updatedAt: string | null;
  status: "live" | "stale" | "empty";
};

const HKT = { lat: 7.8804, lon: 98.3923 };
const RADIUS_NM = 80;
const CACHE_KEY = "pksb:last-good-adsb-hkt";
const POLL_MS = 45_000;

let memoryLast: AdsbSnapshot | null = null;

function readStorage(): AdsbSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdsbSnapshot;
    if (!Array.isArray(parsed?.aircraft)) return null;
    return { ...parsed, status: "stale" };
  } catch {
    return null;
  }
}

function writeStorage(snap: AdsbSnapshot) {
  if (typeof window === "undefined" || snap.aircraft.length === 0) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snap));
  } catch {
    /* quota / private mode */
  }
}

function normalize(ac: Record<string, unknown>): AdsbAircraft | null {
  const lat = Number(ac.lat);
  const lon = Number(ac.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const hex = String(ac.hex ?? "").toLowerCase();
  if (!hex) return null;

  let alt: number | null = null;
  const rawAlt = ac.alt_geom ?? ac.alt_baro;
  if (rawAlt === "ground") alt = 0;
  else if (typeof rawAlt === "number" && Number.isFinite(rawAlt)) alt = rawAlt;

  const callsign = String(ac.flight ?? ac.r ?? hex).trim().toUpperCase() || hex.toUpperCase();
  const track = Number(ac.track ?? ac.true_heading ?? 0);
  const gs = Number(ac.gs);
  const onGround = rawAlt === "ground" || Boolean(ac.ground);

  return {
    hex,
    callsign,
    lat,
    lon,
    altitudeFt: alt,
    speedKts: Number.isFinite(gs) ? gs : null,
    heading: Number.isFinite(track) ? track : 0,
    onGround,
    military: Boolean(ac.mil),
  };
}

/** One-shot fetch. Safe to call from UI effects. */
export async function fetchAdsbAroundHkt(signal?: AbortSignal): Promise<AdsbSnapshot> {
  const url = `https://api.airplanes.live/v2/point/${HKT.lat}/${HKT.lon}/${RADIUS_NM}`;
  try {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`adsb ${res.status}`);
    const data = (await res.json()) as { ac?: Record<string, unknown>[] };
    const aircraft = (data.ac ?? [])
      .map(normalize)
      .filter((a): a is AdsbAircraft => a != null)
      // Keep airborne + recent ground movements near the field
      .filter((a) => !a.onGround || (a.speedKts != null && a.speedKts > 5));

    if (aircraft.length === 0) {
      const fallback = memoryLast ?? readStorage();
      if (fallback && fallback.aircraft.length > 0) {
        return { ...fallback, status: "stale" };
      }
      return { aircraft: [], updatedAt: new Date().toISOString(), status: "empty" };
    }

    const snap: AdsbSnapshot = {
      aircraft,
      updatedAt: new Date().toISOString(),
      status: "live",
    };
    memoryLast = snap;
    writeStorage(snap);
    return snap;
  } catch {
    const fallback = memoryLast ?? readStorage();
    if (fallback && fallback.aircraft.length > 0) {
      return { ...fallback, status: "stale" };
    }
    return { aircraft: [], updatedAt: null, status: "empty" };
  }
}

export const ADSB_POLL_MS = POLL_MS;
export const HKT_COORDS = HKT;

/** Schedule beads — arrivals/departures from the ops fixture near HKT when ADS-B is quiet. */
export type ScheduleFlightBead = {
  id: string;
  callsign: string;
  lat: number;
  lon: number;
  heading: number;
  kind: "arr" | "dep";
  city: string;
  minutesToEvent: number;
};

/**
 * Place schedule flights on a short radial approach/departure arc around HKT
 * so the map always shows the demand story even when ADS-B is empty.
 * Position = f(minutes to/from event); no invented telemetry IDs from live feed.
 */
export function buildScheduleFlightBeads(
  flights: { flightNo: string; type: "arr" | "dep"; city: string; schedMin: number; mode?: "flight" | "boat" }[],
  nowMin: number
): ScheduleFlightBead[] {
  const beads: ScheduleFlightBead[] = [];
  for (const f of flights) {
    if (f.mode === "boat") continue;
    const eventMin = f.schedMin;
    const delta = eventMin - nowMin;
    // Show from 40 min before to 15 min after
    if (delta < -15 || delta > 40) continue;

    const t = f.type === "arr"
      ? Math.max(0, Math.min(1, delta / 40)) // 1 = far out, 0 = at gate
      : Math.max(0, Math.min(1, (15 + delta) / 55)); // 0 = at gate, 1 = far

    // Approach from NE (Bangkok/China corridors); departures climb SW then turn
    const bearing = f.type === "arr" ? 45 : 220;
    const distKm = f.type === "arr" ? 2 + t * 38 : 2 + (1 - t) * 28;
    const rad = (bearing * Math.PI) / 180;
    const dLat = (distKm / 111) * Math.cos(rad);
    const dLon = (distKm / (111 * Math.cos((HKT.lat * Math.PI) / 180))) * Math.sin(rad);

    beads.push({
      id: `sched-${f.flightNo}-${eventMin}`,
      callsign: f.flightNo,
      lat: HKT.lat + dLat,
      lon: HKT.lon + dLon,
      heading: f.type === "arr" ? bearing + 180 : bearing,
      kind: f.type,
      city: f.city,
      minutesToEvent: Math.round(delta),
    });
  }
  return beads;
}
