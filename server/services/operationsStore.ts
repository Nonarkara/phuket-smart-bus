import type {
  DriverAttentionStatus,
  DriverMonitorSample,
  PassengerFlowEvent,
  PassengerFlowSummary,
  PassengerFlowSample,
  SeatAvailability,
  SeatCameraSample,
  VehiclePosition,
  VehicleTelemetrySample
} from "../../shared/types.js";
import { LIVE_STALE_AFTER_MS } from "../config.js";
import {
  clearRealtimeState,
  insertPassengerFlowSamples,
  readDriverMonitorSamples,
  readPassengerFlowEvents,
  readSeatCameraSamples,
  readTelemetrySamples,
  upsertDriverMonitorSamples,
  upsertSeatCameraSamples,
  upsertTelemetrySamples
} from "../lib/db.js";
import { routeDestinationLabel, text } from "../lib/i18n.js";

const MAX_EVENT_HISTORY = 250;
const FLOW_SUMMARY_LOOKBACK_MS = 30 * 60 * 1000;

const telemetryByVehicleId = new Map<string, VehicleTelemetrySample>();
const seatCameraByVehicleId = new Map<string, SeatCameraSample>();
const driverMonitorByVehicleId = new Map<string, DriverMonitorSample>();
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
    passengerFlow: getVehiclePassengerFlowSummary(sample.vehicleId),
    driverAttention: getDriverAttention(sample.vehicleId),
    updatedAt: sample.capturedAt
  };
}

function buildDriverAttention(sample: DriverMonitorSample): DriverAttentionStatus {
  const state = sample.attentionState;

  return {
    state,
    cameraId: sample.cameraId,
    confidence: sample.confidence,
    label:
      state === "alert"
        ? text("Driver alert", "คนขับพร้อม")
        : state === "watch"
          ? text("Driver attention watch", "เฝ้าระวังความล้าของคนขับ")
          : state === "drowsy_detected"
            ? text("Driver drowsiness detected", "ตรวจพบความง่วงของคนขับ")
            : text("Driver camera offline", "กล้องคนขับออฟไลน์"),
    updatedAt: sample.capturedAt
  };
}

function getLatestTelemetrySamples() {
  const persistedSamples = readTelemetrySamples();
  return persistedSamples.length > 0 ? persistedSamples : Array.from(telemetryByVehicleId.values());
}

function getLatestSeatCameraSamples() {
  const persistedSamples = readSeatCameraSamples();
  return persistedSamples.length > 0 ? persistedSamples : Array.from(seatCameraByVehicleId.values());
}

function getLatestDriverMonitorSamples() {
  const persistedSamples = readDriverMonitorSamples();
  return persistedSamples.length > 0 ? persistedSamples : Array.from(driverMonitorByVehicleId.values());
}

function getPersistedPassengerFlowEvents(limit = MAX_EVENT_HISTORY, lookbackMs?: number) {
  const persistedEvents = readPassengerFlowEvents(limit, lookbackMs);

  if (persistedEvents.length > 0) {
    return persistedEvents.map<PassengerFlowEvent>((event) => ({
      ...event,
      stopName: null
    }));
  }

  return passengerFlowEvents.slice(0, limit);
}

export function clearOperationsStore() {
  telemetryByVehicleId.clear();
  seatCameraByVehicleId.clear();
  driverMonitorByVehicleId.clear();
  passengerFlowEvents.splice(0, passengerFlowEvents.length);
  clearRealtimeState();
}

export function clearOperationsStoreCache() {
  telemetryByVehicleId.clear();
  seatCameraByVehicleId.clear();
  driverMonitorByVehicleId.clear();
  passengerFlowEvents.splice(0, passengerFlowEvents.length);
}

export function recordVehicleTelemetry(samples: VehicleTelemetrySample[]) {
  for (const sample of samples) {
    telemetryByVehicleId.set(getVehicleKey(sample.vehicleId), sample);
  }

  upsertTelemetrySamples(samples);
}

export function recordSeatCameraSamples(samples: SeatCameraSample[]) {
  for (const sample of samples) {
    seatCameraByVehicleId.set(getVehicleKey(sample.vehicleId), sample);
  }

  upsertSeatCameraSamples(samples);
}

export function recordDriverMonitorSamples(samples: DriverMonitorSample[]) {
  for (const sample of samples) {
    driverMonitorByVehicleId.set(getVehicleKey(sample.vehicleId), sample);
  }

  upsertDriverMonitorSamples(samples);
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

  insertPassengerFlowSamples(samples);
}

export function getTelemetryVehicles() {
  return getLatestTelemetrySamples()
    .filter((sample) => isFresh(sample.capturedAt))
    .map(buildTelemetryVehicle);
}

export function getLiveSeatAvailability(vehicleId: string) {
  const sample = getLatestSeatCameraSamples().find(
    (entry) => getVehicleKey(entry.vehicleId) === getVehicleKey(vehicleId)
  );

  if (!sample || !isFresh(sample.capturedAt)) {
    return null;
  }

  return buildSeatAvailability(sample);
}

export function getDriverAttention(vehicleId: string) {
  const sample = getLatestDriverMonitorSamples().find(
    (entry) => getVehicleKey(entry.vehicleId) === getVehicleKey(vehicleId)
  );

  if (!sample || !isFresh(sample.capturedAt)) {
    return null;
  }

  return buildDriverAttention(sample);
}

export function getVehiclePassengerFlowSummary(
  vehicleId: string,
  lookbackMs = FLOW_SUMMARY_LOOKBACK_MS
): PassengerFlowSummary | null {
  const now = Date.now();
  const recentEvents = getPersistedPassengerFlowEvents(MAX_EVENT_HISTORY, lookbackMs).filter(
    (event) =>
      event.vehicleId === getVehicleKey(vehicleId) &&
      now - toTimestamp(event.updatedAt) <= lookbackMs
  );

  if (recentEvents.length === 0) {
    return null;
  }

  return {
    boardingsRecent: recentEvents
      .filter((event) => event.eventType === "boarding")
      .reduce((sum, event) => sum + event.passengers, 0),
    alightingsRecent: recentEvents
      .filter((event) => event.eventType === "alighting")
      .reduce((sum, event) => sum + event.passengers, 0),
    updatedAt: recentEvents[0]?.updatedAt ?? null
  };
}

export function getRecentPassengerFlowEvents(limit = 12) {
  return getPersistedPassengerFlowEvents(limit);
}
