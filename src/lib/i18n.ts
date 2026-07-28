import type { Lang, LocalizedText } from "@shared/types";

const LOCALE_MAP: Record<Lang, string> = {
  en: "en-GB",
  th: "th-TH",
  zh: "zh-CN",
  ko: "ko-KR",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES"
};

export const ui = {
  appTitle: {
    en: "Phuket Smart Bus",
    th: "ภูเก็ต สมาร์ท บัส",
    zh: "普吉智能巴士",
    ko: "푸껫 스마트 버스",
    de: "Phuket Smart Bus",
    fr: "Phuket Smart Bus",
    es: "Phuket Smart Bus"
  },
  appSubtitle: {
    en: "Live bus tracker",
    th: "ติดตามรถบัสสด",
    zh: "实时巴士追踪",
    ko: "실시간 버스 추적",
    de: "Live-Bus-Tracker",
    fr: "Suivi de bus en direct",
    es: "Seguimiento de bus en vivo"
  },
  airportBoardingAction: {
    en: "Open boarding stop", th: "เปิดจุดขึ้นรถ", zh: "打开登车站", ko: "탑승 정류장 열기", de: "Einstiegshaltestelle öffnen", fr: "Ouvrir l'arrêt d'embarquement", es: "Abrir parada de embarque"
  },
  airportBusFareLabel: {
    en: "Smart Bus", th: "Smart Bus", zh: "Smart Bus", ko: "스마트 버스", de: "Smart Bus", fr: "Smart Bus", es: "Smart Bus"
  },
  airportSavingsTitle: {
    en: "Why tourists switch", th: "ทำไมนักท่องเที่ยวถึงเปลี่ยนใจ", zh: "为什么游客会选择", ko: "관광객이 왜 바꾸는가", de: "Warum Touristen wechseln", fr: "Pourquoi les touristes changent", es: "Por qué los turistas cambian"
  },
  airportTaxiFareLabel: {
    en: "Taxi", th: "แท็กซี่", zh: "出租车", ko: "택시", de: "Taxi", fr: "Taxi", es: "Taxi"
  },
  airportWalkTitle: {
    en: "Walk to the stop", th: "เดินไปที่ป้าย", zh: "步行到站", ko: "정류장까지 걷기", de: "Zur Haltestelle laufen", fr: "Marcher jusqu'à l'arrêt", es: "Caminar a la parada"
  },
  airportWeatherTitle: {
    en: "Rain risk", th: "ความเสี่ยงฝน", zh: "降雨风险", ko: "비 올 위험", de: "Regenrisiko", fr: "Risque de pluie", es: "Riesgo de lluvia"
  },
  airportWeatherRainChanceLabel: {
    en: "Rain chance", th: "โอกาสฝน", zh: "降雨概率", ko: "비 올 확률", de: "Regenwahrscheinlichkeit", fr: "Chance de pluie", es: "Probabilidad de lluvia"
  },
  airportWeatherRainfallLabel: {
    en: "Rain now", th: "ปริมาณฝนตอนนี้", zh: "当前降雨", ko: "현재 강수량", de: "Regen jetzt", fr: "Pluie actuelle", es: "Lluvia actual"
  },
  clockLabel: {
    en: "Phuket time",
    th: "เวลาภูเก็ต",
    zh: "普吉时间",
    ko: "푸껫 시간",
    de: "Phuket-Zeit",
    fr: "Heure de Phuket",
    es: "Hora de Phuket"
  },
  navMap: {
    en: "Map",
    th: "แผนที่",
    zh: "地图",
    ko: "지도",
    de: "Karte",
    fr: "Carte",
    es: "Mapa"
  },
  navStops: {
    en: "Stops",
    th: "ป้าย",
    zh: "站点",
    ko: "정류장",
    de: "Haltestellen",
    fr: "Arrêts",
    es: "Paradas"
  },
  navPass: {
    en: "Pass",
    th: "บัตร",
    zh: "通行证",
    ko: "패스",
    de: "Pass",
    fr: "Pass",
    es: "Pase"
  },
  navRide: {
    en: "My stop",
    th: "ป้ายของฉัน",
    zh: "我的站",
    ko: "내 정류장",
    de: "Meine Haltestelle",
    fr: "Mon arrêt",
    es: "Mi parada"
  },
  navQr: {
    en: "My QR",
    th: "คิวอาร์ของฉัน",
    zh: "我的二维码",
    ko: "내 QR",
    de: "Mein QR",
    fr: "Mon QR",
    es: "Mi QR"
  },
  navAirport: {
    en: "Airport",
    th: "สนามบิน",
    zh: "机场",
    ko: "공항",
    de: "Flughafen",
    fr: "Aéroport",
    es: "Aeropuerto"
  },
  whyBusTitle: {
    en: "Why take the bus",
    th: "ทำไมต้องนั่งบัส",
    zh: "为什么乘巴士",
    ko: "왜 버스를 타야 하나",
    de: "Warum Bus fahren",
    fr: "Pourquoi prendre le bus",
    es: "Por qué tomar el bus"
  },
  routeAll: {
    en: "All lines",
    th: "ทุกสาย",
    zh: "所有线路",
    ko: "전체 노선",
    de: "Alle Linien",
    fr: "Toutes les lignes",
    es: "Todas las líneas"
  },
  mapModeRoute: {
    en: "Route view",
    th: "ดูทั้งเส้นทาง",
    zh: "线路视图",
    ko: "노선 보기",
    de: "Routenansicht",
    fr: "Vue itinéraire",
    es: "Vista de ruta"
  },
  mapModeStop: {
    en: "Stop focus",
    th: "โฟกัสป้าย",
    zh: "站点聚焦",
    ko: "정류장 포커스",
    de: "Haltestellenfokus",
    fr: "Focus arrêt",
    es: "Enfoque parada"
  },
  mapLiveCountLabel: {
    en: "vehicles live",
    th: "คันออนไลน์",
    zh: "辆交通在线",
    ko: "대 운행 중",
    de: "Fahrzeuge live",
    fr: "véhicules en direct",
    es: "buses en vivo"
  },
  stopTitle: {
    en: "Choose a stop",
    th: "เลือกป้าย",
    zh: "选择站点",
    ko: "정류장 선택",
    de: "Haltestelle wählen",
    fr: "Choisir un arrêt",
    es: "Elegir una parada"
  },
  searchPlaceholder: {
    en: "Search stop or landmark",
    th: "ค้นหาป้ายหรือจุดสังเกต",
    zh: "搜索站点或地标",
    ko: "정류장 또는 랜드마크 검색",
    de: "Haltestelle oder Ort suchen",
    fr: "Chercher arrêt ou lieu",
    es: "Buscar parada o lugar"
  },
  stopEmpty: {
    en: "No stops match this search.",
    th: "ไม่พบป้ายที่ตรงกับคำค้นหา",
    zh: "没有匹配的站点。",
    ko: "검색과 일치하는 정류장이 없습니다.",
    de: "Keine passenden Haltestellen.",
    fr: "Aucun arrêt trouvé.",
    es: "No se encontraron paradas."
  },
  nextBusLabel: {
    en: "Next bus",
    th: "รถคันถัดไป",
    zh: "下一班车",
    ko: "다음 버스",
    de: "Nächster Bus",
    fr: "Prochain bus",
    es: "Próximo bus"
  },
  liveBusesLabel: {
    en: "Live buses",
    th: "รถที่ออนไลน์",
    zh: "在线巴士",
    ko: "실시간 버스",
    de: "Live-Busse",
    fr: "Bus en direct",
    es: "Buses en vivo"
  },
  activeAlertsLabel: {
    en: "Active alerts",
    th: "คำเตือนที่ใช้งานอยู่",
    zh: "活跃警报",
    ko: "활성 알림",
    de: "Aktive Warnungen",
    fr: "Alertes actives",
    es: "Alertas activas"
  },
  timetableTitle: {
    en: "Published timetable",
    th: "ตารางเวลาที่เผยแพร่",
    zh: "公布时刻表",
    ko: "공시된 시간표",
    de: "Veröffentlichter Fahrplan",
    fr: "Horaires publiés",
    es: "Horario publicado"
  },
  timetableFirst: {
    en: "First bus",
    th: "เที่ยวแรก",
    zh: "首班车",
    ko: "첫 버스",
    de: "Erster Bus",
    fr: "Premier bus",
    es: "Primer bus"
  },
  timetableLast: {
    en: "Last bus",
    th: "เที่ยวสุดท้าย",
    zh: "末班车",
    ko: "막차",
    de: "Letzter Bus",
    fr: "Dernier bus",
    es: "Último bus"
  },
  timetableWindow: {
    en: "Service window",
    th: "ช่วงเวลาให้บริการ",
    zh: "服务时段",
    ko: "운행 시간",
    de: "Betriebszeit",
    fr: "Heures de service",
    es: "Horario de servicio"
  },
  timetableNext: {
    en: "Next scheduled",
    th: "รอบถัดไปตามตาราง",
    zh: "下一班计划",
    ko: "다음 예정편",
    de: "Nächste planmäßig",
    fr: "Prochain prévu",
    es: "Próximo programado"
  },
  timetableUpdated: {
    en: "Updated",
    th: "อัปเดต",
    zh: "更新于",
    ko: "업데이트됨",
    de: "Aktualisiert",
    fr: "Mis à jour",
    es: "Actualizado"
  },
  timetableSource: {
    en: "Source",
    th: "แหล่งข้อมูล",
    zh: "来源",
    ko: "출처",
    de: "Quelle",
    fr: "Source",
    es: "Fuente"
  },
  timetableOpenSource: {
    en: "Open source",
    th: "เปิดแหล่งข้อมูล",
    zh: "打开来源",
    ko: "출처 열기",
    de: "Quelle öffnen",
    fr: "Ouvrir la source",
    es: "Abrir fuente"
  },
  advisoryTitle: {
    en: "Service alerts",
    th: "คำเตือนบริการ",
    zh: "服务提醒",
    ko: "운행 알림",
    de: "Servicemeldungen",
    fr: "Alertes de service",
    es: "Alertas de servicio"
  },
  advisoryWarning: {
    en: "Warning",
    th: "เตือนด่วน",
    zh: "警告",
    ko: "경고",
    de: "Warnung",
    fr: "Avertissement",
    es: "Advertencia"
  },
  advisoryCaution: {
    en: "Caution",
    th: "ระวัง",
    zh: "注意",
    ko: "주의",
    de: "Vorsicht",
    fr: "Prudence",
    es: "Precaución"
  },
  advisoryInfo: {
    en: "Info",
    th: "ข้อมูล",
    zh: "信息",
    ko: "안내",
    de: "Info",
    fr: "Info",
    es: "Info"
  },
  advisoryNone: {
    en: "No active alerts right now.",
    th: "ขณะนี้ไม่มีคำเตือน",
    zh: "目前没有活跃警报。",
    ko: "현재 활성 알림이 없습니다.",
    de: "Derzeit keine Warnungen.",
    fr: "Aucune alerte active.",
    es: "Sin alertas activas."
  },
  passEyebrow: {
    en: "Boarding pass",
    th: "บัตรโดยสาร",
    zh: "登车券",
    ko: "탑승권",
    de: "Fahrkarte",
    fr: "Carte d'embarquement",
    es: "Tarjeta de embarque"
  },
  passTitle: {
    en: "My QR code",
    th: "คิวอาร์โค้ดของฉัน",
    zh: "我的二维码",
    ko: "내 QR 코드",
    de: "Mein QR-Code",
    fr: "Mon code QR",
    es: "Mi código QR"
  },
  passBody: {
    en: "Mock day-pass and 7-day-pass with live countdown.",
    th: "จำลองตั๋ว 1 วันและ 7 วัน พร้อมนับถอยหลัง",
    zh: "模拟日票和7日票，实时倒计时。",
    ko: "1일권 및 7일권 모의 패스와 실시간 카운트다운.",
    de: "Demo-Tages- und 7-Tage-Pass mit Countdown.",
    fr: "Pass journée et 7 jours avec compte à rebours.",
    es: "Pase de día y 7 días con cuenta regresiva."
  },
  passDayLabel: {
    en: "24h pass",
    th: "ตั๋ว 24 ชม.",
    zh: "24小时票",
    ko: "24시간권",
    de: "24h-Pass",
    fr: "Pass 24h",
    es: "Pase 24h"
  },
  passWeekLabel: {
    en: "7-day pass",
    th: "ตั๋ว 7 วัน",
    zh: "7日票",
    ko: "7일권",
    de: "7-Tage-Pass",
    fr: "Pass 7 jours",
    es: "Pase 7 días"
  },
  passActiveLabel: {
    en: "Active now",
    th: "กำลังใช้งาน",
    zh: "使用中",
    ko: "사용 중",
    de: "Jetzt aktiv",
    fr: "Actif maintenant",
    es: "Activo ahora"
  },
  passExpiredLabel: {
    en: "Expired",
    th: "หมดอายุ",
    zh: "已过期",
    ko: "만료됨",
    de: "Abgelaufen",
    fr: "Expiré",
    es: "Expirado"
  },
  passCountdownLabel: {
    en: "Time left",
    th: "เวลาคงเหลือ",
    zh: "剩余时间",
    ko: "남은 시간",
    de: "Verbleibend",
    fr: "Temps restant",
    es: "Tiempo restante"
  },
  passActivatedLabel: {
    en: "Activated",
    th: "เริ่มใช้งาน",
    zh: "已激活",
    ko: "활성화됨",
    de: "Aktiviert",
    fr: "Activé",
    es: "Activado"
  },
  passValidUntilLabel: {
    en: "Valid until",
    th: "ใช้ได้ถึง",
    zh: "有效期至",
    ko: "유효 기한",
    de: "Gültig bis",
    fr: "Valide jusqu'au",
    es: "Válido hasta"
  },
  passQrTitle: {
    en: "QR boarding code",
    th: "คิวอาร์สำหรับขึ้นรถ",
    zh: "二维码登车码",
    ko: "QR 탑승 코드",
    de: "QR-Boardingcode",
    fr: "Code QR d'embarquement",
    es: "Código QR de embarque"
  },
  passQrBody: {
    en: "Show this code when boarding.",
    th: "แสดงโค้ดนี้ตอนขึ้นรถ",
    zh: "上车时出示此码。",
    ko: "탑승 시 이 코드를 보여주세요.",
    de: "Zeigen Sie diesen Code beim Einsteigen.",
    fr: "Montrez ce code à l'embarquement.",
    es: "Muestre este código al abordar."
  },
  routeLiveUnit: {
    en: "live",
    th: "ออนไลน์",
    zh: "在线",
    ko: "실시간",
    de: "live",
    fr: "en direct",
    es: "en vivo"
  },
  routeStopsUnit: {
    en: "stops",
    th: "ป้าย",
    zh: "站",
    ko: "정류장",
    de: "Haltestellen",
    fr: "arrêts",
    es: "paradas"
  },
  routeDirectionLabel: {
    en: "Direction",
    th: "ทิศทาง",
    zh: "方向",
    ko: "방향",
    de: "Richtung",
    fr: "Direction",
    es: "Dirección"
  },
  walkLabel: {
    en: "Walk",
    th: "เดิน",
    zh: "步行",
    ko: "도보",
    de: "Zu Fuß",
    fr: "Marche",
    es: "Caminar"
  },
  openMaps: {
    en: "Open in Maps",
    th: "เปิดในแผนที่",
    zh: "在地图中打开",
    ko: "지도에서 열기",
    de: "In Karten öffnen",
    fr: "Ouvrir dans Maps",
    es: "Abrir en Mapas"
  },
  nearby: {
    en: "Nearby landmark",
    th: "จุดสังเกตใกล้เคียง",
    zh: "附近地标",
    ko: "주변 랜드마크",
    de: "Nahegelegenes Wahrzeichen",
    fr: "Lieu proche",
    es: "Punto de referencia cercano"
  },
  sourceBus: {
    en: "Bus feed",
    th: "ข้อมูลรถ",
    zh: "巴士数据",
    ko: "버스 정보",
    de: "Bus-Feed",
    fr: "Flux bus",
    es: "Datos de bus"
  },
  sourceTraffic: {
    en: "Traffic",
    th: "จราจร",
    zh: "交通",
    ko: "교통",
    de: "Verkehr",
    fr: "Trafic",
    es: "Tráfico"
  },
  sourceWeather: {
    en: "Weather",
    th: "อากาศ",
    zh: "天气",
    ko: "날씨",
    de: "Wetter",
    fr: "Météo",
    es: "Clima"
  },
  sourceAqi: {
    en: "Air quality",
    th: "คุณภาพอากาศ",
    zh: "空气质量",
    ko: "공기질",
    de: "Luftqualität",
    fr: "Qualité de l'air",
    es: "Calidad del aire"
  },
  mapLoading: {
    en: "Loading route data...",
    th: "กำลังโหลดข้อมูลเส้นทาง...",
    zh: "加载线路数据...",
    ko: "노선 데이터 로딩 중...",
    de: "Routendaten werden geladen...",
    fr: "Chargement des données...",
    es: "Cargando datos de ruta..."
  },
  loadingError: {
    en: "Live data is taking longer than expected. Use the published timetable.",
    th: "ข้อมูลสดใช้เวลานานกว่าปกติ ให้ใช้ตารางเวลา",
    zh: "实时数据加载较慢，请使用时刻表。",
    ko: "실시간 데이터 로딩이 지연되고 있습니다. 공시된 시간표를 이용하세요.",
    de: "Live-Daten laden langsam. Nutzen Sie den Fahrplan.",
    fr: "Les données en direct sont lentes. Utilisez l'horaire.",
    es: "Los datos en vivo tardan. Use el horario publicado."
  },
  decisionUnavailableTitle: {
    en: "Live guidance unavailable",
    th: "ยังไม่มีคำแนะนำสด",
    zh: "实时引导不可用",
    ko: "실시간 안내 불가",
    de: "Live-Empfehlung nicht verfügbar",
    fr: "Guide en direct indisponible",
    es: "Guía en vivo no disponible"
  },
  decisionUnavailableBody: {
    en: "Use the next scheduled bus and timetable below.",
    th: "ใช้เวลารถคันถัดไปและตารางเวลาด้านล่าง",
    zh: "请参考下方时刻表。",
    ko: "아래의 다음 예정 버스와 시간표를 참고하세요.",
    de: "Nutzen Sie den Fahrplan unten.",
    fr: "Consultez l'horaire ci-dessous.",
    es: "Consulte el horario abajo."
  },
  footerCopyright: {
    en: "© 2026 Dr. Non Arkaraprasertkul",
    th: "© 2026 Dr. Non Arkaraprasertkul",
    zh: "© 2026 Dr. Non Arkaraprasertkul",
    ko: "© 2026 Dr. Non Arkaraprasertkul",
    de: "© 2026 Dr. Non Arkaraprasertkul",
    fr: "© 2026 Dr. Non Arkaraprasertkul",
    es: "© 2026 Dr. Non Arkaraprasertkul"
  },
  locationYouAreHere: {
    en: "You are here",
    th: "คุณอยู่ที่นี่",
    zh: "你在这里",
    ko: "현재 위치",
    de: "Sie sind hier",
    fr: "Vous êtes ici",
    es: "Usted está aquí"
  },
  mapSelectionLabel: {
    en: "Selected stop",
    th: "ป้ายที่เลือก",
    zh: "已选站点",
    ko: "선택된 정류장",
    de: "Ausgewählte Haltestelle",
    fr: "Arrêt sélectionné",
    es: "Parada seleccionada"
  },
  sourceTitle: {
    en: "Source health",
    th: "สถานะข้อมูล",
    zh: "数据源状态",
    ko: "데이터 소스 상태",
    de: "Datenquellenstatus",
    fr: "État des sources",
    es: "Estado de fuentes"
  },
  heroTitle: {
    en: "Should I leave now?",
    th: "ควรออกตอนนี้ไหม?",
    zh: "现在该出发吗？",
    ko: "지금 출발해야 할까?",
    de: "Soll ich jetzt los?",
    fr: "Dois-je partir maintenant ?",
    es: "¿Debo salir ahora?"
  },
  ridePageTitle: {
    en: "Stop details",
    th: "รายละเอียดป้าย",
    zh: "站点详情",
    ko: "정류장 상세정보",
    de: "Haltestellendetails",
    fr: "Détails de l'arrêt",
    es: "Detalles de la parada"
  },
  journeyRoute: {
    en: "Route",
    th: "เส้นทาง",
    zh: "线路",
    ko: "노선",
    de: "Route",
    fr: "Itinéraire",
    es: "Ruta"
  },
  journeyStop: {
    en: "Stop",
    th: "ป้าย",
    zh: "站",
    ko: "정류장",
    de: "Haltestelle",
    fr: "Arrêt",
    es: "Parada"
  },
  journeyDecision: {
    en: "Decision",
    th: "คำแนะนำ",
    zh: "建议",
    ko: "권장사항",
    de: "Empfehlung",
    fr: "Décision",
    es: "Decisión"
  },
  journeyChooseStop: {
    en: "Choose a stop",
    th: "เลือกป้าย",
    zh: "选择站点",
    ko: "정류장 선택",
    de: "Haltestelle wählen",
    fr: "Choisir un arrêt",
    es: "Elegir parada"
  },
  journeyPending: {
    en: "Waiting for live guidance",
    th: "กำลังรอคำแนะนำสด",
    zh: "等待实时引导",
    ko: "실시간 안내 대기 중",
    de: "Warte auf Live-Empfehlung",
    fr: "En attente du guide en direct",
    es: "Esperando guía en vivo"
  },
  passCountdownBody: {
    en: "Clock starts at activation and runs until expiry.",
    th: "เวลาเริ่มนับเมื่อเปิดใช้งาน",
    zh: "激活后开始计时直至到期。",
    ko: "활성화 시 카운트다운이 시작되어 만료 시까지 진행됩니다.",
    de: "Countdown beginnt bei Aktivierung.",
    fr: "Le décompte commence à l'activation.",
    es: "La cuenta regresiva comienza al activar."
  },
  mapTitle: {
    en: "Live network map",
    th: "แผนที่เครือข่ายแบบสด",
    zh: "实时网络地图",
    ko: "실시간 노선망 지도",
    de: "Live-Netzwerkkarte",
    fr: "Carte réseau en direct",
    es: "Mapa de red en vivo"
  },
  mapNetworkLabel: {
    en: "All lines",
    th: "ทุกสาย",
    zh: "所有线路",
    ko: "전체 노선",
    de: "Alle Linien",
    fr: "Toutes les lignes",
    es: "Todas las líneas"
  },
  mapAllLinesTitle: {
    en: "Airport Line + Patong Line",
    th: "สายสนามบิน + สายป่าตอง",
    zh: "机场线 + 芭东线",
    ko: "공항선 + 파통선",
    de: "Flughafenlinie + Patong-Linie",
    fr: "Ligne aéroport + Ligne Patong",
    es: "Línea aeropuerto + Línea Patong"
  },
  mapFocusLabel: {
    en: "Line focus",
    th: "โฟกัสเส้นทาง",
    zh: "线路聚焦",
    ko: "노선 포커스",
    de: "Linienfokus",
    fr: "Focus ligne",
    es: "Enfoque línea"
  },
  routeRail: {
    en: "Core lines",
    th: "สายหลัก",
    zh: "主线路",
    ko: "주요 노선",
    de: "Hauptlinien",
    fr: "Lignes principales",
    es: "Líneas principales"
  },
  locationOpenMap: {
    en: "Open live map",
    th: "เปิดแผนที่สด",
    zh: "打开实时地图",
    ko: "실시간 지도 열기",
    de: "Live-Karte öffnen",
    fr: "Ouvrir la carte",
    es: "Abrir mapa en vivo"
  },
  locationDeniedTitle: {
    en: "Location blocked",
    th: "ไม่ได้รับอนุญาตตำแหน่ง",
    zh: "位置被阻止",
    ko: "위치 정보 차단됨",
    de: "Standort blockiert",
    fr: "Localisation bloquée",
    es: "Ubicación bloqueada"
  },
  navMore: {
    en: "More", th: "เพิ่มเติม", zh: "更多", ko: "더보기", de: "Mehr", fr: "Plus", es: "Más"
  },
  navInfo: {
    en: "Info", th: "ข้อมูล", zh: "信息", ko: "정보", de: "Info", fr: "Info", es: "Info"
  },
  weatherLabel: {
    en: "Weather", th: "อากาศ", zh: "天气", ko: "날씨", de: "Wetter", fr: "Météo", es: "Clima"
  },
  navCompare: {
    en: "Compare", th: "เปรียบเทียบ", zh: "比较", ko: "비교", de: "Vergleich", fr: "Comparer", es: "Comparar"
  },
  compareTitle: {
    en: "Getting around Phuket", th: "เดินทางรอบภูเก็ต", zh: "畅游普吉", ko: "푸껫 이동하기", de: "Unterwegs auf Phuket", fr: "Se déplacer à Phuket", es: "Moverse por Phuket"
  },
  compareTaxi: {
    en: "Taxi", th: "แท็กซี่", zh: "出租车", ko: "택시", de: "Taxi", fr: "Taxi", es: "Taxi"
  },
  compareTukTuk: {
    en: "Tuk-tuk", th: "ตุ๊กตุ๊ก", zh: "突突车", ko: "툭툭", de: "Tuk-tuk", fr: "Tuk-tuk", es: "Tuk-tuk"
  },
  compareSmartBus: {
    en: "Smart Bus", th: "สมาร์ท บัส", zh: "智能巴士", ko: "스마트 버스", de: "Smart Bus", fr: "Smart Bus", es: "Smart Bus"
  },
  compareSave: {
    en: "You save", th: "คุณประหยัด", zh: "您节省", ko: "절약액", de: "Sie sparen", fr: "Vous économisez", es: "Usted ahorra"
  },
  comparePerPerson: {
    en: "per person", th: "ต่อคน", zh: "每人", ko: "인당", de: "pro Person", fr: "par personne", es: "por persona"
  },
  compareRiders: {
    en: "riders chose the bus today", th: "คนเลือกนั่งบัสวันนี้", zh: "人今天选择了巴士", ko: "명이 오늘 버스를 이용했습니다", de: "Fahrgäste wählten heute den Bus", fr: "voyageurs ont choisi le bus aujourd'hui", es: "pasajeros eligieron el bus hoy"
  },
  compareBestValue: {
    en: "Most riders choose", th: "คนส่วนใหญ่เลือก", zh: "多数人选择", ko: "대부분의 승객 선택", de: "Die meisten wählen", fr: "Le choix populaire", es: "La opción popular"
  },
  compareMinLabel: {
    en: "min", th: "นาที", zh: "分钟", ko: "분", de: "Min.", fr: "min", es: "min"
  },
  compareArrive: {
    en: "Arrive", th: "ถึง", zh: "到达", ko: "도착", de: "Ankunft", fr: "Arrivée", es: "Llegada"
  },
  envTemp: {
    en: "Temperature", th: "อุณหภูมิ", zh: "温度", ko: "기온", de: "Temperatur", fr: "Température", es: "Temperatura"
  },
  envAqi: {
    en: "Air quality", th: "คุณภาพอากาศ", zh: "空气质量", ko: "공기질", de: "Luftqualität", fr: "Qualité de l'air", es: "Calidad del aire"
  },
  envRain: {
    en: "Rain chance", th: "โอกาสฝน", zh: "降雨概率", ko: "비 확률", de: "Regenwahrsch.", fr: "Chance de pluie", es: "Prob. lluvia"
  },
  envGood: {
    en: "Good", th: "ดี", zh: "好", ko: "좋음", de: "Gut", fr: "Bon", es: "Bueno"
  },
  envModerate: {
    en: "Moderate", th: "ปานกลาง", zh: "中等", ko: "보통", de: "Mäßig", fr: "Modéré", es: "Moderado"
  },
  envUnhealthy: {
    en: "Unhealthy", th: "ไม่ดีต่อสุขภาพ", zh: "不健康", ko: "나쁨", de: "Ungesund", fr: "Malsain", es: "Insalubre"
  },
  busOccupancy: {
    en: "Bus occupancy", th: "ความจุรถ", zh: "公交载客", ko: "버스 혼잡도", de: "Busauslastung", fr: "Occupation du bus", es: "Ocupación del bus"
  },
  compareMostPopular: {
    en: "Most popular", th: "ยอดนิยม", zh: "最受欢迎", ko: "가장 인기", de: "Beliebteste", fr: "Le plus populaire", es: "Más popular"
  },
  locationDeniedBody: {
    en: "You can still search manually or browse the lines.",
    th: "คุณยังค้นหาเองหรือดูสายได้",
    zh: "您仍可手动搜索或浏览线路。",
    ko: "수동으로 검색하거나 노선을 탐색할 수 있습니다.",
    de: "Sie können manuell suchen oder die Linien durchsuchen.",
    fr: "Vous pouvez chercher manuellement.",
    es: "Puede buscar manualmente."
  },
  // --- Welcome sheet ---
  welcomeTitle: {
    en: "Welcome to Phuket", th: "ยินดีต้อนรับสู่ภูเก็ต", zh: "欢迎来到普吉岛", ko: "푸껫에 오신 것을 환영합니다",
    de: "Willkommen auf Phuket", fr: "Bienvenue à Phuket", es: "Bienvenido a Phuket"
  },
  welcomeSubtitle: {
    en: "Smart buses connect the island", th: "สมาร์ทบัสเชื่อมเกาะ", zh: "智能巴士连接全岛", ko: "스마트 버스가 섬을 연결합니다",
    de: "Smart Busse verbinden die Insel", fr: "Des bus intelligents relient l'île", es: "Buses inteligentes conectan la isla"
  },
  welcomeNextBus: {
    en: "Next bus", th: "บัสถัดไป", zh: "下一班车", ko: "다음 버스", de: "Nächster Bus", fr: "Prochain bus", es: "Próximo bus"
  },
  welcomeMinAway: {
    en: "min away", th: "นาที", zh: "分钟后", ko: "분 후", de: "Min. entfernt", fr: "min", es: "min"
  },
  welcomeSeats: {
    en: "seats available", th: "ที่นั่งว่าง", zh: "个空位", ko: "석 남음", de: "Plätze frei", fr: "places disponibles", es: "asientos disponibles"
  },
  welcomeRideNow: {
    en: "Ride Now", th: "ขึ้นรถเลย", zh: "立即乘车", ko: "지금 탑승", de: "Jetzt fahren", fr: "Monter maintenant", es: "Viajar ahora"
  },
  welcomeSavings: {
    en: "cheaper than a taxi", th: "ถูกกว่าแท็กซี่", zh: "比出租车便宜", ko: "택시보다 저렴", de: "günstiger als Taxi", fr: "moins cher qu'un taxi", es: "más barato que taxi"
  },
  welcomeFrom: {
    en: "From only", th: "เริ่มต้นเพียง", zh: "仅需", ko: "단", de: "Ab nur", fr: "À partir de", es: "Desde solo"
  },
  // --- Find stop ---
  findStopTitle: {
    en: "Find your stop", th: "ค้นหาป้ายรถ", zh: "查找你的站点", ko: "정류장 찾기", de: "Finde deine Haltestelle", fr: "Trouvez votre arrêt", es: "Encuentra tu parada"
  },
  findStopPlaceholder: {
    en: "Hotel, beach, or place name...", th: "ชื่อโรงแรม ชายหาด หรือสถานที่...", zh: "酒店、海滩或地名...", ko: "호텔, 해변 또는 장소명...",
    de: "Hotel, Strand oder Ort...", fr: "Hôtel, plage ou lieu...", es: "Hotel, playa o lugar..."
  },
  findStopNearest: {
    en: "Nearest stop", th: "ป้ายที่ใกล้ที่สุด", zh: "最近的站点", ko: "가장 가까운 정류장", de: "Nächste Haltestelle", fr: "Arrêt le plus proche", es: "Parada más cercana"
  },
  findStopWalkMin: {
    en: "min walk", th: "นาทีเดิน", zh: "分钟步行", ko: "분 도보", de: "Min. zu Fuß", fr: "min à pied", es: "min caminando"
  },
  // --- Request bus ---
  requestBus: {
    en: "Request Bus", th: "ขอรถบัส", zh: "请求巴士", ko: "버스 요청", de: "Bus anfordern", fr: "Demander un bus", es: "Solicitar bus"
  },
  requestSent: {
    en: "Request sent!", th: "ส่งคำขอแล้ว!", zh: "请求已发送！", ko: "요청 전송됨!", de: "Anfrage gesendet!", fr: "Demande envoyée !", es: "¡Solicitud enviada!"
  },
  requestBody: {
    en: "We'll dispatch when demand is high enough", th: "เราจะส่งรถเมื่อมีความต้องการมากพอ",
    zh: "需求足够时我们会派车", ko: "수요가 충분하면 버스를 배차합니다", de: "Wir schicken einen Bus bei genug Nachfrage",
    fr: "Nous enverrons un bus quand la demande sera suffisante", es: "Enviaremos un bus cuando la demanda sea suficiente"
  },
  // --- Compare simplified ---
  compareBusFare: {
    en: "by Smart Bus", th: "โดยสมาร์ทบัส", zh: "乘智能巴士", ko: "스마트 버스", de: "mit Smart Bus", fr: "en Smart Bus", es: "en Smart Bus"
  },
  compareTaxiFare: {
    en: "by taxi", th: "โดยแท็กซี่", zh: "打车", ko: "택시", de: "mit Taxi", fr: "en taxi", es: "en taxi"
  },
  compareSaveUpTo: {
    en: "Save up to", th: "ประหยัดสูงสุด", zh: "最多节省", ko: "최대 절약", de: "Spare bis zu", fr: "Économisez jusqu'à", es: "Ahorra hasta"
  },
  compareLoading: {
    en: "Loading prices...", th: "กำลังโหลดราคา...", zh: "正在加载价格...", ko: "가격 로딩 중...", de: "Preise laden...", fr: "Chargement des prix...", es: "Cargando precios..."
  },
  // --- Destination search flow ---
  whereToGo: {
    en: "Where do you want to go?", th: "คุณต้องการไปที่ไหน?", zh: "你想去哪里？", ko: "어디로 가시나요?",
    de: "Wohin möchten Sie?", fr: "Où voulez-vous aller ?", es: "¿Adónde quieres ir?"
  },
  whereToGoPlaceholder: {
    en: "Beach, hotel, airport...", th: "ชายหาด, โรงแรม, สนามบิน...", zh: "海滩、酒店、机场...", ko: "해변, 호텔, 공항...",
    de: "Strand, Hotel, Flughafen...", fr: "Plage, hôtel, aéroport...", es: "Playa, hotel, aeropuerto..."
  },
  bookSeat: {
    en: "Book Your Seat", th: "จองที่นั่ง", zh: "预订座位", ko: "좌석 예약",
    de: "Platz buchen", fr: "Réserver une place", es: "Reservar asiento"
  },
  seatBooked: {
    en: "Seat Reserved!", th: "จองที่นั่งแล้ว!", zh: "座位已预订！", ko: "좌석 예약됨!",
    de: "Platz reserviert!", fr: "Place réservée !", es: "¡Asiento reservado!"
  },
  bookingWarning: {
    en: "Show this QR to the driver. Seat released if you don't board before departure.",
    th: "แสดง QR นี้ต่อคนขับ ที่นั่งจะถูกปล่อยหากไม่ขึ้นรถก่อนออกเดินทาง",
    zh: "向司机出示此二维码。若未在发车前上车，座位将被释放。",
    ko: "운전기사에게 이 QR을 보여주세요. 출발 전 탑승하지 않으면 좌석이 해제됩니다.",
    de: "Zeigen Sie diesen QR dem Fahrer. Platz wird freigegeben, wenn Sie nicht vor Abfahrt einsteigen.",
    fr: "Montrez ce QR au chauffeur. Place libérée si vous ne montez pas avant le départ.",
    es: "Muestre este QR al conductor. El asiento se libera si no aborda antes de la salida."
  },
  searchAnother: {
    en: "Search another destination", th: "ค้นหาจุดหมายอื่น", zh: "搜索其他目的地", ko: "다른 목적지 검색",
    de: "Anderes Ziel suchen", fr: "Chercher une autre destination", es: "Buscar otro destino"
  },
  welcomeAllRoutes: {
    en: "flat fare · all routes", th: "ค่าโดยสารเดียว · ทุกเส้นทาง", zh: "统一票价 · 所有线路", ko: "균일 요금 · 전체 노선",
    de: "Einheitstarif · alle Routen", fr: "tarif unique · tous les itinéraires", es: "tarifa única · todas las rutas"
  },
  payOnBoard: {
    en: "Pay on board", th: "จ่ายบนรถ", zh: "上车付款", ko: "차내 결제",
    de: "Bezahlung an Bord", fr: "Paiement à bord", es: "Pago a bordo"
  },
  paymentMethods: {
    en: "Cash, Mastercard, Visa accepted", th: "รับเงินสด, Mastercard, Visa", zh: "接受现金、Mastercard、Visa", ko: "현금, 마스터카드, 비자 가능",
    de: "Bar, Mastercard, Visa akzeptiert", fr: "Espèces, Mastercard, Visa acceptés", es: "Efectivo, Mastercard, Visa aceptados"
  },
  seatHoldWarning: {
    en: "Seat held until 5 min before departure. Show barcode to driver. No-show = released to walk-ins.",
    th: "ที่นั่งจองถึง 5 นาทีก่อนออกเดินทาง แสดงบาร์โค้ดต่อคนขับ ไม่มา = ปล่อยให้ผู้โดยสาร",
    zh: "座位保留至发车前5分钟。向司机出示条码。未到=释放给候补乘客。",
    ko: "출발 5분 전까지 좌석 보류. 운전기사에게 바코드 제시. 미탑승 = 현장 대기자에게 양도.",
    de: "Platz reserviert bis 5 Min. vor Abfahrt. Barcode dem Fahrer zeigen. Nichterscheinen = freigegeben.",
    fr: "Place réservée jusqu'à 5 min avant le départ. Montrer le code-barres au chauffeur.",
    es: "Asiento reservado hasta 5 min antes de salida. Mostrar código de barras al conductor."
  },
  haveWeekPass: {
    en: "Have a Week Pass? Activate here", th: "มีบัตรสัปดาห์? เปิดใช้ที่นี่", zh: "有周票？在此激活", ko: "주간 패스가 있으신가요? 여기서 활성화",
    de: "Wochenkarte? Hier aktivieren", fr: "Pass semaine ? Activer ici", es: "¿Pase semanal? Activar aquí"
  },
  weekPassTitle: {
    en: "7-Day Unlimited Pass", th: "บัตรไม่จำกัด 7 วัน", zh: "7天无限次通票", ko: "7일 무제한 패스",
    de: "7-Tage-Unbegrenztkarte", fr: "Pass illimité 7 jours", es: "Pase ilimitado 7 días"
  },
  weekPassDesc: {
    en: "Enter your 16-digit code from the bus driver to activate unlimited rides for 7 days.",
    th: "กรอกรหัส 16 หลักจากคนขับรถเพื่อเปิดใช้การเดินทางไม่จำกัด 7 วัน",
    zh: "输入从司机处获得的16位代码，激活7天无限次乘车。",
    ko: "버스 운전기사에게 받은 16자리 코드를 입력하여 7일간 무제한 탑승을 활성화하세요.",
    de: "Geben Sie Ihren 16-stelligen Code vom Fahrer ein für unbegrenzte Fahrten (7 Tage).",
    fr: "Entrez votre code à 16 chiffres du chauffeur pour activer les trajets illimités pendant 7 jours.",
    es: "Ingrese su código de 16 dígitos del conductor para activar viajes ilimitados por 7 días."
  },
  activatePass: {
    en: "Activate Pass", th: "เปิดใช้บัตร", zh: "激活通票", ko: "패스 활성화",
    de: "Pass aktivieren", fr: "Activer le pass", es: "Activar pase"
  },
  passActive: {
    en: "Pass Active", th: "บัตรเปิดใช้แล้ว", zh: "通票已激活", ko: "패스 활성화됨",
    de: "Pass aktiv", fr: "Pass actif", es: "Pase activo"
  },
  daysRemaining: {
    en: "days remaining", th: "วันที่เหลือ", zh: "天剩余", ko: "일 남음",
    de: "Tage verbleibend", fr: "jours restants", es: "días restantes"
  },
  passUnlimited: {
    en: "Unlimited rides on all routes. Just show this screen to the driver.",
    th: "เดินทางไม่จำกัดทุกเส้นทาง แค่แสดงหน้าจอนี้ต่อคนขับ",
    zh: "所有线路无限次乘车。向司机出示此屏幕即可。",
    ko: "모든 노선 무제한 탑승. 운전기사에게 이 화면을 보여주세요.",
    de: "Unbegrenzte Fahrten auf allen Routen. Zeigen Sie dem Fahrer diesen Bildschirm.",
    fr: "Trajets illimités sur tous les itinéraires. Montrez cet écran au chauffeur.",
    es: "Viajes ilimitados en todas las rutas. Muestre esta pantalla al conductor."
  },
  backToSearch: {
    en: "Back to search", th: "กลับไปค้นหา", zh: "返回搜索", ko: "검색으로 돌아가기",
    de: "Zurück zur Suche", fr: "Retour à la recherche", es: "Volver a buscar"
  },
  heroNextBus: {
    en: "Next Bus", th: "รถบัสถัดไป", zh: "下班车", ko: "다음 버스",
    de: "Nächster Bus", fr: "Prochain bus", es: "Próximo autobús"
  },
  heroMinutes: {
    en: "min away", th: "นาที", zh: "分钟", ko: "분 후",
    de: "min entfernt", fr: "min", es: "min"
  },
  heroBusPrice: {
    en: "Smart Bus", th: "Smart Bus", zh: "Smart Bus", ko: "스마트 버스",
    de: "Smart Bus", fr: "Smart Bus", es: "Smart Bus"
  },
  heroVsGrab: {
    en: "vs Grab", th: "vs Grab", zh: "vs 出租车", ko: "vs 택시",
    de: "vs Taxi", fr: "vs Taxi", es: "vs Taxi"
  },
  heroSavings: {
    en: "savings", th: "ประหยัด", zh: "省钱", ko: "절약",
    de: "Ersparnis", fr: "économies", es: "ahorros"
  },
  heroRequestBus: {
    en: "Request Bus", th: "เรียกรถบัส", zh: "呼叫巴士", ko: "버스 요청",
    de: "Bus anfordern", fr: "Demander un bus", es: "Solicitar autobús"
  }
} satisfies Record<string, LocalizedText>;

export function pick(value: LocalizedText, lang: Lang) {
  return value[lang];
}

export function formatUpdateTime(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(LOCALE_MAP[lang], {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function formatSourceDate(value: string | null, lang: Lang) {
  if (!value) {
    const fallbacks: Record<Lang, string> = {
      en: "Not listed", th: "ไม่ระบุ", zh: "未列出", ko: "미기재",
      de: "Nicht angegeben", fr: "Non indiqué", es: "No indicado"
    };
    return fallbacks[lang];
  }

  return new Intl.DateTimeFormat(LOCALE_MAP[lang], {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}