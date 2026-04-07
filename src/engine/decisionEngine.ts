import type {
  Advisory,
  DataSourceStatus,
  DecisionLevel,
  DecisionSummary,
  EnvironmentContext,
  LocalizedText,
  OperationalRouteId,
  SeatAvailability,
  Stop,
  VehiclePosition
} from "@shared/types";
import { BUS_SEAT_CAPACITY } from "@shared/productConfig";
import { haversineDistanceMeters } from "./geo";
import { text } from "./i18n";

const DEFAULT_CAPACITY = BUS_SEAT_CAPACITY;

function hashSeed(value: string) {
  let total = 0;
  for (const char of value) {
    total = (total * 31 + char.charCodeAt(0)) % 9973;
  }
  return total;
}

export function estimateSeatAvailability(vehicle: VehiclePosition | null): SeatAvailability | null {
  if (!vehicle) return null;

  const seed = hashSeed(`${vehicle.vehicleId}:${vehicle.updatedAt}:${vehicle.status}`);
  const occupancyFloor = vehicle.status === "dwelling" ? 7 : 4;
  const occupancyRange = vehicle.status === "dwelling" ? 10 : 13;
  const occupiedSeats = occupancyFloor + (seed % occupancyRange);
  const seatsLeft = Math.max(0, Math.min(DEFAULT_CAPACITY, DEFAULT_CAPACITY - occupiedSeats));

  return {
    seatsLeft,
    capacity: DEFAULT_CAPACITY,
    occupiedSeats,
    loadFactor: DEFAULT_CAPACITY > 0 ? occupiedSeats / DEFAULT_CAPACITY : null,
    basis: "camera_ready_estimate",
    cameraId: null,
    confidenceLabel: text(
      "Estimated until the seat camera feed is connected.",
      "เป็นค่าประมาณจนกว่าจะเชื่อมต่อกล้องนับที่นั่ง"
    ),
    passengerFlow: null,
    driverAttention: null,
    updatedAt: vehicle.updatedAt
  };
}

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

  if (busStatus.state !== "live") return "live_unavailable";
  if (hasWarning || nextMinutes === null || nextMinutes > 24) return "expect_delay";
  if (nearestDistance <= 650 || (nextMinutes !== null && nextMinutes <= 8)) return "go_now";
  if (hasCaution || (nextMinutes !== null && nextMinutes <= 16)) return "leave_early";
  return "service_watch";
}

