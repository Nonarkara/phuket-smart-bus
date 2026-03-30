import { useEffect, useMemo, useRef, useState } from "react";
import type {
  HourlyCapacityGap,
  InvestorSimulationPayload,
  OpsDashboardPayload,
  OpsMapOverlayMarker,
  OverlayLayerId,
  Route,
  RoutePressure,
  SimulationSnapshot,
  TransferHub,
  VehiclePosition
} from "@shared/types";
import { getInvestorSimulation, getOpsDashboard, getSimulationFrame } from "../api";
import { LiveMap, type MapMarkerOverlay, type MapOverlay } from "./LiveMap";

/* ══════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════ */
const OPS_POLL_MS = 15_000;
const SIM_TICK_MS = 500;
const SIM_ANIMATION_MS = 480;
const BUS_CAPACITY = 25;
const CO2_PER_BUS_KM = 0.12; // kg CO2 saved vs equivalent taxi trips

/* ── Helpers ── */
function densifyPath(sparse: [number, number][], n = 20): [number, number][] {
  if (sparse.length >= n) return sparse;
  const r: [number, number][] = [sparse[0]];
  const segs = sparse.length - 1;
  const ppSeg = Math.ceil((n - 1) / segs);
  for (let s = 0; s < segs; s++) {
    const [aLat, aLng] = sparse[s];
    const [bLat, bLng] = sparse[s + 1];
    for (let i = 1; i <= ppSeg; i++) {
      const t = i / ppSeg;
      r.push([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t]);
    }
  }
  return r;
}

function stableHash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function simPassengers(vid: string, m: number): number {
  return stableHash(vid + String(Math.floor(m / 10))) % (BUS_CAPACITY + 1);
}

const DRIVER_NAMES = [
  "Somchai K.", "Prasert W.", "Anong S.", "Kittisak P.", "Wichai T.",
  "Narong B.", "Supachai M.", "Darunee L.", "Prateep J.", "Sompong R.",
  "Chaiwat N.", "Manee D.", "Surasak V.", "Nattapong A.", "Pornthip C.",
  "Thawatchai H.", "Kamol S.", "Suchart P.", "Wanida K.", "Apichart L."
];
function driverName(vid: string) { return DRIVER_NAMES[stableHash(vid) % DRIVER_NAMES.length]; }
function driverRating(vid: string) { return Math.round((38 + stableHash(vid + "r") % 13) * 10) / 100; }
function simSpeed(progress: number, routeId: string): number {
  const isFerry = FERRY_ROUTE_IDS.has(routeId as any);
  if (isFerry) return 18 + Math.sin(progress * Math.PI) * 8;
  return Math.round((28 + Math.sin(progress * Math.PI) * 12) * 10) / 10;
}

const ROUTE_MARKER_COORDINATES = {
  "rawai-airport": [8.1132, 98.3169], "patong-old-bus-station": [7.8961, 98.2969],
  "dragon-line": [7.8842, 98.3923], "rassada-phi-phi": [7.8574, 98.3866],
  "rassada-ao-nang": [7.8574, 98.3866], "bang-rong-koh-yao": [8.0317, 98.4192],
  "chalong-racha": [7.8216, 98.3613]
} as const;

const FERRY_ROUTE_IDS = new Set(["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"]);

const LAYER_DEFS: { id: OverlayLayerId; label: string; icon: string }[] = [
  { id: "traffic", label: "Traffic", icon: "⚠" },
  { id: "hotspots", label: "Demand", icon: "◎" },
  { id: "transfer_hubs", label: "Hubs", icon: "⇄" },
  { id: "route_pressure", label: "Pressure", icon: "▲" }
];

function colorForPressure(level: RoutePressure["level"]) {
  return level === "strained" ? "#dc322f" : level === "watch" ? "#b58900" : "#16b8b0";
}
function colorForHubStatus(status: TransferHub["status"]) {
  return status === "ready" ? "#16b8b0" : status === "watch" ? "#b58900" : "#999";
}

function fleetSummary(vehicles: VehiclePosition[]) {
  const busCount = vehicles.filter((v) => !FERRY_ROUTE_IDS.has(v.routeId)).length;
  const ferryCount = vehicles.filter((v) => FERRY_ROUTE_IDS.has(v.routeId)).length;
  const movingCount = vehicles.filter((v) => v.status === "moving").length;
  return { totalVehicles: vehicles.length, busCount, ferryCount, movingCount, dwellingCount: vehicles.length - movingCount };
}

/* ══════════════════════════════════════════════════
   NEWS FEED — Left sidebar
   ══════════════════════════════════════════════════ */
type NewsItem = { id: string; time: string; icon: string; title: string; desc: string; severity: "info" | "caution" | "warning"; lat?: number; lng?: number };

