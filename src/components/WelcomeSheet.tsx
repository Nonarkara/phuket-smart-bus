import { useEffect, useRef, useState } from "react";
import type { Lang, PriceComparison, Stop, VehiclePosition } from "@shared/types";
import { ui, pick } from "../lib/i18n";
import { getVehiclesNow } from "../engine/dataProvider";
import { getSimulatedMinutes } from "../engine/fleetSimulator";

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

/* ── Estimate next bus time per destination ── */
const DEST_SCHEDULE: Record<string, number[]> = {
  "Patong": [375,435,495,555,615,675,735,795,855,915,975,1035,1095,1155,1215,1275],
  "Old Town": [360,390,420,450,480,510,540,570,600,630,660,690,720,750,780,810,840,870,900,930,960,990,1020,1050,1080,1110,1140,1170,1200,1230,1260,1290,1320,1350,1380],
  "Airport": [360,420,480,540,600,660,720,780,840,900,960,1020,1080,1140,1200,1260,1320,1380],
  "Rawai": [360,420,480,540,600,660,720,780,840,900,960,1020,1080,1140,1200,1260,1320,1380],
  "Kata": [390,450,510,570,630,690,750,810,870,930,990,1050,1110,1170,1230,1290,1350],
  "Karon": [400,460,520,580,640,700,760,820,880,940,1000,1060,1120,1180,1240,1300,1360],
  "Central": [370,400,430,460,490,520,550,580,610,640,670,700,730,760,790,820,850,880,910,940,970,1000,1030,1060,1090,1120,1150,1180,1210,1240,1270,1300,1330,1360,1390],
  "Chalong": [420,480,540,600,660,720,780,840,900,960,1020,1080,1140,1200,1260,1320,1380],
};

function getNextBusMin(dest: string): number | null {
  const nowMin = getSimulatedMinutes() % 1440;
  const sched = DEST_SCHEDULE[dest];
  if (!sched) return null;
  const next = sched.find((m) => m > nowMin);
  return next ? Math.round(next - nowMin) : null;
}

export function WelcomeSheet({ lang, vehicles: _vehiclesProp, allStops, onNavigateToStop }: WelcomeSheetProps) {
  const [step, setStep] = useState<SheetStep>("ask");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [matchedStop, setMatchedStop] = useState<Stop | null>(null);
  const [barcodeVal, setBarcodeVal] = useState("");
  const [passCode, setPassCode] = useState("");
  const [passInput, setPassInput] = useState("");
  const [passActivated, setPassActivated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live vehicles from the 30x simulation engine (updates every 1s)
  const [liveVehicles, setLiveVehicles] = useState(() => getVehiclesNow());
  useEffect(() => {
    const id = setInterval(() => setLiveVehicles(getVehiclesNow()), 1000);
    return () => clearInterval(id);
  }, []);
  const vehicles = liveVehicles;

  // Compute real bus data for matched stop's route
  const routeVehicles = matchedStop
    ? vehicles.filter(v => v.routeId === matchedStop.routeId)
    : [];
  const movingOnRoute = routeVehicles.filter(v => v.status === "moving");
  const closestBus = movingOnRoute.length > 0 ? movingOnRoute.reduce((a, b) =>
    (a.distanceToDestinationMeters ?? Infinity) < (b.distanceToDestinationMeters ?? Infinity) ? a : b
  ) : null;
  const nextBusMinutes = closestBus
    ? Math.min(45, Math.max(1, Math.round((closestBus.stopsAway ?? 5) * 2.5)))
    : routeVehicles.length > 0 ? 15 : null;
  const totalSeats = routeVehicles.length * SEATS_PER_BUS;
  const occupiedEstimate = Math.floor(totalSeats * 0.4);
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

  // --- Step 1: Collapsed = "Next bus" teaser, Expanded = full search ---
  // Live ticking countdown — updates every 200ms for visible seconds ticking
  const [tickingDisplay, setTickingDisplay] = useState({ text: "", dest: "Patong", cls: "" });
  useEffect(() => {
    function refresh() {
      const simMin = getSimulatedMinutes() % 1440;
      const pSched = DEST_SCHEDULE["Patong"];
      const aSched = DEST_SCHEDULE["Airport"];
      const pNext = pSched?.find((m) => m > simMin);
      const aNext = aSched?.find((m) => m > simMin);
      const pDiff = pNext ? pNext - simMin : null;
      const aDiff = aNext ? aNext - simMin : null;
      const diff = pDiff ?? aDiff;
      const dest = pDiff !== null ? "Patong" : "Airport";

      if (diff === null) {
        setTickingDisplay({ text: "Resumes 06:00", dest, cls: "welcome-sheet__next-time--dim" });
      } else {
        const totalSec = Math.max(0, Math.round(diff * 60));
        const mm = Math.floor(totalSec / 60);
        const ss = totalSec % 60;
        setTickingDisplay({
          text: mm > 0 ? `${mm}:${String(ss).padStart(2, "0")}` : `${ss}s`,
          dest,
          cls: ""
        });
      }
    }
    refresh();
    const id = setInterval(refresh, 200); // 5fps for smooth seconds
    return () => clearInterval(id);
  }, []);

  if (step === "ask") {
    if (!expanded) {
      const timeDisplay = tickingDisplay.text;
      const timeClass = tickingDisplay.cls;
      const primaryDest = tickingDisplay.dest;

      return (
        <div className="welcome-sheet welcome-sheet--collapsed" onClick={() => setExpanded(true)}>
          <div className="welcome-sheet__handle"><div className="welcome-sheet__bar" /></div>
          <div className="welcome-sheet__peek">
            <div className="welcome-sheet__next-bus">
              <span className="welcome-sheet__next-label">Next bus to {primaryDest}</span>
              <span className={`welcome-sheet__next-time ${timeClass}`}>{timeDisplay}</span>
            </div>
            <div className="welcome-sheet__peek-right">
              <span className="welcome-sheet__peek-fare">฿{BUS_FARE}</span>
              <span className="welcome-sheet__peek-hint">Tap for routes</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="welcome-sheet">
        <div className="welcome-sheet__handle" onClick={() => setExpanded(false)}><div className="welcome-sheet__bar" /></div>
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
          {DESTINATION_HINTS.map(d => {
            const min = getNextBusMin(d);
            return (
              <button key={d} className="welcome-sheet__quick-pill" type="button" onClick={() => handleQuickDest(d)}>
                {d}{min !== null ? <span className="welcome-sheet__pill-time"> · {min}m</span> : null}
              </button>
            );
          })}
        </div>

        <div className="welcome-sheet__fare-teaser">
          <span className="welcome-sheet__fare-amount">฿{BUS_FARE}</span>
          <span className="welcome-sheet__fare-label">{pick(ui.welcomeAllRoutes, lang)}</span>
        </div>

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
