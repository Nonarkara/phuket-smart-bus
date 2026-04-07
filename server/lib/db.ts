import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  DriverMonitorSample,
  OperationalRouteId,
  PassengerFlowSample,
  SeatCameraSample,
  VehiclePosition,
  VehicleTelemetrySample
} from "../../shared/types.js";

type PersistedPassengerFlowEvent = {
  id: string;
  routeId: OperationalRouteId;
  vehicleId: string;
  stopId: string | null;
  cameraId: string;
  coordinates: [number, number];
  eventType: "boarding" | "alighting";
  passengers: number;
  updatedAt: string;
};

export type PersistedDemandRequest = {
  lat: number;
  lng: number;
  zone: string;
  ts: number;
};

let db: import("better-sqlite3").Database | null = null;
let dbPath: string | null = null;

try {
  const Database = (await import("better-sqlite3")).default;
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.resolve(currentDir, "../../data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, "pksb.sqlite3");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 3000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_snapshots (
      id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      license_plate TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      device_id TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      heading REAL NOT NULL,
      speed_kph REAL NOT NULL,
      destination_en TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      telemetry_source TEXT NOT NULL,
      freshness TEXT NOT NULL,
      status TEXT NOT NULL,
      distance_to_dest_m REAL,
      stops_away INTEGER,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id, route_id)
    );

    CREATE INDEX IF NOT EXISTS idx_vehicle_snapshots_route
      ON vehicle_snapshots(route_id);

    CREATE INDEX IF NOT EXISTS idx_vehicle_snapshots_captured
      ON vehicle_snapshots(captured_at);

    CREATE TABLE IF NOT EXISTS vehicle_history (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed_kph REAL NOT NULL,
      status TEXT NOT NULL,
      captured_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vehicle_history_time
      ON vehicle_history(captured_at);

    CREATE TABLE IF NOT EXISTS health_log (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      sources_json TEXT NOT NULL,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_health_log_time
      ON health_log(checked_at);

    CREATE TABLE IF NOT EXISTS worker_heartbeat (
      worker_name TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      detail TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicle_telemetry_latest (
      vehicle_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      license_plate TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      heading REAL NOT NULL,
      speed_kph REAL NOT NULL,
      destination_hint TEXT,
      captured_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seat_camera_latest (
      vehicle_id TEXT PRIMARY KEY,
      camera_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      occupied_seats INTEGER NOT NULL,
      seats_left INTEGER NOT NULL,
      captured_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS driver_monitor_latest (
      vehicle_id TEXT PRIMARY KEY,
      camera_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      attention_state TEXT NOT NULL,
      confidence REAL,
      captured_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS passenger_flow_events (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      route_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      stop_id TEXT,
      camera_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      event_type TEXT NOT NULL,
      passengers INTEGER NOT NULL,
      captured_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_passenger_flow_events_time
      ON passenger_flow_events(captured_at);

    CREATE INDEX IF NOT EXISTS idx_passenger_flow_events_vehicle
      ON passenger_flow_events(vehicle_id, captured_at);

    CREATE TABLE IF NOT EXISTS demand_requests (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      zone TEXT NOT NULL,
      requested_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_demand_requests_time
      ON demand_requests(requested_at);
  `);
} catch (error) {
  console.warn(
    "[db] SQLite unavailable (serverless environment) — running without persistence:",
    (error as Error).message
  );
  db = null;
  dbPath = null;
}

function isoFromNowOffset(offsetMs: number) {
  return new Date(Date.now() - offsetMs).toISOString();
}

function asDemandTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function mapTelemetryRow(row: Record<string, unknown>): VehicleTelemetrySample {
  return {
    deviceId: String(row.device_id),
    vehicleId: String(row.vehicle_id),
    routeId: String(row.route_id) as OperationalRouteId,
    licensePlate: row.license_plate === null ? null : String(row.license_plate),
    coordinates: [Number(row.lat), Number(row.lng)],
    heading: Number(row.heading),
    speedKph: Number(row.speed_kph),
    destinationHint: row.destination_hint === null ? null : String(row.destination_hint),
    capturedAt: String(row.captured_at)
  };
}

function mapSeatCameraRow(row: Record<string, unknown>): SeatCameraSample {
  return {
    cameraId: String(row.camera_id),
    vehicleId: String(row.vehicle_id),
    routeId: String(row.route_id) as OperationalRouteId,
    capacity: Number(row.capacity),
    occupiedSeats: Number(row.occupied_seats),
    seatsLeft: Number(row.seats_left),
    capturedAt: String(row.captured_at)
  };
}

function mapDriverMonitorRow(row: Record<string, unknown>): DriverMonitorSample {
  return {
    cameraId: String(row.camera_id),
    vehicleId: String(row.vehicle_id),
    routeId: String(row.route_id) as OperationalRouteId,
    attentionState: String(row.attention_state) as DriverMonitorSample["attentionState"],
    confidence: row.confidence === null ? null : Number(row.confidence),
    capturedAt: String(row.captured_at)
  };
}

export function writeVehicleSnapshot(vehicles: VehiclePosition[]) {
  if (!db) {
    return;
  }

  const now = new Date().toISOString();
  const upsertVehicle = db.prepare(`
    INSERT OR REPLACE INTO vehicle_snapshots
      (id, route_id, license_plate, vehicle_id, device_id, lat, lng, heading, speed_kph,
       destination_en, updated_at, telemetry_source, freshness, status,
       distance_to_dest_m, stops_away, captured_at)
    VALUES
      (@id, @routeId, @licensePlate, @vehicleId, @deviceId, @lat, @lng, @heading, @speedKph,
       @destinationEn, @updatedAt, @telemetrySource, @freshness, @status,
       @distanceToDestM, @stopsAway, @capturedAt)
  `);
  const insertHistory = db.prepare(`
    INSERT INTO vehicle_history (vehicle_id, route_id, lat, lng, speed_kph, status, captured_at)
    VALUES (@vehicleId, @routeId, @lat, @lng, @speedKph, @status, @capturedAt)
  `);
  const clearSnapshots = db.prepare(`DELETE FROM vehicle_snapshots`);

  db.transaction(() => {
    clearSnapshots.run();

    for (const vehicle of vehicles) {
      upsertVehicle.run({
        id: vehicle.id,
        routeId: vehicle.routeId,
        licensePlate: vehicle.licensePlate,
        vehicleId: vehicle.vehicleId,
        deviceId: vehicle.deviceId,
        lat: vehicle.coordinates[0],
        lng: vehicle.coordinates[1],
        heading: vehicle.heading,
        speedKph: vehicle.speedKph,
        destinationEn: vehicle.destination.en,
        updatedAt: vehicle.updatedAt,
        telemetrySource: vehicle.telemetrySource,
        freshness: vehicle.freshness,
        status: vehicle.status,
        distanceToDestM: vehicle.distanceToDestinationMeters,
        stopsAway: vehicle.stopsAway,
        capturedAt: now
      });

      insertHistory.run({
        vehicleId: vehicle.vehicleId,
        routeId: vehicle.routeId,
        lat: vehicle.coordinates[0],
        lng: vehicle.coordinates[1],
        speedKph: vehicle.speedKph,
        status: vehicle.status,
        capturedAt: now
      });
    }
  })();
}

export function writeHealthLog(status: string, sourcesJson: string) {
  if (!db) {
    return;
  }

  db.prepare(`INSERT INTO health_log (status, sources_json, checked_at) VALUES (?, ?, ?)`).run(
    status,
    sourcesJson,
    new Date().toISOString()
  );
}

export function writeWorkerHeartbeat(workerName: string, status = "ok", detail: string | null = null) {
  if (!db) {
    return;
  }

  db.prepare(
    `
      INSERT OR REPLACE INTO worker_heartbeat (worker_name, status, detail, updated_at)
      VALUES (?, ?, ?, ?)
    `
  ).run(workerName, status, detail, new Date().toISOString());
}

export function readWorkerHeartbeat(workerName: string) {
  if (!db) {
    return null;
  }

  return (
    (db
      .prepare(`SELECT * FROM worker_heartbeat WHERE worker_name = ?`)
      .get(workerName) as Record<string, unknown> | undefined) ?? null
  );
}

export function upsertTelemetrySamples(samples: VehicleTelemetrySample[]) {
  if (!db || samples.length === 0) {
    return;
  }

  const statement = db.prepare(`
    INSERT OR REPLACE INTO vehicle_telemetry_latest
      (vehicle_id, device_id, route_id, license_plate, lat, lng, heading, speed_kph, destination_hint, captured_at)
    VALUES
      (@vehicleId, @deviceId, @routeId, @licensePlate, @lat, @lng, @heading, @speedKph, @destinationHint, @capturedAt)
  `);

  db.transaction((entries: VehicleTelemetrySample[]) => {
    for (const sample of entries) {
      statement.run({
        vehicleId: sample.vehicleId,
        deviceId: sample.deviceId,
        routeId: sample.routeId,
        licensePlate: sample.licensePlate,
        lat: sample.coordinates[0],
        lng: sample.coordinates[1],
        heading: sample.heading,
        speedKph: sample.speedKph,
        destinationHint: sample.destinationHint,
        capturedAt: sample.capturedAt
      });
    }
  })(samples);
}

export function readTelemetrySamples() {
  if (!db) {
    return [];
  }

  return db
    .prepare(`SELECT * FROM vehicle_telemetry_latest ORDER BY captured_at DESC`)
    .all()
    .map((row) => mapTelemetryRow(row as Record<string, unknown>));
}

export function upsertSeatCameraSamples(samples: SeatCameraSample[]) {
  if (!db || samples.length === 0) {
    return;
  }

  const statement = db.prepare(`
    INSERT OR REPLACE INTO seat_camera_latest
      (vehicle_id, camera_id, route_id, capacity, occupied_seats, seats_left, captured_at)
    VALUES
      (@vehicleId, @cameraId, @routeId, @capacity, @occupiedSeats, @seatsLeft, @capturedAt)
  `);

  db.transaction((entries: SeatCameraSample[]) => {
    for (const sample of entries) {
      statement.run(sample);
    }
  })(samples);
}

export function readSeatCameraSamples() {
  if (!db) {
    return [];
  }

  return db
    .prepare(`SELECT * FROM seat_camera_latest ORDER BY captured_at DESC`)
    .all()
    .map((row) => mapSeatCameraRow(row as Record<string, unknown>));
}

export function upsertDriverMonitorSamples(samples: DriverMonitorSample[]) {
  if (!db || samples.length === 0) {
    return;
  }

  const statement = db.prepare(`
    INSERT OR REPLACE INTO driver_monitor_latest
      (vehicle_id, camera_id, route_id, attention_state, confidence, captured_at)
    VALUES
      (@vehicleId, @cameraId, @routeId, @attentionState, @confidence, @capturedAt)
  `);

  db.transaction((entries: DriverMonitorSample[]) => {
    for (const sample of entries) {
      statement.run(sample);
    }
  })(samples);
}

export function readDriverMonitorSamples() {
  if (!db) {
    return [];
  }

  return db
    .prepare(`SELECT * FROM driver_monitor_latest ORDER BY captured_at DESC`)
    .all()
    .map((row) => mapDriverMonitorRow(row as Record<string, unknown>));
}

export function insertPassengerFlowSamples(samples: PassengerFlowSample[]) {
  if (!db || samples.length === 0) {
    return;
  }

  const statement = db.prepare(`
    INSERT OR IGNORE INTO passenger_flow_events
      (event_id, route_id, vehicle_id, stop_id, camera_id, lat, lng, event_type, passengers, captured_at)
    VALUES
      (@eventId, @routeId, @vehicleId, @stopId, @cameraId, @lat, @lng, @eventType, @passengers, @capturedAt)
  `);

  db.transaction((entries: PassengerFlowSample[]) => {
    entries.forEach((sample, index) => {
      statement.run({
        eventId: `${sample.cameraId}:${sample.vehicleId}:${sample.capturedAt}:${index}`,
        routeId: sample.routeId,
        vehicleId: sample.vehicleId,
        stopId: sample.stopId,
        cameraId: sample.cameraId,
        lat: sample.coordinates[0],
        lng: sample.coordinates[1],
        eventType: sample.eventType,
        passengers: sample.passengers,
        capturedAt: sample.capturedAt
      });
    });
  })(samples);
}

export function readPassengerFlowEvents(limit = 250, lookbackMs?: number): PersistedPassengerFlowEvent[] {
  if (!db) {
    return [];
  }

  const cutoff = lookbackMs ? isoFromNowOffset(lookbackMs) : null;
  const rows =
    cutoff === null
      ? db
          .prepare(`SELECT * FROM passenger_flow_events ORDER BY captured_at DESC LIMIT ?`)
          .all(limit)
      : db
          .prepare(
            `SELECT * FROM passenger_flow_events WHERE captured_at >= ? ORDER BY captured_at DESC LIMIT ?`
          )
          .all(cutoff, limit);

  return rows.map((row) => ({
    id: String((row as Record<string, unknown>).event_id),
    routeId: String((row as Record<string, unknown>).route_id) as OperationalRouteId,
    vehicleId: String((row as Record<string, unknown>).vehicle_id),
    stopId:
      (row as Record<string, unknown>).stop_id === null
        ? null
        : String((row as Record<string, unknown>).stop_id),
    cameraId: String((row as Record<string, unknown>).camera_id),
    coordinates: [
      Number((row as Record<string, unknown>).lat),
      Number((row as Record<string, unknown>).lng)
    ],
    eventType: String((row as Record<string, unknown>).event_type) as "boarding" | "alighting",
    passengers: Number((row as Record<string, unknown>).passengers),
    updatedAt: String((row as Record<string, unknown>).captured_at)
  }));
}

export function insertDemandRequest(lat: number, lng: number, zone: string, now = Date.now()) {
  if (!db) {
    return;
  }

  db.prepare(`INSERT INTO demand_requests (lat, lng, zone, requested_at) VALUES (?, ?, ?, ?)`).run(
    lat,
    lng,
    zone,
    new Date(now).toISOString()
  );
}

export function readDemandRequests(lookbackMs: number): PersistedDemandRequest[] {
  if (!db) {
    return [];
  }

  const cutoff = isoFromNowOffset(lookbackMs);
  return db
    .prepare(`SELECT * FROM demand_requests WHERE requested_at >= ? ORDER BY requested_at ASC`)
    .all(cutoff)
    .map((row) => ({
      lat: Number((row as Record<string, unknown>).lat),
      lng: Number((row as Record<string, unknown>).lng),
      zone: String((row as Record<string, unknown>).zone),
      ts: asDemandTimestamp(String((row as Record<string, unknown>).requested_at))
    }));
}

export function clearRealtimeState() {
  if (!db) {
    return;
  }

  db.exec(`
    DELETE FROM vehicle_telemetry_latest;
    DELETE FROM seat_camera_latest;
    DELETE FROM driver_monitor_latest;
    DELETE FROM passenger_flow_events;
    DELETE FROM demand_requests;
  `);
}

export function readVehiclesByRoute(routeId: OperationalRouteId) {
  if (!db) {
    return [];
  }

  return db
    .prepare(`SELECT * FROM vehicle_snapshots WHERE route_id = ?`)
    .all(routeId) as Array<Record<string, unknown>>;
}

export function readAllVehicles() {
  if (!db) {
    return [];
  }

  return db.prepare(`SELECT * FROM vehicle_snapshots`).all() as Array<Record<string, unknown>>;
}

export function readRecentHistory() {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `SELECT * FROM vehicle_history WHERE captured_at > datetime('now', '-1 hour') ORDER BY captured_at DESC LIMIT 500`
    )
    .all() as Array<Record<string, unknown>>;
}

export function pruneDatabase() {
  if (!db) {
    return;
  }

  db.prepare(`DELETE FROM vehicle_history WHERE captured_at < datetime('now', '-24 hours')`).run();
  db.prepare(`DELETE FROM health_log WHERE checked_at < datetime('now', '-24 hours')`).run();
  db.prepare(`DELETE FROM passenger_flow_events WHERE captured_at < datetime('now', '-24 hours')`).run();
  db.prepare(`DELETE FROM demand_requests WHERE requested_at < datetime('now', '-24 hours')`).run();
  db.prepare(`DELETE FROM vehicle_telemetry_latest WHERE captured_at < datetime('now', '-24 hours')`).run();
  db.prepare(`DELETE FROM seat_camera_latest WHERE captured_at < datetime('now', '-24 hours')`).run();
  db.prepare(`DELETE FROM driver_monitor_latest WHERE captured_at < datetime('now', '-24 hours')`).run();
}

export function getDatabaseHealth() {
  return {
    available: Boolean(db),
    writable: Boolean(db),
    mode: db ? ("sqlite" as const) : ("memory" as const),
    path: dbPath
  };
}

export function getDb() {
  return db;
}
