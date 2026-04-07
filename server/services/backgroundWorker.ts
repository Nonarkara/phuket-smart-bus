import { getBusSnapshot } from "./providers/busProvider.js";
import {
  pruneDatabase,
  writeHealthLog,
  writeVehicleSnapshot,
  writeWorkerHeartbeat
} from "../lib/db.js";
import { getWeatherSnapshot } from "./providers/weatherProvider.js";
import { getAqiSnapshot } from "./providers/aqiProvider.js";
import { getTrafficSnapshot } from "./providers/trafficProvider.js";

const SNAPSHOT_INTERVAL_MS = 15_000;    // Write vehicle positions every 15 seconds
const PRUNE_INTERVAL_MS = 60 * 60_000; // Prune old data every hour

let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let pruneTimer: ReturnType<typeof setInterval> | null = null;

async function captureSnapshot() {
  try {
    const [snapshot, trafficSnapshot, weatherSnapshot, aqiSnapshot] = await Promise.all([
      getBusSnapshot(),
      getTrafficSnapshot(),
      getWeatherSnapshot(),
      getAqiSnapshot()
    ]);
    writeVehicleSnapshot(snapshot.vehicles);
    writeWorkerHeartbeat("background-worker");

    const sourceStatuses = [
      snapshot.status,
      trafficSnapshot.status,
      weatherSnapshot.status,
      aqiSnapshot.status
    ];
    const healthStatus =
      sourceStatuses.filter((status) => status.source === "bus" || status.source === "weather")
        .every((status) => status.state === "live")
        ? "ok"
        : "degraded";
    writeHealthLog(healthStatus, JSON.stringify(sourceStatuses));

    if (snapshot.vehicles.length > 0) {
      console.log(
        `[worker] Snapshot: ${snapshot.vehicles.length} vehicles (${snapshot.status.state}) saved to DB`
      );
    }
  } catch (error) {
    writeWorkerHeartbeat(
      "background-worker",
      "error",
      error instanceof Error ? error.message : String(error)
    );
    console.error("[worker] Snapshot capture failed:", error);
  }
}

async function warmCaches() {
  try {
    await Promise.allSettled([
      getWeatherSnapshot(),
      getAqiSnapshot(),
      getTrafficSnapshot()
    ]);
  } catch {
    // Caches will be warmed on next request
  }
}

export function startBackgroundWorker() {
  console.log("[worker] Starting background simulation worker");

  // Initial capture immediately
  void captureSnapshot();
  void warmCaches();

  // Periodic snapshot
  snapshotTimer = setInterval(() => void captureSnapshot(), SNAPSHOT_INTERVAL_MS);

  // Periodic cleanup of old history (keep 24 hours)
  pruneTimer = setInterval(() => {
    try {
      pruneDatabase();
    } catch (error) {
      console.error("[worker] Prune failed:", error);
    }
  }, PRUNE_INTERVAL_MS);

  return function stop() {
    if (snapshotTimer) clearInterval(snapshotTimer);
    if (pruneTimer) clearInterval(pruneTimer);
    snapshotTimer = null;
    pruneTimer = null;
    console.log("[worker] Background worker stopped");
  };
}
