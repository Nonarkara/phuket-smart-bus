import type {
  CompetitorBenchmark,
  CompetitorRouteId,
  LocalizedText,
  OperationalRouteId,
  OperationalRouteTier,
  RouteAxis
} from "@shared/types";
import { text } from "./i18n";

export const BANGKOK_TIME_ZONE = "Asia/Bangkok";
export const APP_VERSION = "1.0.0";

export const OPERATIONAL_ROUTE_IDS: OperationalRouteId[] = [
  "rawai-airport",
  "patong-old-bus-station",
  "dragon-line",
  "rassada-phi-phi",
  "rassada-ao-nang",
  "bang-rong-koh-yao",
  "chalong-racha"
];

export const FERRY_ROUTE_IDS: OperationalRouteId[] = [
  "rassada-phi-phi",
  "rassada-ao-nang",
  "bang-rong-koh-yao",
  "chalong-racha"
];

export const ROUTE_DEFINITIONS: Record<
  OperationalRouteId,
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
    tier: OperationalRouteTier;
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
  },
  "rassada-phi-phi": {
    sourceRoute: "rassada_phi_phi",
    lineFile: "rassada_phi_phi_line.geojson",
    color: "#2196F3",
    accentColor: "#e3f2fd",
    name: text("Rassada Pier - Phi Phi Island", "ท่าเรือรัษฎา - เกาะพีพี", "拉萨达码头 - 皮皮岛", "Rassada Pier - Phi Phi Insel", "Quai Rassada - Île Phi Phi", "Muelle Rassada - Isla Phi Phi"),
    shortName: text("Phi Phi Ferry", "เรือพีพี", "皮皮渡轮", "Phi Phi Fähre", "Ferry Phi Phi", "Ferry Phi Phi"),
    overview: text("Main ferry route to Phi Phi Islands. Multiple daily departures by several operators.", "เส้นทางเรือหลักไปเกาะพีพี มีหลายเที่ยวต่อวันจากหลายบริษัท", "前往皮皮岛的主要渡轮航线。多家运营商每日多班次。", "Hauptfährroute zu den Phi Phi Inseln. Mehrere tägliche Abfahrten.", "Principale ligne de ferry vers Phi Phi. Plusieurs départs quotidiens.", "Ruta principal de ferry a Phi Phi. Múltiples salidas diarias."),
    axis: "marine",
    axisLabel: text("Andaman Sea crossing", "ข้ามทะเลอันดามัน", "安达曼海航线", "Andamanensee-Überfahrt", "Traversée mer d'Andaman", "Cruce mar de Andamán"),
    tier: "ferry",
    defaultStopName: "Rassada Pier",
    timetableSource: {
      label: text("Rassada Pier ferry schedule", "ตารางเรือท่าเรือรัษฎา", "拉萨达码头渡轮时刻表", "Rassada Pier Fährfahrplan", "Horaire ferry Quai Rassada", "Horario ferry Muelle Rassada"),
      url: "https://rassadapier.net/z_phuket_ferry_schedule.php",
      updatedAt: "2025-03-01",
      notes: text("Schedule from Andaman Wave Master, Phi Phi Cruiser & Chaokoh Ferry operators.", "ตารางจาก Andaman Wave Master, Phi Phi Cruiser และ Chaokoh Ferry")
    }
  },
  "rassada-ao-nang": {
    sourceRoute: "rassada_ao_nang",
    lineFile: "rassada_ao_nang_line.geojson",
    color: "#9C27B0",
    accentColor: "#f3e5f5",
    name: text("Rassada Pier - Ao Nang (Krabi)", "ท่าเรือรัษฎา - อ่าวนาง (กระบี่)", "拉萨达码头 - 奥南 (甲米)", "Rassada Pier - Ao Nang (Krabi)", "Quai Rassada - Ao Nang (Krabi)", "Muelle Rassada - Ao Nang (Krabi)"),
    shortName: text("Ao Nang Ferry", "เรืออ่าวนาง", "奥南渡轮", "Ao Nang Fähre", "Ferry Ao Nang", "Ferry Ao Nang"),
    overview: text("Direct ferry to Ao Nang and Railay Beach in Krabi province.", "เรือตรงไปอ่าวนางและหาดไร่เลย์ จังหวัดกระบี่", "直达甲米府奥南和莱利海滩的渡轮。", "Direktfähre nach Ao Nang und Railay Beach in Krabi.", "Ferry direct vers Ao Nang et Railay Beach à Krabi.", "Ferry directo a Ao Nang y Railay Beach en Krabi."),
    axis: "marine",
    axisLabel: text("Phang Nga Bay crossing", "ข้ามอ่าวพังงา", "攀牙湾航线", "Phang Nga Bucht-Überfahrt", "Traversée baie de Phang Nga", "Cruce bahía de Phang Nga"),
    tier: "ferry",
    defaultStopName: "Rassada Pier",
    timetableSource: {
      label: text("Rassada Pier ferry schedule", "ตารางเรือท่าเรือรัษฎา"),
      url: "https://rassadapier.net/z_phuket_ferry_schedule.php",
      updatedAt: "2025-03-01",
      notes: text("Daily ferry service, one departure morning, return afternoon.", "บริการเรือรายวัน ออกเช้า กลับบ่าย")
    }
  },
  "bang-rong-koh-yao": {
    sourceRoute: "bang_rong_koh_yao",
    lineFile: "bang_rong_koh_yao_line.geojson",
    color: "#FF9800",
    accentColor: "#fff3e0",
    name: text("Bang Rong Pier - Koh Yao Noi", "ท่าเรือบางโรง - เกาะยาวน้อย", "邦荣码头 - 瑶诺岛", "Bang Rong Pier - Koh Yao Noi", "Quai Bang Rong - Koh Yao Noi", "Muelle Bang Rong - Koh Yao Noi"),
    shortName: text("Koh Yao Ferry", "เรือเกาะยาว", "瑶岛渡轮", "Koh Yao Fähre", "Ferry Koh Yao", "Ferry Koh Yao"),
    overview: text("Speedboat service to Koh Yao Noi island in Phang Nga Bay.", "บริการสปีดโบทไปเกาะยาวน้อยในอ่าวพังงา", "前往攀牙湾瑶诺岛的快艇服务。", "Schnellbootservice nach Koh Yao Noi in der Phang Nga Bucht.", "Service de speedboat vers Koh Yao Noi dans la baie de Phang Nga.", "Servicio de lancha rápida a Koh Yao Noi en la bahía de Phang Nga."),
    axis: "marine",
    axisLabel: text("Phang Nga Bay crossing", "ข้ามอ่าวพังงา", "攀牙湾航线", "Phang Nga Bucht-Überfahrt", "Traversée baie de Phang Nga", "Cruce bahía de Phang Nga"),
    tier: "ferry",
    defaultStopName: "Bang Rong Pier",
    timetableSource: {
      label: text("Bang Rong Pier schedule", "ตารางเรือท่าเรือบางโรง"),
      url: "https://www.bangrongpier.com/schedule.php",
      updatedAt: "2025-03-01",
      notes: text("Speedboat departures 4 times daily.", "สปีดโบทออก 4 เที่ยวต่อวัน")
    }
  },
  "chalong-racha": {
    sourceRoute: "chalong_racha",
    lineFile: "chalong_racha_line.geojson",
    color: "#E91E63",
    accentColor: "#fce4ec",
    name: text("Chalong Pier - Racha Island", "ท่าเรือฉลอง - เกาะราชา", "查龙码头 - 拉查岛", "Chalong Pier - Racha Insel", "Quai Chalong - Île Racha", "Muelle Chalong - Isla Racha"),
    shortName: text("Racha Ferry", "เรือราชา", "拉查渡轮", "Racha Fähre", "Ferry Racha", "Ferry Racha"),
    overview: text("Speedboat to Racha Yai island, popular for diving and beaches.", "สปีดโบทไปเกาะราชาใหญ่ ยอดนิยมสำหรับดำน้ำและชายหาด", "前往拉查大岛的快艇，以潜水和海滩闻名。", "Schnellboot zur Racha Yai Insel, beliebt zum Tauchen.", "Speedboat vers Racha Yai, populaire pour la plongée.", "Lancha rápida a Racha Yai, popular para buceo y playas."),
    axis: "marine",
    axisLabel: text("Andaman Sea crossing", "ข้ามทะเลอันดามัน", "安达曼海航线", "Andamanensee-Überfahrt", "Traversée mer d'Andaman", "Cruce mar de Andamán"),
    tier: "ferry",
    defaultStopName: "Chalong Pier",
    timetableSource: {
      label: text("Chalong Pier schedule", "ตารางเรือท่าเรือฉลอง"),
      url: "https://www.phuketferry.com/chalong-pier.html",
      updatedAt: "2025-03-01",
      notes: text("Resort boat and tour speedboat departures.", "เรือรีสอร์ทและสปีดโบททัวร์")
    }
  }
};

