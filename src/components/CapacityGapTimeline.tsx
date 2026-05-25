import { useEffect, useState } from "react";
import { getHourlyDemandSupply, simNow, type HourlyDemandSupply } from "../engine/simulation";

/**
 * Hour-by-hour capacity status — designed so an investor can answer
 * "did we have enough buses?" at a glance, without reading a bar chart.
 *
 * Each hour is one cell. Colour says everything:
 *   🔴 SHORTFALL  — demand > supply (paxleft on tarmac, lost revenue)
 *   🟡 TIGHT      — demand within ±10% of supply (operating right at the limit)
 *   🟢 SURPLUS    — supply >20% above demand (oversupplied, opex inefficiency)
 *   ⚪ QUIET      — no meaningful operation that hour
 *
 * Hover shows the underlying numbers. Current hour is outlined.
 */

type GapStatus = "shortfall" | "tight" | "surplus" | "quiet";

function classifyHour(row: HourlyDemandSupply): GapStatus {
  if (row.busDemandPax === 0 && row.busSeatsAvailable === 0) return "quiet";
  if (row.busDemandPax > row.busSeatsAvailable * 1.10) return "shortfall";
  if (row.busSeatsAvailable > row.busDemandPax * 1.20 && row.busDemandPax > 0) return "surplus";
  if (row.busDemandPax > 0) return "tight";
  return "quiet";
}

const STATUS_META: Record<GapStatus, { color: string; label: string }> = {
  shortfall: { color: "#dc322f", label: "Shortfall" },
  tight:     { color: "#b58900", label: "Tight" },
  surplus:   { color: "#16b8b0", label: "Surplus" },
  quiet:     { color: "#cfd5db", label: "Quiet" }
};

const HOURS = Array.from({ length: 17 }, (_, i) => 6 + i); // 06–22

export function CapacityGapTimeline({ simMinutes }: { simMinutes?: number | null }) {
  const [data, setData] = useState<HourlyDemandSupply[]>(() => getHourlyDemandSupply());
  const [engineHour, setEngineHour] = useState<number>(() => Math.floor(simNow() / 60));

  useEffect(() => {
    const id = setInterval(() => {
      setData(getHourlyDemandSupply());
      setEngineHour(Math.floor(simNow() / 60));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const currentHour = simMinutes != null ? Math.floor(simMinutes / 60) : engineHour;
  const rows = HOURS.map((h) => data[h]).filter(Boolean);
  if (rows.length === 0) return null;

  // Headline numbers — what investor sees first
  const past = rows.filter((r) => r.hour <= currentHour);
  const shortfallHours = past.filter((r) => classifyHour(r) === "shortfall").length;
  const surplusHours = past.filter((r) => classifyHour(r) === "surplus").length;
  const lostRevenueThb = past.reduce((s, r) => s + r.unmetPax * 100, 0);
  const collectedRevenueThb = past.reduce((s, r) => s + r.revenueThb, 0);

  return (
    <div className="capacity-gap">
      <div className="capacity-gap__head">
        <h3 className="capacity-gap__title">Capacity vs Demand · Today</h3>
        <div className="capacity-gap__summary">
          <span className="capacity-gap__chip capacity-gap__chip--shortfall">
            <span className="capacity-gap__dot" style={{ background: STATUS_META.shortfall.color }} />
            {shortfallHours} short
          </span>
          <span className="capacity-gap__chip capacity-gap__chip--surplus">
            <span className="capacity-gap__dot" style={{ background: STATUS_META.surplus.color }} />
            {surplusHours} over
          </span>
        </div>
      </div>

      <div className="capacity-gap__strip">
        {rows.map((r) => {
          const status = classifyHour(r);
          const meta = STATUS_META[status];
          const isCurrent = r.hour === currentHour;
          const isFuture = r.hour > currentHour;
          return (
            <div
              key={r.hour}
              className={`capacity-gap__cell ${isCurrent ? "capacity-gap__cell--current" : ""} ${isFuture ? "capacity-gap__cell--future" : ""}`}
              style={{ background: isFuture ? "transparent" : meta.color }}
              title={isFuture
                ? `${String(r.hour).padStart(2, "0")}:00 · pending`
                : `${String(r.hour).padStart(2, "0")}:00 · ${meta.label} · demand ${r.busDemandPax} pax / supply ${r.busSeatsAvailable} seats${r.unmetPax > 0 ? ` · ${r.unmetPax} unmet (฿${(r.unmetPax * 100).toLocaleString()} lost)` : ""}`}
            >
              <span className="capacity-gap__hour">{String(r.hour).padStart(2, "0")}</span>
            </div>
          );
        })}
      </div>

      <div className="capacity-gap__foot">
        <div className="capacity-gap__metric">
          <span className="capacity-gap__metric-label">Collected today</span>
          <span className="capacity-gap__metric-value capacity-gap__metric-value--good">
            ฿{collectedRevenueThb.toLocaleString()}
          </span>
        </div>
        <div className="capacity-gap__metric">
          <span className="capacity-gap__metric-label">Lost to capacity</span>
          <span className="capacity-gap__metric-value capacity-gap__metric-value--bad">
            ฿{lostRevenueThb.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
