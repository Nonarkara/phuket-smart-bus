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
    document.title = "Phuket Smart Bus · ฿100 to Patong";
    return () => { document.title = oldTitle; };
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
    <div className="pa-app" data-step={step}>
      <header className="pa-header">
        <div className="pa-header__brand">
          <span className="pa-header__logo" aria-hidden="true">PSKB</span>
          <span className="pa-header__name">Phuket Smart Bus</span>
        </div>
        <a className="pa-header__link" href="https://depa-usdot.nonarkara.org/">
          For operators ↗
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
        <span>PSKB · ฿100 single · ฿250 3-day · every hour 06:00 – 23:30</span>
        <a href="https://depa-usdot.nonarkara.org/" className="pa-footer__link">
          Open the operator console
        </a>
      </footer>
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
      <section className="pa-countdown" aria-live="polite">
        <span className="pa-countdown__label">Next bus leaves in</span>
        <strong className="pa-countdown__time">
          {String(countdown.mm).padStart(2, "0")}:{String(countdown.ss).padStart(2, "0")}
        </strong>
        <span className="pa-countdown__sub">
          From HKT Terminal 2 at <strong>{formatClock(countdown.depMin)}</strong> · 95 min to Patong
        </span>
      </section>

      <section className="pa-cards" aria-label="Ticket options">
        <button className="pa-card" type="button" onClick={onPickSingle}>
          <span className="pa-card__kicker">Single ride</span>
          <strong className="pa-card__price">฿100</strong>
          <p className="pa-card__copy">
            Tell us where. The bus stops at your hotel — anywhere on the
            airport corridor, no formal stop needed.
          </p>
          <span className="pa-card__cta">
            Buy single ride <span aria-hidden="true">→</span>
          </span>
        </button>

        <button className="pa-card pa-card--featured" type="button" onClick={onPickThreeDay}>
          <span className="pa-card__kicker">3-day pass</span>
          <strong className="pa-card__price">฿250</strong>
          <p className="pa-card__copy">
            Unlimited rides for 72 hours. Use the same boarding token on any
            PKSB bus. Pay once, ride the whole stay.
          </p>
          <span className="pa-card__cta">
            Buy 3-day pass <span aria-hidden="true">→</span>
          </span>
        </button>
      </section>

      <section className="pa-promise">
        <h2>What the bus is</h2>
        <ul>
          <li>One bus every hour, 06:00 – 23:30, 25 departures a day.</li>
          <li>Same vehicle runs both ways — airport curb to your hotel and back.</li>
          <li>Stops wherever you tell the driver. There are no formal bus stops in Phuket.</li>
          <li>฿100 is about 7× cheaper than the cheapest Grab to Patong, 10× cheaper than a walk-up taxi.</li>
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
        Type the hotel, the beach, or the area. The driver stops there
        directly — no formal bus stop, no transfer.
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
        Pay ฿{SINGLE_FARE_THB} · bus in {String(countdown.mm).padStart(2, "0")}:{String(countdown.ss).padStart(2, "0")}
      </button>
      <p className="pa-form__note">
        This is a mockup. No card is charged. The boarding token is for
        the operator console at <a href="https://depa-usdot.nonarkara.org/">depa-usdot.nonarkara.org</a>.
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
        72 hours of unlimited PKSB bus use. One boarding token, valid on
        any route. Card details are processed by Stripe — this mockup
        does not transmit data.
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
        Stripe test card pre-filled (4242…). Real deployment would
        redirect to Stripe Checkout.
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
          <span>Stops anywhere on the airport corridor</span>
          <span>No formal bus stop in Phuket</span>
        </footer>
      </div>

      <button type="button" className="pa-pay pa-pay--ghost" onClick={onReset}>
        Buy another ticket
      </button>
    </main>
  );
}

export default PassengerApp;
