import type {
  Advisory,
  DataSourceStatus,
  DecisionLevel,
  DecisionSummary,
  EnvironmentContext,
  RouteId,
  Stop,
  VehiclePosition
} from "../../shared/types.js";
import { haversineDistanceMeters } from "../lib/geo.js";
import { text } from "../lib/i18n.js";
import { estimateSeatAvailability } from "./providers/seatProvider.js";
import type { WeatherSnapshot } from "./providers/weatherProvider.js";
import type { AqiSnapshot } from "./providers/aqiProvider.js";

function rankLevel(
  stop: Stop,
  vehicles: VehiclePosition[],
  advisories: Advisory[],
  busStatus: DataSourceStatus
): DecisionLevel {
  const nextMinutes = stop.nextBus.minutesUntil;
  const nearestDistance = vehicles.length
    ? Math.min(...vehicles.map((vehicle) => haversineDistanceMeters(vehicle.coordinates, stop.coordinates)))
    : Infinity;
  const hasWarning = advisories.some((item) => item.severity === "warning");
  const hasCaution = advisories.some((item) => item.severity === "caution");

  if (busStatus.state !== "live") {
    return "live_unavailable";
  }

  if (hasWarning || nextMinutes === null || nextMinutes > 24) {
    return "expect_delay";
  }

  if (nearestDistance <= 650 || (nextMinutes !== null && nextMinutes <= 8)) {
    return "go_now";
  }

  if (hasCaution || (nextMinutes !== null && nextMinutes <= 16)) {
    return "leave_early";
  }

  return "service_watch";
}

function buildHeadline(level: DecisionLevel) {
  switch (level) {
    case "go_now":
      return text("Go now", "ออกได้เลย", "现在出发", "Jetzt los", "Partez maintenant", "Salir ahora");
    case "leave_early":
      return text("Leave a bit early", "ออกเร็วขึ้นเล็กน้อย", "提前出发", "Etwas früher los", "Partez un peu plus tôt", "Salir un poco antes");
    case "expect_delay":
      return text("Expect delay", "คาดว่าจะล่าช้า", "预计延迟", "Verzögerung erwartet", "Retard prévu", "Retraso previsto");
    case "service_watch":
      return text("Watch the route", "ติดตามเส้นทางต่อ", "关注路线", "Route beobachten", "Surveillez la ligne", "Vigile la ruta");
    case "live_unavailable":
      return text("Live feed unstable", "ข้อมูลสดไม่เสถียร", "实时数据不稳定", "Live-Daten instabil", "Flux en direct instable", "Datos en vivo inestables");
  }
}

function buildSummary(level: DecisionLevel, stop: Stop) {
  switch (level) {
    case "go_now":
      return text(
        `The next bus for ${stop.name.en} is close enough to start moving now.`,
        `รถคันถัดไปของป้าย ${stop.name.th} ใกล้พอให้เริ่มออกเดินทางได้แล้ว`
      );
    case "leave_early":
      return text(
        `Service looks usable, but small delays could erase your buffer.`,
        "รถยังใช้ได้ แต่ความล่าช้าเล็กน้อยอาจกินเวลาเผื่อของคุณ"
      );
    case "expect_delay":
      return text(
        `Advisories or headway gaps suggest this leg will feel slower than normal.`,
        "คำเตือนหรือช่วงห่างของรถบอกว่าทริปนี้อาจช้ากว่าปกติ"
      );
    case "service_watch":
      return text(
        `The route is running, but there is no immediate reason to rush yet.`,
        "เส้นทางยังวิ่งอยู่ แต่ยังไม่จำเป็นต้องรีบมากในตอนนี้"
      );
    case "live_unavailable":
      return text(
        `Use the published schedule and stop context while live tracking recovers.`,
        "ใช้ตารางเวลาและข้อมูลป้ายไปก่อนระหว่างรอระบบติดตามสดกลับมา"
      );
  }
}

