import { useRef, useState } from "react";
import type { Lang, PriceComparison, Stop, VehiclePosition } from "@shared/types";
import { ui, pick } from "../lib/i18n";

type SheetStep = "ask" | "result" | "booked" | "pass";

const BUS_FARE = 100; // ฿100 flat fare
const SEATS_PER_BUS = 25;

const DESTINATION_HINTS = [
  "Patong", "Old Town", "Rawai", "Airport",
  "Kata", "Karon", "Central", "Chalong",
];

const SEARCH_ALIASES: Record<string, string[]> = {
  "patong": ["patong", "jungceylon", "bangla"],
  "kata": ["kata"],
  "karon": ["karon"],
  "airport": ["airport", "สนามบิน"],
  "old town": ["old town", "rassada", "phuket town", "terminal"],
  "central": ["central", "floresta", "lotus"],
  "rawai": ["rawai"],
  "chalong": ["chalong"],
};

// Grab/taxi fare estimates by zone
const GRAB_FARES: Record<string, number> = {
  "patong": 450, "kata": 550, "karon": 500, "airport": 900,
  "old town": 350, "central": 400, "rawai": 600, "chalong": 400,
};

function findBestStop(query: string, stops: Stop[]): Stop | null {
  const q = query.toLowerCase().trim();
  if (!q || stops.length === 0) return null;
  const aliases = SEARCH_ALIASES[q] ?? [q];
  const allTerms = [q, ...aliases];
  for (const term of allTerms) {
    const m = stops.find(s => s.name.en.toLowerCase().includes(term) || s.name.th.includes(term));
    if (m) return m;
  }
  for (const term of allTerms) {
    const m = stops.find(s => s.nearbyPlace?.name?.toLowerCase().includes(term));
    if (m) return m;
  }
  for (const term of allTerms) {
    const m = stops.find(s => s.direction?.en.toLowerCase().includes(term) || s.routeId.includes(term));
    if (m) return m;
  }
  return stops[0] ?? null;
}

function generateBarcode(): string {
  const chars = "0123456789";
  let code = "";
  for (let i = 0; i < 13; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generate16DigitCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// SVG barcode renderer
function BarcodeGraphic({ code }: { code: string }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < code.length; i++) {
    const digit = parseInt(code[i]!, 10);
    // Generate bar pattern from digit
    const widths = [1, 2, 1, 1.5, 1, 2, 1];
    for (let j = 0; j < widths.length; j++) {
      if (j % 2 === (digit % 2)) {
        bars.push({ x, w: widths[j]! });
      }
      x += widths[j]!;
    }
    x += 1; // gap between digit groups
  }
  const totalW = x;
  return (
    <svg viewBox={`0 0 ${totalW} 40`} width="200" height="50" className="welcome-sheet__barcode-svg">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="35" fill="#000" />
      ))}
      <text x={totalW / 2} y="39" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="#333">
        {code}
      </text>
    </svg>
  );
}

interface WelcomeSheetProps {
  lang: Lang;
  vehicles: VehiclePosition[];
  allStops: Stop[];
  onNavigateToStop: (stopId: string) => void;
}

