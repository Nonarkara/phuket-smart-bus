import { useRef, useState } from "react";
import type { Lang, PriceComparison, Stop, VehiclePosition } from "@shared/types";
import { ui, pick } from "../lib/i18n";

type SheetStep = "ask" | "result" | "booked";

// Well-known destinations tourists search for
const DESTINATION_HINTS = [
  "Airport", "Patong Beach", "Central Phuket", "Old Town",
  "Kata Beach", "Karon Beach", "Rawai", "Chalong",
];

interface WelcomeSheetProps {
  lang: Lang;
  vehicles: VehiclePosition[];
  comparisons: PriceComparison[];
  allStops: Stop[];
  onNavigateToStop: (stopId: string) => void;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  return text.toLowerCase().includes(q);
}

function findBestStop(query: string, stops: Stop[]): Stop | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  // Priority 1: exact name match
  const nameMatch = stops.find(s =>
    s.name.en.toLowerCase().includes(q) || s.name.th.includes(q)
  );
  if (nameMatch) return nameMatch;
  // Priority 2: nearby place match
  const nearbyMatch = stops.find(s =>
    s.nearbyPlace?.name?.toLowerCase().includes(q)
  );
  if (nearbyMatch) return nearbyMatch;
  // Priority 3: direction/route match
  const dirMatch = stops.find(s =>
    s.direction?.en.toLowerCase().includes(q)
  );
  return dirMatch ?? null;
}

