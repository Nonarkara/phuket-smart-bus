import type {
  PassengerFlowEvent,
  PassengerFlowSample,
  SeatAvailability,
  SeatCameraSample,
  VehiclePosition,
  VehicleTelemetrySample
} from "../../shared/types.js";
import { LIVE_STALE_AFTER_MS } from "../config.js";
import { routeDestinationLabel, text } from "../lib/i18n.js";

const MAX_EVENT_HISTORY = 250;

const telemetryByVehicleId = new Map<string, VehicleTelemetrySample>();
const seatCameraByVehicleId = new Map<string, SeatCameraSample>();
const passengerFlowEvents: PassengerFlowEvent[] = [];

function toTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isFresh(updatedAt: string) {
  return Date.now() - toTimestamp(updatedAt) < LIVE_STALE_AFTER_MS;
}

function getVehicleKey(vehicleId: string) {
  return vehicleId.trim();
}

function buildTelemetryVehicle(sample: VehicleTelemetrySample): VehiclePosition {
  const vehicleId = getVehicleKey(sample.vehicleId);

  return {
    id: `direct:${vehicleId}`,
    routeId: sample.routeId,
    licensePlate: sample.licensePlate?.trim() || vehicleId,
    vehicleId,
    deviceId: sample.deviceId.trim(),
    coordinates: sample.coordinates,
    heading: Number(sample.heading ?? 0),
    speedKph: Number(sample.speedKph ?? 0),
    destination: routeDestinationLabel(sample.routeId, sample.destinationHint ?? ""),
    updatedAt: sample.capturedAt,
    telemetrySource: "direct_gps",
    freshness: isFresh(sample.capturedAt) ? "fresh" : "stale",
    status:
      sample.speedKph > 4 ? "moving" : sample.speedKph === 0 ? "dwelling" : "unknown",
    distanceToDestinationMeters: null,
    stopsAway: null
  };
}

function buildSeatAvailability(sample: SeatCameraSample): SeatAvailability {
  const seatsLeft = Math.max(0, Math.min(sample.capacity, sample.seatsLeft));
  const occupiedSeats = Math.max(0, Math.min(sample.capacity, sample.occupiedSeats));

  return {
    seatsLeft,
    capacity: sample.capacity,
    occupiedSeats,
    loadFactor: sample.capacity > 0 ? occupiedSeats / sample.capacity : null,
    basis: "camera_live",
    cameraId: sample.cameraId,
    confidenceLabel: text(
      "Live seats from the bus camera feed.",
      "จำนวนที่นั่งสดจากกล้องบนรถ"
    ),
    updatedAt: sample.capturedAt
  };
}

export function clearOperationsStore() {
  telemetryByVehicleId.clear();
  seatCameraByVehicleId.clear();
  passengerFlowEvents.splice(0, passengerFlowEvents.length);
}

export function recordVehicleTelemetry(samples: VehicleTelemetrySample[]) {
  for (const sample of samples) {
    telemetryByVehicleId.set(getVehicleKey(sample.vehicleId), sample);
  }
}

export function recordSeatCameraSamples(samples: SeatCameraSample[]) {
  for (const sample of samples) {
    seatCameraByVehicleId.set(getVehicleKey(sample.vehicleId), sample);
  }
}

export function recordPassengerFlowSamples(samples: PassengerFlowSample[]) {
  samples.forEach((sample, index) => {
    passengerFlowEvents.unshift({
      id: `${sample.cameraId}:${sample.vehicleId}:${sample.capturedAt}:${index}`,
      routeId: sample.routeId,
      vehicleId: getVehicleKey(sample.vehicleId),
      stopId: sample.stopId,
      stopName: null,
      cameraId: sample.cameraId,
      coordinates: sample.coordinates,
      eventType: sample.eventType,
      passengers: sample.passengers,
      updatedAt: sample.capturedAt
    });
  });

  passengerFlowEvents.sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt));

  if (passengerFlowEvents.length > MAX_EVENT_HISTORY) {
    passengerFlowEvents.length = MAX_EVENT_HISTORY;
  }
}

export function getTelemetryVehicles() {
  return Array.from(telemetryByVehicleId.values())
    .filter((sample) => isFresh(sample.capturedAt))
    .map(buildTelemetryVehicle);
}

export function getLiveSeatAvailability(vehicleId: string) {
  const sample = seatCameraByVehicleId.get(getVehicleKey(vehicleId));

  if (!sample || !isFresh(sample.capturedAt)) {
    return null;
  }

  return buildSeatAvailability(sample);
}

export function getRecentPassengerFlowEvents(limit = 12) {
  return passengerFlowEvents.slice(0, limit);
}
