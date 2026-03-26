import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { VehiclePosition, RouteId } from "../../shared/types.js";

let db: import("better-sqlite3").Database | null = null;

try {
  const Database = (await import("better-sqlite3")).default;
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.resolve(currentDir, "../../data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "pksb.sqlite3");
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
  `);
} catch (err) {
  console.warn("[db] SQLite unavailable (serverless environment) — running without persistence:", (err as Error).message);
  db = null;
}

// --- Public API (all gracefully degrade if db is null) ---

export function writeVehicleSnapshot(vehicles: VehiclePosition[]) {
  if (!db) return;
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

  const writeAll = db.transaction(() => {
    clearSnapshots.run();
    for (const v of vehicles) {
      upsertVehicle.run({
        id: v.id, routeId: v.routeId, licensePlate: v.licensePlate,
        vehicleId: v.vehicleId, deviceId: v.deviceId,
        lat: v.coordinates[0], lng: v.coordinates[1],
        heading: v.heading, speedKph: v.speedKph,
        destinationEn: v.destination.en, updatedAt: v.updatedAt,
        telemetrySource: v.telemetrySource, freshness: v.freshness,
        status: v.status, distanceToDestM: v.distanceToDestinationMeters,
        stopsAway: v.stopsAway, capturedAt: now
      });
      insertHistory.run({
        vehicleId: v.vehicleId, routeId: v.routeId,
        lat: v.coordinates[0], lng: v.coordinates[1],
        speedKph: v.speedKph, status: v.status, capturedAt: now
      });
    }
  });
  writeAll();
}

export function writeHealthLog(status: string, sourcesJson: string) {
  if (!db) return;
  db.prepare(`INSERT INTO health_log (status, sources_json, checked_at) VALUES (?, ?, ?)`)
    .run(status, sourcesJson, new Date().toISOString());
}

export function readVehiclesByRoute(routeId: RouteId) {
  if (!db) return [];
  return db.prepare(`SELECT * FROM vehicle_snapshots WHERE route_id = ?`).all(routeId) as Array<Record<string, unknown>>;
}

export function readAllVehicles() {
  if (!db) return [];
  return db.prepare(`SELECT * FROM vehicle_snapshots`).all() as Array<Record<string, unknown>>;
}

export function readRecentHistory() {
  if (!db) return [];
  return db.prepare(`SELECT * FROM vehicle_history WHERE captured_at > datetime('now', '-1 hour') ORDER BY captured_at DESC LIMIT 500`).all() as Array<Record<string, unknown>>;
}

export function pruneDatabase() {
  if (!db) return;
  db.prepare(`DELETE FROM vehicle_history WHERE captured_at < datetime('now', '-24 hours')`).run();
  db.prepare(`DELETE FROM health_log WHERE checked_at < datetime('now', '-24 hours')`).run();
}

export function getDb() {
  return db;
}
