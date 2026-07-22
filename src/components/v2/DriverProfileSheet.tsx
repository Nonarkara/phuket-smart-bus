import { useEffect, useId, useRef } from "react";
import type { DriverDayRecord } from "../../engine/driverStats";

type Props = {
  record: DriverDayRecord | null;
  onClose: () => void;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="v2-driver__stat" title={hint}>
      <span className="v2-driver__stat-val">{value}</span>
      <span className="v2-driver__stat-label">{label}</span>
    </div>
  );
}

/**
 * Driver dossier — opens from a fleet row click.
 * All operational numbers come from getDriverDayRecord (schedule + engine loads).
 */
export function DriverProfileSheet({ record, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!record) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [record, onClose]);

  if (!record) return null;
  const { profile, career } = record;
  const plateShort = profile.plate.replace(/\s*ภูเก็ต\s*$/, "");

  return (
    <div className="v2-driver-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="v2-driver"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="v2-driver__head">
          <img
            className="v2-driver__face"
            src={profile.faceDataUri}
            alt=""
            width={48}
            height={48}
          />
          <div className="v2-driver__identity">
            <span className="v2-driver__eyebrow">Driver dossier · {profile.employeeNo}</span>
            <h2 id={titleId} className="v2-driver__name">
              {profile.nameTh}
            </h2>
            <span className="v2-driver__name-en">{profile.nameEn}</span>
            <span className="v2-driver__meta">
              {plateShort} · {profile.homeDepot} depot · license {profile.licenseClass} · {profile.yearsService} yrs
            </span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="v2-driver__close"
            onClick={onClose}
            aria-label="Close driver dossier"
          >
            ✕
          </button>
        </header>

        <p className="v2-driver__trace">
          Today&apos;s numbers follow this bus on the published timetable — trips, loads, km, and CO₂ from the same demand-supply engine as the map.
        </p>

        <section className="v2-driver__grid" aria-label="Today's performance">
          <Stat label="Trips done" value={String(record.tripsCompleted)} hint="Completed one-way legs today" />
          <Stat label="Hours on duty" value={record.hoursOnDuty.toFixed(1)} hint="Sum of assigned trip minutes" />
          <Stat label="Km driven" value={record.kmDriven.toFixed(0)} hint="Polyline length × progress" />
          <Stat label="Pax served" value={record.paxServed.toLocaleString()} hint="Engine boarded × leg progress" />
          <Stat label="Revenue" value={`฿${record.revenueThb.toLocaleString()}`} hint="Pax × ฿100" />
          <Stat label="CO₂ reduced" value={`${record.co2ReducedKg} kg`} hint="Pax × 28 km × 0.15 kg" />
          <Stat label="Efficiency" value={`${record.efficiencyPct}%`} hint="Average load factor" />
          <Stat label="Reliability" value={`${record.reliabilityPct}%`} hint="On-time share of scored legs" />
        </section>

        <section className="v2-driver__shifts" aria-label="Shifts today">
          <h3 className="v2-driver__section-title">Shifts today</h3>
          {record.shifts.length === 0 ? (
            <p className="v2-driver__empty">No duty blocks yet at this sim time.</p>
          ) : (
            <ul className="v2-driver__shift-list">
              {record.shifts.map((s) => (
                <li key={s.label}>
                  <span>{s.label}</span>
                  <span>{s.trips} trip{s.trips === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="v2-driver__career" aria-label="Career record">
          <h3 className="v2-driver__section-title">Career record</h3>
          <div className="v2-driver__career-grid">
            <Stat label="Lifetime hours" value={career.hoursLifetime.toLocaleString()} />
            <Stat label="Pax lifetime" value={career.paxLifetime.toLocaleString()} />
            <Stat label="CO₂ lifetime" value={`${career.co2LifetimeTonnes} t`} />
            <Stat label="On-time career" value={`${career.onTimeLifetimePct}%`} />
          </div>
        </section>
      </aside>
    </div>
  );
}
