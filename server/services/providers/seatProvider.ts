import type { SeatAvailability, VehiclePosition } from "../../../shared/types.js";
import { text } from "../../lib/i18n.js";

const DEFAULT_CAPACITY = 23;

function hashSeed(value: string) {
  let total = 0;

  for (const char of value) {
    total = (total * 31 + char.charCodeAt(0)) % 9973;
  }

  return total;
}

export function estimateSeatAvailability(vehicle: VehiclePosition | null): SeatAvailability | null {
  if (!vehicle) {
    return null;
  }

  const seed = hashSeed(`${vehicle.vehicleId}:${vehicle.updatedAt}:${vehicle.status}`);
  const occupancyFloor = vehicle.status === "dwelling" ? 7 : 4;
  const occupancyRange = vehicle.status === "dwelling" ? 10 : 13;
  const occupiedSeats = occupancyFloor + (seed % occupancyRange);
  const seatsLeft = Math.max(0, Math.min(DEFAULT_CAPACITY, DEFAULT_CAPACITY - occupiedSeats));

  return {
    seatsLeft,
    capacity: DEFAULT_CAPACITY,
    basis: "camera_ready_estimate",
    confidenceLabel: text(
      "Estimated until the seat camera feed is connected.",
      "เป็นค่าประมาณจนกว่าจะเชื่อมต่อกล้องนับที่นั่ง"
    ),
    updatedAt: vehicle.updatedAt
  };
}