function generateNews(simMinutes: number | null): NewsItem[] {
  const hour = simMinutes !== null ? Math.floor(simMinutes / 60) : new Date().getHours();
  const base: NewsItem[] = [
    { id: "n1", time: "06:15", icon: "✈", title: "HKT Morning Rush", desc: "12 flights arriving 06:00–08:00. Expect high demand at airport bus stop.", severity: "info" },
    { id: "n2", time: "07:30", icon: "⚠", title: "Patong Hill Slowdown", desc: "Construction on Route 4029 near Patong Hill. Expect 10-min delay.", severity: "caution", lat: 7.9050, lng: 98.2970 },
    { id: "n3", time: "08:00", icon: "🌧", title: "Rain Alert — South Coast", desc: "70% rain probability Rawai-Chalong area 14:00–17:00.", severity: "caution", lat: 7.7804, lng: 98.3225 },
    { id: "n4", time: "09:00", icon: "🚢", title: "Phi Phi Ferry On Schedule", desc: "All Rassada–Phi Phi departures confirmed. Seas calm.", severity: "info" },
    { id: "n5", time: "10:30", icon: "📊", title: "Tourism Up 12% in March", desc: "TAT reports 1.2M visitors to Phuket this month, driven by Chinese and Russian arrivals.", severity: "info" },
    { id: "n6", time: "11:00", icon: "🚧", title: "Accident — Thepkasattri Rd", desc: "Minor collision near Thalang intersection. One lane blocked northbound.", severity: "warning", lat: 8.0200, lng: 98.3350 },
    { id: "n7", time: "12:00", icon: "🎪", title: "Old Town Walking Street", desc: "Sunday market closes Thalang Road 16:00–22:00. Dragon Line rerouted.", severity: "caution", lat: 7.8842, lng: 98.3923 },
    { id: "n8", time: "13:00", icon: "✈", title: "Afternoon Wave", desc: "8 international arrivals 13:00–15:00 including 2 wide-body from Dubai and Singapore.", severity: "info" },
    { id: "n9", time: "14:30", icon: "⛽", title: "Diesel Price Stable", desc: "B7 diesel at ฿29.94/liter. Fleet fuel cost within budget.", severity: "info" },
    { id: "n10", time: "16:00", icon: "🌊", title: "High Tide Advisory", desc: "Chalong Pier high tide 16:45. Ferry boarding may shift to alternate dock.", severity: "caution", lat: 7.8216, lng: 98.3613 },
    { id: "n11", time: "17:30", icon: "🚌", title: "Peak Demand — Airport", desc: "Departure queue at airport bus stop exceeds 30 pax. Consider dispatch.", severity: "warning", lat: 8.1090, lng: 98.3070 },
    { id: "n12", time: "19:00", icon: "🌅", title: "Promthep Sunset Rush", desc: "Tourist shuttles congesting Route 4233 near Rawai roundabout.", severity: "caution", lat: 7.7700, lng: 98.3100 },
    { id: "n13", time: "21:00", icon: "🔧", title: "Bus PKT-1003 Maintenance", desc: "Scheduled brake inspection completed. Returning to service 22:00.", severity: "info" },
  ];
  // Show items up to current hour
  return base.filter((n) => {
    const [h] = n.time.split(":").map(Number);
    return h <= hour;
  }).reverse(); // newest first
}

