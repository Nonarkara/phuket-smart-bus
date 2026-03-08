import type { Lang, LocalizedText } from "@shared/types";

export const ui = {
  appTitle: {
    en: "Phuket Smart Bus",
    th: "ภูเก็ต สมาร์ท บัส"
  },
  appSubtitle: {
    en: "Rider prototype",
    th: "ต้นแบบสำหรับผู้โดยสาร"
  },
  appBody: {
    en: "Live buses first. Decision support second.",
    th: "เห็นรถสดก่อน แล้วค่อยตัดสินใจ"
  },
  heroTitle: {
    en: "Should I leave now?",
    th: "ควรออกตอนนี้ไหม?"
  },
  heroBody: {
    en: "Use the map, stop context, and alerts to decide if this is the right moment to move.",
    th: "ใช้แผนที่ ข้อมูลป้าย และคำเตือน เพื่อดูว่าควรออกเดินทางตอนนี้หรือไม่"
  },
  mapHeroTitle: {
    en: "Buses available now",
    th: "รถที่มีอยู่ตอนนี้"
  },
  mapHeroBody: {
    en: "Start with the route map so availability is obvious before you read anything else.",
    th: "เริ่มจากแผนที่เส้นทาง เพื่อให้เห็นก่อนว่ามีรถวิ่งอยู่จริงหรือไม่"
  },
  trackingTitle: {
    en: "Tracking right now",
    th: "กำลังติดตามอยู่ตอนนี้"
  },
  trackingBody: {
    en: "Keep one stop in focus while you decide whether to move.",
    th: "โฟกัสที่ป้ายเดียวเพื่อช่วยตัดสินใจว่าจะออกเดินทางตอนนี้หรือไม่"
  },
  routeRail: {
    en: "Pick your route",
    th: "เลือกเส้นทาง"
  },
  mapTitle: {
    en: "Live route map",
    th: "แผนที่เส้นทางสด"
  },
  mapModeRoute: {
    en: "Route view",
    th: "ดูทั้งเส้นทาง"
  },
  mapModeStop: {
    en: "Stop focus",
    th: "โฟกัสป้าย"
  },
  mapSelectionLabel: {
    en: "Selected stop",
    th: "ป้ายที่เลือก"
  },
  mapLiveCountLabel: {
    en: "visible now",
    th: "คันที่เห็นตอนนี้"
  },
  stopTitle: {
    en: "Stops and next-bus context",
    th: "ป้ายและบริบทรถคันถัดไป"
  },
  advisoryTitle: {
    en: "Advisories that change rider decisions",
    th: "คำเตือนที่มีผลต่อการตัดสินใจของผู้โดยสาร"
  },
  searchPlaceholder: {
    en: "Search stop or landmark",
    th: "ค้นหาป้ายหรือจุดสังเกต"
  },
  sourceTitle: {
    en: "Source health",
    th: "สถานะข้อมูล"
  },
  nextBusLabel: {
    en: "Next bus",
    th: "รถคันถัดไป"
  },
  liveBusesLabel: {
    en: "Live buses",
    th: "รถที่ออนไลน์"
  },
  activeAlertsLabel: {
    en: "Active alerts",
    th: "คำเตือนที่ใช้งานอยู่"
  },
  timetableTitle: {
    en: "Published timetable",
    th: "ตารางเวลาที่เผยแพร่"
  },
  timetableFirst: {
    en: "First bus",
    th: "เที่ยวแรก"
  },
  timetableLast: {
    en: "Last bus",
    th: "เที่ยวสุดท้าย"
  },
  timetableWindow: {
    en: "Service window",
    th: "ช่วงเวลาให้บริการ"
  },
  timetableNext: {
    en: "Next scheduled",
    th: "รอบถัดไปตามตาราง"
  },
  timetableUpdated: {
    en: "Updated",
    th: "อัปเดต"
  },
  timetableSource: {
    en: "Source",
    th: "แหล่งข้อมูล"
  },
  timetableOpenSource: {
    en: "Open source",
    th: "เปิดแหล่งข้อมูล"
  },
  walkLabel: {
    en: "Walk",
    th: "เดิน"
  },
  routeDirectionLabel: {
    en: "Direction",
    th: "ทิศทาง"
  },
  sourceBus: {
    en: "Bus feed",
    th: "ข้อมูลรถ"
  },
  sourceTraffic: {
    en: "Traffic",
    th: "จราจร"
  },
  sourceWeather: {
    en: "Weather",
    th: "อากาศ"
  },
  advisoryWarning: {
    en: "Warning",
    th: "เตือนด่วน"
  },
  advisoryCaution: {
    en: "Caution",
    th: "ระวัง"
  },
  advisoryInfo: {
    en: "Info",
    th: "ข้อมูล"
  },
  routeLiveUnit: {
    en: "live",
    th: "ออนไลน์"
  },
  routeStopsUnit: {
    en: "stops",
    th: "ป้าย"
  },
  openMaps: {
    en: "Open in Maps",
    th: "เปิดในแผนที่"
  },
  nearby: {
    en: "Nearby landmark",
    th: "จุดสังเกตใกล้เคียง"
  },
  advisoryNone: {
    en: "No active rider advisories right now.",
    th: "ขณะนี้ไม่มีคำเตือนที่มีผลต่อผู้โดยสาร"
  },
  mapLoading: {
    en: "Loading route intelligence...",
    th: "กำลังโหลดข้อมูลเส้นทาง..."
  }
} satisfies Record<string, LocalizedText>;

export function pick(value: LocalizedText, lang: Lang) {
  return value[lang];
}

export function formatUpdateTime(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function formatSourceDate(value: string | null, lang: Lang) {
  if (!value) {
    return lang === "th" ? "ไม่ระบุ" : "Not listed";
  }

  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
