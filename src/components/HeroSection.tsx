import { useEffect, useState } from "react";
import type { Lang, RouteId, Stop, PriceComparison } from "@shared/types";
import { ui, pick } from "../lib/i18n";
import { getVehiclesNow } from "../engine/dataProvider";
import { getSimulatedMinutes } from "../engine/fleetSimulator";
import { getBangkokNowFractionalMinutes } from "../engine/time";
import { getScheduledServices } from "../engine/scheduleService";

interface HeroSectionProps {
  routeId: RouteId | null;
  stops: Stop[];
  lang: Lang;
  comparisons: PriceComparison[];
}

function getNextBusEta(routeId: RouteId | null, stops: Stop[]): { minutes: number; destination: string } | null {
  if (!routeId || stops.length === 0) return null;
  const vehicles = getVehiclesNow().filter((v) => v.routeId === routeId && v.status === "moving");
  if (vehicles.length === 0) {
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
  const nextVehicle = vehicles[0];
  const estimatedMin = nextVehicle.stopsAway ? Math.ceil(nextVehicle.stopsAway * 2) : 8;
  return {
    minutes: estimatedMin,
    destination: nextVehicle.destination?.en || "destination"
  };
}

export function HeroSection({ routeId, stops, lang, comparisons }: HeroSectionProps) {
  const [countdown, setCountdown] = useState(0);
  const [destination, setDestination] = useState("Patong");

  // Update countdown every 200ms for smooth ticking at 30× speed
  useEffect(() => {
    function updateCountdown() {
      const eta = getNextBusEta(routeId, stops);
      if (eta) {
        // Subtract fractional seconds to account for sim time
        const fracMin = getBangkokNowFractionalMinutes();
        const fracEta = eta.minutes - (fracMin % 1);
        setCountdown(Math.max(0, Math.ceil(fracEta * 60))); // Convert to seconds
        setDestination(eta.destination);
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
  const countdownStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  // Find relevant comparison (default to first available or fallback)
  const comparison = comparisons.find((c) => pick(c.destinationName, lang).toLowerCase() === destination.toLowerCase()) ||
    comparisons.find((c) => pick(c.destinationName, lang).toLowerCase() === "patong") ||
    comparisons[0];

  const comparisonData = comparison ? {
    destination: pick(comparison.destinationName, lang),
    busThb: comparison.bus.fareThb,
    grabThb: comparison.taxi.minThb,
    grabHigh: comparison.taxi.maxThb
  } : {
    destination: "Patong",
    busThb: 100,
    grabThb: 450,
    grabHigh: 900
  };

  return (
    <div className="hero-section">
      <div className="hero-section__title">{pick(ui.heroNextBus, lang)}</div>
      <div className="hero-section__destination">{destination}</div>

      <div className="hero-section__countdown">{countdownStr}</div>
      <div className="hero-section__countdown-label">{pick(ui.heroMinutes, lang)}</div>

      <div className="hero-section__price-row">
        <div className="hero-section__our-price">
          <div className="hero-section__price">฿{comparisonData.busThb}</div>
          <div className="hero-section__price-label">{pick(ui.heroBusPrice, lang)}</div>
        </div>

        <div className="hero-section__divider" />

        <div className="hero-section__grab-price">
          <div className="hero-section__comparison">
            <span className="hero-section__vs">{pick(ui.heroVsGrab, lang)}</span>
            <span className="hero-section__grab-range">
              ฿{comparisonData.grabThb}–{comparisonData.grabHigh}
            </span>
          </div>
          <div className="hero-section__savings">
            {Math.round(((comparisonData.grabThb - comparisonData.busThb) / comparisonData.grabThb) * 100)}% {pick(ui.heroSavings, lang)}
          </div>
        </div>
      </div>

      <button className="hero-section__cta" type="button">
        {pick(ui.heroRequestBus, lang)}
      </button>
    </div>
  );
}
