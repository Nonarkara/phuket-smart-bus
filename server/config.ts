import type { LocalizedText, RouteAxis, RouteId, RouteTier } from "../shared/types.js";

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
    name: {
      en: "Rawai - Phuket Airport",
      th: "ราไวย์ - สนามบินภูเก็ต"
    },
    shortName: {
      en: "Airport Line",
      th: "สายสนามบิน"
    },
    overview: {
      en: "Best for airport transfers and the west-coast hotel belt.",
      th: "เหมาะสำหรับเดินทางไปสนามบินและแนวโรงแรมชายฝั่งตะวันตก"
    },
    axis: "north_south",
    axisLabel: {
      en: "North-south corridor",
      th: "แนวเส้นทางเหนือใต้"
    },
    tier: "core",
    defaultStopName: "Phuket Airport",
    timetableSource: {
      label: {
        en: "Official Phuket Smart Bus timetable",
        th: "ตารางเวลาอย่างเป็นทางการของภูเก็ตสมาร์ทบัส"
      },
      url: "https://phuketsmartbus.com/time-table/",
      updatedAt: "2025-01-18",
      notes: {
        en: "Airport line schedule published on the official timetable page.",
        th: "ตารางเวลาสายสนามบินที่เผยแพร่บนหน้าตารางเวลาอย่างเป็นทางการ"
      }
    }
  },
  "patong-old-bus-station": {
    sourceRoute: "patong_line",
    lineFile: "patong_old_bus_station_line.geojson",
    color: "#ffcc33",
    accentColor: "#fff7d9",
    name: {
      en: "Patong - Phuket Bus Terminal 1",
      th: "ป่าตอง - สถานีขนส่งภูเก็ต 1"
    },
    shortName: {
      en: "Patong Line",
      th: "สายป่าตอง"
    },
    overview: {
      en: "Good for moving between Patong, hospitals, schools, and old-town links.",
      th: "เหมาะสำหรับเชื่อมป่าตอง โรงพยาบาล โรงเรียน และเข้าเมือง"
    },
    axis: "east_west",
    axisLabel: {
      en: "East-west corridor",
      th: "แนวเส้นทางตะวันออกตะวันตก"
    },
    tier: "core",
    defaultStopName: "Patong",
    timetableSource: {
      label: {
        en: "Published route timetable",
        th: "ตารางเวลาเส้นทางที่เผยแพร่"
      },
      url: "https://phuketsmartbus.com/phuket-smart-bus-eng/",
      updatedAt: null,
      notes: {
        en: "Service window is derived from the published stop times in the route data.",
        th: "ช่วงเวลาให้บริการคำนวณจากเวลาแต่ละป้ายที่เผยแพร่ในข้อมูลเส้นทาง"
      }
    }
  },
  "dragon-line": {
    sourceRoute: "dragon_line",
    lineFile: "dragon_line.geojson",
    color: "#db0000",
    accentColor: "#ffe6e0",
    name: {
      en: "Dragon Line Old Town Loop",
      th: "ดราก้อน ไลน์ วนเมืองเก่า"
    },
    shortName: {
      en: "Dragon Line",
      th: "ดราก้อน ไลน์"
    },
    overview: {
      en: "Short-hop loop around Phuket Old Town landmarks and hotels.",
      th: "เส้นทางสั้นสำหรับย่านเมืองเก่าภูเก็ต โรงแรม และจุดท่องเที่ยว"
    },
    axis: "loop",
    axisLabel: {
      en: "Old-town loop",
      th: "เส้นทางวนเมืองเก่า"
    },
    tier: "auxiliary",
    defaultStopName: "Old Town Intersection",
    timetableSource: {
      label: {
        en: "Published route timetable",
        th: "ตารางเวลาเส้นทางที่เผยแพร่"
      },
      url: "https://phuketsmartbus.com/phuket-smart-bus-eng/",
      updatedAt: null,
      notes: {
        en: "Service window is derived from the published stop times in the route data.",
        th: "ช่วงเวลาให้บริการคำนวณจากเวลาแต่ละป้ายที่เผยแพร่ในข้อมูลเส้นทาง"
      }
    }
  }
};
