/**
 * Passenger App — the front door of bus.nonarkara.org.
 *
 * A single-screen, phone-first experience for the actual rider — a person
 * who just walked out of HKT arrivals, is holding a backpack with one hand
 * and a phone with the other, and wants to know three things:
 *
 *   1. Is the bus actually coming? (countdown)
 *   2. How do I pay? (one-time pass or 3-day pass)
 *   3. Where does it stop? (anywhere — Phuket has no formal bus stops)
 *
 * The model in plain language: there is no scheduled "stop" in Phuket.
 * Buses run the airport corridor and stop wherever the passenger names —
 * a hotel, a beach, a restaurant. The single-ride pass captures the
 * destination so the driver knows where to pull over.
 *
 * 3-day pass is a Stripe-style checkout (mocked). The dashboard we already
 * built is the operator's view; this page is the rider's view, and it
 * should never require the rider to think about the operator.
 */

import { useEffect, useMemo, useState } from "react";
import { getAirportDepartures, getSimulatedMinutes } from "../../engine/fleetSimulator";
import { getOpsFlightSchedule } from "../../engine/opsFlightSchedule";
import { ADSB_POLL_MS, fetchAdsbAroundHkt } from "../../engine/adsbFlights";

/* -------------------------------------------------------------------------
 * Ticket options
 * ----------------------------------------------------------------------- */

const SINGLE_FARE_THB = 100;
const THREE_DAY_FARE_THB = 250;

const QUICK_DESTINATIONS = [
  "Patong Beach",
  "Karon / Kata",
  "Phuket Old Town",
  "Rawai / Nai Harn",
  "Kamala / Surin",
  "Bang Tao / Laguna"
];

/* -------------------------------------------------------------------------
 * Live bus time — pure functions of the engine, ticking every 250ms
 * ----------------------------------------------------------------------- */

function useNextBusCountdown() {
  const [now, setNow] = useState(() => getSimulatedMinutes());
  useEffect(() => {
    const id = setInterval(() => setNow(getSimulatedMinutes()), 250);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    const departures = getAirportDepartures().slice().sort((a, b) => a - b);
    const firstToday = departures.find((d) => d > now);
    const next = firstToday ?? (departures[0] ?? 0) + 24 * 60; // wraps tomorrow
    const deltaMin = next - now;
    const totalSec = Math.max(0, Math.round(deltaMin * 60));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return { mm: m, ss: s, depMin: next };
  }, [now]);
}

