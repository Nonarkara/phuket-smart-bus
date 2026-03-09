import { useState } from "react";
import type { Lang } from "@shared/types";
import { pick, ui } from "@/lib/i18n";

type Props = {
  lang: Lang;
  now: number;
};

type PassKind = "day" | "week";

const PASS_PRESETS = {
  day: {
    durationMs: 24 * 60 * 60 * 1000,
    startOffsetMs: (2 * 60 * 60 + 18 * 60 + 12) * 1000,
    code: "PKSB-DAY-24-0381"
  },
  week: {
    durationMs: 7 * 24 * 60 * 60 * 1000,
    startOffsetMs: (29 * 60 * 60 + 41 * 60 + 9) * 1000,
    code: "PKSB-WEEK-7-1124"
  }
} as const;

function formatPassDateTime(value: number, lang: Lang) {
  const locale = lang === "th" ? "th-TH" : "en-GB";

  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
}

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${hh}:${mm}:${ss}`;
  }

  return `${hh}:${mm}:${ss}`;
}

function buildMockQrMatrix(seed: string) {
  const size = 21;
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  let state = 0;

  for (const char of seed) {
    state = (state * 31 + char.charCodeAt(0)) >>> 0;
  }

  function drawFinder(offsetX: number, offsetY: number) {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        matrix[offsetY + y]![offsetX + x] = edge || core;
      }
    }
  }

  function isReserved(x: number, y: number) {
    const topLeft = x < 8 && y < 8;
    const topRight = x >= size - 8 && y < 8;
    const bottomLeft = x < 8 && y >= size - 8;
    return topLeft || topRight || bottomLeft || x === 6 || y === 6;
  }

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  for (let i = 8; i < size - 8; i += 1) {
    matrix[6]![i] = i % 2 === 0;
    matrix[i]![6] = i % 2 === 0;
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isReserved(x, y)) {
        continue;
      }

      state = (state * 1664525 + 1013904223) >>> 0;
      matrix[y]![x] = ((state >>> 28) + x + y) % 2 === 0;
    }
  }

  return matrix;
}

function MockQrCode({ value }: { value: string }) {
  const matrix = buildMockQrMatrix(value);
  const size = matrix.length;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="pass-qr" role="img" aria-label="Mock QR code">
      <rect width={size} height={size} fill="#ffffff" />
      {matrix.flatMap((row, y) =>
        row.map((filled, x) =>
          filled ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#101418" /> : null
        )
      )}
    </svg>
  );
}

export function PassPanel({ lang, now }: Props) {
  const [selectedPass, setSelectedPass] = useState<PassKind>("day");
  const preset = PASS_PRESETS[selectedPass];
  const activatedAt = now - preset.startOffsetMs;
  const expiresAt = activatedAt + preset.durationMs;
  const remainingMs = Math.max(0, expiresAt - now);
  const countdownLabel = formatCountdown(remainingMs);
  const passLabel = selectedPass === "day" ? pick(ui.passDayLabel, lang) : pick(ui.passWeekLabel, lang);
  const statusLabel = remainingMs > 0 ? pick(ui.passActiveLabel, lang) : pick(ui.passExpiredLabel, lang);
  const passThemeClass = selectedPass === "day" ? "is-day" : "is-week";

  return (
    <section className={`pass-panel card ${passThemeClass}`} aria-label={pick(ui.passTitle, lang)}>
      <div className="section-heading pass-panel__header">
        <div>
          <p className="hero__eyebrow">{pick(ui.passEyebrow, lang)}</p>
          <h3>{pick(ui.passTitle, lang)}</h3>
        </div>
        <p>{pick(ui.passBody, lang)}</p>
      </div>

      <div className="pass-switch" role="tablist" aria-label={pick(ui.passTitle, lang)}>
        <button
          className={selectedPass === "day" ? "pass-switch__button is-active is-day" : "pass-switch__button"}
          type="button"
          onClick={() => setSelectedPass("day")}
          aria-selected={selectedPass === "day"}
        >
          {pick(ui.passDayLabel, lang)}
        </button>
        <button
          className={selectedPass === "week" ? "pass-switch__button is-active is-week" : "pass-switch__button"}
          type="button"
          onClick={() => setSelectedPass("week")}
          aria-selected={selectedPass === "week"}
        >
          {pick(ui.passWeekLabel, lang)}
        </button>
      </div>

      <div className={`pass-ticket ${passThemeClass}`}>
        <div className="pass-ticket__status-row">
          <span className="pass-ticket__status">{statusLabel}</span>
          <span className="pass-ticket__clock">{pick(ui.clockLabel, lang)}</span>
        </div>
        <strong className="pass-ticket__name">{passLabel}</strong>

        <div className="pass-ticket__countdown">
          <span>{pick(ui.passCountdownLabel, lang)}</span>
          <strong>{countdownLabel}</strong>
          <small>{pick(ui.passCountdownBody, lang)}</small>
        </div>

        <div className="pass-ticket__meta-grid">
          <div className="pass-ticket__meta-card">
            <span>{pick(ui.passActivatedLabel, lang)}</span>
            <strong>{formatPassDateTime(activatedAt, lang)}</strong>
          </div>
          <div className="pass-ticket__meta-card">
            <span>{pick(ui.passValidUntilLabel, lang)}</span>
            <strong>{formatPassDateTime(expiresAt, lang)}</strong>
          </div>
        </div>
      </div>

      <div className={`pass-qr-card ${passThemeClass}`}>
        <MockQrCode value={`${preset.code}-${activatedAt}`} />
        <div className="pass-qr-card__copy">
          <strong>{pick(ui.passQrTitle, lang)}</strong>
          <p>{pick(ui.passQrBody, lang)}</p>
          <small>{preset.code}</small>
        </div>
      </div>
    </section>
  );
}
