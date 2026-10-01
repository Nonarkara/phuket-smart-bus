/**
 * Real-Bus Study — patient, consistent, true numbers from the live tracker.
 *
 * One screen, three honest cuts of the same data:
 *   1. Today's snapshot — what's been observed since 00:00 BKK so far
 *   2. Range view (today / 7d / 14d / 30d) — daily breakdown, per-bus totals
 *   3. Modelled comparison — what the demand model says SHOULD have boarded
 *      (plane arrivals × regional capture × 25-cap bus), side by side with
 *      what the counters actually counted (currently null — the APC hasn't
 *      reported above zero across the fleet, so this view makes that gap
 *      unmistakable).
 *
 * The data path: KV `day:YYYY-MM-DD` aggregates written by `/api/collect/tick`
 * (cron) and `/api/collect/gps` (browser producer). One minute of GPS data
 * per sample; the day ledger accumulates fix-to-fix km, odometer km, and
 * passenger-counter rises. Coverage is shown minute-by-minute so a gap is
 * honest, never papered over.
 *
 * What the user asked for: "patient, consistent, true, accurate, unbiased"
 * — so we never round up to "0 riders" when the counter was silent. Missing
 * is missing. Model is model. Counter is counter. Each labelled.
 */
import { useEffect, useMemo, useState } from "react";
import {
  getDayModelFor,
} from "../../engine/demandSupplyEngine";
import { getOpsFlightScheduleFor } from "../../engine/opsFlightSchedule";
import { getLiveBusesRaw, getLiveFeedState, startLiveFeed, subscribeLiveFeed } from "../../engine/liveOps";
import { appPath } from "../../lib/paths";

type Range = "today" | "7d" | "14d" | "30d";

type Coverage = {
  samples: number | null;
  firstSampleAt: string | null;
  lastSampleAt: string | null;
  longestGapMin: number | null;
  serviceMinutesSampled: number | null;
  serviceMinutesSoFar: number;
  coveragePct: number | null;
};

type DayVehicle = {
  vehicleId: string;
  licensePlate: string;
  totalDistanceKm: number;
  kmBasis: "odometer" | "gps-trace";
  gpsTraceKm: number;
  fixes: number | null;
  paxServed: number | null;
  paxBasis: "apc" | "counter-silent" | "no-counter";
  revenueThb: number | null;
  lastState: "parked_depot" | "in_transit" | "dwelling";
  lastSeenAt: string;
  lastFixAt: string | null;
  runs?: number;
  hoursMoving?: number;
  firstMoveAt?: string | null;
  lastMoveAt?: string | null;
  reachedAirport?: boolean;
  lostWhileMoving?: boolean;
};

type Day = {
  date: string;
  missing: boolean;
  future: boolean;
  updatedAt: number | null;
  coverage: Coverage | null;
  totalTrackedVehicles: number | null;
  kmBasis: "odometer" | "mixed" | "gps-trace" | null;
  totalKmTracked: number | null;
  totalGpsTraceKm: number | null;
  countersReporting: number | null;
  unmeteredVehicles: number | null;
  totalPaxServed: number | null;
  totalRevenueThb: number | null;
  totalOperatingCostThb: number | null;
  netMarginThb: number | null;
  profitMarginPct: number | null;
  totalCo2SavedKg: number | null;
  revenuePerKm: number | null;
  busesMoved?: number | null;
  totalRuns?: number | null;
  totalHoursMoving?: number | null;
  busesReachedAirport?: number | null;
  busesNoFix?: number | null;
  vehicles: DayVehicle[];
};

type WeekResponse = {
  ok: boolean;
  from: string;
  through: string;
  days: Day[];
};

const BKK_TZ = "Asia/Bangkok";
const DAY_MS = 86_400_000;
/** Service hours when a silent collector is a fault, not night. */
const SERVICE_START_H = 5;
const COLLECTOR_STALE_MIN = 5;

function todayBangkokIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function bangkokDow(iso: string): number {
  // `en-CA` → ISO date. Bangkok is +07:00. Noon in Bangkok is the safe noon for any zone.
  const ms = Date.parse(`${iso}T12:00:00+07:00`);
  if (!Number.isFinite(ms)) return 0;
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: BKK_TZ, weekday: "short" }).format(new Date(ms));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

function fmtN(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString()}${suffix}`;
}

function fmtThb(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `฿${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function rangeStart(range: Range, todayIso: string): string {
  if (range === "today") return todayIso;
  if (range === "7d") return bangkokAddDays(todayIso, -6);
  if (range === "14d") return bangkokAddDays(todayIso, -13);
  return bangkokAddDays(todayIso, -29);
}

/** 1440×900 is the design reference; wall screens scale up, never down.
 *  Width-only scaling clipped the body on common 16:9 displays because the
 *  header/footer consumed more than their share of the zoomed height. */
function computeOpsScale(): number {
  if (typeof window === "undefined") return 1;
  const widthScale = window.innerWidth / 1440;
  const heightScale = window.innerHeight / 900;
  return Math.min(2.5, Math.max(1, Math.min(widthScale, heightScale)));
}

/** A laptop should get a focused briefing, not a cropped wall console. */
function shouldUseCompactOps(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1360 || window.innerHeight < 820;
}

function bangkokAddDays(iso: string, delta: number): string {
  const ms = Date.parse(`${iso}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms + delta * DAY_MS));
}

function bangkokTimeOf(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BKK_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export function Study() {
  const [range, setRange] = useState<Range>("7d");
  const [anchorIso, setAnchorIso] = useState<string>(() => todayBangkokIso());
  const [data, setData] = useState<WeekResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  // Live "right now" panel: pulls the same feed the Ops Wall reads, so an
  // operator sees buses moving THIS minute alongside the historical aggregates.
  const [liveFeed, setLiveFeed] = useState(() => getLiveFeedState());
  const [liveBuses, setLiveBuses] = useState(() => getLiveBusesRaw());
  const [now, setNow] = useState(() => Date.now());

  // Wall-display scaling: same logic as DashboardV2. Reference is 1440×900,
  // narrow laptops collapse to the compact OpsBriefing. The Study screen reads
  // best when the operator can stand back from it, so we scale up by default
  // rather than letting 13 px type drown on a 4K monitor.
  const [opsScale, setOpsScale] = useState(() => computeOpsScale());
  const [isCompact, setIsCompact] = useState(() => shouldUseCompactOps());
  useEffect(() => {
    const onResize = () => {
      setOpsScale(computeOpsScale());
      setIsCompact(shouldUseCompactOps());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const from = useMemo(() => rangeStart(range, anchorIso), [range, anchorIso]);
  const days = range === "today" ? 1 : range === "7d" ? 7 : range === "14d" ? 14 : 30;

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const url = `${appPath("/api/collect/week")}?from=${encodeURIComponent(from)}&days=${days}&detail=vehicles`;
      const res = await fetch(url, { cache: "no-store" });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        setError(`/api/collect/week returned ${res.status} ${ct || "non-JSON"}`);
        setIsLoading(false);
        return;
      }
      const body = await res.json() as WeekResponse & { detail?: string };
      if (!body.ok) {
        setError(body.detail ?? "study endpoint returned ok=false");
        setIsLoading(false);
        return;
      }
      setData(body);
      setFetchedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void load(); }, [from, days]);
  // Refresh once a minute so the "last seen X min ago" stays honest.
  useEffect(() => {
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [from, days]);

  // Ref-counted live feed: the same /api/live-buses the Ops Wall reads.
  // Stays subscribed while Study is open so the "right now" panel can show
  // current buses reporting / moving, not just the last sample.
  useEffect(() => {
    const stop = startLiveFeed();
    const refresh = () => {
      setLiveFeed(getLiveFeedState());
      setLiveBuses(getLiveBusesRaw());
    };
    const unsub = subscribeLiveFeed(refresh);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { stop(); unsub(); clearInterval(tick); };
  }, []);

  // Modelled boarded: the engine's per-DOW flight demand × regional capture ×
  // 25-cap queue simulation. Independent of the tracker — what we'd EXPECT
  // given today's flight schedule. Counter data sits next to it for contrast.
  const modelledByDate = useMemo(() => {
    const out: Record<string, { dow: number; flights: number; pax: number; modelledBoarded: number; modelledRevenue: number; modelledKm: number }> = {};
    if (!data) return out;
    // Both reads are keyed by dow — the global sim day (/ops picker) is untouched.
    for (const day of data.days) {
      const dow = bangkokDow(day.date);
      const schedule = getOpsFlightScheduleFor(dow);
      const arrivalsToday = schedule.filter((f) => f.type === "arr");
      const pax = arrivalsToday.reduce((s, f) => s + f.pax, 0);
      const model = getDayModelFor(dow);
      out[day.date] = {
        dow,
        flights: arrivalsToday.length,
        pax,
        modelledBoarded: model.combined.boarded,
        modelledRevenue: model.combined.revenueThb,
        modelledKm: model.combined.demand * 28, // ~airport↔island avg, see roi.ts
      };
    }
    return out;
  }, [data]);

  // Aggregate the range so we can answer "this week / this month" at a glance.
  const aggregate = useMemo(() => {
    if (!data) return null;
    const present = data.days.filter((d) => !d.missing && !d.future);
    const totalKm = present.reduce((s, d) => s + (d.totalKmTracked ?? 0), 0);
    const totalGpsKm = present.reduce((s, d) => s + (d.totalGpsTraceKm ?? 0), 0);
    const countedVehicles = present.reduce((s, d) => s + (d.countersReporting ?? 0), 0);
    const totalCountedPax = present.reduce((s, d) => s + (d.totalPaxServed ?? 0), 0);
    const totalCountedRev = present.reduce((s, d) => s + (d.totalRevenueThb ?? 0), 0);
    const totalVehiclesEver = present.reduce((s, d) => s + (d.totalTrackedVehicles ?? 0), 0);
    const modelledBoarders = Object.values(modelledByDate).reduce((s, v) => s + v.modelledBoarded, 0);
    const modelledRevenue = Object.values(modelledByDate).reduce((s, v) => s + v.modelledRevenue, 0);
    const modelledFlights = Object.values(modelledByDate).reduce((s, v) => s + v.flights, 0);
    const modelledPax = Object.values(modelledByDate).reduce((s, v) => s + v.pax, 0);
    // Observed supply: what the buses actually did, not seats × an assumed trip count.
    const busDaysMoved = present.reduce((s, d) => s + (d.busesMoved ?? 0), 0);
    const totalRuns = present.reduce((s, d) => s + (d.totalRuns ?? 0), 0);
    const totalHoursMoving = present.reduce((s, d) => s + (d.totalHoursMoving ?? 0), 0);
    const airportBusDays = present.reduce((s, d) => s + (d.busesReachedAirport ?? 0), 0);
    return {
      daysObserved: present.length,
      daysInRange: data.days.length,
      totalKm, totalGpsKm,
      countersMovedEver: countedVehicles,
      totalCountedPax, totalCountedRev,
      totalVehiclesEver,
      modelledFlights, modelledPax, modelledBoarders, modelledRevenue,
      busDaysMoved, totalRuns, totalHoursMoving, airportBusDays,
    };
  }, [data, modelledByDate]);

  // Per-bus aggregates across the range.
  const perBus = useMemo(() => {
    if (!data) return [];
    const byPlate: Record<string, {
      plate: string;
      daysSeen: number;
      km: number;
      gpsKm: number;
      fixes: number;
      countedPax: number;
      countedRevenue: number;
      lastSeenAt: string;
      lastState: string;
      lostWhileMoving: boolean;
      runs: number;
      hoursMoving: number;
      paxBasis: DayVehicle["paxBasis"] | null;
    }> = {};
    for (const day of data.days) {
      if (day.missing || day.future) continue;
      for (const v of day.vehicles) {
        const cur = byPlate[v.licensePlate] ?? {
          plate: v.licensePlate, daysSeen: 0, km: 0, gpsKm: 0, fixes: 0,
          countedPax: 0, countedRevenue: 0, lastSeenAt: "", lastState: "", lostWhileMoving: false,
          runs: 0, hoursMoving: 0, paxBasis: null,
        };
        cur.runs += v.runs ?? 0;
        cur.hoursMoving += v.hoursMoving ?? 0;
        cur.daysSeen += 1;
        cur.km += v.totalDistanceKm;
        cur.gpsKm += v.gpsTraceKm;
        cur.fixes += v.fixes ?? 0;
        if (v.paxBasis === "apc") cur.paxBasis = "apc";
        else if (v.paxBasis === "counter-silent" && cur.paxBasis !== "apc") cur.paxBasis = "counter-silent";
        else if (cur.paxBasis === null) cur.paxBasis = v.paxBasis;
        cur.countedPax += v.paxServed ?? 0;
        cur.countedRevenue += v.revenueThb ?? 0;
        if (!cur.lastSeenAt || (v.lastSeenAt && v.lastSeenAt > cur.lastSeenAt)) {
          cur.lastSeenAt = v.lastSeenAt;
          cur.lastState = v.lastState;
          cur.lostWhileMoving = v.lostWhileMoving ?? false;
        }
        byPlate[v.licensePlate] = cur;
      }
    }
    return Object.values(byPlate).sort((a, b) => b.km - a.km);
  }, [data]);

  const dowShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const collectionIsLive = fetchedAt > 0 && Date.now() - fetchedAt < 90_000;
  // Is the collector itself alive? Read from the archive, not from this page's own fetch.
  const todayRow = data?.days.find((d) => d.date === todayBangkokIso());
  const lastSampleMs = todayRow?.coverage?.lastSampleAt ? Date.parse(todayRow.coverage.lastSampleAt) : null;
  const collectorAgeMin = lastSampleMs === null ? null : Math.max(0, Math.round((Date.now() - lastSampleMs) / 60_000));
  const inService = Number(bangkokTimeOf(new Date().toISOString()).slice(0, 2)) >= SERVICE_START_H;
  const collectorStale = inService && (collectorAgeMin === null || collectorAgeMin > COLLECTOR_STALE_MIN);
  const stateLabel = (state: string, lastSeenAt: string, lost: boolean) =>
    state === "no_fix" ? `${lost ? "lost signal driving" : "no fix"} since ${bangkokTimeOf(lastSeenAt)}`
      : state === "parked_depot" ? "at depot" : state || "—";

  return (
    <div className={`v2 v2--operations study ${isCompact ? "study--compact" : ""}`} style={{ zoom: opsScale, minHeight: "100vh", overflow: "auto" }}>
      <header className="v2-header study__header">
        <div className="v2-header__brand">
          <span className="v2-header__eyebrow">
            <span className="v2-header__eyebrow-full">Real-Bus Study</span>
            <span className="v2-header__eyebrow-compact">Study</span>
          </span>
          <h1>Phuket Smart Bus · Study</h1>
          <span className="v2-header__sub">Patient · consistent · true — every number has a source</span>
        </div>

        <div className="study__controls">
          <div className="study__chips" role="group" aria-label="Range">
            {(["today", "7d", "14d", "30d"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`study__chip ${range === r ? "is-active" : ""}`}
                onClick={() => setRange(r)}
              >{r === "today" ? "Today" : r.toUpperCase()}</button>
            ))}
          </div>
          <input
            type="date"
            className="study__date"
            value={anchorIso}
            onChange={(e) => setAnchorIso(e.target.value)}
            aria-label="Anchor date (Bangkok)"
          />
          <button type="button" className="study__refresh" onClick={() => void load()} disabled={isLoading}>
            {isLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className="study__actions">
          <a className="v2-source__btn" href={appPath("/ops")}>← Back to ops</a>
          <a className="v2-source__btn" href={appPath("/fleet")}>Fleet</a>
          <a className="v2-source__btn" href={appPath("/research")}>Trips</a>
        </div>
      </header>

      {error && (
        <div className="study__error">
          <strong>Could not load study data.</strong>
          <span>{error}</span>
          <code>GET {appPath("/api/collect/week")}?from={from}&days={days}</code>
        </div>
      )}

      {data && aggregate && (
        <>
          <RightNowPanel feed={liveFeed} buses={liveBuses} now={now} />

          <section className="study__kpis">
            <div className={`study__kpi${collectorStale ? " study__kpi--alert" : ""}`}>
              <span className="study__kpi-label">Collector</span>
              <strong className="study__kpi-value">{collectorAgeMin === null ? "no sample today" : `${collectorAgeMin} min ago`}</strong>
              <span className="study__kpi-detail">{collectorStale ? "Not recording — check the phuket-smart-bus-collector cron" : "last archived fleet sample · cron every 30 s"}</span>
            </div>
            <div className="study__kpi">
              <span className="study__kpi-label">Days observed</span>
              <strong className="study__kpi-value">{aggregate.daysObserved} / {aggregate.daysInRange}</strong>
              <span className="study__kpi-detail">out of {data.days.length} days in the range</span>
            </div>
            <div className="study__kpi">
              <span className="study__kpi-label">Tracked km (odometer / GPS trace)</span>
              <strong className="study__kpi-value">{fmtN(Math.round(aggregate.totalKm), "")}</strong>
              <span className="study__kpi-detail">GPS trace {fmtN(Math.round(aggregate.totalGpsKm), "")} km — odometer is the bus's own count</span>
            </div>
            <div className="study__kpi">
              <span className="study__kpi-label">Counters moved (APC)</span>
              <strong className="study__kpi-value">{aggregate.countersMovedEver}</strong>
              <span className="study__kpi-detail">bus-days with a counter reading &gt;0</span>
            </div>
            <div className="study__kpi">
              <span className="study__kpi-label">Counted boarders</span>
              <strong className="study__kpi-value">{aggregate.countersMovedEver > 0 ? fmtN(aggregate.totalCountedPax) : "unknown"}</strong>
              <span className="study__kpi-detail">{aggregate.countersMovedEver > 0 ? `${fmtThb(aggregate.totalCountedRev)} revenue` : "unknown — no counter reported"}</span>
            </div>
            <div className="study__kpi study__kpi--model">
              <span className="study__kpi-label">Airport-line model · reference</span>
              <strong className="study__kpi-value">{fmtN(aggregate.modelledBoarders)}</strong>
              <span className="study__kpi-detail">{aggregate.airportBusDays === 0 ? "Not these buses — none reached the airport in range" : `${aggregate.airportBusDays} tracked bus-days reached the airport`} · {aggregate.modelledFlights} arrivals modelled</span>
            </div>
            <div className="study__kpi">
              <span className="study__kpi-label">Runs · hours moving</span>
              <strong className="study__kpi-value">{fmtN(aggregate.totalRuns)} · {fmtN(Math.round(aggregate.totalHoursMoving))} h</strong>
              <span className="study__kpi-detail">{aggregate.busDaysMoved} bus-days moved · a run = leaving a halt of 10+ min</span>
            </div>
          </section>

          <section className="study__caveats">
            <h3>What this screen is honest about</h3>
            <ul>
              <li>
                <strong>Counters are silent.</strong> Every CMSV6 passenger counter on every PKSB bus reads 0 even while the bus is moving — verified {data.days.find((d) => !d.missing && (d.countersReporting ?? 0) > 0) ? "" : "across all observed days"}.
                So <em>counted boarders</em> is currently null, not ฿0. The page never rounds up.
              </li>
              <li>
                <strong>Modelled numbers</strong> use the engine's flight schedule × regional capture rate (SE Asia 7%, Europe 3%, …) × 25-cap queue simulation.
                They're the demand-side <em>expectation</em>, not a measurement.
              </li>
              <li>
                <strong>These are town buses.</strong> {aggregate.airportBusDays === 0 ? "No tracked bus came within 1 km of HKT airport in this range" : `${aggregate.airportBusDays} tracked bus-days reached HKT airport`}. The airport-line model is shown for reference only — it is not a target for this fleet.
              </li>
              <li>
                <strong>Runs and hours moving</strong> come from the fixes: a run starts when a bus leaves a halt of 10+ minutes; hours moving count only fix-to-fix steps of 50 m+ taken ≤3 min apart. The feed carries no line or trip, so these are not timetable trips.
              </li>
              <li>
                <strong>Coverage</strong> shows which Bangkok minutes have a sample. A missing day means the cron or browser producer didn't write — that gap is shown, never papered over.
              </li>
            </ul>
          </section>

          <section className="study__coverage">
            <h3>Daily coverage</h3>
            <div className="study__coverage-strip">
              {data.days.map((d) => {
                const cov = d.coverage?.coveragePct;
                const filled = cov == null ? 0 : Math.round(cov);
                const label = d.missing ? "missing" : d.future ? "future" : cov == null ? "no data" : `${cov.toFixed(0)}%`;
                return (
                  <div key={d.date} className={`study__coverage-cell study__coverage-cell--${d.missing ? "missing" : d.future ? "future" : (cov ?? 0) >= 80 ? "good" : (cov ?? 0) >= 40 ? "partial" : "thin"}`} title={`${d.date}: ${label}`}>
                    <div className="study__coverage-bar" style={{ height: `${Math.max(2, filled)}%` }} />
                    <span className="study__coverage-date">{d.date.slice(5)}</span>
                    <span className="study__coverage-pct">{label}</span>
                  </div>
                );
              })}
            </div>
            <p className="study__hint">
              Bar height = % of the 05:00–24:00 BKK service window that received at least one sample.
              <span className="study__chip study__chip--legend study__chip--good">good ≥80%</span>
              <span className="study__chip study__chip--legend study__chip--partial">partial 40–80%</span>
              <span className="study__chip study__chip--legend study__chip--thin">thin &lt;40%</span>
              <span className="study__chip study__chip--legend study__chip--missing">missing</span>
              <span className="study__chip study__chip--legend study__chip--future">future</span>
            </p>
          </section>

          <section className="study__table-wrap">
            <h3>Per-day breakdown</h3>
            <table className="study__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>DOW</th>
                  <th className="study__num">Flights (arr)</th>
                  <th className="study__num">Pax arrived</th>
                  <th className="study__num">Modelled boarders</th>
                  <th className="study__num">Counted boarders</th>
                  <th className="study__num">Counted ฿</th>
                  <th className="study__num">Tracked km</th>
                  <th className="study__num">GPS trace km</th>
                  <th className="study__num">Vehicles</th>
                  <th className="study__num">Moved</th>
                  <th className="study__num">Runs</th>
                  <th className="study__num">Hours moving</th>
                  <th className="study__num">No fix</th>
                  <th className="study__num">Counters moved</th>
                  <th className="study__num">Coverage</th>
                  <th>Last sample (BKK)</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => {
                  const m = modelledByDate[d.date];
                  return (
                    <tr key={d.date} className={`study__row study__row--${d.missing ? "missing" : d.future ? "future" : "ok"}`}>
                      <td><strong>{d.date}</strong></td>
                      <td>{m ? dowShort[m.dow] : dowShort[bangkokDow(d.date)]}</td>
                      <td className="study__num">{m ? fmtN(m.flights) : "—"}</td>
                      <td className="study__num">{m ? fmtN(m.pax) : "—"}</td>
                      <td className="study__num">{m ? fmtN(m.modelledBoarded) : "—"}</td>
                      <td className="study__num">{d.missing || d.future ? "—" : d.totalPaxServed == null ? <span className="study__null">null · counter silent</span> : fmtN(d.totalPaxServed)}</td>
                      <td className="study__num">{fmtThb(d.totalRevenueThb)}</td>
                      <td className="study__num">{fmtN(d.totalKmTracked)}</td>
                      <td className="study__num">{fmtN(d.totalGpsTraceKm)}</td>
                      <td className="study__num">{fmtN(d.totalTrackedVehicles)}</td>
                      <td className="study__num">{fmtN(d.busesMoved)}</td>
                      <td className="study__num">{fmtN(d.totalRuns)}</td>
                      <td className="study__num">{fmtN(d.totalHoursMoving)}</td>
                      <td className="study__num">{fmtN(d.busesNoFix)}</td>
                      <td className="study__num">{fmtN(d.countersReporting)}</td>
                      <td className="study__num">{fmtPct(d.coverage?.coveragePct ?? null)}</td>
                      <td>{bangkokTimeOf(d.coverage?.lastSampleAt ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="study__table-wrap">
            <h3>Per-bus — {aggregate.daysObserved}-day aggregate</h3>
            <p className="study__hint">
              Sorted by tracked km. Each row is one bus summed across every day it appeared in the range.
              <span className="study__chip study__chip--legend study__chip--pax">apc</span> counted from passenger counter · <span className="study__chip study__chip--legend study__chip--silent">silent</span> counter present but never read above 0 · <span className="study__chip study__chip--legend study__chip--none">none</span> no counter on the device
            </p>
            <table className="study__table">
              <thead>
                <tr>
                  <th>Plate</th>
                  <th className="study__num">Days seen</th>
                  <th className="study__num">Tracked km</th>
                  <th className="study__num">GPS trace km</th>
                  <th className="study__num">Fixes</th>
                  <th className="study__num">Runs</th>
                  <th className="study__num">Hours moving</th>
                  <th>Counter</th>
                  <th className="study__num">Counted boarders</th>
                  <th className="study__num">Counted ฿</th>
                  <th>Last state</th>
                  <th>Last seen (BKK)</th>
                </tr>
              </thead>
              <tbody>
                {perBus.length === 0 ? (
                  <tr><td colSpan={12} className="study__empty">No buses observed in this range yet.</td></tr>
                ) : perBus.map((b) => (
                  <tr key={b.plate}>
                    <td><strong>{b.plate}</strong></td>
                    <td className="study__num">{b.daysSeen}</td>
                    <td className="study__num">{fmtN(Math.round(b.km))}</td>
                    <td className="study__num">{fmtN(Math.round(b.gpsKm))}</td>
                    <td className="study__num">{fmtN(b.fixes)}</td>
                    <td className="study__num">{fmtN(b.runs)}</td>
                    <td className="study__num">{fmtN(Math.round(b.hoursMoving * 10) / 10)}</td>
                    <td>
                      {b.paxBasis === "apc" ? <span className="study__chip study__chip--pax">apc</span>
                        : b.paxBasis === "counter-silent" ? <span className="study__chip study__chip--silent">silent</span>
                        : b.paxBasis === "no-counter" ? <span className="study__chip study__chip--none">none</span>
                        : <span className="study__chip study__chip--none">—</span>}
                    </td>
                    <td className="study__num">{b.countedPax > 0 ? fmtN(b.countedPax) : <span className="study__null">null</span>}</td>
                    <td className="study__num">{b.countedRevenue > 0 ? fmtThb(b.countedRevenue) : <span className="study__null">—</span>}</td>
                    <td className={b.lastState === "no_fix" ? "study__state--alert" : undefined}>{stateLabel(b.lastState, b.lastSeenAt, b.lostWhileMoving)}</td>
                    <td>{bangkokTimeOf(b.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="study__footer">
            <span>
              Range <strong>{data.from}</strong> → <strong>{data.through}</strong> ({aggregate.daysInRange} days BKK)
              {collectionIsLive ? " · live" : ` · last refresh ${bangkokTimeOf(new Date(fetchedAt).toISOString())}`}
            </span>
            <span className="study__footer-detail">
              One click upstream: {appPath("/api/collect/week")}?from={data.from}&days={data.days.length}&detail=vehicles
            </span>
          </footer>
        </>
      )}
    </div>
  );
}

/** "Right now" banner — the operator's first read. Pulls the live feed
 *  (same source the Ops Wall reads) and answers:
 *    - Are buses reporting THIS minute?
 *    - How many are moving?
 *    - When did the relay last hear from upstream?
 *  Big numbers + BKK-timestamped labels so it reads from across the room. */
function RightNowPanel({ feed, buses, now }: { feed: ReturnType<typeof getLiveFeedState>; buses: ReturnType<typeof getLiveBusesRaw>; now: number }) {
  const FRESH_MS = 3 * 60_000;
  const reporting = buses.filter((b) => now - Date.parse(b.updatedAt) <= FRESH_MS);
  const moving = reporting.filter((b) => b.speedKph > 4);
  const dwelling = reporting.filter((b) => b.speedKph <= 4 && b.speedKph >= 0);
  const stale = buses.length - reporting.length;
  const ageSec = feed.lastOkMs === null ? null : Math.max(0, Math.round((now - feed.lastOkMs) / 1000));
  const isFresh = ageSec !== null && ageSec <= 60;

  return (
    <section className="study__now">
      <div className="study__now-head">
        <span className="study__now-eyebrow">Right now</span>
        <span className={`study__now-pill study__now-pill--${feed.status}`}>{feed.status.toUpperCase()}</span>
        <span className="study__now-detail">
          Server fetched <strong>{feed.fetchedAtMs ? bangkokTimeOf(new Date(feed.fetchedAtMs).toISOString()) : "—"}</strong>
          {" · "}last sample {ageSec === null ? "—" : `${ageSec}s ago`}
          {" · "}sources
          <span className={`study__chip study__chip--${feed.sources?.keyless ? "pax" : "none"}`}>{feed.sources?.keyless ? "✓" : "×"} keyless</span>
          <span className={`study__chip study__chip--${feed.sources?.token ? "pax" : "none"}`}>{feed.sources?.token ? "✓" : "×"} token</span>
        </span>
      </div>

      <div className="study__now-grid">
        <div className="study__now-tile">
          <span className="study__now-label">Buses reporting</span>
          <strong className="study__now-value">{reporting.length}</strong>
          <span className="study__now-sub">fresh fix in the last 3 min</span>
        </div>
        <div className={`study__now-tile study__now-tile--${moving.length > 0 ? "live" : "quiet"}`}>
          <span className="study__now-label">Moving now</span>
          <strong className="study__now-value">{moving.length}</strong>
          <span className="study__now-sub">{moving.length > 0 ? "speed &gt; 4 km/h right now" : "every reporting bus is dwelling"}</span>
        </div>
        <div className="study__now-tile">
          <span className="study__now-label">Dwelling</span>
          <strong className="study__now-value">{dwelling.length}</strong>
          <span className="study__now-sub">parked or stopped, still reporting</span>
        </div>
        <div className={`study__now-tile ${stale > 0 ? "study__now-tile--alert" : ""}`}>
          <span className="study__now-label">Stale / no fix</span>
          <strong className="study__now-value">{stale}</strong>
          <span className="study__now-sub">reported once but not in the last 3 min</span>
        </div>
        <div className="study__now-tile">
          <span className="study__now-label">Feed age</span>
          <strong className="study__now-value">{ageSec === null ? "—" : `${ageSec}s`}</strong>
          <span className="study__now-sub">{isFresh ? "within the 60 s health window" : "edge relay slower than usual"}</span>
        </div>
        <div className="study__now-tile">
          <span className="study__now-label">Sample rate</span>
          <strong className="study__now-value">{feed.okCount}/{feed.pollCount}</strong>
          <span className="study__now-sub">ok / total polls · {feed.pollCount === 0 ? "warming up" : `${Math.round((feed.okCount / feed.pollCount) * 100)}%`}</span>
        </div>
      </div>
    </section>
  );
}