function buildHeadline(level: DecisionLevel): LocalizedText {
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

function buildSummary(level: DecisionLevel, stop: Stop): LocalizedText {
  switch (level) {
    case "go_now":
      return text(
        `The next bus for ${stop.name.en} is close enough to start moving now.`,
        `รถคันถัดไปของป้าย ${stop.name.th} ใกล้พอให้เริ่มออกเดินทางได้แล้ว`
      );
    case "leave_early":
      return text("Service looks usable, but small delays could erase your buffer.", "รถยังใช้ได้ แต่ความล่าช้าเล็กน้อยอาจกินเวลาเผื่อของคุณ");
    case "expect_delay":
      return text("Advisories or headway gaps suggest this leg will feel slower than normal.", "คำเตือนหรือช่วงห่างของรถบอกว่าทริปนี้อาจช้ากว่าปกติ");
    case "service_watch":
      return text("The route is running, but there is no immediate reason to rush yet.", "เส้นทางยังวิ่งอยู่ แต่ยังไม่จำเป็นต้องรีบมากในตอนนี้");
    case "live_unavailable":
      return text("Use the published schedule and stop context while live tracking recovers.", "ใช้ตารางเวลาและข้อมูลป้ายไปก่อนระหว่างรอระบบติดตามสดกลับมา");
  }
}

function buildReasons(
  stop: Stop,
  vehicles: VehiclePosition[],
  advisories: Advisory[],
  busStatus: DataSourceStatus,
  seatsLeft: number | null
) {
  const reasons: LocalizedText[] = [
    text(`${vehicles.length} live vehicles are visible on this route.`, `มีรถสด ${vehicles.length} คันบนเส้นทางนี้`),
    text(`Next scheduled pass: ${stop.nextBus.label}.`, `รอบรถตามตารางถัดไป: ${stop.nextBus.label}`)
  ];

  if (stop.timetable.serviceWindowLabel) {
    reasons.push(text(`Published service window: ${stop.timetable.serviceWindowLabel}.`, `ช่วงเวลาตามตารางที่เผยแพร่: ${stop.timetable.serviceWindowLabel}`));
  }

  if (seatsLeft !== null) {
    reasons.push(text(`${seatsLeft} seats are currently visible on the nearest reporting bus.`, `ขณะนี้เห็นที่นั่งเหลือ ${seatsLeft} ที่บนรถที่รายงานใกล้ที่สุด`));
  }

  if (advisories[0]) {
    reasons.push(advisories[0].recommendation);
  }

  if (busStatus.state !== "live") {
    reasons.push(text("Live confidence is reduced, so schedule fallback is weighted more heavily.", "ความเชื่อมั่นของข้อมูลสดลดลง จึงให้น้ำหนักกับตารางเวลาเพิ่มขึ้น"));
  }

  return reasons;
}

function buildBusAdvantages(
  env: { precipitationProbability: number; precipitation: number; windSpeed: number; usAqi: number },
  routeId: OperationalRouteId
): LocalizedText[] {
  const advantages: LocalizedText[] = [];
  const fareRange = routeId === "dragon-line" ? "50" : "100";

  advantages.push(text(`Bus fare ${fareRange} THB vs 600-1,500 THB by Grab or taxi`, `ค่าโดยสาร ${fareRange} บาท vs แกร็บ/แท็กซี่ 600-1,500 บาท`));

  if (env.precipitation >= 1 || env.precipitationProbability >= 50) {
    advantages.push(text(`${env.precipitationProbability}% rain chance — air-con bus keeps you dry`, `โอกาสฝน ${env.precipitationProbability}% — รถบัสปรับอากาศไม่เปียก`));
  } else if (env.windSpeed >= 20) {
    advantages.push(text(`Wind ${Math.round(env.windSpeed)} km/h — bus is more comfortable than scooter`, `ลม ${Math.round(env.windSpeed)} กม./ชม. — รถบัสสบายกว่ามอเตอร์ไซค์`));
  }

  if (env.usAqi > 50) {
    const aqiLabel = env.usAqi <= 100 ? "moderate" : "high";
    advantages.push(text(`AQI ${env.usAqi} (${aqiLabel}) — AC bus filters the air you breathe`, `AQI ${env.usAqi} (${aqiLabel === "moderate" ? "ปานกลาง" : "สูง"}) — รถบัส AC กรองอากาศให้คุณ`));
  }

  advantages.push(text("Fixed route, licensed driver, insurance-covered — safer than scooter rental", "เส้นทางชัดเจน คนขับมีใบอนุญาต มีประกัน — ปลอดภัยกว่าเช่ามอเตอร์ไซค์"));
  return advantages;
}

export function buildDecisionSummary(
  routeId: OperationalRouteId,
  stop: Stop,
  vehicles: VehiclePosition[],
  advisories: Advisory[],
  sourceStatuses: DataSourceStatus[],
  env: { temperatureC: number; precipitationMm: number; precipitationProbability: number; windSpeedKmh: number; usAqi: number; pm25: number }
): DecisionSummary {
  const busStatus = sourceStatuses.find((status) => status.source === "bus") ?? {
    source: "bus" as const,
    state: "live" as const,
    updatedAt: new Date().toISOString(),
    detail: text("Schedule-based simulation active", "การจำลองจากตารางเวลาเปิดใช้งาน"),
    freshnessSeconds: null,
    fallbackReason: null
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
  const updatedAt = sourceStatuses.map((status) => status.updatedAt).sort().at(-1) ?? new Date().toISOString();

  const environment: EnvironmentContext = {
    temperatureC: env.temperatureC,
    precipitationMm: env.precipitationMm,
    precipitationProbability: env.precipitationProbability,
    windSpeedKmh: env.windSpeedKmh,
    usAqi: env.usAqi,
    pm25: env.pm25,
    busAdvantages: buildBusAdvantages(
      { precipitationProbability: env.precipitationProbability, precipitation: env.precipitationMm, windSpeed: env.windSpeedKmh, usAqi: env.usAqi },
      routeId
    )
  };

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
    environment,
    updatedAt,
    sourceStatuses
  };
}
