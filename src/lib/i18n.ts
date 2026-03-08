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
    en: "Pick a route, choose a stop, then decide when to move.",
    th: "เลือกเส้นทาง เลือกป้าย แล้วค่อยตัดสินใจออกเดินทาง"
  },
  journeyTitle: {
    en: "Rider journey",
    th: "ลำดับการเดินทาง"
  },
  journeyRoute: {
    en: "Route",
    th: "เส้นทาง"
  },
  journeyStop: {
    en: "Stop",
    th: "ป้าย"
  },
  journeyDecision: {
    en: "Decision",
    th: "คำแนะนำ"
  },
  journeyChooseStop: {
    en: "Choose a stop",
    th: "เลือกป้าย"
  },
  journeyPending: {
    en: "Waiting for live guidance",
    th: "กำลังรอคำแนะนำสด"
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
    en: "Choose your route",
    th: "เลือกเส้นทางของคุณ"
  },
  mapHeroBody: {
    en: "Start with the live map, then narrow the trip down to one stop.",
    th: "เริ่มจากแผนที่สด แล้วค่อยเจาะลงไปที่ป้ายเดียว"
  },
  trackingTitle: {
    en: "Stop focus",
    th: "โฟกัสป้าย"
  },
  trackingBody: {
    en: "Everything that matters for this stop stays together here.",
    th: "รวมทุกอย่างที่สำคัญสำหรับป้ายนี้ไว้ในจุดเดียว"
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
    en: "Choose your stop",
    th: "เลือกป้ายของคุณ"
  },
  advisoryTitle: {
    en: "Service alerts",
    th: "คำเตือนบริการ"
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
  },
  loadingError: {
    en: "Live data is taking longer than expected. Keep using the map and the published timetable below.",
    th: "ข้อมูลสดใช้เวลานานกว่าปกติ ให้ใช้แผนที่และตารางเวลาที่เผยแพร่ด้านล่างไปก่อน"
  },
  decisionUnavailableTitle: {
    en: "Live decision unavailable",
    th: "ยังไม่มีคำแนะนำสด"
  },
  decisionUnavailableBody: {
    en: "The recommendation service is temporarily unavailable. Use the next scheduled bus and timetable below.",
    th: "ระบบคำแนะนำชั่วคราวใช้งานไม่ได้ ให้ใช้เวลารถคันถัดไปและตารางเวลาที่เผยแพร่ด้านล่าง"
  },
  stopEmpty: {
    en: "No stops match this search.",
    th: "ไม่พบป้ายที่ตรงกับคำค้นหา"
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