export function WelcomeSheet({ lang, vehicles, allStops, onNavigateToStop }: WelcomeSheetProps) {
  const [step, setStep] = useState<SheetStep>("ask");
  const [query, setQuery] = useState("");
  const [matchedStop, setMatchedStop] = useState<Stop | null>(null);
  const [barcodeVal, setBarcodeVal] = useState("");
  const [passCode, setPassCode] = useState("");
  const [passInput, setPassInput] = useState("");
  const [passActivated, setPassActivated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute real bus data for matched stop's route
  const routeVehicles = matchedStop
    ? vehicles.filter(v => v.routeId === matchedStop.routeId)
    : [];
  const movingOnRoute = routeVehicles.filter(v => v.status === "moving");
  // Estimate minutes: use speed + distance, capped at reasonable range
  const closestBus = movingOnRoute.length > 0 ? movingOnRoute.reduce((a, b) =>
    (a.distanceToDestinationMeters ?? Infinity) < (b.distanceToDestinationMeters ?? Infinity) ? a : b
  ) : null;
  const nextBusMinutes = closestBus
    ? Math.min(45, Math.max(3, Math.round((closestBus.stopsAway ?? 5) * 2.5)))
    : routeVehicles.length > 0 ? 15 : null;
  const totalSeats = routeVehicles.length * SEATS_PER_BUS;
  const occupiedEstimate = Math.floor(totalSeats * 0.4); // ~40% load factor mock
  const seatsLeft = Math.max(0, totalSeats - occupiedEstimate);

  // Grab fare for comparison
  const grabFare = GRAB_FARES[query.toLowerCase()] ?? 500;

  function handleSearch() {
    const stop = findBestStop(query, allStops);
    if (stop) { setMatchedStop(stop); setStep("result"); onNavigateToStop(stop.id); }
  }

  function handleQuickDest(dest: string) {
    setQuery(dest);
    const stop = findBestStop(dest, allStops);
    if (stop) { setMatchedStop(stop); setStep("result"); onNavigateToStop(stop.id); }
  }

  function handleBook() {
    setBarcodeVal(generateBarcode());
    setStep("booked");
  }

  function handleReset() {
    setStep("ask"); setQuery(""); setMatchedStop(null); setBarcodeVal("");
  }

  function handleActivatePass() {
    if (passInput.replace(/-/g, "").length >= 16) {
      setPassActivated(true);
    }
  }

  // --- Step 1: "Where do you want to go?" ---
  if (step === "ask") {
    return (
      <div className="welcome-sheet">
        <div className="welcome-sheet__handle"><div className="welcome-sheet__bar" /></div>
        <div className="welcome-sheet__header">
          <h1 className="welcome-sheet__title">{pick(ui.welcomeTitle, lang)}</h1>
          <p className="welcome-sheet__subtitle">{pick(ui.whereToGo, lang)}</p>
        </div>

        <div className="welcome-sheet__search">
          <input ref={inputRef} className="welcome-sheet__input" type="text"
            placeholder={pick(ui.whereToGoPlaceholder, lang)} value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
          <button className="welcome-sheet__search-btn" type="button" onClick={handleSearch}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          </button>
        </div>

        <div className="welcome-sheet__quick-dests">
          {DESTINATION_HINTS.map(d => (
            <button key={d} className="welcome-sheet__quick-pill" type="button" onClick={() => handleQuickDest(d)}>{d}</button>
          ))}
        </div>

        <div className="welcome-sheet__fare-teaser">
          <span className="welcome-sheet__fare-amount">฿{BUS_FARE}</span>
          <span className="welcome-sheet__fare-label">{pick(ui.welcomeAllRoutes, lang)}</span>
        </div>

        {/* Week pass link */}
        <button className="welcome-sheet__pass-link" type="button" onClick={() => { setPassCode(generate16DigitCode()); setStep("pass"); }}>
          {pick(ui.haveWeekPass, lang)}
        </button>
      </div>
    );
  }

  // --- Step 2: Route found + fare comparison ---
  if (step === "result" && matchedStop) {
    return (
      <div className="welcome-sheet is-expanded">
        <div className="welcome-sheet__handle" onClick={handleReset}><div className="welcome-sheet__bar" /></div>
        <div className="welcome-sheet__result">
          <div className="welcome-sheet__result-header">
            <span className="welcome-sheet__result-check">✓</span>
            <div>
              <h2 className="welcome-sheet__result-title">{pick(matchedStop.name, lang)}</h2>
              <p className="welcome-sheet__result-route">{pick(matchedStop.direction!, lang)}</p>
            </div>
          </div>

          {/* Bus countdown + seats */}
          <div className="welcome-sheet__next-bus">
            <div className="welcome-sheet__countdown">
              <span className="welcome-sheet__minutes">{nextBusMinutes ?? "~15"}</span>
              <span className="welcome-sheet__min-label">{pick(ui.welcomeMinAway, lang)}</span>
            </div>
            <div className="welcome-sheet__bus-info">
              <span className="welcome-sheet__bus-label">{pick(ui.welcomeNextBus, lang)}</span>
              <span className="welcome-sheet__seats">{seatsLeft}/{totalSeats || SEATS_PER_BUS} {pick(ui.welcomeSeats, lang)}</span>
            </div>
          </div>

          {/* Fare comparison: Bus vs Grab vs Taxi */}
          <div className="welcome-sheet__fare-compare">
            <div className="welcome-sheet__fare-option welcome-sheet__fare-option--bus">
              <span className="welcome-sheet__fare-mode">🚌 Smart Bus</span>
              <span className="welcome-sheet__fare-price">฿{BUS_FARE}</span>
            </div>
            <div className="welcome-sheet__fare-option">
              <span className="welcome-sheet__fare-mode">🚗 Grab</span>
              <span className="welcome-sheet__fare-price welcome-sheet__fare-price--other">฿{grabFare}</span>
            </div>
            <div className="welcome-sheet__fare-option">
              <span className="welcome-sheet__fare-mode">🚕 Taxi</span>
              <span className="welcome-sheet__fare-price welcome-sheet__fare-price--other">฿{Math.floor(grabFare * 1.4)}-{Math.floor(grabFare * 2)}</span>
            </div>
          </div>

          <button className="welcome-sheet__book-btn" type="button" onClick={handleBook}>
            {pick(ui.bookSeat, lang)} — ฿{BUS_FARE}
          </button>
        </div>
      </div>
    );
  }

  // --- Step 3: Booked — barcode + seat hold ---
  if (step === "booked") {
    return (
      <div className="welcome-sheet is-expanded">
        <div className="welcome-sheet__handle" onClick={handleReset}><div className="welcome-sheet__bar" /></div>
        <div className="welcome-sheet__booked">
          <div className="welcome-sheet__booked-icon">✓</div>
          <h2 className="welcome-sheet__booked-title">{pick(ui.seatBooked, lang)}</h2>
          <p className="welcome-sheet__booked-dest">{matchedStop ? pick(matchedStop.name, lang) : ""}</p>

          {/* Barcode */}
          <div className="welcome-sheet__barcode">
            <BarcodeGraphic code={barcodeVal} />
          </div>

          <div className="welcome-sheet__booking-info">
            <div className="welcome-sheet__booking-row">
              <span>💰</span>
              <span>฿{BUS_FARE} — {pick(ui.payOnBoard, lang)}</span>
            </div>
            <div className="welcome-sheet__booking-row">
              <span>💳</span>
              <span>{pick(ui.paymentMethods, lang)}</span>
            </div>
          </div>

          <div className="welcome-sheet__warning">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>{pick(ui.seatHoldWarning, lang)}</span>
          </div>

          <button className="welcome-sheet__new-search" type="button" onClick={handleReset}>
            {pick(ui.searchAnother, lang)}
          </button>
        </div>
      </div>
    );
  }

  // --- Step 4: Week pass activation ---
  if (step === "pass") {
    return (
      <div className="welcome-sheet is-expanded">
        <div className="welcome-sheet__handle" onClick={handleReset}><div className="welcome-sheet__bar" /></div>
        <div className="welcome-sheet__pass">
          <h2 className="welcome-sheet__pass-title">{pick(ui.weekPassTitle, lang)}</h2>
          {!passActivated ? (
            <>
              <p className="welcome-sheet__pass-desc">{pick(ui.weekPassDesc, lang)}</p>
              <input className="welcome-sheet__pass-input" type="text" placeholder="XXXX-XXXX-XXXX-XXXX"
                value={passInput} onChange={(e) => setPassInput(e.target.value.toUpperCase())}
                maxLength={19} />
              <button className="welcome-sheet__book-btn" type="button" onClick={handleActivatePass}>
                {pick(ui.activatePass, lang)}
              </button>
            </>
          ) : (
            <div className="welcome-sheet__pass-active">
              <div className="welcome-sheet__pass-badge">✓ {pick(ui.passActive, lang)}</div>
              <div className="welcome-sheet__pass-timer">
                <span className="welcome-sheet__pass-days">7</span>
                <span className="welcome-sheet__pass-days-label">{pick(ui.daysRemaining, lang)}</span>
              </div>
              <p className="welcome-sheet__pass-note">{pick(ui.passUnlimited, lang)}</p>
            </div>
          )}
          <button className="welcome-sheet__new-search" type="button" onClick={handleReset}>
            ← {pick(ui.backToSearch, lang)}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
