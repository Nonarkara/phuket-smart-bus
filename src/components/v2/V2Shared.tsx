import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Animated counter — numbers roll up, not snap
// ---------------------------------------------------------------------------
interface CounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
}

export function Counter({ value, prefix, suffix }: CounterProps) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const diff = value - from;
    if (diff === 0) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 1200);
      setDisplay(Math.round(from + diff * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className="counter">
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Insight Card
// ---------------------------------------------------------------------------
interface InsightCardProps {
  eyebrow: string;
  headline: string;
  detail: string;
  tone?: "neutral" | "demand" | "supply";
}

export function InsightCard({ eyebrow, headline, detail, tone = "neutral" }: InsightCardProps) {
  return (
    <section className={`v2-insight v2-insight--${tone}`}>
      <span className="v2-insight__eyebrow">{eyebrow}</span>
      <strong className="v2-insight__headline">{headline}</strong>
      <p className="v2-insight__detail">{detail}</p>
    </section>
  );
}
