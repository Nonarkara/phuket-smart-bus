import type { Lang, LocalizedText } from "@shared/types";

export const ui = {
  appTitle: {
    en: "Phuket Smart Bus",
    th: "ภูเก็ต สมาร์ท บัส"
  },
  appSubtitle: {
    en: "Airport QR web app",
    th: "เว็บแอปสำหรับสแกนที่สนามบิน"
  },
  appBody: {
    en: "Show riders the bus is real before taxis take the decision away.",
    th: "ทำให้ผู้โดยสารเห็นว่ารถบัสใช้งานได้จริงก่อนที่แท็กซี่จะตัดสินใจแทน"
  },
  airportEyebrow: {
    en: "From Phuket Airport",
    th: "จากสนามบินภูเก็ต"
  },
  airportTitle: {
    en: "Can the bus take me there?",
    th: "รถบัสไปถึงที่นั่นไหม?"
  },
  airportBody: {
    en: "Search a beach, hotel belt, or landmark. We will tell you if Smart Bus is available, when it leaves, and whether seats are still open.",
    th: "ค้นหาหาด ย่านโรงแรม หรือจุดสังเกต แล้วเราจะบอกว่าควรใช้ Smart Bus หรือไม่ รถจะออกเมื่อไร และยังพอมีที่นั่งหรือไม่"
  },
  airportSearchPlaceholder: {
    en: "Search beach, hotel, or landmark",
    th: "ค้นหาหาด โรงแรม หรือจุดสังเกต"
  },
  airportQuickTitle: {
    en: "Popular airport trips",
    th: "จุดหมายยอดนิยมจากสนามบิน"
  },
  airportDepartureLabel: {
    en: "Next airport departure",
    th: "รถถัดไปจากสนามบิน"
  },
  airportSeatsLabel: {
    en: "Est. seats left",
    th: "ที่นั่งเหลือโดยประมาณ"
  },
  airportSeatsPending: {
    en: "Seat camera feed ready to connect",
    th: "พร้อมเชื่อมต่อกล้องนับที่นั่ง"
  },
  airportBoardingLabel: {
    en: "Boarding point",
    th: "จุดขึ้นรถ"
  },
  airportTimesLabel: {
    en: "Next departures",
    th: "รอบรถถัดไป"
  },
  airportConnectionLabel: {
    en: "Best line",
    th: "สายที่เหมาะ"
  },
  airportDestinationLabel: {
    en: "Best stop",
    th: "ป้ายที่เหมาะ"
  },
  airportFocusAction: {
    en: "Show on map",
    th: "แสดงบนแผนที่"
  },
  airportGuideFallbackTitle: {
    en: "Airport guidance unavailable",
    th: "ยังไม่มีคำแนะนำจากสนามบิน"
  },
  airportGuideFallbackBody: {
    en: "Use the airport timetable and the live network map below while the guide reloads.",
    th: "ใช้ตารางเวลาสนามบินและแผนที่สดด้านล่างไปก่อนระหว่างรอคำแนะนำโหลดใหม่"
  },
  airportSecondaryTitle: {
    en: "Already waiting somewhere else?",
    th: "ถ้าคุณกำลังรอที่อื่นอยู่แล้ว"
  },
  airportSecondaryBody: {
    en: "Use the live map only when you are already on the corridor and need to see where buses are now.",
    th: "ใช้แผนที่สดเมื่อคุณอยู่บนเส้นทางแล้วและต้องการดูว่ารถอยู่ตรงไหนในตอนนี้"
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
    en: "This is for riders who are already at a stop and need the last timing check.",
    th: "ส่วนนี้สำหรับคนที่อยู่ที่ป้ายแล้วและต้องการเช็กเวลารอบสุดท้าย"
  },
  mapHeroTitle: {
    en: "Live network map",
    th: "แผนที่เครือข่ายแบบสด"
  },
  mapHeroBody: {
    en: "Keep this below the airport decision flow. It is mainly for riders already waiting on the line.",
    th: "ส่วนนี้อยู่ถัดจากการตัดสินใจที่สนามบิน และเหมาะกับผู้โดยสารที่รออยู่บนเส้นทางแล้ว"
  },
  trackingTitle: {
    en: "Stop details",
    th: "รายละเอียดป้าย"
  },
  trackingBody: {
    en: "Once a rider chooses a stop, keep the essentials in one quiet card.",
    th: "เมื่อผู้โดยสารเลือกป้ายแล้ว ให้รวมข้อมูลสำคัญไว้ในการ์ดเดียวที่ดูนิ่งและอ่านง่าย"
  },
  routeRail: {
    en: "Core lines",
    th: "สายหลัก"
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
    en: "Choose a stop",
    th: "เลือกป้าย"
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
