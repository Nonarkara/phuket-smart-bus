export type Lang = "en" | "th";

export type RouteId =
  | "rawai-airport"
  | "patong-old-bus-station"
  | "dragon-line";

export type DecisionLevel =
  | "go_now"
  | "leave_early"
  | "expect_delay"
  | "service_watch"
  | "live_unavailable";

export type SourceState = "live" | "fallback" | "unavailable";

export type AdvisorySeverity = "info" | "caution" | "warning";

export type SourceName = "bus" | "traffic" | "weather";

export type NextBusBasis = "live" | "schedule" | "fallback";

export type AirportGuideKind = "ready" | "direct" | "transfer" | "not_supported";

export type SeatAvailabilityBasis = "camera_ready_estimate" | "unavailable";

export type AirportDepartureState = "boarding" | "scheduled";

export type LatLngTuple = [number, number];

export interface LocalizedText {
  en: string;
  th: string;
}

export interface DataSourceStatus {
  source: SourceName;
  state: SourceState;
  updatedAt: string;
  detail: LocalizedText;
}

export interface NearbyPlace {
  name: string;
  mapUrl: string;
  openingHours: string;
  distanceMeters: number;
  walkMinutes: number;
}

export interface NextBusContext {
  label: string;
  minutesUntil: number | null;
  basis: NextBusBasis;
  notes: LocalizedText;
}

export interface TimetableSummary {
  firstDepartureLabel: string | null;
  lastDepartureLabel: string | null;
  nextDepartures: string[];
  serviceWindowLabel: string | null;
  sourceLabel: LocalizedText;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  notes: LocalizedText;
}

export interface SeatAvailability {
  seatsLeft: number | null;
  capacity: number | null;
  basis: SeatAvailabilityBasis;
  confidenceLabel: LocalizedText;
  updatedAt: string;
}

export interface AirportDestinationMatch {
  routeId: RouteId;
  stopId: string;
  stopName: LocalizedText;
  nearbyPlaceName: string;
  areaLabel: LocalizedText;
  kind: Exclude<AirportGuideKind, "ready" | "not_supported">;
  travelMinutes: number | null;
}

export interface AirportQuickDestination {
  id: string;
  label: LocalizedText;
  routeId: RouteId;
  stopId: string;
  kind: Exclude<AirportGuideKind, "ready" | "not_supported">;
  travelMinutes: number | null;
}

export interface AirportDeparture {
  routeId: RouteId;
  routeName: LocalizedText;
  label: string;
  minutesUntil: number | null;
  basis: NextBusBasis;
  state: AirportDepartureState;
  liveBusId: string | null;
  liveLicensePlate: string | null;
  seats: SeatAvailability | null;
}

export interface Stop {
  id: string;
  routeId: RouteId;
  sequence: number;
  name: LocalizedText;
  direction: LocalizedText;
  routeDirection: LocalizedText;
  coordinates: LatLngTuple;
  scheduleText: string;
  nextBus: NextBusContext;
  timetable: TimetableSummary;
  nearbyPlace: NearbyPlace;
}

export interface Route {
  id: RouteId;
  name: LocalizedText;
  shortName: LocalizedText;
  overview: LocalizedText;
  color: string;
  accentColor: string;
  bounds: [LatLngTuple, LatLngTuple];
  pathSegments: LatLngTuple[][];
  stopCount: number;
  defaultStopId: string;
  activeVehicles: number;
  status: LocalizedText;
  sourceStatus: DataSourceStatus;
}

export interface VehiclePosition {
  id: string;
  routeId: RouteId;
  licensePlate: string;
  vehicleId: string;
  coordinates: LatLngTuple;
  heading: number;
  speedKph: number;
  destination: LocalizedText;
  updatedAt: string;
  freshness: "fresh" | "stale";
  status: "moving" | "dwelling" | "unknown";
  distanceToDestinationMeters: number | null;
  stopsAway: number | null;
}

export interface Advisory {
  id: string;
  routeId: RouteId | "all";
  source: "itic" | "weather" | "operations";
  severity: AdvisorySeverity;
  title: LocalizedText;
  message: LocalizedText;
  recommendation: LocalizedText;
  updatedAt: string;
  active: boolean;
  tags: string[];
}

export interface DecisionSummary {
  routeId: RouteId;
  stopId: string;
  level: DecisionLevel;
  headline: LocalizedText;
  summary: LocalizedText;
  reasons: LocalizedText[];
  nextBus: NextBusContext;
  timetable: TimetableSummary;
  liveVehicles: number;
  routeStatus: LocalizedText;
  updatedAt: string;
  sourceStatuses: DataSourceStatus[];
}

export interface AirportGuidePayload {
  destinationQuery: string;
  recommendation: AirportGuideKind;
  headline: LocalizedText;
  summary: LocalizedText;
  bestMatch: AirportDestinationMatch | null;
  matches: AirportDestinationMatch[];
  nextDeparture: AirportDeparture;
  followingDepartures: string[];
  airportBoardingLabel: LocalizedText;
  boardingNotes: LocalizedText[];
  quickDestinations: AirportQuickDestination[];
  sourceStatuses: DataSourceStatus[];
  checkedAt: string;
}

export interface HealthPayload {
  status: "ok" | "degraded";
  checkedAt: string;
  sources: DataSourceStatus[];
}
