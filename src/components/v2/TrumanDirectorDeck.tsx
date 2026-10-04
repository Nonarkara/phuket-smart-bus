/**
 * TrumanDirectorDeck.tsx — Omniscient Truman Show Control Console
 *
 * Provides the entertaining, omniscient observer layer over real PKSB buses:
 * - Live broadcast HUD with [REC] ticker and Bangkok director clock
 * - Reality vs. Untapped Potential scoreboard (observed fares vs missed revenue & Grab leakage)
 * - Auto-tour mode that cycles between buses with live cinematic narration
 * - Detailed Actor Dossier with pixel-art driver avatar and director notes
 */

import { useEffect, useMemo, useState } from "react";
import type { LiveBus } from "@shared/pksbFeed";
import {
  getTrumanScoreboard,
  generateTrumanScenes,
  buildTrumanActorDossier,
  type TrumanScoreboard,
  type TrumanScene,
  type TrumanActorDossier,
} from "../../engine/trumanEngine";
import "./trumanConsole.css";

interface TrumanDirectorDeckProps {
  buses: readonly LiveBus[];
  realKmToday: number;
  realRevenueThb: number;
  selectedPlate: string | null;
  onSelectPlate: (plate: string | null) => void;
}

export function TrumanDirectorDeck({
  buses,
  realKmToday,
  realRevenueThb,
  selectedPlate,
  onSelectPlate,
}: TrumanDirectorDeckProps) {
  const [now, setNow] = useState(() => Date.now());
  const [isTouring, setIsTouring] = useState(false);
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);

  // 1-second refresh for live timestamps and animation
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const scoreboard: TrumanScoreboard = useMemo(
    () => getTrumanScoreboard(buses, realKmToday, realRevenueThb, now),
    [buses, realKmToday, realRevenueThb, now]
  );

  const scenes: TrumanScene[] = useMemo(
    () => generateTrumanScenes(buses, now),
    [buses, now]
  );

  // Auto-tour director camera: cycles buses every 10 seconds if active
  useEffect(() => {
    if (!isTouring || scenes.length === 0) return;
    const tourTimer = setInterval(() => {
      setActiveSceneIdx((prev) => {
        const nextIdx = (prev + 1) % scenes.length;
        const nextPlate = scenes[nextIdx]?.plate ?? null;
        if (nextPlate) onSelectPlate(nextPlate);
        return nextIdx;
      });
    }, 10_000);
    return () => clearInterval(tourTimer);
  }, [isTouring, scenes, onSelectPlate]);

  // Selected bus actor dossier
  const selectedBus = useMemo(
    () => buses.find((b) => b.plate === selectedPlate) ?? buses[0] ?? null,
    [buses, selectedPlate]
  );

  const actorDossier: TrumanActorDossier | null = useMemo(() => {
    if (!selectedBus) return null;
    return buildTrumanActorDossier(selectedBus, 3, 85, now);
  }, [selectedBus, now]);

  return (
    <section className="truman-deck" aria-label="Truman Show Director Deck">
      {/* ── Top Director Bar ─────────────────────────────────────────── */}
      <div className="truman-bar">
        <div className="truman-bar__left">
          <span className="truman-rec">
            <span className="truman-rec__dot" aria-hidden="true" />
            REC
          </span>
          <span className="truman-tag">CH-01 · THE BUS SHOW</span>
          <span className="truman-live-clock">
            {new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Bangkok",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }).format(new Date(now))}{" "}
            BKK
          </span>
        </div>

        <div className="truman-bar__right">
          <button
            type="button"
            className={`truman-tour-btn ${isTouring ? "is-active" : ""}`}
            onClick={() => setIsTouring(!isTouring)}
            title="Auto-switch camera view every 10 seconds across active buses"
          >
            {isTouring ? "⏸ PAUSE AUTO-TOUR" : "▶ START FLEET TOUR"}
          </button>
        </div>
      </div>

      {/* ── Reality vs. Potential Split Scoreboard ─────────────────── */}
      <div className="truman-scoreboard">
        {/* Reality Side */}
        <div className="truman-side truman-side--reality">
          <div className="truman-side__head">
            <span className="truman-badge truman-badge--reality">OBSERVED REALITY</span>
            <span className="truman-sub">What the buses are doing right now</span>
          </div>
          <div className="truman-metrics">
            <div className="truman-metric">
              <span className="truman-metric__label">Buses Moving</span>
              <strong className="truman-metric__val">
                {scoreboard.busesMoving}
                <small> / {scoreboard.busesReporting}</small>
              </strong>
              <span className="truman-metric__note">{scoreboard.busesStanding} parked / idling</span>
            </div>
            <div className="truman-metric">
              <span className="truman-metric__label">Real Km Driven</span>
              <strong className="truman-metric__val">{scoreboard.realKmToday.toLocaleString()} km</strong>
              <span className="truman-metric__note">via GPS odometer</span>
            </div>
            <div className="truman-metric truman-metric--gain">
              <span className="truman-metric__label">Fares Collected</span>
              <strong className="truman-metric__val">฿{scoreboard.realRevenueThb.toLocaleString()}</strong>
              <span className="truman-metric__note">observed trips × ฿100</span>
            </div>
          </div>
        </div>

        {/* Potential Side */}
        <div className="truman-side truman-side--potential">
          <div className="truman-side__head">
            <span className="truman-badge truman-badge--potential">UNTAPPED DEMAND</span>
            <span className="truman-sub">What synchronized dispatch would unlock</span>
          </div>
          <div className="truman-metrics">
            <div className="truman-metric truman-metric--warn">
              <span className="truman-metric__label">Airport Curb Queue</span>
              <strong className="truman-metric__val">{scoreboard.curbQueueNow} pax</strong>
              <span className="truman-metric__note">{scoreboard.flightsLandedRecent} flights in last hour</span>
            </div>
            <div className="truman-metric truman-metric--neg">
              <span className="truman-metric__label">Grab Taxi Leakage</span>
              <strong className="truman-metric__val">฿{scoreboard.grabLeakageThb.toLocaleString()}</strong>
              <span className="truman-metric__note">{scoreboard.paxAbandonedToday} pax took Grab @ ฿720</span>
            </div>
            <div className="truman-metric truman-metric--action">
              <span className="truman-metric__label">Money On The Table</span>
              <strong className="truman-metric__val">฿{scoreboard.missedRevenueThb.toLocaleString()}</strong>
              <span className="truman-metric__note">+{scoreboard.potentialMultiplier}× revenue potential</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Director's Observation & Actor Spotlight ────────────────── */}
      <div className="truman-viewport">
        {/* Selected Actor Card */}
        {actorDossier && (
          <div className="truman-actor" aria-label={`Actor ${actorDossier.plate}`}>
            <div className="truman-actor__viewfinder">
              <span className="vf-bracket vf-bracket--tl" />
              <span className="vf-bracket vf-bracket--tr" />
              <span className="vf-bracket vf-bracket--bl" />
              <span className="vf-bracket vf-bracket--br" />

              <div className="truman-actor__profile">
                <img
                  src={actorDossier.driver.faceDataUri}
                  alt={actorDossier.driver.nameEn}
                  className="truman-actor__avatar"
                />
                <div className="truman-actor__id">
                  <span className="truman-actor__kicker">
                    {actorDossier.status.toUpperCase()} · {actorDossier.speedKph} KM/H
                  </span>
                  <strong className="truman-actor__name">
                    {actorDossier.driver.nameEn} ({actorDossier.driver.nameTh})
                  </strong>
                  <span className="truman-actor__plate">{actorDossier.plate}</span>
                </div>
              </div>

              <div className="truman-actor__stats">
                <div>
                  <dt>Location</dt>
                  <dd>{actorDossier.locationText}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{actorDossier.emptySeats} seats empty</dd>
                </div>
                <div>
                  <dt>Earned vs Potential</dt>
                  <dd>
                    ฿{actorDossier.realEarningsThb.toLocaleString()}{" "}
                    <span className="truman-highlight">
                      → ฿{actorDossier.potentialEarningsThb.toLocaleString()}
                    </span>
                  </dd>
                </div>
              </div>

              <div className="truman-actor__note">
                <span className="truman-note-label">DIRECTOR'S LOG:</span>
                <p>{actorDossier.directorNote}</p>
              </div>
            </div>
          </div>
        )}

        {/* Live Scenes / Script Ticker */}
        <div className="truman-scenes" aria-label="Live fleet scenes">
          <div className="truman-scenes__title">
            <span>LIVE SCENES ({scenes.length} ACTORS)</span>
            <small>CLICK TO FOCUS CAMERA</small>
          </div>
          <div className="truman-scenes__list" role="list">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                type="button"
                className={`truman-scene-card ${selectedPlate === scene.plate ? "is-selected" : ""}`}
                onClick={() => onSelectPlate(scene.plate)}
                role="listitem"
              >
                <div className="truman-scene-card__head">
                  <span className="truman-scene-card__chan">{scene.channel}</span>
                  <strong className="truman-scene-card__plate">{scene.plate}</strong>
                  <span className="truman-scene-card__speed">{scene.speedKph} km/h</span>
                </div>
                <p className="truman-scene-card__reality">
                  <strong>Reality:</strong> {scene.realityText}
                </p>
                <p className="truman-scene-card__potential">
                  <strong>Untapped:</strong> {scene.potentialText}
                </p>
                {scene.opportunityThb > 0 && (
                  <div className="truman-scene-card__footer">
                    <span>Missed Opportunity: +฿{scene.opportunityThb.toLocaleString()}</span>
                  </div>
                )}
              </button>
            ))}
            {scenes.length === 0 && (
              <div className="truman-empty">Waiting for live bus positions…</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