export function WelcomeSheet({ lang, vehicles, comparisons, allStops, onNavigateToStop }: WelcomeSheetProps) {
  const [step, setStep] = useState<SheetStep>("ask");
  const [query, setQuery] = useState("");
  const [matchedStop, setMatchedStop] = useState<Stop | null>(null);
  const [bookingCode, setBookingCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const movingBuses = vehicles.filter(v => v.status === "moving");

  // Find next bus info for matched stop's route
  const routeVehicles = matchedStop
    ? vehicles.filter(v => v.routeId === matchedStop.routeId && v.status === "moving")
    : [];
  const nextBusMinutes = routeVehicles.length > 0
    ? Math.max(2, (routeVehicles[0]?.stopsAway ?? 3) * 3)
    : null;
  const seatsEstimate = routeVehicles.length * 32;

  // Savings for matched stop's route
  const comparison = comparisons.find(c => c.bus.routeId === matchedStop?.routeId) ?? comparisons[0];

  function handleSearch() {
    const stop = findBestStop(query, allStops);
    if (stop) {
      setMatchedStop(stop);
      setStep("result");
      onNavigateToStop(stop.id);
    }
  }

  function handleQuickDest(dest: string) {
    setQuery(dest);
    const stop = findBestStop(dest, allStops);
    if (stop) {
      setMatchedStop(stop);
      setStep("result");
      onNavigateToStop(stop.id);
    }
  }

  function handleBook() {
    const code = `PKSB-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setBookingCode(code);
    setStep("booked");
  }

  function handleReset() {
    setStep("ask");
    setQuery("");
    setMatchedStop(null);
    setBookingCode("");
  }

  // --- Step 1: "Where do you want to go?" ---
  if (step === "ask") {
    return (
      <div className="welcome-sheet">
        <div className="welcome-sheet__handle" onClick={() => {}}>
          <div className="welcome-sheet__bar" />
        </div>
        <div className="welcome-sheet__header">
          <h1 className="welcome-sheet__title">{pick(ui.welcomeTitle, lang)}</h1>
          <p className="welcome-sheet__subtitle">{pick(ui.whereToGo, lang)}</p>
        </div>

        {/* Search input */}
        <div className="welcome-sheet__search">
          <input
            ref={inputRef}
            className="welcome-sheet__input"
            type="text"
            placeholder={pick(ui.whereToGoPlaceholder, lang)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="welcome-sheet__search-btn" type="button" onClick={handleSearch}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          </button>
        </div>

        {/* Quick destination pills */}
        <div className="welcome-sheet__quick-dests">
          {DESTINATION_HINTS.map(d => (
            <button key={d} className="welcome-sheet__quick-pill" type="button" onClick={() => handleQuickDest(d)}>
              {d}
            </button>
          ))}
        </div>

        {/* Savings teaser */}
        {comparison ? (
          <div className="welcome-sheet__savings">
            <span className="welcome-sheet__savings-multiplier">
              {pick(ui.welcomeFrom, lang)} ฿{comparison.bus.fareThb}
            </span>
            <span className="welcome-sheet__savings-text">
              · {Math.floor(comparison.taxi.maxThb / Math.max(comparison.bus.fareThb, 1))}× {pick(ui.welcomeSavings, lang)}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  // --- Step 2: Route found — show bus info + book button ---
  if (step === "result" && matchedStop) {
    return (
      <div className="welcome-sheet is-expanded">
        <div className="welcome-sheet__handle" onClick={handleReset}>
          <div className="welcome-sheet__bar" />
        </div>

        <div className="welcome-sheet__result">
          <div className="welcome-sheet__result-header">
            <span className="welcome-sheet__result-check">✓</span>
            <div>
              <h2 className="welcome-sheet__result-title">{pick(matchedStop.name, lang)}</h2>
              <p className="welcome-sheet__result-route">{pick(matchedStop.direction!, lang)}</p>
            </div>
          </div>

          {/* Bus info card */}
          <div className="welcome-sheet__next-bus">
            {nextBusMinutes != null ? (
              <div className="welcome-sheet__countdown">
                <span className="welcome-sheet__minutes">{nextBusMinutes}</span>
                <span className="welcome-sheet__min-label">{pick(ui.welcomeMinAway, lang)}</span>
              </div>
            ) : (
              <div className="welcome-sheet__countdown">
                <span className="welcome-sheet__minutes welcome-sheet__minutes--schedule">~15</span>
                <span className="welcome-sheet__min-label">{pick(ui.welcomeMinAway, lang)}</span>
              </div>
            )}
            <div className="welcome-sheet__bus-info">
              <span className="welcome-sheet__bus-label">{pick(ui.welcomeNextBus, lang)}</span>
              <span className="welcome-sheet__seats">
                {seatsEstimate > 0 ? `${seatsEstimate} ${pick(ui.welcomeSeats, lang)}` : pick(ui.welcomeSubtitle, lang)}
              </span>
            </div>
          </div>

          {/* Price comparison */}
          {comparison ? (
            <div className="welcome-sheet__price-compare">
              <div className="welcome-sheet__price-bus">
                <span className="welcome-sheet__price-amount">฿{comparison.bus.fareThb}</span>
                <span className="welcome-sheet__price-label">{pick(ui.compareBusFare, lang)}</span>
              </div>
              <span className="welcome-sheet__price-vs">vs</span>
              <div className="welcome-sheet__price-taxi">
                <span className="welcome-sheet__price-amount welcome-sheet__price-amount--taxi">
                  <del>฿{comparison.taxi.minThb}-{comparison.taxi.maxThb}</del>
                </span>
                <span className="welcome-sheet__price-label">{pick(ui.compareTaxiFare, lang)}</span>
              </div>
            </div>
          ) : null}

          {/* Book seat button */}
          <button className="welcome-sheet__book-btn" type="button" onClick={handleBook}>
            {pick(ui.bookSeat, lang)}
          </button>
        </div>
      </div>
    );
  }

  // --- Step 3: Booked — show QR code + warning ---
  if (step === "booked") {
    return (
      <div className="welcome-sheet is-expanded">
        <div className="welcome-sheet__handle" onClick={handleReset}>
          <div className="welcome-sheet__bar" />
        </div>

        <div className="welcome-sheet__booked">
          <div className="welcome-sheet__booked-icon">✓</div>
          <h2 className="welcome-sheet__booked-title">{pick(ui.seatBooked, lang)}</h2>
          <p className="welcome-sheet__booked-dest">{matchedStop ? pick(matchedStop.name, lang) : ""}</p>

          {/* QR code mock */}
          <div className="welcome-sheet__qr">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <rect width="120" height="120" rx="8" fill="#f8f8f8" />
              {/* Simplified QR pattern */}
              <rect x="10" y="10" width="30" height="30" rx="2" fill="#000" />
              <rect x="80" y="10" width="30" height="30" rx="2" fill="#000" />
              <rect x="10" y="80" width="30" height="30" rx="2" fill="#000" />
              <rect x="15" y="15" width="20" height="20" rx="1" fill="#fff" />
              <rect x="85" y="15" width="20" height="20" rx="1" fill="#fff" />
              <rect x="15" y="85" width="20" height="20" rx="1" fill="#fff" />
              <rect x="20" y="20" width="10" height="10" fill="#000" />
              <rect x="90" y="20" width="10" height="10" fill="#000" />
              <rect x="20" y="90" width="10" height="10" fill="#000" />
              <rect x="50" y="50" width="20" height="20" rx="2" fill="#007AFF" />
              {/* Random pattern */}
              {Array.from({ length: 20 }, (_, i) => (
                <rect key={i} x={45 + (i % 5) * 7} y={10 + Math.floor(i / 5) * 22} width="5" height="5" fill="#333" />
              ))}
            </svg>
            <span className="welcome-sheet__qr-code">{bookingCode}</span>
          </div>

          {/* Warning */}
          <div className="welcome-sheet__warning">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>{pick(ui.bookingWarning, lang)}</span>
          </div>

          {/* New search */}
          <button className="welcome-sheet__new-search" type="button" onClick={handleReset}>
            {pick(ui.searchAnother, lang)}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