function buildReasons(
  stop: Stop,
  vehicles: VehiclePosition[],
  advisories: Advisory[],
  busStatus: DataSourceStatus,
  seatsLeft: number | null
) {
  const reasons = [
    text(
      `${vehicles.length} live vehicles are visible on this route.`,
      `มีรถสด ${vehicles.length} คันบนเส้นทางนี้`
    ),
    text(
      `Next scheduled pass: ${stop.nextBus.label}.`,
      `รอบรถตามตารางถัดไป: ${stop.nextBus.label}`
    )
  ];

  if (stop.timetable.serviceWindowLabel) {
    reasons.push(
      text(
        `Published service window: ${stop.timetable.serviceWindowLabel}.`,
        `ช่วงเวลาตามตารางที่เผยแพร่: ${stop.timetable.serviceWindowLabel}`
      )
    );
  }

  if (seatsLeft !== null) {
    reasons.push(
      text(
        `${seatsLeft} seats are currently visible on the nearest reporting bus.`,
        `ขณะนี้เห็นที่นั่งเหลือ ${seatsLeft} ที่บนรถที่รายงานใกล้ที่สุด`
      )
    );
  }

  if (advisories[0]) {
    reasons.push(advisories[0].recommendation);
  }

  if (busStatus.state !== "live") {
    reasons.push(
      text(
        "Live confidence is reduced, so schedule fallback is weighted more heavily.",
        "ความเชื่อมั่นของข้อมูลสดลดลง จึงให้น้ำหนักกับตารางเวลาเพิ่มขึ้น"
      )
    );
  }

  return reasons;
}

function buildBusAdvantages(
  weather: WeatherSnapshot | null,
  aqi: AqiSnapshot | null,
  routeId: RouteId
): EnvironmentContext["busAdvantages"] {
  const advantages: EnvironmentContext["busAdvantages"] = [];

  // Price advantage — always true in Phuket
  const fareRange = routeId === "dragon-line" ? "20-30" : "50-170";
  advantages.push(
    text(
      `Bus fare ${fareRange} THB vs 400-1,500 THB by taxi or grab`,
      `ค่าโดยสาร ${fareRange} บาท vs แท็กซี่/แกร็บ 400-1,500 บาท`,
      `公交车票 ${fareRange} 泰铢 vs 出租车 400-1,500 泰铢`,
      `Busfahrpreis ${fareRange} THB vs Taxi 400-1.500 THB`,
      `Bus ${fareRange} THB vs taxi 400-1 500 THB`,
      `Autobús ${fareRange} THB vs taxi 400-1.500 THB`
    )
  );

  // Weather/rain advantage
  if (weather) {
    if (weather.precipitation >= 1 || weather.precipitationProbability >= 50) {
      advantages.push(
        text(
          `${weather.precipitationProbability}% rain chance — air-con bus keeps you dry`,
          `โอกาสฝน ${weather.precipitationProbability}% — รถบัสปรับอากาศไม่เปียก`,
          `${weather.precipitationProbability}%降雨概率 — 空调巴士保持干爽`,
          `${weather.precipitationProbability}% Regenwahrscheinlichkeit — klimatisierter Bus hält trocken`,
          `${weather.precipitationProbability}% de pluie — bus climatisé au sec`,
          `${weather.precipitationProbability}% de lluvia — bus con aire acondicionado`
        )
      );
    } else if (weather.windSpeed >= 20) {
      advantages.push(
        text(
          `Wind ${Math.round(weather.windSpeed)} km/h — bus is more comfortable than scooter`,
          `ลม ${Math.round(weather.windSpeed)} กม./ชม. — รถบัสสบายกว่ามอเตอร์ไซค์`,
          `风速 ${Math.round(weather.windSpeed)} km/h — 巴士比摩托车舒适`,
          `Wind ${Math.round(weather.windSpeed)} km/h — Bus bequemer als Roller`,
          `Vent ${Math.round(weather.windSpeed)} km/h — bus plus confortable qu'un scooter`,
          `Viento ${Math.round(weather.windSpeed)} km/h — bus más cómodo que scooter`
        )
      );
    }
  }

  // AQI advantage
  if (aqi && aqi.usAqi > 50) {
    const aqiLabel = aqi.usAqi <= 100 ? "moderate" : "high";
    advantages.push(
      text(
        `AQI ${aqi.usAqi} (${aqiLabel}) — AC bus filters the air you breathe`,
        `AQI ${aqi.usAqi} (${aqiLabel === "moderate" ? "ปานกลาง" : "สูง"}) — รถบัส AC กรองอากาศให้คุณ`,
        `AQI ${aqi.usAqi} (${aqiLabel === "moderate" ? "中等" : "高"}) — 空调巴士过滤空气`,
        `AQI ${aqi.usAqi} (${aqiLabel === "moderate" ? "mäßig" : "hoch"}) — klimatisierter Bus filtert die Luft`,
        `AQI ${aqi.usAqi} (${aqiLabel === "moderate" ? "modéré" : "élevé"}) — bus climatisé filtre l'air`,
        `AQI ${aqi.usAqi} (${aqiLabel === "moderate" ? "moderado" : "alto"}) — bus con AC filtra el aire`
      )
    );
  }

  // Safety advantage — always relevant
  advantages.push(
    text(
      "Fixed route, licensed driver, insurance-covered — safer than scooter rental",
      "เส้นทางชัดเจน คนขับมีใบอนุญาต มีประกัน — ปลอดภัยกว่าเช่ามอเตอร์ไซค์",
      "固定路线、持照司机、有保险 — 比租摩托车安全",
      "Feste Route, lizenzierter Fahrer, versichert — sicherer als Roller",
      "Itinéraire fixe, chauffeur agréé, assuré — plus sûr qu'un scooter",
      "Ruta fija, conductor autorizado, asegurado — más seguro que scooter"
    )
  );

  return advantages;
}

