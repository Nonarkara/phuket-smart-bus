/**
 * The visitor tracker, disclosed.
 *
 * A ping per session goes to a personal spreadsheet with the visitor's IP
 * address, country, region, city, hostname, page, referrer, user agent,
 * language, screen size and timezone. Under Thailand's PDPA an IP address is
 * personal data, and a site aimed at a government department has to say so
 * on the page rather than in a policy nobody opens.
 *
 * This says exactly what is sent and where it lands. It does not pretend the
 * data is anonymous: it is not.
 */

export const VISITOR_TRACKER_NOTICE =
  "This site records one anonymous-session ping: your IP address, city, country, " +
  "the page you opened, your browser, screen size and time zone. It is used to count " +
  "visits, not to identify you, and it is stored in a private spreadsheet. " +
  "Thailand's Personal Data Protection Act B.E. 2562 (PDPA) applies.";

export function VisitorPrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "pa-privacy pa-privacy--compact" : "pa-privacy"}>
      <strong>Privacy.</strong> {VISITOR_TRACKER_NOTICE}
    </p>
  );
}

export default VisitorPrivacyNotice;
