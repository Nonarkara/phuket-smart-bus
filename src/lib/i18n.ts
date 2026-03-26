import type { Lang, LocalizedText } from "@shared/types";

const LOCALE_MAP: Record<Lang, string> = {
  en: "en-GB",
  th: "th-TH",
  zh: "zh-CN",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES"
};

export const ui = {
  appTitle: {
    en: "Phuket Smart Bus",
    th: "ภูเก็ต สมาร์ท บัส",
    zh: "普吉智能巴士",
    de: "Phuket Smart Bus",
    fr: "Phuket Smart Bus",
    es: "Phuket Smart Bus"
  },
  appSubtitle: {
    en: "Live bus tracker",
    th: "ติดตามรถบัสสด",
    zh: "实时巴士追踪",
    de: "Live-Bus-Tracker",
    fr: "Suivi de bus en direct",
    es: "Seguimiento de bus en vivo"
  },
  airportBoardingAction: {
    en: "Open boarding stop", th: "เปิดจุดขึ้นรถ", zh: "打开登车站", de: "Einstiegshaltestelle öffnen", fr: "Ouvrir l'arrêt d'embarquement", es: "Abrir parada de embarque"
  },
  airportBusFareLabel: {
    en: "Smart Bus", th: "Smart Bus", zh: "Smart Bus", de: "Smart Bus", fr: "Smart Bus", es: "Smart Bus"
  },
  airportSavingsTitle: {
    en: "Why tourists switch", th: "ทำไมนักท่องเที่ยวถึงเปลี่ยนใจ", zh: "为什么游客会选择", de: "Warum Touristen wechseln", fr: "Pourquoi les touristes changent", es: "Por qué los turistas cambian"
  },
  airportTaxiFareLabel: {
    en: "Taxi", th: "แท็กซี่", zh: "出租车", de: "Taxi", fr: "Taxi", es: "Taxi"
  },
  airportWalkTitle: {
    en: "Walk to the stop", th: "เดินไปที่ป้าย", zh: "步行到站", de: "Zur Haltestelle laufen", fr: "Marcher jusqu'à l'arrêt", es: "Caminar a la parada"
  },
  airportWeatherTitle: {
    en: "Rain risk", th: "ความเสี่ยงฝน", zh: "降雨风险", de: "Regenrisiko", fr: "Risque de pluie", es: "Riesgo de lluvia"
  },
  airportWeatherRainChanceLabel: {
    en: "Rain chance", th: "โอกาสฝน", zh: "降雨概率", de: "Regenwahrscheinlichkeit", fr: "Chance de pluie", es: "Probabilidad de lluvia"
  },
  airportWeatherRainfallLabel: {
    en: "Rain now", th: "ปริมาณฝนตอนนี้", zh: "当前降雨", de: "Regen jetzt", fr: "Pluie actuelle", es: "Lluvia actual"
  },
  clockLabel: {
    en: "Phuket time",
    th: "เวลาภูเก็ต",
    zh: "普吉时间",
    de: "Phuket-Zeit",
    fr: "Heure de Phuket",
    es: "Hora de Phuket"
  },
  navMap: {
    en: "Map",
    th: "แผนที่",
    zh: "地图",
    de: "Karte",
    fr: "Carte",
    es: "Mapa"
  },
  navStops: {
    en: "Stops",
    th: "ป้าย",
    zh: "站点",
    de: "Haltestellen",
    fr: "Arrêts",
    es: "Paradas"
  },
  navPass: {
    en: "Pass",
    th: "บัตร",
    zh: "通行证",
    de: "Pass",
    fr: "Pass",
    es: "Pase"
  },
  navRide: {
    en: "My stop",
    th: "ป้ายของฉัน",
    zh: "我的站",
    de: "Meine Haltestelle",
    fr: "Mon arrêt",
    es: "Mi parada"
  },
  navQr: {
    en: "My QR",
    th: "คิวอาร์ของฉัน",
    zh: "我的二维码",
    de: "Mein QR",
    fr: "Mon QR",
    es: "Mi QR"
  },
  navAirport: {
    en: "Airport",
    th: "สนามบิน",
    zh: "机场",
    de: "Flughafen",
    fr: "Aéroport",
    es: "Aeropuerto"
  },
  whyBusTitle: {
    en: "Why take the bus",
    th: "ทำไมต้องนั่งบัส",
    zh: "为什么乘巴士",
    de: "Warum Bus fahren",
    fr: "Pourquoi prendre le bus",
    es: "Por qué tomar el bus"
  },
  routeAll: {
    en: "All lines",
    th: "ทุกสาย",
    zh: "所有线路",
    de: "Alle Linien",
    fr: "Toutes les lignes",
    es: "Todas las líneas"
  },
  mapModeRoute: {
    en: "Route view",
    th: "ดูทั้งเส้นทาง",
    zh: "线路视图",
    de: "Routenansicht",
    fr: "Vue itinéraire",
    es: "Vista de ruta"
  },
  mapModeStop: {
    en: "Stop focus",
    th: "โฟกัสป้าย",
    zh: "站点聚焦",
    de: "Haltestellenfokus",
    fr: "Focus arrêt",
    es: "Enfoque parada"
  },
  mapLiveCountLabel: {
    en: "vehicles live",
    th: "คันออนไลน์",
    zh: "辆交通在线",
    de: "Fahrzeuge live",
    fr: "véhicules en direct",
    es: "buses en vivo"
  },
  stopTitle: {
    en: "Choose a stop",
    th: "เลือกป้าย",
    zh: "选择站点",
    de: "Haltestelle wählen",
    fr: "Choisir un arrêt",
    es: "Elegir una parada"
  },
  searchPlaceholder: {
    en: "Search stop or landmark",
    th: "ค้นหาป้ายหรือจุดสังเกต",
    zh: "搜索站点或地标",
    de: "Haltestelle oder Ort suchen",
    fr: "Chercher arrêt ou lieu",
    es: "Buscar parada o lugar"
  },
  stopEmpty: {
    en: "No stops match this search.",
    th: "ไม่พบป้ายที่ตรงกับคำค้นหา",
    zh: "没有匹配的站点。",
    de: "Keine passenden Haltestellen.",
    fr: "Aucun arrêt trouvé.",
    es: "No se encontraron paradas."
  },
  nextBusLabel: {
    en: "Next bus",
    th: "รถคันถัดไป",
    zh: "下一班车",
    de: "Nächster Bus",
    fr: "Prochain bus",
    es: "Próximo bus"
  },
  liveBusesLabel: {
    en: "Live buses",
    th: "รถที่ออนไลน์",
    zh: "在线巴士",
    de: "Live-Busse",
    fr: "Bus en direct",
    es: "Buses en vivo"
  },
  activeAlertsLabel: {
    en: "Active alerts",
    th: "คำเตือนที่ใช้งานอยู่",
    zh: "活跃警报",
    de: "Aktive Warnungen",
    fr: "Alertes actives",
    es: "Alertas activas"
  },
  timetableTitle: {
    en: "Published timetable",
    th: "ตารางเวลาที่เผยแพร่",
    zh: "公布时刻表",
    de: "Veröffentlichter Fahrplan",
    fr: "Horaires publiés",
    es: "Horario publicado"
  },
  timetableFirst: {
    en: "First bus",
    th: "เที่ยวแรก",
    zh: "首班车",
    de: "Erster Bus",
    fr: "Premier bus",
    es: "Primer bus"
  },
  timetableLast: {
    en: "Last bus",
    th: "เที่ยวสุดท้าย",
    zh: "末班车",
    de: "Letzter Bus",
    fr: "Dernier bus",
    es: "Último bus"
  },
  timetableWindow: {
    en: "Service window",
    th: "ช่วงเวลาให้บริการ",
    zh: "服务时段",
    de: "Betriebszeit",
    fr: "Heures de service",
    es: "Horario de servicio"
  },
  timetableNext: {
    en: "Next scheduled",
    th: "รอบถัดไปตามตาราง",
    zh: "下一班计划",
    de: "Nächste planmäßig",
    fr: "Prochain prévu",
    es: "Próximo programado"
  },
  timetableUpdated: {
    en: "Updated",
    th: "อัปเดต",
    zh: "更新于",
    de: "Aktualisiert",
    fr: "Mis à jour",
    es: "Actualizado"
  },
  timetableSource: {
    en: "Source",
    th: "แหล่งข้อมูล",
    zh: "来源",
    de: "Quelle",
    fr: "Source",
    es: "Fuente"
  },
  timetableOpenSource: {
    en: "Open source",
    th: "เปิดแหล่งข้อมูล",
    zh: "打开来源",
    de: "Quelle öffnen",
    fr: "Ouvrir la source",
    es: "Abrir fuente"
  },
  advisoryTitle: {
    en: "Service alerts",
    th: "คำเตือนบริการ",
    zh: "服务提醒",
    de: "Servicemeldungen",
    fr: "Alertes de service",
    es: "Alertas de servicio"
  },
  advisoryWarning: {
    en: "Warning",
    th: "เตือนด่วน",
    zh: "警告",
    de: "Warnung",
    fr: "Avertissement",
    es: "Advertencia"
  },
  advisoryCaution: {
    en: "Caution",
    th: "ระวัง",
    zh: "注意",
    de: "Vorsicht",
    fr: "Prudence",
    es: "Precaución"
  },
  advisoryInfo: {
    en: "Info",
    th: "ข้อมูล",
    zh: "信息",
    de: "Info",
    fr: "Info",
    es: "Info"
  },
  advisoryNone: {
    en: "No active alerts right now.",
    th: "ขณะนี้ไม่มีคำเตือน",
    zh: "目前没有活跃警报。",
    de: "Derzeit keine Warnungen.",
    fr: "Aucune alerte active.",
    es: "Sin alertas activas."
  },
  passEyebrow: {
    en: "Boarding pass",
    th: "บัตรโดยสาร",
    zh: "登车券",
    de: "Fahrkarte",
    fr: "Carte d'embarquement",
    es: "Tarjeta de embarque"
  },
  passTitle: {
    en: "My QR code",
    th: "คิวอาร์โค้ดของฉัน",
    zh: "我的二维码",
    de: "Mein QR-Code",
    fr: "Mon code QR",
    es: "Mi código QR"
  },
  passBody: {
    en: "Mock day-pass and 7-day-pass with live countdown.",
    th: "จำลองตั๋ว 1 วันและ 7 วัน พร้อมนับถอยหลัง",
    zh: "模拟日票和7日票，实时倒计时。",
    de: "Demo-Tages- und 7-Tage-Pass mit Countdown.",
    fr: "Pass journée et 7 jours avec compte à rebours.",
    es: "Pase de día y 7 días con cuenta regresiva."
  },
  passDayLabel: {
    en: "24h pass",
    th: "ตั๋ว 24 ชม.",
    zh: "24小时票",
    de: "24h-Pass",
    fr: "Pass 24h",
    es: "Pase 24h"
  },
  passWeekLabel: {
    en: "7-day pass",
    th: "ตั๋ว 7 วัน",
    zh: "7日票",
    de: "7-Tage-Pass",
    fr: "Pass 7 jours",
    es: "Pase 7 días"
  },
  passActiveLabel: {
    en: "Active now",
    th: "กำลังใช้งาน",
    zh: "使用中",
    de: "Jetzt aktiv",
    fr: "Actif maintenant",
    es: "Activo ahora"
  },
  passExpiredLabel: {
    en: "Expired",
    th: "หมดอายุ",
    zh: "已过期",
    de: "Abgelaufen",
    fr: "Expiré",
    es: "Expirado"
  },
  passCountdownLabel: {
    en: "Time left",
    th: "เวลาคงเหลือ",
    zh: "剩余时间",
    de: "Verbleibend",
    fr: "Temps restant",
    es: "Tiempo restante"
  },
  passActivatedLabel: {
    en: "Activated",
    th: "เริ่มใช้งาน",
    zh: "已激活",
    de: "Aktiviert",
    fr: "Activé",
    es: "Activado"
  },
  passValidUntilLabel: {
    en: "Valid until",
    th: "ใช้ได้ถึง",
    zh: "有效期至",
    de: "Gültig bis",
    fr: "Valide jusqu'au",
    es: "Válido hasta"
  },
  passQrTitle: {
    en: "QR boarding code",
    th: "คิวอาร์สำหรับขึ้นรถ",
    zh: "二维码登车码",
    de: "QR-Boardingcode",
    fr: "Code QR d'embarquement",
    es: "Código QR de embarque"
  },
  passQrBody: {
    en: "Show this code when boarding.",
    th: "แสดงโค้ดนี้ตอนขึ้นรถ",
    zh: "上车时出示此码。",
    de: "Zeigen Sie diesen Code beim Einsteigen.",
    fr: "Montrez ce code à l'embarquement.",
    es: "Muestre este código al abordar."
  },
  routeLiveUnit: {
    en: "live",
    th: "ออนไลน์",
    zh: "在线",
    de: "live",
    fr: "en direct",
    es: "en vivo"
  },
  routeStopsUnit: {
    en: "stops",
    th: "ป้าย",
    zh: "站",
    de: "Haltestellen",
    fr: "arrêts",
    es: "paradas"
  },
  routeDirectionLabel: {
    en: "Direction",
    th: "ทิศทาง",
    zh: "方向",
    de: "Richtung",
    fr: "Direction",
    es: "Dirección"
  },
  walkLabel: {
    en: "Walk",
    th: "เดิน",
    zh: "步行",
    de: "Zu Fuß",
    fr: "Marche",
    es: "Caminar"
  },
  openMaps: {
    en: "Open in Maps",
    th: "เปิดในแผนที่",
    zh: "在地图中打开",
    de: "In Karten öffnen",
    fr: "Ouvrir dans Maps",
    es: "Abrir en Mapas"
  },
  nearby: {
    en: "Nearby landmark",
    th: "จุดสังเกตใกล้เคียง",
    zh: "附近地标",
    de: "Nahegelegenes Wahrzeichen",
    fr: "Lieu proche",
    es: "Punto de referencia cercano"
  },
  sourceBus: {
    en: "Bus feed",
    th: "ข้อมูลรถ",
    zh: "巴士数据",
    de: "Bus-Feed",
    fr: "Flux bus",
    es: "Datos de bus"
  },
  sourceTraffic: {
    en: "Traffic",
    th: "จราจร",
    zh: "交通",
    de: "Verkehr",
    fr: "Trafic",
    es: "Tráfico"
  },
  sourceWeather: {
    en: "Weather",
    th: "อากาศ",
    zh: "天气",
    de: "Wetter",
    fr: "Météo",
    es: "Clima"
  },
  mapLoading: {
    en: "Loading route data...",
    th: "กำลังโหลดข้อมูลเส้นทาง...",
    zh: "加载线路数据...",
    de: "Routendaten werden geladen...",
    fr: "Chargement des données...",
    es: "Cargando datos de ruta..."
  },
  loadingError: {
    en: "Live data is taking longer than expected. Use the published timetable.",
    th: "ข้อมูลสดใช้เวลานานกว่าปกติ ให้ใช้ตารางเวลา",
    zh: "实时数据加载较慢，请使用时刻表。",
    de: "Live-Daten laden langsam. Nutzen Sie den Fahrplan.",
    fr: "Les données en direct sont lentes. Utilisez l'horaire.",
    es: "Los datos en vivo tardan. Use el horario publicado."
  },
  decisionUnavailableTitle: {
    en: "Live guidance unavailable",
    th: "ยังไม่มีคำแนะนำสด",
    zh: "实时引导不可用",
    de: "Live-Empfehlung nicht verfügbar",
    fr: "Guide en direct indisponible",
    es: "Guía en vivo no disponible"
  },
  decisionUnavailableBody: {
    en: "Use the next scheduled bus and timetable below.",
    th: "ใช้เวลารถคันถัดไปและตารางเวลาด้านล่าง",
    zh: "请参考下方时刻表。",
    de: "Nutzen Sie den Fahrplan unten.",
    fr: "Consultez l'horaire ci-dessous.",
    es: "Consulte el horario abajo."
  },
  footerCopyright: {
    en: "© 2026 Dr. Non Arkaraprasertkul",
    th: "© 2026 Dr. Non Arkaraprasertkul",
    zh: "© 2026 Dr. Non Arkaraprasertkul",
    de: "© 2026 Dr. Non Arkaraprasertkul",
    fr: "© 2026 Dr. Non Arkaraprasertkul",
    es: "© 2026 Dr. Non Arkaraprasertkul"
  },
  locationYouAreHere: {
    en: "You are here",
    th: "คุณอยู่ที่นี่",
    zh: "你在这里",
    de: "Sie sind hier",
    fr: "Vous êtes ici",
    es: "Usted está aquí"
  },
  mapSelectionLabel: {
    en: "Selected stop",
    th: "ป้ายที่เลือก",
    zh: "已选站点",
    de: "Ausgewählte Haltestelle",
    fr: "Arrêt sélectionné",
    es: "Parada seleccionada"
  },
  sourceTitle: {
    en: "Source health",
    th: "สถานะข้อมูล",
    zh: "数据源状态",
    de: "Datenquellenstatus",
    fr: "État des sources",
    es: "Estado de fuentes"
  },
  heroTitle: {
    en: "Should I leave now?",
    th: "ควรออกตอนนี้ไหม?",
    zh: "现在该出发吗？",
    de: "Soll ich jetzt los?",
    fr: "Dois-je partir maintenant ?",
    es: "¿Debo salir ahora?"
  },
  ridePageTitle: {
    en: "Stop details",
    th: "รายละเอียดป้าย",
    zh: "站点详情",
    de: "Haltestellendetails",
    fr: "Détails de l'arrêt",
    es: "Detalles de la parada"
  },
  journeyRoute: {
    en: "Route",
    th: "เส้นทาง",
    zh: "线路",
    de: "Route",
    fr: "Itinéraire",
    es: "Ruta"
  },
  journeyStop: {
    en: "Stop",
    th: "ป้าย",
    zh: "站",
    de: "Haltestelle",
    fr: "Arrêt",
    es: "Parada"
  },
  journeyDecision: {
    en: "Decision",
    th: "คำแนะนำ",
    zh: "建议",
    de: "Empfehlung",
    fr: "Décision",
    es: "Decisión"
  },
  journeyChooseStop: {
    en: "Choose a stop",
    th: "เลือกป้าย",
    zh: "选择站点",
    de: "Haltestelle wählen",
    fr: "Choisir un arrêt",
    es: "Elegir parada"
  },
  journeyPending: {
    en: "Waiting for live guidance",
    th: "กำลังรอคำแนะนำสด",
    zh: "等待实时引导",
    de: "Warte auf Live-Empfehlung",
    fr: "En attente du guide en direct",
    es: "Esperando guía en vivo"
  },
  passCountdownBody: {
    en: "Clock starts at activation and runs until expiry.",
    th: "เวลาเริ่มนับเมื่อเปิดใช้งาน",
    zh: "激活后开始计时直至到期。",
    de: "Countdown beginnt bei Aktivierung.",
    fr: "Le décompte commence à l'activation.",
    es: "La cuenta regresiva comienza al activar."
  },
  mapTitle: {
    en: "Live network map",
    th: "แผนที่เครือข่ายแบบสด",
    zh: "实时网络地图",
    de: "Live-Netzwerkkarte",
    fr: "Carte réseau en direct",
    es: "Mapa de red en vivo"
  },
  mapNetworkLabel: {
    en: "All lines",
    th: "ทุกสาย",
    zh: "所有线路",
    de: "Alle Linien",
    fr: "Toutes les lignes",
    es: "Todas las líneas"
  },
  mapAllLinesTitle: {
    en: "Airport Line + Patong Line",
    th: "สายสนามบิน + สายป่าตอง",
    zh: "机场线 + 芭东线",
    de: "Flughafenlinie + Patong-Linie",
    fr: "Ligne aéroport + Ligne Patong",
    es: "Línea aeropuerto + Línea Patong"
  },
  mapFocusLabel: {
    en: "Line focus",
    th: "โฟกัสเส้นทาง",
    zh: "线路聚焦",
    de: "Linienfokus",
    fr: "Focus ligne",
    es: "Enfoque línea"
  },
  routeRail: {
    en: "Core lines",
    th: "สายหลัก",
    zh: "主线路",
    de: "Hauptlinien",
    fr: "Lignes principales",
    es: "Líneas principales"
  },
  locationOpenMap: {
    en: "Open live map",
    th: "เปิดแผนที่สด",
    zh: "打开实时地图",
    de: "Live-Karte öffnen",
    fr: "Ouvrir la carte",
    es: "Abrir mapa en vivo"
  },
  locationDeniedTitle: {
    en: "Location blocked",
    th: "ไม่ได้รับอนุญาตตำแหน่ง",
    zh: "位置被阻止",
    de: "Standort blockiert",
    fr: "Localisation bloquée",
    es: "Ubicación bloqueada"
  },
  navMore: {
    en: "More", th: "เพิ่มเติม", zh: "更多", de: "Mehr", fr: "Plus", es: "Más"
  },
  weatherLabel: {
    en: "Weather", th: "อากาศ", zh: "天气", de: "Wetter", fr: "Météo", es: "Clima"
  },
  navCompare: {
    en: "Compare", th: "เปรียบเทียบ", zh: "比较", de: "Vergleich", fr: "Comparer", es: "Comparar"
  },
  compareTitle: {
    en: "Getting around Phuket", th: "เดินทางรอบภูเก็ต", zh: "畅游普吉", de: "Unterwegs auf Phuket", fr: "Se déplacer à Phuket", es: "Moverse por Phuket"
  },
  compareTaxi: {
    en: "Taxi", th: "แท็กซี่", zh: "出租车", de: "Taxi", fr: "Taxi", es: "Taxi"
  },
  compareTukTuk: {
    en: "Tuk-tuk", th: "ตุ๊กตุ๊ก", zh: "突突车", de: "Tuk-tuk", fr: "Tuk-tuk", es: "Tuk-tuk"
  },
  compareSmartBus: {
    en: "Smart Bus", th: "สมาร์ท บัส", zh: "智能巴士", de: "Smart Bus", fr: "Smart Bus", es: "Smart Bus"
  },
  compareSave: {
    en: "You save", th: "คุณประหยัด", zh: "您节省", de: "Sie sparen", fr: "Vous économisez", es: "Usted ahorra"
  },
  comparePerPerson: {
    en: "per person", th: "ต่อคน", zh: "每人", de: "pro Person", fr: "par personne", es: "por persona"
  },
  compareRiders: {
    en: "riders chose the bus today", th: "คนเลือกนั่งบัสวันนี้", zh: "人今天选择了巴士", de: "Fahrgäste wählten heute den Bus", fr: "voyageurs ont choisi le bus aujourd'hui", es: "pasajeros eligieron el bus hoy"
  },
  compareMinLabel: {
    en: "min", th: "นาที", zh: "分钟", de: "Min.", fr: "min", es: "min"
  },
  compareMostPopular: {
    en: "Most popular", th: "ยอดนิยม", zh: "最受欢迎", de: "Beliebteste", fr: "Le plus populaire", es: "Más popular"
  },
  locationDeniedBody: {
    en: "You can still search manually or browse the lines.",
    th: "คุณยังค้นหาเองหรือดูสายได้",
    zh: "您仍可手动搜索或浏览线路。",
    de: "Sie können manuell suchen oder die Linien durchsuchen.",
    fr: "Vous pouvez chercher manuellement.",
    es: "Puede buscar manualmente."
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
      en: "Not listed", th: "ไม่ระบุ", zh: "未列出",
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
