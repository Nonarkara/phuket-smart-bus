import { useEffect, useState } from "react";
import type { Lang, RouteId, Stop, PriceComparison, VehiclePosition } from "@shared/types";
import { ui, pick } from "../lib/i18n";
import { getSimulatedMinutes } from "../engine/fleetSimulator";
import { getBangkokNowFractionalMinutes } from "../engine/time";
import { getScheduledServices } from "../engine/scheduleService";
import { getInjuriesForLocale, THAIRSC_2026_FOREIGNERS } from "../engine/safetyData";

interface HeroSectionProps {
  routeId: RouteId | null;
  stops: Stop[];
  lang: Lang;
  comparisons: PriceComparison[];
  vehicles: VehiclePosition[];
}

function getNextBusEta(
  routeId: RouteId | null,
  stops: Stop[],
  vehicles: VehiclePosition[]
): { minutes: number; destination: string } | null {
  if (!routeId || stops.length === 0) return null;
  const moving = vehicles.filter((v) => v.routeId === routeId && v.status === "moving");
  if (moving.length === 0) {
    const services = getScheduledServices(routeId);
    if (services.length > 0) {
      const nowMin = getSimulatedMinutes();
      let nextDeparture = Infinity;
      let nextDirection = "destination";
      for (const svc of services) {
        for (const depMin of svc.departures) {
          if (depMin > nowMin && depMin < nextDeparture) {
            nextDeparture = depMin;
            nextDirection = svc.directionLabel || "destination";
          }
        }
      }
      if (nextDeparture < Infinity) {
        return {
          minutes: Math.ceil(nextDeparture - nowMin),
          destination: nextDirection
        };
      }
    }
    return null;
  }
  const nextVehicle = moving[0];
  const estimatedMin = nextVehicle.stopsAway ? Math.ceil(nextVehicle.stopsAway * 2) : 8;
  return {
    minutes: estimatedMin,
    destination: nextVehicle.destination?.en || "destination"
  };
}

export function HeroSection({ routeId, stops, lang, comparisons, vehicles }: HeroSectionProps) {
  const [countdown, setCountdown] = useState(0);
  const [destination, setDestination] = useState("Patong");

  // Real-time PM2.5 from GISTDA — live air quality at Phuket Airport area
  const [pm25, setPm25] = useState<{ value: number; level: string; color: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("https://pm25.gistda.or.th/rest/getPm25byLocation?lat=7.88&lng=98.39")
      .then(r => r.json())
      .then((d: { status: number; data: { pm25: number } }) => {
        if (cancelled || d.status !== 200) return;
        const v = Math.round(d.data.pm25 * 10) / 10;
        const level = v <= 12 ? "Good" : v <= 25 ? "Moderate" : "Poor";
        // Canonical Dr Non semantic palette — Good = gain green, Moderate = amber, Poor = loss red.
        const color = v <= 12 ? "#16a574" : v <= 25 ? "#f59e0b" : "#c0392b";
        if (!cancelled) setPm25({ value: v, level, color });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Shorten verbose destinations so the "NEXT BUS · {dest}" label doesn't
  // truncate ("Phuket Airport" → "Airport", "Patong Beach" → "Patong", etc.)
  function shortDest(d: string): string {
    return d
      .replace(/^to\s+/i, "")
      .replace(/\bphuket\s+airport\b/i, "Airport")
      .replace(/\bphuket\s+town\b/i, "Old Town")
      .replace(/\bpatong\s+beach\b/i, "Patong")
      .replace(/\brawai\s+beach\b/i, "Rawai")
      .replace(/\bkata\s+beach\b/i, "Kata")
      .replace(/\bkaron\s+beach\b/i, "Karon")
      .trim() || d;
  }

  useEffect(() => {
    function updateCountdown() {
      const eta = getNextBusEta(routeId, stops, vehicles);
      if (eta) {
        const fracMin = getBangkokNowFractionalMinutes();
        const fracEta = eta.minutes - (fracMin % 1);
        setCountdown(Math.max(0, Math.ceil(fracEta * 60)));
        setDestination(shortDest(eta.destination));
      } else {
        setCountdown(0);
      }
    }
    updateCountdown();
    const id = setInterval(updateCountdown, 200);
    return () => clearInterval(id);
  }, [routeId, stops]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const countdownStr = countdown > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : "—:——";

  const comparison = comparisons.find((c) => pick(c.destinationName, lang).toLowerCase().includes(destination.toLowerCase())) ||
    comparisons.find((c) => pick(c.destinationName, lang).toLowerCase() === "patong") ||
    comparisons[0];

  const busThb = comparison?.bus.fareThb ?? 100;
  const grabThb = comparison?.taxi.minThb ?? 650;
  const grabHigh = comparison?.taxi.maxThb ?? 1000;
  const savings = grabThb > 0 ? Math.round(((grabThb - busThb) / grabThb) * 100) : 85;

  // Safety nudge: localised to the tourist's language
  const safetyInfo = getInjuriesForLocale(lang);
  const motorcyclePct = Math.round(THAIRSC_2026_FOREIGNERS.byVehicle.motorcyclePct);

  return (
    <div className="hero-section">
      <div className="hero-section__row">
        <div className="hero-section__col">
          <div className="hero-section__label">{pick(ui.heroNextBus, lang)} · {destination}</div>
          <div className="hero-section__countdown">{countdownStr}</div>
        </div>
        <div className="hero-section__col hero-section__col--right">
          <div className="hero-section__price">฿{busThb}</div>
          <div className="hero-section__compare">
            {pick(ui.heroVsGrab, lang)} ฿{grabThb}–{grabHigh} · {savings}% {pick(ui.heroSavings, lang)}
          </div>
        </div>
      </div>
      {/* Road-safety nudge strip */}
      {safetyInfo.injured > 0 && (
        <div className="hero-section__safety">
          <span className="hero-section__safety-icon">⚠</span>
          <span className="hero-section__safety-text">
            {safetyInfo.injured.toLocaleString()} {safetyInfo.nation} tourists injured in Thai traffic this year
            ({motorcyclePct}% on motorcycles) — bus riders: 0.
          </span>
        </div>
      )}
      {/* Live GISTDA PM2.5 — fewer buses = fewer rental scooters = cleaner air */}
      {pm25 && (
        <div className="hero-pm25" style={{ background: pm25.color + "18", border: `1px solid ${pm25.color}55` }}>
          <span className="hero-pm25__pill" style={{ background: pm25.color }}>
            PM2.5 {pm25.value}
          </span>
          <span className="hero-pm25__msg" style={{ color: pm25.color }}>
            {pm25.level} · 1 rider = 1 less scooter
          </span>
        </div>
      )}
    </div>
  );
}
