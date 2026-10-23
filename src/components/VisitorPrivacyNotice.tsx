/**
 * What this site collects, disclosed.
 *
 * WHY THIS TEXT CHANGED ON 2026-10-23
 *   It used to say: "This site records one anonymous-session ping: your IP
 *   address, city, country, the page you opened, your browser, screen size
 *   and time zone… stored in a private spreadsheet."
 *
 *   That was true of a tracker that has been REMOVED. It sent one ping per
 *   session to a personal Google Sheet, after resolving the visitor's IP
 *   through ipapi.co — a third party. Under Thailand's PDPA an IP address
 *   is personal data.
 *
 *   The sheet it wrote to is locked, so the pings stopped recording. The
 *   IP lookup did not: the address still left the visitor's browser on
 *   every route, to a third party, to feed a sheet that could not receive
 *   it. A tracker that records nothing and still leaks is worse than one
 *   that is honestly described.
 *
 * WHAT IS TRUE NOW
 *   The site keeps ONE beacon: Cloudflare's own Web Analytics, served from
 *   static.cloudflareinsights.com (index.html). Cloudflare serves the site
 *   and counts the page views on the same infrastructure. It is first-party
 *   — there is no third-party analytics service and no spreadsheet.
 *
 *   Nothing else is collected. The bus data comes from the public PKSB
 *   tracker; the fleet positions, the timetable and the demand model are
 *   computed in the visitor's own browser and never sent anywhere.
 *
 *   Cloudflare's own analytics documentation is the source for what their
 *   beacon records: https://developers.cloudflare.com/analytics/
 */

export const VISITOR_TRACKER_NOTICE =
  "This site uses Cloudflare's own analytics to count page views — the same company that " +
  "serves it. No third-party analytics service, no visitor list, and nothing about you is " +
  "sent anywhere else. The bus positions, the timetable and the demand model are computed " +
  "in your browser. Thailand's Personal Data Protection Act B.E. 2562 (PDPA) applies.";

export function VisitorPrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "pa-privacy pa-privacy--compact" : "pa-privacy"}>
      <strong>Privacy.</strong> {VISITOR_TRACKER_NOTICE}
    </p>
  );
}

export default VisitorPrivacyNotice;
