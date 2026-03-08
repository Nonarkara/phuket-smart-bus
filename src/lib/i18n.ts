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
    en: "See the next airport bus before you leave the terminal.",
    th: "ดูรถคันถัดไปจากสนามบินก่อนออกจากอาคาร"
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
    en: "Search a beach, hotel, or landmark. We will tell you if the bus works for that trip.",
    th: "ค้นหาหาด โรงแรม หรือจุดสังเกต แล้วเราจะบอกว่ารถบัสใช้ไปถึงได้หรือไม่"
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
    en: "Open stop",
    th: "เปิดดูป้าย"
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
    en: "Use the map only if you are already waiting on the route.",
    th: "ใช้แผนที่เมื่อคุณรออยู่บนเส้นทางแล้วเท่านั้น"
  },
  navAirport: {
    en: "Airport",
    th: "สนามบิน"
  },
  navMap: {
    en: "Live map",
    th: "แผนที่สด"
  },
  navRide: {
    en: "My stop",
    th: "ป้ายของฉัน"
  },
  airportStoryTitle: {
    en: "Scan, decide, board",
    th: "สแกน ตัดสินใจ แล้วขึ้นรถ"
  },
  airportStoryBody: {
    en: "A rider lands, sees the airport bus is real, and learns whether the north-south airport line or the east-west city line is the right move.",
    th: "ผู้โดยสารลงจากเครื่อง เห็นว่ารถสนามบินใช้งานได้จริง และรู้ได้ทันทีว่าควรใช้สายสนามบินแนวเหนือใต้หรือสายเมืองแนวตะวันออกตะวันตก"
  },
  airportStoryPrimary: {
    en: "Stop details",
    th: "รายละเอียดป้าย"
  },
  airportStorySecondary: {
    en: "Live map",
    th: "แผนที่สด"
  },
  ridePageTitle: {
    en: "Stop details",
    th: "รายละเอียดป้าย"
  },
  ridePageBody: {
    en: "Once a destination is chosen, keep the next bus, timetable, and walking cue on their own screen.",
    th: "เมื่อเลือกปลายทางแล้ว ให้แยกหน้าที่มีรถคันถัดไป ตารางเวลา และทางเดินไว้ชัดเจน"
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
  opsTitle: {
    en: "Plug-in ready network",
    th: "เครือข่ายที่พร้อมต่อระบบ"
  },
  opsBody: {
    en: "These two lines are ready for direct GPS, seat cameras, and boarding or alighting events by stop.",
    th: "สองเส้นทางนี้พร้อมเชื่อมต่อ GPS ตรง กล้องนับที่นั่ง และเหตุการณ์ขึ้นหรือลงรถตามป้าย"
  },
  opsGpsLabel: {
    en: "GPS live",
    th: "GPS ที่กำลังรายงาน"
  },
  opsCameraLabel: {
    en: "Cameras live",
    th: "กล้องที่กำลังรายงาน"
  },
  opsSeatsLabel: {
    en: "Seats visible",
    th: "ที่นั่งที่มองเห็น"
  },
  opsBoardingsLabel: {
    en: "Boarded 1h",
    th: "ขึ้นรถใน 1 ชม."
  },
  opsAlightingsLabel: {
    en: "Got off 1h",
    th: "ลงรถใน 1 ชม."
  },
  opsRecentTitle: {
    en: "Recent stop activity",
    th: "กิจกรรมล่าสุดตามป้าย"
  },
  opsRecentEmpty: {
    en: "Camera events will appear here once boarding data is connected.",
    th: "เหตุการณ์จากกล้องจะปรากฏที่นี่เมื่อเชื่อมข้อมูลการขึ้นลงรถแล้ว"
  },
  opsRecentBoarding: {
    en: "Boarding",
    th: "ขึ้นรถ"
  },
  opsRecentAlighting: {
    en: "Alighting",
    th: "ลงรถ"
  },
  opsRecentUnknownStop: {
    en: "Unknown stop",
    th: "ป้ายไม่ทราบชื่อ"
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