// Realistic 2025 Phuket prices: Grab/taxi from airport is 600-1500 THB.
// Tuk-tuks are unmetered, unregulated, and notoriously overpriced for tourists.
// Wide tuk-tuk range implies "you WILL have to bargain" — plus luggage fees, tips.
// Smart Bus: 100 THB flat fare for airport line, 50 THB for local lines.
export const PRICE_COMPARISONS = [
  {
    destinationId: "airport",
    destinationName: text("Airport", "สนามบิน", "机场", "Flughafen", "Aéroport", "Aeropuerto"),
    taxi: { minThb: 800, maxThb: 1500, minutes: 45 },
    tukTuk: { minThb: 500, maxThb: 4000, minutes: 55 },
    bus: { fareThb: 100, minutes: 75, routeId: "rawai-airport" as OperationalRouteId },
  },
  {
    destinationId: "patong",
    destinationName: text("Patong Beach", "หาดป่าตอง", "芭东海滩", "Patong Strand", "Plage de Patong", "Playa Patong"),
    taxi: { minThb: 600, maxThb: 1000, minutes: 30 },
    tukTuk: { minThb: 500, maxThb: 3000, minutes: 40 },
    bus: { fareThb: 100, minutes: 50, routeId: "rawai-airport" as OperationalRouteId },
  },
  {
    destinationId: "kata",
    destinationName: text("Kata Beach", "หาดกะตะ", "卡塔海滩", "Kata Strand", "Plage de Kata", "Playa Kata"),
    taxi: { minThb: 500, maxThb: 900, minutes: 25 },
    tukTuk: { minThb: 400, maxThb: 2500, minutes: 35 },
    bus: { fareThb: 100, minutes: 40, routeId: "rawai-airport" as OperationalRouteId },
  },
  {
    destinationId: "oldtown",
    destinationName: text("Old Town", "เมืองเก่า", "老城", "Altstadt", "Vieille ville", "Casco antiguo"),
    taxi: { minThb: 400, maxThb: 700, minutes: 15 },
    tukTuk: { minThb: 300, maxThb: 1500, minutes: 20 },
    bus: { fareThb: 50, minutes: 25, routeId: "patong-old-bus-station" as OperationalRouteId },
  },
  {
    destinationId: "rassada",
    destinationName: text("Rassada Pier", "ท่าเรือรัษฎา", "拉萨达码头", "Rassada Pier", "Quai Rassada", "Muelle Rassada"),
    taxi: { minThb: 500, maxThb: 800, minutes: 20 },
    tukTuk: { minThb: 400, maxThb: 2000, minutes: 25 },
    bus: { fareThb: 100, minutes: 35, routeId: "rawai-airport" as OperationalRouteId },
  },
  {
    destinationId: "central",
    destinationName: text("Central Festival", "เซ็นทรัล เฟสติวัล", "中央节日广场", "Central Festival", "Central Festival", "Central Festival"),
    taxi: { minThb: 400, maxThb: 700, minutes: 15 },
    tukTuk: { minThb: 300, maxThb: 1500, minutes: 20 },
    bus: { fareThb: 100, minutes: 30, routeId: "rawai-airport" as OperationalRouteId },
  },
];

export const COMPETITOR_ROUTE_IDS: CompetitorRouteId[] = ["orange-line"];

export const COMPETITOR_BENCHMARKS: Record<CompetitorRouteId, Omit<CompetitorBenchmark, "estimatedDemand" | "seatSupply" | "carriedRiders" | "revenueThb" | "capturePct">> = {
  "orange-line": {
    routeId: "orange-line",
    routeName: text(
      "Orange Line (Government)",
      "สายสีส้ม (ภาครัฐ)",
      "橙线（政府）",
      "Orange Line (Staat)",
      "Orange Line (gouvernement)",
      "Orange Line (gobierno)"
    ),
    tier: "competitor",
    operatorLabel: "Government-operated",
    fareThb: 100,
    headwayMinutes: 60,
    tripDurationMinutes: 90,
    overlapRouteIds: ["rawai-airport", "dragon-line"],
    provenance: "estimated",
    notes: text(
      "Benchmark competitor on the Airport to Phuket Town corridor.",
      "คู่เทียบเชิงกลยุทธ์บนคอร์ริดอร์สนามบินถึงเมืองภูเก็ต"
    )
  }
};
