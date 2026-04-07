export type Lang = "en" | "th" | "zh" | "de" | "fr" | "es";

export type OperationalRouteId =
  | "rawai-airport"
  | "patong-old-bus-station"
  | "dragon-line"
  | "rassada-phi-phi"
  | "rassada-ao-nang"
  | "bang-rong-koh-yao"
  | "chalong-racha";

export type CompetitorRouteId = "orange-line";

export type RouteId = OperationalRouteId;

export type MarketRouteId = RouteId | CompetitorRouteId;

export type RouteAxis = "north_south" | "east_west" | "loop" | "marine";

export type OperationalRouteTier = "core" | "auxiliary" | "ferry";

export type RouteTier = OperationalRouteTier;

export type MarketRouteTier = RouteTier | "competitor";

export type DecisionLevel =
  | "go_now"
  | "leave_early"
  | "expect_delay"
  | "service_watch"
  | "live_unavailable";

export type SourceState = "live" | "fallback" | "unavailable";

export type AdvisorySeverity = "info" | "caution" | "warning";

export type SourceName = "bus" | "traffic" | "weather" | "aqi";

export type OpsDataMode = "live" | "degraded" | "demo";

export type DataMode = "live" | "demo";

export type NextBusBasis = "live" | "schedule" | "fallback";

export type AirportGuideKind = "ready" | "direct" | "transfer" | "not_supported";

export type SeatAvailabilityBasis = "camera_live" | "camera_ready_estimate" | "unavailable";

export type AirportDepartureState = "boarding" | "scheduled";

export type LatLngTuple = [number, number];

export type TelemetrySource = "public_tracker" | "direct_gps" | "schedule_mock" | "ferry_mock";

export type PassengerFlowEventType = "boarding" | "alighting";

export type DriverAttentionState =
  | "alert"
  | "watch"
  | "drowsy_detected"
  | "camera_offline";

export interface LocalizedText {
  en: string;
  th: string;
  zh: string;
  de: string;
  fr: string;
  es: string;
}

export interface DataSourceStatus {
  source: SourceName;
  state: SourceState;
  updatedAt: string;
  detail: LocalizedText;
  freshnessSeconds: number | null;
  fallbackReason: string | null;
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
  occupiedSeats: number | null;
  loadFactor: number | null;
  basis: SeatAvailabilityBasis;
  cameraId: string | null;
  confidenceLabel: LocalizedText;
  passengerFlow: PassengerFlowSummary | null;
  driverAttention: DriverAttentionStatus | null;
  updatedAt: string;
}

export interface PassengerFlowSummary {
  boardingsRecent: number;
  alightingsRecent: number;
  updatedAt: string | null;
}

export interface DriverAttentionStatus {
  state: DriverAttentionState;
  cameraId: string | null;
  confidence: number | null;
  label: LocalizedText;
  updatedAt: string;
}

export interface AirportDestinationMatch {
  routeId: OperationalRouteId;
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
  routeId: OperationalRouteId;
  stopId: string;
  kind: Exclude<AirportGuideKind, "ready" | "not_supported">;
  travelMinutes: number | null;
}

export interface AirportFareComparison {
  busFareThb: number;
  taxiFareEstimateThb: number;
  savingsThb: number;
  savingsCopy: LocalizedText;
}

export interface AirportBoardingWalk {
  primaryInstruction: LocalizedText;
  secondaryInstruction: LocalizedText;
  focusStopId: string;
}

export interface AirportWeatherSummary {
  conditionLabel: LocalizedText;
  currentPrecipitation: number;
  maxRainProbability: number;
  recommendation: LocalizedText;
  severity: AdvisorySeverity;
}

export interface AirportDeparture {
  routeId: OperationalRouteId;
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
  routeId: OperationalRouteId;
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
  id: OperationalRouteId;
  name: LocalizedText;
  shortName: LocalizedText;
  overview: LocalizedText;
  axis: RouteAxis;
  axisLabel: LocalizedText;
  tier: OperationalRouteTier;
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
  routeId: OperationalRouteId;
  licensePlate: string;
  vehicleId: string;
  deviceId: string | null;
  coordinates: LatLngTuple;
  heading: number;
  speedKph: number;
  destination: LocalizedText;
  updatedAt: string;
  telemetrySource: TelemetrySource;
  freshness: "fresh" | "stale";
  status: "moving" | "dwelling" | "unknown";
  distanceToDestinationMeters: number | null;
  stopsAway: number | null;
}