function buildEnvironmentContext(
  weather: WeatherSnapshot | null,
  aqi: AqiSnapshot | null,
  routeId: RouteId
): EnvironmentContext | null {
  if (!weather && !aqi) return null;

  return {
    temperatureC: weather?.temperatureC ?? 31,
    precipitationMm: weather?.precipitation ?? 0,
    precipitationProbability: weather?.precipitationProbability ?? 0,
    windSpeedKmh: weather?.windSpeed ?? 0,
    usAqi: aqi?.usAqi ?? 0,
    pm25: aqi?.pm25 ?? 0,
    busAdvantages: buildBusAdvantages(weather, aqi, routeId)
  };
}

export function buildDecisionSummary(
  routeId: RouteId,
  stop: Stop,
  vehicles: VehiclePosition[],
  advisories: Advisory[],
  sourceStatuses: DataSourceStatus[],
  weather?: WeatherSnapshot | null,
  aqi?: AqiSnapshot | null
) {
  const busStatus = sourceStatuses.find((status) => status.source === "bus") ?? {
    source: "bus" as const,
    state: "fallback" as const,
    updatedAt: new Date().toISOString(),
    detail: { en: "Bus status unavailable", th: "สถานะรถไม่พร้อมใช้งาน", zh: "巴士状态不可用", de: "Busstatus nicht verfügbar", fr: "Statut bus indisponible", es: "Estado del bus no disponible" }
  };
  const level = rankLevel(stop, vehicles, advisories, busStatus);
  const nearestVehicle = vehicles.length
    ? [...vehicles].sort(
        (left, right) =>
          haversineDistanceMeters(left.coordinates, stop.coordinates) -
          haversineDistanceMeters(right.coordinates, stop.coordinates)
      )[0]
    : null;
  const seatAvailability = estimateSeatAvailability(nearestVehicle);
  const updatedAt = sourceStatuses
    .map((status) => status.updatedAt)
    .sort()
    .at(-1) ?? new Date().toISOString();

  return {
    routeId,
    stopId: stop.id,
    level,
    headline: buildHeadline(level),
    summary: buildSummary(level, stop),
    reasons: buildReasons(stop, vehicles, advisories, busStatus, seatAvailability?.seatsLeft ?? null),
    nextBus: stop.nextBus,
    seatAvailability,
    timetable: stop.timetable,
    liveVehicles: vehicles.length,
    routeStatus:
      level === "go_now"
        ? text("Healthy live service", "เส้นทางสดทำงานดี")
        : level === "live_unavailable"
          ? text("Fallback schedule mode", "โหมดตารางเวลาสำรอง")
          : text("Live service with rider caution", "มีรถสดแต่ควรเผื่อเวลา"),
    environment: buildEnvironmentContext(weather ?? null, aqi ?? null, routeId),
    updatedAt,
    sourceStatuses
  } satisfies DecisionSummary;
}
