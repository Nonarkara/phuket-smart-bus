type Props = {
  eyebrow: string;
  headline: string;
  body: string;
  actionLabel?: string | null;
  onAction?: (() => void) | null;
};

export function LocationBanner({ eyebrow, headline, body, actionLabel, onAction }: Props) {
  return (
    <section className="location-banner card" aria-live="polite">
      <div className="location-banner__copy">
        <span className="hero__eyebrow">{eyebrow}</span>
        <strong>{headline}</strong>
        <p>{body}</p>
      </div>
      {actionLabel && onAction ? (
        <button className="location-banner__action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