export interface Advisory {
  id: string;
  routeId: OperationalRouteId | "all";
  source: "itic" | "weather" | "operations";
  severity: AdvisorySeverity;
  title: LocalizedText;
  message: LocalizedText;
  recommendation: LocalizedText;
  updatedAt: string;
  active: boolean;
  tags: string[];
}

export interface EnvironmentContext {
  temperatureC: number;
  precipitationMm: number;
  precipitationProbability: number;
  windSpeedKmh: number;
  usAqi: number;
  pm25: number;
  busAdvantages: LocalizedText[];
}

export interface DecisionSummary {
  routeId: OperationalRouteId;
  stopId: string;
  level: DecisionLevel;
  headline: LocalizedText;
  summary: LocalizedText;
  reasons: LocalizedText[];
  nextBus: NextBusContext;
  seatAvailability: SeatAvailability | null;
  timetable: TimetableSummary;
  liveVehicles: number;
  routeStatus: LocalizedText;
  environment: EnvironmentContext | null;
  updatedAt: string;
  sourceStatuses: DataSourceStatus[];
}

export interface AirportGuidePayload {
  destinationQuery: string;
  recommendation: AirportGuideKind;
  headline: LocalizedText;
  summary: LocalizedText;
  fareComparison: AirportFareComparison;
  boardingWalk: AirportBoardingWalk;
  weatherSummary: AirportWeatherSummary;
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

export interface EnvironmentSnapshot {
  tempC: number;
  precipMm: number;
  rainProb: number;
  windKph: number;
  aqi: number;
  pm25: number;
  conditionLabel: string;
  updatedAt: string;
}

export interface FlightInfo {
  flightNo: string;
  airline: string;
  origin: string;
  scheduledTime: string;
  estimatedPax: number;
  type: "arrival" | "departure";
}

export interface DemandForecast {
  currentHour: string;
  arrivalsNext2h: number;
  estimatedPaxNext2h: number;
  busDemandEstimate: number;
  currentFleetOnline: number;
  recommendedFleet: number;
  recommendation: string;
  flights: FlightInfo[];
}

export interface HourlyDemandPoint {
  hour: string;
  arrivals: number;
  estimatedPax: number;
  busDemand: number;
  seatsAvailable: number;
}

export interface WeatherForecastHour {
  hour: string;
  tempC: number;
  rainProb: number;
  precipMm: number;
  windKph: number;
  code: number;
}

export interface WeatherIntelligence {
  current: { tempC: number; rainProb: number; precipMm: number; windKph: number; aqi: number; pm25: number };
  forecast: WeatherForecastHour[];
  monsoonSeason: boolean;
  monsoonNote: string;
  driverAlerts: string[];
}

export interface PriceComparison {
  destinationId: string;
  destinationName: LocalizedText;
  taxi: { minThb: number; maxThb: number; minutes: number };
  tukTuk: { minThb: number; maxThb: number; minutes: number };
  bus: { fareThb: number; minutes: number; routeId: OperationalRouteId };
  savingsMin: number;
  savingsMax: number;
  ridersToday: number;
}

export interface HealthPayload {
  status: "ok" | "degraded";
  checkedAt: string;
  mode: DataMode;
  appVersion: string;
  database: {
    available: boolean;
    writable: boolean;
    mode: "postgres" | "sqlite" | "memory";
    path: string | null;
  };
  worker: {
    status: "ok" | "stale" | "missing";
    updatedAt: string | null;
    maxAgeMs: number;
  };
  sources: Array<
    DataSourceStatus & {
      critical: boolean;
      demoOnly: boolean;
    }
  >;
}

export interface VehicleTelemetrySample {
  deviceId: string;
  vehicleId: string;
  routeId: OperationalRouteId;
  licensePlate: string | null;
  coordinates: LatLngTuple;
  heading: number;
  speedKph: number;
  destinationHint: string | null;
  capturedAt: string;
}

export interface SeatCameraSample {
  cameraId: string;
  vehicleId: string;
  routeId: OperationalRouteId;
  capacity: number;
  occupiedSeats: number;
  seatsLeft: number;
  capturedAt: string;
}

export interface DriverMonitorSample {
  cameraId: string;
  vehicleId: string;
  routeId: OperationalRouteId;
  attentionState: DriverAttentionState;
  confidence: number | null;
  capturedAt: string;
}

export interface PassengerFlowSample {
  cameraId: string;
  vehicleId: string;
  routeId: OperationalRouteId;
  stopId: string | null;
  coordinates: LatLngTuple;
  eventType: PassengerFlowEventType;
  passengers: number;
  capturedAt: string;
}

export interface PassengerFlowEvent {
  id: string;
  routeId: OperationalRouteId;
  vehicleId: string;
  stopId: string | null;
  stopName: LocalizedText | null;
  cameraId: string;
  coordinates: LatLngTuple;
  eventType: PassengerFlowEventType;
  passengers: number;
  updatedAt: string;
}

export interface OperationsRouteSummary {
  routeId: OperationalRouteId;
  routeName: LocalizedText;
  shortName: LocalizedText;
  axisLabel: LocalizedText;
  tier: OperationalRouteTier;
  vehiclesOnline: number;
  gpsDevicesLive: number;
  seatCamerasLive: number;
  seatsLeftVisible: number | null;
  occupiedSeatsVisible: number | null;
  boardingsLastHour: number;
  alightingsLastHour: number;
  driverAttentionLive: number;
  driverAttentionWarnings: number;
  lastEventAt: string | null;
}

export interface OperationsOverviewPayload {
  checkedAt: string;
  routes: OperationsRouteSummary[];
  recentEvents: PassengerFlowEvent[];
}

export type MetricProvenance = "live" | "estimated" | "fallback";

export type TransferHubStatus = "ready" | "watch" | "inactive";

export type OverlayLayerId =
  | "traffic"
  | "weather"
  | "aqi"
  | "hotspots"
  | "transfer_hubs"
  | "route_pressure";

export interface OpsMapTileLayer {
  id: string;
  layerId: OverlayLayerId;
  label: string;
  description: string;
  url: string;
  attribution?: string;
  opacity?: number;
}

export interface OpsMapOverlayMarker {
  id: string;
  layerId: OverlayLayerId;
  lat: number;
  lng: number;
  color: string;
  radius: number;
  label: string;
  fillOpacity?: number;
}

export interface TransferHubConnection {
  routeId: OperationalRouteId;
  directionLabel: string;
  nextDepartureLabel: string | null;
  minutesUntil: number | null;
  kind: "feeder_bus" | "ferry";
}

export interface TransferHub {
  id: string;
  name: LocalizedText;
  coordinates: LatLngTuple;
  feederRouteIds: OperationalRouteId[];
  ferryRouteIds: OperationalRouteId[];
  walkMinutes: number;
  transferBufferMinutes: number;
  provenance: MetricProvenance;
  status: TransferHubStatus;
  rationale: LocalizedText;
  activeWindowLabel: string | null;
  nextWindowStartLabel: string | null;
  activeConnections: TransferHubConnection[];
}

export interface RoutePressure {
  routeId: OperationalRouteId;
  level: "balanced" | "watch" | "strained";
  demand: number;
  seatSupply: number;
  gap: number;
  coverageRatio: number;
  delayRiskMinutes: number;
  provenance: MetricProvenance;
}

export interface DemandHotspot {
  id: string;
  zone: string;
  lat: number;
  lng: number;
  demand: number;
  liveRequests: number;
  modeledDemand: number;
  coverageRatio: number;
  gap: number;
  provenance: MetricProvenance;
}

export interface OpsFleetSnapshot {
  vehicles: VehiclePosition[];
  totalVehicles: number;
  busCount: number;
  ferryCount: number;
  movingCount: number;
  dwellingCount: number;
  routePressure: RoutePressure[];
}

export interface CurrentDemandSupply {
  rawAirportArrivalPaxNext2h: number;
  rawAirportDeparturePaxNext2h: number;
  addressableArrivalDemandNext2h: number;
  addressableDepartureDemandNext2h: number;
  arrivalSeatSupplyNext2h: number;
  departureSeatSupplyNext2h: number;
  carriedArrivalDemandNext2h: number;
  carriedDepartureDemandNext2h: number;
  unmetArrivalDemandNext2h: number;
  unmetDepartureDemandNext2h: number;
  arrivalCaptureOfAddressablePct: number;
  departureCaptureOfAddressablePct: number;
  additionalBusesNeededPeak: number;
  provenance: MetricProvenance;
}

export interface OpsWeatherPanel {
  severity: AdvisorySeverity;
  intelligence: WeatherIntelligence;
  provenance: MetricProvenance;
}

export interface OpsTrafficPanel {
  severity: AdvisorySeverity;
  advisories: Advisory[];
  provenance: MetricProvenance;
}

export interface OpsMapOverlaySet {
  tileLayers: OpsMapTileLayer[];
  markers: OpsMapOverlayMarker[];
}

export interface OpsDashboardPayload {
  checkedAt: string;
  dataMode: OpsDataMode;
  fallbackReasons: string[];
  fleet: OpsFleetSnapshot;
  routes: Route[];
  demandSupply: CurrentDemandSupply;
  weather: OpsWeatherPanel;
  traffic: OpsTrafficPanel;
  hotspots: {
    hotspots: DemandHotspot[];
    totalRequests: number;
  };
  transferHubs: TransferHub[];
  history: {
    recentEvents: PassengerFlowEvent[];
    vehicleHistoryCount: number;
  };
  mapOverlays: OpsMapOverlaySet;
  competitorBenchmarks: CompetitorBenchmark[];
  sources: DataSourceStatus[];
}

export interface InvestorAssumptions {
  seatCapacityPerBus: number;
  flatFareThb: number;
  addressableDemandShare: number;
  replayStepMinutes: number;
  replayStartMinutes: number;
  replayEndMinutes: number;
}

export interface HourlyCapacityGap {
  hour: string;
  rawArrivalPax: number;
  rawDeparturePax: number;
  addressableArrivalDemand: number;
  addressableDepartureDemand: number;
  arrivalSeatSupply: number;
  departureSeatSupply: number;
  carriedArrivalDemand: number;
  carriedDepartureDemand: number;
  unmetArrivalDemand: number;
  unmetDepartureDemand: number;
  requiredArrivalDepartures: number;
  requiredDepartureDepartures: number;
  additionalArrivalBusesNeeded: number;
  additionalDepartureBusesNeeded: number;
  lostRevenueThb: number;
}

export interface ServiceRevenueBreakdown {
  routeId: MarketRouteId;
  routeName: LocalizedText;
  directionLabel: string;
  tier: MarketRouteTier;
  departures: number;
  seatSupply: number;
  estimatedDemand: number;
  carriedRiders: number;
  unmetRiders: number;
  revenueThb: number;
  capturePct: number;
  provenance: MetricProvenance;
  strategicValue: LocalizedText | null;
}

export interface CompetitorBenchmark {
  routeId: CompetitorRouteId;
  routeName: LocalizedText;
  tier: "competitor";
  operatorLabel: string;
  fareThb: number;
  headwayMinutes: number;
  tripDurationMinutes: number;
  estimatedDemand: number;
  seatSupply: number;
  carriedRiders: number;
  revenueThb: number;
  capturePct: number;
  overlapRouteIds: OperationalRouteId[];
  provenance: MetricProvenance;
  notes: LocalizedText;
}

export interface InvestorTotals {
  rawAirportArrivalPax: number;
  rawAirportDeparturePax: number;
  addressableArrivalDemand: number;
  addressableDepartureDemand: number;
  carriedArrivalDemand: number;
  carriedDepartureDemand: number;
  unmetArrivalDemand: number;
  unmetDepartureDemand: number;
  totalAirportCapturePct: number;
  addressableAirportCapturePct: number;
  dailyRevenueThb: number;
  lostRevenueThb: number;
  peakAdditionalBusesNeeded: number;
}

export interface InvestorOpportunities {
  summary: string;
  peakArrivalGapHour: string | null;
  peakDepartureGapHour: string | null;
  strongestRevenueServiceRouteId: MarketRouteId | null;
}

export interface InvestorSimulationPayload {
  generatedAt: string;
  dataMode: OpsDataMode;
  fallbackReasons: string[];
  assumptions: InvestorAssumptions;
  hourly: HourlyCapacityGap[];
  services: ServiceRevenueBreakdown[];
  competitorBenchmarks: CompetitorBenchmark[];
  totals: InvestorTotals;
  opportunities: InvestorOpportunities;
  touchpoints: TransferHub[];
}

export interface SimulationSnapshot {
  simMinutes: number;
  simTime: string;
  dataMode: OpsDataMode;
  fallbackReasons: string[];
  vehicles: VehiclePosition[];
  routePressure: RoutePressure[];
  transferHubs: TransferHub[];
  competitorBenchmarks: CompetitorBenchmark[];
}