function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function FlightWatch() {
  const [kind, setKind] = useState<"arr" | "dep">("arr");
  const [now, setNow] = useState(() => getSimulatedMinutes());
  const [aircraft, setAircraft] = useState<{ count: number; status: "live" | "stale" | "empty" }>({ count: 0, status: "empty" });

  useEffect(() => {
    const clock = window.setInterval(() => setNow(getSimulatedMinutes()), 2_000);
    let cancelled = false;
    const ctrl = new AbortController();
    const refresh = async () => {
      const snap = await fetchAdsbAroundHkt(ctrl.signal);
      if (!cancelled) setAircraft({ count: snap.aircraft.length, status: snap.status });
    };
    void refresh();
    const poll = window.setInterval(() => void refresh(), ADSB_POLL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(clock);
      window.clearInterval(poll);
    };
  }, []);

  const flights = useMemo(() => getOpsFlightSchedule()
    .filter((flight) => flight.mode === "flight" && flight.type === kind && flight.schedMin >= now - 15)
    .slice(0, 4), [kind, now]);

  return (
    <section className="pa-flights" aria-labelledby="pa-flight-title">
      <header className="pa-flights__head">
        <div>
          <span className="pa-flights__kicker">HKT flight watch</span>
          <h2 id="pa-flight-title">Will the terminal get busy?</h2>
        </div>
        <span className={`pa-flights__radar pa-flights__radar--${aircraft.status}`}>
          {aircraft.count} aircraft · {aircraft.status === "live" ? "ADS-B live" : aircraft.status === "stale" ? "last seen" : "no signal"}
        </span>
      </header>
      <div className="pa-flights__tabs" role="tablist" aria-label="Flight direction">
        <button type="button" role="tab" aria-selected={kind === "arr"} className={kind === "arr" ? "is-active" : ""} onClick={() => setKind("arr")}>Arrivals</button>
        <button type="button" role="tab" aria-selected={kind === "dep"} className={kind === "dep" ? "is-active" : ""} onClick={() => setKind("dep")}>Departures</button>
      </div>
      <div className="pa-flights__board">
        {flights.map((flight) => (
          <div className="pa-flights__row" key={`${flight.flightNo}-${flight.schedMin}-${flight.type}`}>
            <time>{flight.timeLabel}</time>
            <strong>{flight.flightNo}</strong>
            <span>{flight.city}</span>
            <small>{flight.type === "arr" ? "to HKT" : "from HKT"}</small>
          </div>
        ))}
      </div>
      <p className="pa-flights__truth">
        Amber aircraft are live ADS-B observations. Times above run with this research simulation—not airport status.
        For gates, delays and the official live board, use AOT.
      </p>
      <a className="pa-flights__official" href="https://phuket.airportthai.co.th/flight" target="_blank" rel="noreferrer">
        Open official AOT live flight status <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}

/* -------------------------------------------------------------------------
 * Mocked Stripe checkout — looks like a real card form but never
 * actually charges. The numbers below are Stripe's well-known test
 * card so anyone who looks closely recognises the convention.
 * ----------------------------------------------------------------------- */

const STRIPE_TEST_CARD = "4242 4242 4242 4242";

/* -------------------------------------------------------------------------
 * Mocked QR — a deterministic but realistic-looking SVG QR placeholder.
 * Not a real scannable code. The driver's tablet in the depot reads
 * a server-side token, not this visual.
 * ----------------------------------------------------------------------- */

function MockQR({ payload }: { payload: string }) {
  // Simple 21x21 grid of black/white modules, deterministic from the
  // payload (string hash). Not a real QR; the visual cue is enough.
  const cells = useMemo(() => {
    const size = 21;
    const seed = Array.from(payload).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 5381);
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    let s = seed;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        grid[y][x] = (s & 0x8000) !== 0;
      }
    }
    // Three finder squares (corners) — large solid 7x7 with a 5x5 hole and a 3x3 core
    const finder = (cx: number, cy: number) => {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const onEdge = dy === 0 || dy === 6 || dx === 0 || dx === 6;
          const inner = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
          grid[cy + dy][cx + dx] = onEdge || inner;
        }
      }
    };
    finder(0, 0);
    finder(size - 7, 0);
    finder(0, size - 7);
    return grid;
  }, [payload]);

  return (
    <svg viewBox="0 0 21 21" className="pa-qr" aria-label={`Boarding token: ${payload}`}>
      <rect width="21" height="21" fill="#fff" />
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111820" /> : null
        )
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------
 * Main component
 * ----------------------------------------------------------------------- */

type Step = "home" | "destination" | "payment" | "ticket";

