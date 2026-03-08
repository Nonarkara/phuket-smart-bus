import type {
  Advisory,
  DataSourceStatus,
  DecisionLevel,
  DecisionSummary,
  RouteId,
  Stop,
  VehiclePosition
} from "../../shared/types.js";
import { haversineDistanceMeters } from "../lib/geo.js";
import { text } from "../lib/i18n.js";

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
      return text("Go now", "ออกได้เลย");
    case "leave_early":
      return text("Leave a bit early", "ออกเร็วขึ้นเล็กน้อย");
    case "expect_delay":
      return text("Expect delay", "คาดว่าจะล่าช้า");
    case "service_watch":
      return text("Watch the route", "ติดตามเส้นทางต่อ");
    case "live_unavailable":
      return text("Live feed unstable", "ข้อมูลสดไม่เสถียร");
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
  busStatus: DataSourceStatus
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

export function buildDecisionSummary(
  routeId: RouteId,
  stop: Stop,
  vehicles: VehiclePosition[],
  advisories: Advisory[],
  sourceStatuses: DataSourceStatus[]
) {
  const busStatus = sourceStatuses.find((status) => status.source === "bus")!;
  const level = rankLevel(stop, vehicles, advisories, busStatus);
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
    reasons: buildReasons(stop, vehicles, advisories, busStatus),
    nextBus: stop.nextBus,
    timetable: stop.timetable,
    liveVehicles: vehicles.length,
    routeStatus:
      level === "go_now"
        ? text("Healthy live service", "เส้นทางสดทำงานดี")
        : level === "live_unavailable"
          ? text("Fallback schedule mode", "โหมดตารางเวลาสำรอง")
          : text("Live service with rider caution", "มีรถสดแต่ควรเผื่อเวลา"),
    updatedAt,
    sourceStatuses
  } satisfies DecisionSummary;
}