function NewsFeed({ simMinutes }: { simMinutes: number | null }) {
  const news = useMemo(() => generateNews(simMinutes), [simMinutes]);
  return (
    <div className="ops__news">
      <h3 className="ops__news-title">News & Incidents</h3>
      {news.map((n) => (
        <div key={n.id} className={`news-item news-item--${n.severity}`}>
          <span className="news-item__icon">{n.icon}</span>
          <div className="news-item__body">
            <div className="news-item__header">
              <strong>{n.title}</strong>
              <span className="news-item__time">{n.time}</span>
            </div>
            <p className="news-item__desc">{n.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SIMULATION TIMELINE — Bottom bar
   ══════════════════════════════════════════════════ */
function SimTimeline({ simMinutes, investor, vehicles, simRunning, onToggle, simLoading }: {
  simMinutes: number | null; investor: InvestorSimulationPayload | null;
  vehicles: VehiclePosition[]; simRunning: boolean; onToggle: () => void; simLoading: boolean;
}) {
  const hours = Array.from({ length: 19 }, (_, i) => i + 6); // 06–24
  const progress = simMinutes !== null ? Math.max(0, Math.min(1, (simMinutes - 360) / (1440 - 360))) : 0;

  // Cumulative metrics up to current sim hour
  const hourIdx = simMinutes !== null ? Math.floor(simMinutes / 60) - 6 : -1;
  const accHourly = investor?.hourly.slice(0, Math.max(0, hourIdx + 1)) ?? [];
  const totalPax = accHourly.reduce((s, h) => s + h.carriedArrivalDemand + h.carriedDepartureDemand, 0);
  const totalRevenue = totalPax * 100;
  const totalLost = accHourly.reduce((s, h) => s + h.lostRevenueThb, 0);
  // Estimate rounds: each bus trip is one departure, 2 directions per round
  const totalRounds = accHourly.reduce((s, h) => s + (h.requiredArrivalDepartures ?? 0) + (h.requiredDepartureDepartures ?? 0), 0);
  const busKm = totalRounds * 35; // ~35km per trip (airport to south)
  const carbonSaved = Math.round(busKm * CO2_PER_BUS_KM);
  const activeCount = vehicles.filter((v) => v.status === "moving").length;

  const metrics = [
    { label: "Buses Active", value: String(activeCount), unit: "" },
    { label: "Rounds", value: totalRounds.toLocaleString(), unit: "" },
    { label: "Km Served", value: busKm.toLocaleString(), unit: "km" },
    { label: "Passengers", value: totalPax.toLocaleString(), unit: "" },
    { label: "Revenue", value: `฿${totalRevenue.toLocaleString()}`, unit: "" },
    { label: "CO₂ Saved", value: carbonSaved.toLocaleString(), unit: "kg" },
  ];

  return (
    <div className="sim-timeline">
      <div className="sim-timeline__header">
        <button className="sim-timeline__btn" type="button" onClick={onToggle} disabled={simLoading}>
          {simRunning ? "■ Stop" : simLoading ? "…" : "▶ Simulate"}
        </button>
        <div className="sim-timeline__track">
          {hours.map((h) => (
            <div key={h} className={`sim-timeline__hour ${simMinutes !== null && Math.floor(simMinutes / 60) === h ? "is-current" : ""}`}>
              {String(h).padStart(2, "0")}
            </div>
          ))}
          {simRunning ? <div className="sim-timeline__playhead" style={{ left: `${progress * 100}%` }} /> : null}
        </div>
        {simRunning && simMinutes !== null ? (
          <span className="sim-timeline__clock">{String(Math.floor(simMinutes / 60)).padStart(2, "0")}:{String(simMinutes % 60).padStart(2, "0")}</span>
        ) : null}
      </div>
      <div className="sim-timeline__metrics">
        {metrics.map((m) => (
          <div key={m.label} className="sim-metric">
            <span className="sim-metric__value">{m.value}{m.unit ? <small> {m.unit}</small> : null}</span>
            <span className="sim-metric__label">{m.label}</span>
          </div>
        ))}
        {totalLost > 0 ? (
          <div className="sim-metric sim-metric--lost">
            <span className="sim-metric__value">฿{totalLost.toLocaleString()}</span>
            <span className="sim-metric__label">Lost Revenue</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   REPLAY MARKER BUILDER
   ══════════════════════════════════════════════════ */
function buildReplayMarkers(base: OpsMapOverlayMarker[], rp: RoutePressure[], hubs: TransferHub[]) {
  const statics = base.filter((m) => m.layerId !== "route_pressure" && m.layerId !== "transfer_hubs");
  const pMarkers: OpsMapOverlayMarker[] = rp.map((p) => {
    const c = ROUTE_MARKER_COORDINATES[p.routeId];
    return { id: `p-${p.routeId}`, layerId: "route_pressure", lat: c[0], lng: c[1], color: colorForPressure(p.level), radius: p.level === "strained" ? 16 : 11, label: `${p.routeId}: ${p.demand}/${p.seatSupply}`, fillOpacity: 0.24 };
  });
  const hMarkers: OpsMapOverlayMarker[] = hubs.map((h) => ({
    id: `h-${h.id}`, layerId: "transfer_hubs", lat: h.coordinates[0], lng: h.coordinates[1], color: colorForHubStatus(h.status), radius: h.status === "ready" ? 16 : 12, label: `${h.name.en}`, fillOpacity: 0.25
  }));
  return [...statics, ...pMarkers, ...hMarkers];
}

/* Build incident markers from news items */
function buildIncidentMarkers(simMinutes: number | null): MapMarkerOverlay[] {
  return generateNews(simMinutes)
    .filter((n) => n.lat && n.lng)
    .map((n) => ({
      id: `incident-${n.id}`, lat: n.lat!, lng: n.lng!,
      color: n.severity === "warning" ? "#dc322f" : n.severity === "caution" ? "#b58900" : "#16b8b0",
      radius: n.severity === "warning" ? 14 : 10, label: n.title, fillOpacity: 0.3
    }));
}

/* ══════════════════════════════════════════════════
   FALLBACK DATA BUILDERS (unchanged logic, trimmed)
   ══════════════════════════════════════════════════ */
function buildFallbackDashboard(): OpsDashboardPayload {
  const now = new Date();
  const bh = Number(now.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }));
  const busAct = bh < 6 ? 0 : bh < 7 ? 0.3 : bh < 9 ? 0.7 : bh < 18 ? 1.0 : bh < 21 ? 0.6 : bh < 23 ? 0.2 : 0;
  const ferryAct = bh < 8 ? 0 : bh < 9 ? 0.4 : bh < 17 ? 1.0 : bh < 19 ? 0.5 : 0;
  const lt = (s: string) => ({ en: s, th: s, zh: s, de: s, fr: s, es: s });
  const RD = [
    { id: "rawai-airport", sn: "Airport Line", c: "#16b8b0", t: "core", f: false, wp: [[7.7804,98.3225],[7.8420,98.3080],[7.9050,98.3050],[8.0700,98.3100],[8.1090,98.3070]] },
    { id: "patong-old-bus-station", sn: "Patong Line", c: "#e5574f", t: "core", f: false, wp: [[7.8830,98.2930],[7.8900,98.3200],[7.8840,98.3800],[7.8840,98.3960]] },
    { id: "dragon-line", sn: "Dragon Line", c: "#f0b429", t: "auxiliary", f: false, wp: [[7.8840,98.3960],[7.8870,98.3920],[7.8900,98.3850],[7.8840,98.3960]] },
    { id: "rassada-phi-phi", sn: "Phi Phi Ferry", c: "#58a6ff", t: "ferry", f: true, wp: [[7.8574,98.3866],[7.8200,98.4500],[7.7500,98.7700]] },
    { id: "rassada-ao-nang", sn: "Ao Nang Ferry", c: "#a371f7", t: "ferry", f: true, wp: [[7.8574,98.3866],[7.9500,98.6000],[8.0300,98.8200]] },
    { id: "bang-rong-koh-yao", sn: "Koh Yao Ferry", c: "#3fb950", t: "ferry", f: true, wp: [[8.0317,98.4192],[8.0800,98.5000],[8.1100,98.5800]] },
    { id: "chalong-racha", sn: "Racha Ferry", c: "#d29922", t: "ferry", f: true, wp: [[7.8216,98.3613],[7.7500,98.3600],[7.6000,98.3650]] },
  ] as const;
  const vehicles: VehiclePosition[] = [];
  for (const rd of RD) {
    const act = rd.f ? ferryAct : busAct;
    if (act <= 0) continue;
    const cnt = rd.f ? Math.round(act * 2) : Math.round(act * (rd.id === "rawai-airport" ? 6 : 3));
    for (let i = 0; i < cnt; i++) {
      const p = (i + 0.5) / cnt;
      const wp = rd.wp as unknown as [number,number][];
      const pp = p * (wp.length - 1);
      const idx = Math.min(Math.floor(pp), wp.length - 2);
      const seg = pp - idx;
      vehicles.push({
        id: `fb-${rd.id}-${i}`, routeId: rd.id as any, licensePlate: `PKT-${1000+vehicles.length}`,
        vehicleId: `v-${rd.id}-${i}`, deviceId: null,
        coordinates: [wp[idx][0]+(wp[idx+1][0]-wp[idx][0])*seg, wp[idx][1]+(wp[idx+1][1]-wp[idx][1])*seg],
        heading: i%2===0?0:180, speedKph: act>0?25+Math.random()*15:0,
        destination: lt(rd.sn), updatedAt: now.toISOString(), telemetrySource: "schedule_mock",
        freshness: "fresh", status: Math.random()>0.3?"moving":"dwelling", distanceToDestinationMeters: null, stopsAway: null,
      });
    }
  }
  const bc = vehicles.filter(v=>!FERRY_ROUTE_IDS.has(v.routeId)).length;
  const fc = vehicles.filter(v=>FERRY_ROUTE_IDS.has(v.routeId)).length;
  const mc = vehicles.filter(v=>v.status==="moving").length;
  const pm = (bh>=10&&bh<=14)?1.0:(bh>=18&&bh<=20)?0.8:(bh>=7&&bh<=22)?0.5:0.1;
  const rA = Math.round(1200*pm), rD = Math.round(900*pm);
  const aA = Math.round(rA*0.15), aD = Math.round(rD*0.15);
  const ss = bc*25, cA = Math.min(aA,ss), cD = Math.min(aD,ss);
  const isMon = now.getMonth()>=4&&now.getMonth()<=9;
  const forecast = Array.from({length:12},(_,i)=>{const h=(bh+i)%24;return{hour:`${String(h).padStart(2,"0")}:00`,tempC:30+Math.round(Math.random()*4),rainProb:isMon?30+Math.round(Math.random()*40):10+Math.round(Math.random()*20),precipMm:isMon?Math.random()*3:Math.random()*0.5,windKph:8+Math.round(Math.random()*10),code:1000}});
  const rp: RoutePressure[] = RD.map(rd=>{const d=rd.id==="rawai-airport"?Math.round(aA*0.6):rd.f?12:8;const s=vehicles.filter(v=>v.routeId===rd.id).length*25;const r=s>0?Math.min(1,s/d):0;return{routeId:rd.id as any,level:r>=1?"balanced" as const:r>=0.7?"watch" as const:"strained" as const,demand:d,seatSupply:s,gap:Math.max(0,d-s),coverageRatio:r,delayRiskMinutes:0,provenance:"fallback" as const}});
  const hs = [{id:"patong",zone:"Patong",lat:7.8961,lng:98.2969,base:12},{id:"airport",zone:"Airport",lat:8.1132,lng:98.3169,base:10},{id:"kata",zone:"Kata",lat:7.8165,lng:98.2972,base:6},{id:"town",zone:"Old Town",lat:7.8840,lng:98.3960,base:8}].map(h=>{const d=Math.round(h.base*pm);return{id:h.id,zone:h.zone,lat:h.lat,lng:h.lng,demand:d,liveRequests:0,modeledDemand:d,coverageRatio:d>8?0.45:0.7,gap:Math.max(0,Math.round(d*0.4)),provenance:"fallback" as const}});
  const th: TransferHub[] = [{id:"rassada",name:lt("Rassada Hub"),coordinates:[7.8557,98.4013],feederRouteIds:["dragon-line","patong-old-bus-station"] as any,ferryRouteIds:["rassada-phi-phi","rassada-ao-nang"] as any,walkMinutes:12,transferBufferMinutes:20},{id:"chalong",name:lt("Chalong Hub"),coordinates:[7.8216,98.3613],feederRouteIds:["rawai-airport"] as any,ferryRouteIds:["chalong-racha"] as any,walkMinutes:15,transferBufferMinutes:20},{id:"bang-rong",name:lt("Bang Rong Hub"),coordinates:[8.0317,98.4192],feederRouteIds:["rawai-airport"] as any,ferryRouteIds:["bang-rong-koh-yao"] as any,walkMinutes:18,transferBufferMinutes:25}].map(h=>({...h,provenance:"fallback" as const,status:"inactive" as const,rationale:lt("Fallback"),activeWindowLabel:null,nextWindowStartLabel:null,activeConnections:[]}));
  const mk: OpsMapOverlayMarker[] = [...hs.map(h=>({id:`hs-${h.id}`,layerId:"hotspots" as OverlayLayerId,lat:h.lat,lng:h.lng,color:h.gap>=4?"#dc322f":"#b58900",radius:h.demand>8?14:10,label:`${h.zone}: ${h.demand}`,fillOpacity:0.2})),...th.map(h=>({id:`hub-${h.id}`,layerId:"transfer_hubs" as OverlayLayerId,lat:h.coordinates[0],lng:h.coordinates[1],color:"#999",radius:12,label:h.name.en,fillOpacity:0.2}))];
  const routes: Route[] = RD.map(rd=>({id:rd.id as any,name:lt(rd.sn),shortName:lt(rd.sn),overview:lt(rd.sn),axis:rd.f?"marine" as const:"north_south" as const,axisLabel:lt(rd.f?"Marine":"Land"),tier:rd.t as any,color:rd.c,accentColor:rd.c,bounds:[rd.wp[0],rd.wp[rd.wp.length-1]] as any,pathSegments:[rd.wp] as any,stopCount:rd.wp.length,defaultStopId:`${rd.id}-1`,activeVehicles:vehicles.filter(v=>v.routeId===rd.id).length,status:lt("Fallback"),sourceStatus:{source:"bus" as const,state:"fallback" as const,updatedAt:now.toISOString(),detail:lt("Fallback")}}));
  return {checkedAt:now.toISOString(),fleet:{vehicles,totalVehicles:vehicles.length,busCount:bc,ferryCount:fc,movingCount:mc,dwellingCount:vehicles.length-mc,routePressure:rp},routes,demandSupply:{rawAirportArrivalPaxNext2h:rA,rawAirportDeparturePaxNext2h:rD,addressableArrivalDemandNext2h:aA,addressableDepartureDemandNext2h:aD,arrivalSeatSupplyNext2h:ss,departureSeatSupplyNext2h:ss,carriedArrivalDemandNext2h:cA,carriedDepartureDemandNext2h:cD,unmetArrivalDemandNext2h:Math.max(0,aA-ss),unmetDepartureDemandNext2h:Math.max(0,aD-ss),arrivalCaptureOfAddressablePct:aA>0?Math.round(cA/aA*100):0,departureCaptureOfAddressablePct:aD>0?Math.round(cD/aD*100):0,additionalBusesNeededPeak:Math.max(0,Math.ceil((aA-ss)/25)),provenance:"fallback" as const},weather:{severity:"info" as const,intelligence:{current:{tempC:32,rainProb:isMon?45:15,precipMm:0,windKph:12,aqi:42,pm25:11},forecast,monsoonSeason:isMon,monsoonNote:isMon?"Monsoon — afternoon showers":"Dry season",driverAlerts:[]},provenance:"fallback" as const},traffic:{severity:"info" as const,advisories:[{id:"fb-1",routeId:"all" as any,source:"operations" as const,severity:"info" as const,title:lt("Normal Traffic"),message:lt("No incidents"),recommendation:lt("Standard"),updatedAt:now.toISOString(),active:true,tags:[]}],provenance:"fallback" as const,sourceStatuses:[]},hotspots:{hotspots:hs,totalRequests:0},transferHubs:th,history:{recentEvents:[],vehicleHistoryCount:0},mapOverlays:{tileLayers:[],markers:mk},sources:[{source:"bus" as const,state:"fallback" as const,updatedAt:now.toISOString(),detail:lt("Fallback")},{source:"traffic" as const,state:"fallback" as const,updatedAt:now.toISOString(),detail:lt("Fallback")},{source:"weather" as const,state:"fallback" as const,updatedAt:now.toISOString(),detail:lt("Fallback")}]};
}

function buildFallbackInvestorPayload(): InvestorSimulationPayload {
  const lt = (s: string) => ({ en: s, th: s, zh: s, de: s, fr: s, es: s });
  const HA = [0,0,0,0,0,0,180,320,450,380,520,600,680,750,700,580,500,420,380,300,250,150,80,0];
  const HD = [0,0,0,0,0,50,120,250,350,300,400,480,520,580,550,450,380,320,280,200,150,100,50,0];
  const S=0.15,F=100,SE=25;
  const bdph=(h:number)=>h<6?0:h<7?2:h<9?3:h<18?4:h<21?3:h<23?1:0;
  const hourly: HourlyCapacityGap[] = Array.from({length:18},(_,i)=>{const h=i+6;const hr=`${String(h).padStart(2,"0")}:00`;const rA=HA[h],rD=HD[h],aA=Math.round(rA*S),aD=Math.round(rD*S),d=bdph(h),su=d*SE,cA=Math.min(aA,su),cD=Math.min(aD,su),uA=Math.max(0,aA-su),uD=Math.max(0,aD-su);return{hour:hr,rawArrivalPax:rA,rawDeparturePax:rD,addressableArrivalDemand:aA,addressableDepartureDemand:aD,arrivalSeatSupply:su,departureSeatSupply:su,carriedArrivalDemand:cA,carriedDepartureDemand:cD,unmetArrivalDemand:uA,unmetDepartureDemand:uD,requiredArrivalDepartures:Math.ceil(aA/SE),requiredDepartureDepartures:Math.ceil(aD/SE),additionalArrivalBusesNeeded:Math.max(0,Math.ceil(aA/SE)-d),additionalDepartureBusesNeeded:Math.max(0,Math.ceil(aD/SE)-d),lostRevenueThb:(uA+uD)*F}});
  const tCA=hourly.reduce((s,h)=>s+h.carriedArrivalDemand,0),tCD=hourly.reduce((s,h)=>s+h.carriedDepartureDemand,0);
  const tAA=hourly.reduce((s,h)=>s+h.addressableArrivalDemand,0),tAD=hourly.reduce((s,h)=>s+h.addressableDepartureDemand,0);
  const tUA=hourly.reduce((s,h)=>s+h.unmetArrivalDemand,0),tUD=hourly.reduce((s,h)=>s+h.unmetDepartureDemand,0);
  const dr=(tCA+tCD)*F,lr=(tUA+tUD)*F;
  const pb=Math.max(...hourly.map(h=>h.additionalArrivalBusesNeeded+h.additionalDepartureBusesNeeded));
  const pg=hourly.reduce((b,h)=>h.unmetArrivalDemand>(b?.unmetArrivalDemand??0)?h:b,hourly[0]);
  return {generatedAt:new Date().toISOString(),assumptions:{seatCapacityPerBus:SE,flatFareThb:F,addressableDemandShare:S,replayStepMinutes:3,replayStartMinutes:360,replayEndMinutes:1440},hourly,services:[{routeId:"rawai-airport" as any,routeName:lt("Airport Line"),directionLabel:"Airport → City",tier:"core" as any,departures:52,seatSupply:1300,estimatedDemand:tAA,carriedRiders:tCA,unmetRiders:tUA,revenueThb:tCA*F,capturePct:tAA>0?Math.round(tCA/tAA*100):0,provenance:"fallback" as any,strategicValue:lt("Primary airport connector")},{routeId:"rawai-airport" as any,routeName:lt("Airport Line"),directionLabel:"City → Airport",tier:"core" as any,departures:52,seatSupply:1300,estimatedDemand:tAD,carriedRiders:tCD,unmetRiders:tUD,revenueThb:tCD*F,capturePct:tAD>0?Math.round(tCD/tAD*100):0,provenance:"fallback" as any,strategicValue:null},{routeId:"patong-old-bus-station" as any,routeName:lt("Patong Line"),directionLabel:"Both",tier:"core" as any,departures:36,seatSupply:900,estimatedDemand:320,carriedRiders:280,unmetRiders:40,revenueThb:28000,capturePct:88,provenance:"fallback" as any,strategicValue:lt("Beach demand")},{routeId:"dragon-line" as any,routeName:lt("Dragon Line"),directionLabel:"Loop",tier:"auxiliary" as any,departures:24,seatSupply:600,estimatedDemand:180,carriedRiders:180,unmetRiders:0,revenueThb:18000,capturePct:100,provenance:"fallback" as any,strategicValue:null}],touchpoints:[],totals:{rawAirportArrivalPax:hourly.reduce((s,h)=>s+h.rawArrivalPax,0),rawAirportDeparturePax:hourly.reduce((s,h)=>s+h.rawDeparturePax,0),addressableArrivalDemand:tAA,addressableDepartureDemand:tAD,carriedArrivalDemand:tCA,carriedDepartureDemand:tCD,unmetArrivalDemand:tUA,unmetDepartureDemand:tUD,totalAirportCapturePct:(tAA+tAD)>0?Math.round((tCA+tCD)/(tAA+tAD)*100):0,addressableAirportCapturePct:(tAA+tAD)>0?Math.round((tCA+tCD)/(tAA+tAD)*100):0,dailyRevenueThb:dr,lostRevenueThb:lr,peakAdditionalBusesNeeded:pb},opportunities:{summary:`Peak gap at ${pg.hour} — ${pg.unmetArrivalDemand+pg.unmetDepartureDemand} unmet pax. Adding ${pb} buses captures ฿${lr.toLocaleString()}.`,peakArrivalGapHour:pg.hour,peakDepartureGapHour:pg.hour,strongestRevenueServiceRouteId:"rawai-airport" as any}};
}

function buildFallbackSimFrame(simMinutes: number, fb: OpsDashboardPayload): SimulationSnapshot {
  const hour = simMinutes/60;
  const busAct = hour<6?0:hour<7?0.3:hour<9?0.7:hour<18?1.0:hour<21?0.6:hour<23?0.2:0;
  const ferryAct = hour<8?0:hour<9?0.4:hour<17?1.0:hour<19?0.5:0;
  const RW: Record<string,[number,number][]> = {
    "rawai-airport": densifyPath([[7.7804,98.3225],[7.8120,98.3150],[7.8420,98.3080],[7.8750,98.3050],[7.9050,98.3050],[7.9500,98.3060],[8.0000,98.3080],[8.0700,98.3100],[8.1090,98.3070]],25),
    "patong-old-bus-station": densifyPath([[7.8830,98.2930],[7.8860,98.3050],[7.8900,98.3200],[7.8880,98.3400],[7.8860,98.3600],[7.8840,98.3800],[7.8840,98.3960]],20),
    "dragon-line": densifyPath([[7.8840,98.3960],[7.8860,98.3940],[7.8870,98.3920],[7.8880,98.3890],[7.8900,98.3850],[7.8880,98.3880],[7.8860,98.3920],[7.8840,98.3960]],20),
    "rassada-phi-phi": densifyPath([[7.8574,98.3866],[7.8400,98.4200],[7.8200,98.4500],[7.8000,98.5500],[7.7500,98.7700]],20),
    "rassada-ao-nang": densifyPath([[7.8574,98.3866],[7.8800,98.4500],[7.9500,98.6000],[8.0000,98.7200],[8.0300,98.8200]],20),
    "bang-rong-koh-yao": densifyPath([[8.0317,98.4192],[8.0500,98.4500],[8.0800,98.5000],[8.1000,98.5400],[8.1100,98.5800]],20),
    "chalong-racha": densifyPath([[7.8216,98.3613],[7.7900,98.3610],[7.7500,98.3600],[7.7000,98.3620],[7.6000,98.3650]],20),
  };
  const TD: Record<string,number> = {"rawai-airport":75,"patong-old-bus-station":40,"dragon-line":25,"rassada-phi-phi":90,"rassada-ao-nang":120,"bang-rong-koh-yao":45,"chalong-racha":60};
  const HW: Record<string,number> = {"rawai-airport":15,"patong-old-bus-station":20,"dragon-line":30,"rassada-phi-phi":60,"rassada-ao-nang":120,"bang-rong-koh-yao":90,"chalong-racha":120};
  const vehicles: VehiclePosition[] = [];
  const lt = (s: string) => ({en:s,th:s,zh:s,de:s,fr:s,es:s});
  for (const [rid, wp] of Object.entries(RW)) {
    const isFerry = FERRY_ROUTE_IDS.has(rid as any);
    const act = isFerry ? ferryAct : busAct;
    if (act <= 0) continue;
    const tripMin = TD[rid]??60, headway = HW[rid]??30, firstDep = isFerry?480:360;
    for (let dep=firstDep; dep<simMinutes+tripMin; dep+=headway) {
      const age = simMinutes-dep;
      if (age<0||age>tripMin) continue;
      if (act<0.5&&(dep/headway)%2===0) continue;
      const progress = age/tripMin;
      const tripIdx = Math.floor((dep-firstDep)/headway);
      const reverse = tripIdx%2===1;
      const eff = reverse?1-progress:progress;
      const pathPos = eff*(wp.length-1);
      const idx = Math.min(Math.floor(pathPos),wp.length-2);
      const seg = pathPos-idx;
      const lat = wp[idx][0]+(wp[idx+1][0]-wp[idx][0])*seg;
      const lng = wp[idx][1]+(wp[idx+1][1]-wp[idx][1])*seg;
      const nIdx = Math.min(idx+1,wp.length-1);
      const dLat=wp[nIdx][0]-wp[idx][0], dLng=wp[nIdx][1]-wp[idx][1];
      const heading = reverse?(Math.atan2(-dLng,-dLat)*180/Math.PI+360)%360:(Math.atan2(dLng,dLat)*180/Math.PI+360)%360;
      vehicles.push({id:`sim-${rid}-${dep}`,routeId:rid as any,licensePlate:`SIM-${vehicles.length}`,vehicleId:`sv-${rid}-${dep}`,deviceId:null,coordinates:[lat,lng],heading,speedKph:simSpeed(progress,rid),destination:lt(rid),updatedAt:new Date().toISOString(),telemetrySource:"schedule_mock",freshness:"fresh",status:progress>0.95||progress<0.05?"dwelling":"moving",distanceToDestinationMeters:null,stopsAway:null});
    }
  }
  return {simMinutes,simTime:`${String(Math.floor(simMinutes/60)).padStart(2,"0")}:${String(simMinutes%60).padStart(2,"0")}`,vehicles,routePressure:fb.fleet.routePressure,transferHubs:fb.transferHubs};
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export function OpsConsole({ onToggle }: { onToggle?: () => void }) {
  const [dashboard, setDashboard] = useState<OpsDashboardPayload | null>(null);
  const [investor, setInvestor] = useState<InvestorSimulationPayload | null>(null);
  const [simSnapshot, setSimSnapshot] = useState<SimulationSnapshot | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }));
  const [activeLayers, setActiveLayers] = useState<Set<OverlayLayerId>>(new Set(["traffic", "hotspots", "transfer_hubs", "route_pressure"]));
  const replayAbortRef = useRef(false);
  const nextReplayMinuteRef = useRef<number | null>(null);
  const useClientSimRef = useRef(false);

  useEffect(() => { const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" })), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => { try { const p = await getOpsDashboard(); if (alive) setDashboard(p); } catch { if (alive) setDashboard((c) => c ?? buildFallbackDashboard()); } };
    void load(); const id = setInterval(() => void load(), OPS_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!simRunning || !investor) return;
    let cancelled = false; replayAbortRef.current = false;
    const tick = async () => {
      const nm = nextReplayMinuteRef.current;
      if (cancelled || replayAbortRef.current || nm === null) return;
      if (nm > investor.assumptions.replayEndMinutes) { setSimRunning(false); nextReplayMinuteRef.current = null; return; }
      try {
        let frame: SimulationSnapshot;
        if (useClientSimRef.current) { frame = buildFallbackSimFrame(nm, dashboard!); }
        else { try { frame = await getSimulationFrame(nm); } catch { useClientSimRef.current = true; frame = buildFallbackSimFrame(nm, dashboard!); } }
        if (cancelled || replayAbortRef.current) return;
        setSimSnapshot(frame);
        nextReplayMinuteRef.current = nm + investor.assumptions.replayStepMinutes;
        setTimeout(() => void tick(), SIM_TICK_MS);
      } catch { setSimRunning(false); nextReplayMinuteRef.current = null; }
    };
    setTimeout(() => void tick(), SIM_TICK_MS);
    return () => { cancelled = true; };
  }, [investor, simRunning]);

  const routes = dashboard?.routes ?? [];
  const liveFleet = dashboard?.fleet.vehicles ?? [];
  const displayVehicles = simRunning && simSnapshot ? simSnapshot.vehicles : liveFleet;
  const displayFS = useMemo(() => fleetSummary(displayVehicles), [displayVehicles]);
  const displayPressure = simRunning && simSnapshot ? simSnapshot.routePressure : dashboard?.fleet.routePressure ?? [];

  const currentMarkers = useMemo(() => {
    if (!dashboard) return [];
    return simRunning && simSnapshot ? buildReplayMarkers(dashboard.mapOverlays.markers, simSnapshot.routePressure, simSnapshot.transferHubs) : dashboard.mapOverlays.markers;
  }, [dashboard, simRunning, simSnapshot]);

  const incidentMarkers = useMemo(() => buildIncidentMarkers(simRunning && simSnapshot ? simSnapshot.simMinutes : null), [simRunning, simSnapshot]);

  const overlayLayers = useMemo<MapOverlay[]>(() => (dashboard?.mapOverlays.tileLayers ?? []).filter((l) => activeLayers.has(l.layerId)).map((l) => ({ id: l.id, url: l.url, attribution: l.attribution, opacity: l.opacity })), [activeLayers, dashboard]);

  const overlayMarkers = useMemo<MapMarkerOverlay[]>(() => {
    const base = currentMarkers.filter((m) => activeLayers.has(m.layerId)).map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, color: m.color, radius: m.radius, label: m.label, fillOpacity: m.fillOpacity }));
    return [...base, ...incidentMarkers];
  }, [activeLayers, currentMarkers, incidentMarkers]);

  const simMinutes = simRunning && simSnapshot ? simSnapshot.simMinutes : null;

  function toggleLayer(id: OverlayLayerId) { setActiveLayers((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function toggleReplay() {
    if (simRunning) { replayAbortRef.current = true; setSimRunning(false); nextReplayMinuteRef.current = null; return; }
    setSimLoading(true); replayAbortRef.current = false;
    try {
      let ip: InvestorSimulationPayload;
      if (useClientSimRef.current || investor) { ip = investor ?? buildFallbackInvestorPayload(); }
      else { try { ip = await getInvestorSimulation(); } catch { useClientSimRef.current = true; ip = buildFallbackInvestorPayload(); } }
      const fm = ip.assumptions.replayStartMinutes;
      let ff: SimulationSnapshot;
      if (useClientSimRef.current) { ff = buildFallbackSimFrame(fm, dashboard!); }
      else { try { ff = await getSimulationFrame(fm); } catch { useClientSimRef.current = true; ff = buildFallbackSimFrame(fm, dashboard!); } }
      setInvestor(ip); setSimSnapshot(ff);
      nextReplayMinuteRef.current = fm + ip.assumptions.replayStepMinutes;
      setSimRunning(true);
    } finally { setSimLoading(false); }
  }

  if (!dashboard) return (
    <div className="ops">
      <header className="ops__header"><div className="ops__brand">{onToggle?<button className="ops__back" type="button" onClick={onToggle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></button>:null}<h1>PKSB Operations</h1></div></header>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div className="ops-card" style={{textAlign:"center"}}><h2 className="ops-card__title">Connecting</h2><p className="ops-card__rec">Loading fleet and operations data.</p></div></div>
    </div>
  );

  // Fleet rows for right sidebar (5 active + idle)
  const routeColorById = Object.fromEntries(routes.map((r) => [r.id, r.color]));
  const routeNameById = Object.fromEntries(routes.map((r) => [r.id, r.shortName?.en ?? r.id]));
  const routeCounters: Record<string, number> = {};
  const fleetRows = displayVehicles.slice(0, 10).map((v) => {
    routeCounters[v.routeId] = (routeCounters[v.routeId] ?? 0) + 1;
    const isFerry = FERRY_ROUTE_IDS.has(v.routeId);
    return { ...v, label: isFerry ? `Ferry ${routeCounters[v.routeId]}` : `Bus ${routeCounters[v.routeId]}`, driver: driverName(v.vehicleId), rating: driverRating(v.vehicleId), pax: simMinutes !== null ? simPassengers(v.vehicleId, simMinutes) : null };
  });
  const routeSummary = routes.map((r) => ({ ...r, vehicles: displayVehicles.filter((v) => v.routeId === r.id).length }));

  return (
    <div className={`ops ${simRunning ? "ops--sim-mode" : ""}`}>
      {/* ── Header ── */}
      <header className="ops__header">
        <div className="ops__brand">
          {onToggle ? <button className="ops__back" type="button" onClick={onToggle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></button> : null}
          <h1>PKSB Operations</h1>
          {simRunning ? <span className="ops__sim-badge">Simulation</span> : null}
        </div>
        <div className="ops__flight-ticker">
          <span className="ops__ticker-label">HKT</span>
          <span className="ops__ticker-arrivals">↓ {dashboard.demandSupply.rawAirportArrivalPaxNext2h.toLocaleString()} arr</span>
          <span className="ops__ticker-sep">·</span>
          <span className="ops__ticker-departures">↑ {dashboard.demandSupply.rawAirportDeparturePaxNext2h.toLocaleString()} dep</span>
          <span className="ops__ticker-sep">·</span>
          <span style={{ color: "#999", fontSize: 11 }}>{dashboard.weather.intelligence.current.tempC}° {dashboard.weather.intelligence.current.rainProb}% rain</span>
        </div>
        <div className="ops__status-bar">
          <span className="ops__clock">{clock}</span>
          {dashboard.sources.map((s) => <span key={s.source} className="ops__health-dot" style={{ background: s.state === "live" ? "#16b8b0" : s.state === "fallback" ? "#b58900" : "#dc322f" }} title={`${s.source}: ${s.state}`} />)}
        </div>
      </header>

      {/* ── 3-panel body: news | map | operations ── */}
      <div className="ops__body">
        {/* LEFT: News feed */}
        <NewsFeed simMinutes={simMinutes} />

        {/* CENTER: Map */}
        <div className="ops__map">
          <LiveMap lang="en" routes={routes} stops={[]} vehicles={displayVehicles} userLocation={null} selectedStop={null} mode="route" bounds={null} animationDurationMs={simRunning ? SIM_ANIMATION_MS : OPS_POLL_MS} overlayLayers={overlayLayers} overlayMarkers={overlayMarkers} onModeChange={() => {}} />
          <div className="ops__layers">
            {LAYER_DEFS.map((l) => (
              <button key={l.id} className={`ops__layer-btn ${activeLayers.has(l.id) ? "is-active" : ""}`} type="button" onClick={() => toggleLayer(l.id)} title={l.label}>
                <span className="ops__layer-icon">{l.icon}</span>
                <span className="ops__layer-label">{l.label}</span>
              </button>
            ))}
          </div>
          <div className="ops__map-overlay">
            <span className="ops__map-stat ops__map-stat--primary">{displayFS.totalVehicles} vehicles</span>
            <span className="ops__map-stat">{displayFS.movingCount} moving</span>
          </div>
        </div>

        {/* RIGHT: Operations panel */}
        <div className="ops__analytics">
          {/* Fleet status */}
          <section className="ops-card">
            <h2 className="ops-card__title">Fleet — {displayFS.movingCount} of {displayFS.totalVehicles} active</h2>
            <div className="ops-card__routes" style={{ marginTop: 0 }}>
              {routeSummary.filter((r) => r.vehicles > 0).map((r) => {
                const p = displayPressure.find((pr) => pr.routeId === r.id);
                return (
                  <div key={r.id} className="ops-route-row">
                    <span className="ops-route-row__dot" style={{ background: r.color }} />
                    <span className="ops-route-row__name">{r.shortName.en}</span>
                    <span className="ops-route-row__count">{r.vehicles}</span>
                    <span className="ops-route-row__tier" style={{ color: p ? colorForPressure(p.level) : "#999" }}>{p ? p.level : r.tier}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Driver roster */}
          <section className="ops-card">
            <h2 className="ops-card__title">Drivers</h2>
            <div className="ops-fleet-rows">
              {fleetRows.map((v) => (
                <div key={v.id} className="fleet-row">
                  <span className="fleet-row__dot" style={{ background: routeColorById[v.routeId] ?? "#999" }} />
                  <span className="fleet-row__info">
                    <strong>{v.label}</strong> · {v.driver}
                    <span className="fleet-row__sub">★ {v.rating.toFixed(1)} · {v.pax ?? "—"}/{BUS_CAPACITY} pax · {Math.round(v.speedKph)} km/h</span>
                  </span>
                  <span className={`fleet-row__status fleet-row__status--${v.status}`}>
                    {v.status === "moving" ? "Moving" : "Idle"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Airport demand */}
          <section className="ops-card">
            <h2 className="ops-card__title">Airport Demand</h2>
            <div className="ops-card__grid">
              <div className="ops-metric">
                <span className="ops-metric__value">{dashboard.demandSupply.rawAirportArrivalPaxNext2h.toLocaleString()}</span>
                <span className="ops-metric__label">Arrivals/2h</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{dashboard.demandSupply.rawAirportDeparturePaxNext2h.toLocaleString()}</span>
                <span className="ops-metric__label">Departures/2h</span>
              </div>
            </div>
            <p className="ops-card__rec">
              {dashboard.demandSupply.arrivalCaptureOfAddressablePct}% capture · {dashboard.demandSupply.additionalBusesNeededPeak > 0 ? `${dashboard.demandSupply.additionalBusesNeededPeak} extra buses needed at peak` : "Supply meets demand"}
            </p>
          </section>

          {/* Transfer hubs compact */}
          <section className="ops-card">
            <h2 className="ops-card__title">Transfer Hubs</h2>
            {["Rassada → Phi Phi, Ao Nang", "Chalong → Racha Island", "Bang Rong → Koh Yao"].map((h, i) => (
              <div key={i} className="ops-hub-line">
                <span className="ops-hub-line__dot" style={{ background: "#16b8b0" }} />
                <span>{h}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      {/* ── Bottom: Simulation Timeline ── */}
      <SimTimeline simMinutes={simMinutes} investor={investor} vehicles={displayVehicles} simRunning={simRunning} onToggle={toggleReplay} simLoading={simLoading} />
    </div>
  );
}