export function PassengerApp() {
  const countdown = useNextBusCountdown();
  const [step, setStep] = useState<Step>("home");
  const [passType, setPassType] = useState<"single" | "3day" | null>(null);
  const [destination, setDestination] = useState<string>("");
  const [ticketId, setTicketId] = useState<string>("");

  // The static index.html is built for the toolkit research surface
  // (different title, different meta description). Override on mount so
  // the rider sees a tab labelled for the bus, not the toolkit.
  useEffect(() => {
    const oldTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const oldDescription = description?.content;
    document.documentElement.classList.add("passenger-site-mode");
    document.body.classList.add("passenger-site-mode");
    document.title = "Phuket Smart Bus · ฿100 to Patong";
    if (description) {
      description.content = "See the next Phuket Smart Bus from HKT airport, choose a destination and try the single-ride or 3-day pass prototype.";
    }
    return () => {
      document.documentElement.classList.remove("passenger-site-mode");
      document.body.classList.remove("passenger-site-mode");
      document.title = oldTitle;
      if (description && oldDescription !== undefined) description.content = oldDescription;
    };
  }, []);

  // Form state for the mocked Stripe checkout
  const [card, setCard] = useState<string>(STRIPE_TEST_CARD);
  const [expiry, setExpiry] = useState<string>("12 / 28");
  const [cvc, setCvc] = useState<string>("123");
  const [name, setName] = useState<string>("");

  function startSingle() {
    setPassType("single");
    setStep("destination");
  }
  function startThreeDay() {
    setPassType("3day");
    setStep("payment");
  }
  function confirmSingle() {
    if (!destination.trim()) return;
    const id = `PSKB-S${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setTicketId(id);
    setStep("ticket");
  }
  function confirmThreeDay() {
    const id = `PSKB-3D${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setTicketId(id);
    setStep("ticket");
  }
  function reset() {
    setStep("home");
    setPassType(null);
    setDestination("");
    setTicketId("");
  }

  return (
    <div className="pa-shell">
      <div className="pa-app" data-step={step}>
      <header className="pa-header">
        <div className="pa-header__brand">
          <span className="pa-header__logo" aria-hidden="true">PSKB</span>
          <span className="pa-header__name">Phuket Smart Bus</span>
        </div>
        <a className="pa-header__link" href="https://depa-usdot.nonarkara.org/">
          Research ↗
        </a>
      </header>

      {step === "home" && (
        <HomeStep
          countdown={countdown}
          onPickSingle={startSingle}
          onPickThreeDay={startThreeDay}
        />
      )}

      {step === "destination" && (
        <DestinationStep
          countdown={countdown}
          destination={destination}
          setDestination={setDestination}
          onBack={() => setStep("home")}
          onContinue={confirmSingle}
        />
      )}

      {step === "payment" && (
        <PaymentStep
          countdown={countdown}
          card={card}
          setCard={setCard}
          expiry={expiry}
          setExpiry={setExpiry}
          cvc={cvc}
          setCvc={setCvc}
          name={name}
          setName={setName}
          onBack={() => setStep("home")}
          onPay={confirmThreeDay}
        />
      )}

      {step === "ticket" && (
        <TicketStep
          countdown={countdown}
          passType={passType}
          destination={destination}
          ticketId={ticketId}
          onReset={reset}
        />
      )}

      <footer className="pa-footer">
        <span>Prototype fares · live timetable simulation · no real payment</span>
        <a href="https://depa-usdot.nonarkara.org/" className="pa-footer__link">
          How this system was built
        </a>
      </footer>
      </div>

      {/* Desktop-only: investor/ops is a different job — never the phone tourist chrome. */}
      <aside className="pa-console-invite" aria-label="Operations console preview">
        <span className="pa-console-invite__kicker">Same system · another job</span>
        <h2>The passenger sees one bus. The operator sees the whole day.</h2>
        <p>
          Every destination request can become a demand signal. GPS shows the duty.
          Anonymous boarding counts show the load. The console joins them before
          anybody buys another bus.
        </p>
        <div className="pa-console-invite__chain" aria-label="Passenger request becomes an operating decision">
          <span>Destination</span><b>→</b><span>Boarding</span><b>→</b><span>Dispatch</span><b>→</b><span>Evidence</span>
        </div>
        <a href="/ops">Open the live operations console <span aria-hidden="true">↗</span></a>
        <a className="pa-console-invite__research" href="https://depa-usdot.nonarkara.org/">
          Read the research behind it
        </a>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Step 1 — Home: countdown + ticket cards
 * ----------------------------------------------------------------------- */

function HomeStep({
  countdown,
  onPickSingle,
  onPickThreeDay
}: {
  countdown: ReturnType<typeof useNextBusCountdown>;
  onPickSingle: () => void;
  onPickThreeDay: () => void;
}) {
  return (
    <main className="pa-home">
      <h1 className="sr-only">Phuket Smart Bus tickets and next airport departure</h1>
      <section className="pa-countdown" aria-live="polite">
        <span className="pa-countdown__label">Next scheduled bus leaves in</span>
        <strong className="pa-countdown__time">
          {String(countdown.mm).padStart(2, "0")}:{String(countdown.ss).padStart(2, "0")}
        </strong>
        <span className="pa-countdown__sub">
          From HKT Terminal 2 at <strong>{formatClock(countdown.depMin)}</strong> · about 100 min to Patong
        </span>
      </section>

      <FlightWatch />

      <section className="pa-cards" aria-label="Ticket options">
        <button className="pa-card" type="button" onClick={onPickSingle}>
          <span className="pa-card__kicker">Single ride</span>
          <strong className="pa-card__price">฿100</strong>
          <p className="pa-card__copy">
            Name your hotel or area. The driver gets the request and confirms
            a safe pull-over on the airport corridor.
          </p>
          <span className="pa-card__cta">
            Buy single ride <span aria-hidden="true">→</span>
          </span>
        </button>

        <button className="pa-card pa-card--featured" type="button" onClick={onPickThreeDay}>
          <span className="pa-card__kicker">3-day pass</span>
          <strong className="pa-card__price">฿250</strong>
          <p className="pa-card__copy">
            A mock 72-hour pass and reusable boarding token. Stripe Checkout
            is shown as the production payment path.
          </p>
          <span className="pa-card__cta">
            Buy 3-day pass <span aria-hidden="true">→</span>
          </span>
        </button>
      </section>

      <section className="pa-promise">
        <h2>What the bus is</h2>
        <ul>
          <li>The countdown comes from the published airport timetable, not a decorative timer.</li>
          <li>The same fleet rotates in both directions — airport to the island and back.</li>
          <li>Your destination becomes a driver request; the driver still chooses a safe, legal pull-over.</li>
          <li>฿100 is the modelled single fare. This prototype does not charge a card.</li>
        </ul>
      </section>
    </main>
  );
}

/* -------------------------------------------------------------------------
 * Step 2 — Destination (for single ride)
 * ----------------------------------------------------------------------- */

function DestinationStep({
  countdown,
  destination,
  setDestination,
  onBack,
  onContinue
}: {
  countdown: ReturnType<typeof useNextBusCountdown>;
  destination: string;
  setDestination: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <main className="pa-form">
      <button type="button" className="pa-back" onClick={onBack}>
        ← Single ride
      </button>
      <h1 className="pa-form__title">Where are you going?</h1>
      <p className="pa-form__sub">
        Type the hotel, beach, or area. The request appears on the driver
        tablet; the driver confirms the nearest safe pull-over on the corridor.
      </p>

      <label className="pa-form__field">
        <span>Hotel or destination</span>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g. Patong Beach, Banyan Tree Phuket, Central Phuket"
          autoFocus
          className="pa-form__input"
        />
      </label>

      <div className="pa-suggestions">
        <span className="pa-suggestions__label">Popular destinations</span>
        <ul>
          {QUICK_DESTINATIONS.map((d) => (
            <li key={d}>
              <button type="button" onClick={() => setDestination(d)}>
                {d}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className="pa-pay"
        onClick={onContinue}
        disabled={!destination.trim()}
      >
        Reserve ride · pay driver ฿{SINGLE_FARE_THB}
      </button>
      <p className="pa-form__note">
        Prototype only. No payment is taken. Your bus is currently due in{" "}
        {String(countdown.mm).padStart(2, "0")}:{String(countdown.ss).padStart(2, "0")}.
      </p>
    </main>
  );
}

/* -------------------------------------------------------------------------
 * Step 3 — Payment (for 3-day pass)
 * ----------------------------------------------------------------------- */

function PaymentStep({
  countdown,
  card,
  setCard,
  expiry,
  setExpiry,
  cvc,
  setCvc,
  name,
  setName,
  onBack,
  onPay
}: {
  countdown: ReturnType<typeof useNextBusCountdown>;
  card: string;
  setCard: (v: string) => void;
  expiry: string;
  setExpiry: (v: string) => void;
  cvc: string;
  setCvc: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  onBack: () => void;
  onPay: () => void;
}) {
  const canPay = name.trim().length > 1 && card.replace(/\s/g, "").length >= 13 && cvc.length >= 3;
  return (
    <main className="pa-form">
      <button type="button" className="pa-back" onClick={onBack}>
        ← 3-day pass
      </button>
      <h1 className="pa-form__title">Pay ฿{THREE_DAY_FARE_THB} for unlimited rides</h1>
      <p className="pa-form__sub">
        72 hours of unlimited PKSB bus use. Production would use
        Stripe-hosted Checkout. This prototype does not transmit card data.
      </p>

      <div className="pa-stripe" role="group" aria-label="Card details (Stripe)">
        <div className="pa-stripe__brand">
          <span aria-hidden="true">stripe</span>
          <small>test mode</small>
        </div>
        <label className="pa-form__field">
          <span>Card number</span>
          <input
            type="text"
            inputMode="numeric"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            className="pa-form__input pa-form__input--mono"
            autoComplete="cc-number"
          />
        </label>
        <div className="pa-form__row">
          <label className="pa-form__field">
            <span>Expiry</span>
            <input
              type="text"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="pa-form__input pa-form__input--mono"
              autoComplete="cc-exp"
              placeholder="MM / YY"
            />
          </label>
          <label className="pa-form__field">
            <span>CVC</span>
            <input
              type="text"
              inputMode="numeric"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              className="pa-form__input pa-form__input--mono"
              autoComplete="cc-csc"
            />
          </label>
        </div>
        <label className="pa-form__field">
          <span>Cardholder name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="pa-form__input"
            placeholder="Name on card"
            autoComplete="cc-name"
          />
        </label>
      </div>

      <button
        type="button"
        className="pa-pay"
        onClick={onPay}
        disabled={!canPay}
      >
        Pay ฿{THREE_DAY_FARE_THB} · valid for 72 hours
      </button>
      <p className="pa-form__note">
        Demonstration data only (Stripe's 4242 test number). Nothing is sent.
      </p>
    </main>
  );
}

/* -------------------------------------------------------------------------
 * Step 4 — Ticket: QR + show to driver
 * ----------------------------------------------------------------------- */

function TicketStep({
  countdown,
  passType,
  destination,
  ticketId,
  onReset
}: {
  countdown: ReturnType<typeof useNextBusCountdown>;
  passType: "single" | "3day" | null;
  destination: string;
  ticketId: string;
  onReset: () => void;
}) {
  const fare = passType === "3day" ? THREE_DAY_FARE_THB : SINGLE_FARE_THB;
  return (
    <main className="pa-ticket">
      <div className="pa-ticket__head">
        <span className="pa-ticket__success">Boarding token ready</span>
        <h1 className="pa-ticket__title">
          Show this to the driver at the airport curb.
        </h1>
        <p className="pa-ticket__sub">
          The driver scans the code from your screen — or reads the
          token. The bus leaves in{" "}
          <strong>
            {String(countdown.mm).padStart(2, "0")}:{String(countdown.ss).padStart(2, "0")}
          </strong>{" "}
          from Terminal 2.
        </p>
      </div>

      <div className="pa-ticket__card">
        <header>
          <span>Phuket Smart Bus · PKSB</span>
          <span>{passType === "3day" ? "3-day pass" : "Single ride"}</span>
        </header>
        <MockQR payload={ticketId} />
        <dl>
          <div>
            <dt>Token</dt>
            <dd className="pa-mono">{ticketId}</dd>
          </div>
          <div>
            <dt>Fare</dt>
            <dd>฿{fare}</dd>
          </div>
          {passType === "single" && destination && (
            <div>
              <dt>Drop-off</dt>
              <dd>{destination}</dd>
            </div>
          )}
          {passType === "3day" && (
            <div>
              <dt>Valid for</dt>
              <dd>72 hours from first scan</dd>
            </div>
          )}
        </dl>
        <footer>
          <span>Requested drop-off on the airport corridor</span>
          <span>Driver confirms the safe pull-over</span>
        </footer>
      </div>

      <button type="button" className="pa-pay pa-pay--ghost" onClick={onReset}>
        Buy another ticket
      </button>
    </main>
  );
}

export default PassengerApp;
