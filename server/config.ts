import type { LocalizedText, RouteAxis, RouteId, RouteTier } from "../shared/types.js";
import { text } from "./lib/i18n.js";

export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export const BUS_FEED_URL =
  "https://smartbus-pk-api.phuket.cloud/api/bus-news-2/";

// This token is already shipped in the public Phuket Smart Bus tracker bundle.
// Keep it scoped to prototype use only and replace it before any production work.
export const PUBLIC_TRACKER_TOKEN =
  process.env.SMARTBUS_BEARER_TOKEN ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoyMDY1NzUwMjQ4LCJpYXQiOjE3NTAzOTAyNDgsImp0aSI6ImIwMmE1YmI2ZDM1NTRjMjFiODJiNDRmNWE0MmQ4MmZhIiwidXNlcl9pZCI6NX0.bNz_c8ItQoT8Ozxws9aOfuLMWjeL5Yeyddr7Ex9F8jY";

export const OPEN_METEO_URL =
  process.env.OPEN_METEO_BASE_URL ?? "https://api.open-meteo.com/v1/forecast";

export const BUS_CACHE_MS = 15_000;
export const WEATHER_CACHE_MS = 15 * 60_000;
export const TRAFFIC_CACHE_MS = 5 * 60_000;
export const LIVE_STALE_AFTER_MS = 3 * 60_000;

export const ROUTE_DEFINITIONS: Record<
  RouteId,
  {
    sourceRoute: string;
    lineFile: string;
    color: string;
    accentColor: string;
    name: LocalizedText;
    shortName: LocalizedText;
    overview: LocalizedText;
    axis: RouteAxis;
    axisLabel: LocalizedText;
    tier: RouteTier;
    defaultStopName: string;
    timetableSource: {
      label: LocalizedText;
      url: string;
      updatedAt: string | null;
      notes: LocalizedText;
    };
  }
> = {
  "rawai-airport": {
    sourceRoute: "main_line",
    lineFile: "rawai_airport_line.geojson",
    color: "#16b8b0",
    accentColor: "#e8fff9",
    name: text("Rawai - Phuket Airport", "ราไวย์ - สนามบินภูเก็ต", "拉威 - 普吉机场", "Rawai - Flughafen Phuket", "Rawai - Aéroport de Phuket", "Rawai - Aeropuerto de Phuket"),
    shortName: text("Airport Line", "สายสนามบิน", "机场线", "Flughafenlinie", "Ligne aéroport", "Línea aeropuerto"),
    overview: text("Best for airport transfers and the west-coast hotel belt.", "เหมาะสำหรับเดินทางไปสนามบินและแนวโรงแรมชายฝั่งตะวันตก", "适合机场接送和西海岸酒店区。", "Ideal für Flughafentransfers und die Westküsten-Hotels.", "Idéal pour les transferts aéroport et les hôtels de la côte ouest.", "Ideal para traslados al aeropuerto y hoteles de la costa oeste."),
    axis: "north_south",
    axisLabel: text("North-south corridor", "แนวเส้นทางเหนือใต้", "南北走廊", "Nord-Süd-Korridor", "Corridor nord-sud", "Corredor norte-sur"),
    tier: "core",
    defaultStopName: "Phuket Airport",
    timetableSource: {
      label: text("Official Phuket Smart Bus timetable", "ตารางเวลาอย่างเป็นทางการของภูเก็ตสมาร์ทบัส", "普吉智能巴士官方时刻表", "Offizieller Phuket Smart Bus Fahrplan", "Horaire officiel Phuket Smart Bus", "Horario oficial Phuket Smart Bus"),
      url: "https://phuketsmartbus.com/time-table/",
      updatedAt: "2025-01-18",
      notes: text("Airport line schedule published on the official timetable page.", "ตารางเวลาสายสนามบินที่เผยแพร่บนหน้าตารางเวลาอย่างเป็นทางการ")
    }
  },
  "patong-old-bus-station": {
    sourceRoute: "patong_line",
    lineFile: "patong_old_bus_station_line.geojson",
    color: "#ffcc33",
    accentColor: "#fff7d9",
    name: text("Patong - Phuket Bus Terminal 1", "ป่าตอง - สถานีขนส่งภูเก็ต 1", "芭东 - 普吉巴士总站1", "Patong - Busbahnhof Phuket 1", "Patong - Terminal de bus Phuket 1", "Patong - Terminal de autobuses Phuket 1"),
    shortName: text("Patong Line", "สายป่าตอง", "芭东线", "Patong-Linie", "Ligne Patong", "Línea Patong"),
    overview: text("Good for moving between Patong, hospitals, schools, and old-town links.", "เหมาะสำหรับเชื่อมป่าตอง โรงพยาบาล โรงเรียน และเข้าเมือง", "适合在芭东、医院、学校和老城之间出行。", "Gut für Fahrten zwischen Patong, Krankenhäusern und Altstadt.", "Pratique entre Patong, hôpitaux, écoles et vieille ville.", "Bueno para moverse entre Patong, hospitales y casco antiguo."),
    axis: "east_west",
    axisLabel: text("East-west corridor", "แนวเส้นทางตะวันออกตะวันตก", "东西走廊", "Ost-West-Korridor", "Corridor est-ouest", "Corredor este-oeste"),
    tier: "core",
    defaultStopName: "Patong",
    timetableSource: {
      label: text("Published route timetable", "ตารางเวลาเส้นทางที่เผยแพร่"),
      url: "https://phuketsmartbus.com/phuket-smart-bus-eng/",
      updatedAt: null,
      notes: text("Service window is derived from the published stop times in the route data.", "ช่วงเวลาให้บริการคำนวณจากเวลาแต่ละป้ายที่เผยแพร่ในข้อมูลเส้นทาง")
    }
  },
  "dragon-line": {
    sourceRoute: "dragon_line",
    lineFile: "dragon_line.geojson",
    color: "#db0000",
    accentColor: "#ffe6e0",
    name: text("Dragon Line Old Town Loop", "ดราก้อน ไลน์ วนเมืองเก่า", "龙线老城环线", "Dragon Line Altstadtschleife", "Dragon Line boucle vieille ville", "Dragon Line circuito casco antiguo"),
    shortName: text("Dragon Line", "ดราก้อน ไลน์", "龙线", "Dragon-Linie", "Ligne Dragon", "Línea Dragon"),
    overview: text("Short-hop loop around Phuket Old Town landmarks and hotels.", "เส้นทางสั้นสำหรับย่านเมืองเก่าภูเก็ต โรงแรม และจุดท่องเที่ยว", "普吉老城地标和酒店的短途环线。", "Kurzstrecke durch die Altstadt von Phuket.", "Boucle courte autour de la vieille ville de Phuket.", "Circuito corto por el casco antiguo de Phuket."),
    axis: "loop",
    axisLabel: text("Old-town loop", "เส้นทางวนเมืองเก่า", "老城环线", "Altstadtschleife", "Boucle vieille ville", "Circuito casco antiguo"),
    tier: "auxiliary",
    defaultStopName: "Old Town Intersection",
    timetableSource: {
      label: text("Published route timetable", "ตารางเวลาเส้นทางที่เผยแพร่"),
      url: "https://phuketsmartbus.com/phuket-smart-bus-eng/",
      updatedAt: null,
      notes: text("Service window is derived from the published stop times in the route data.", "ช่วงเวลาให้บริการคำนวณจากเวลาแต่ละป้ายที่เผยแพร่ในข้อมูลเส้นทาง")
    }
  }
};
