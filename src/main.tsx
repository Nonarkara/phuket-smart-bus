import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "leaflet/dist/leaflet.css";

// The visitor tracker that used to live here has been REMOVED.
//
// It sent one ping per session — IP address, city, country, region,
// hostname, page, referrer, user agent, language, screen size, time zone —
// to a personal spreadsheet, after looking the IP up on ipapi.co. That is
// personal data under Thailand's PDPA, it went to a third party, and the
// disclosure that described it appeared on two routes out of seventeen.
//
// The sheet it wrote to is locked now, so the pings stopped recording —
// but the IP still left the visitor's browser to ipapi.co, which does not
// need the sheet. A tracker that records nothing and still leaks is worse
// than one that is honestly described.
//
// What replaces it: nothing. The site keeps Cloudflare's own first-party
// beacon (in index.html), which is disclosed on the pages that ship it —
// see components/VisitorPrivacyNotice.tsx.
//
// scripts/design/shipaudit.mjs proves this stays gone: it aborts every
// request to a known collector host, so running the audit cannot itself
// leak, and it reports any route that tries.

// A deploy replaces the hashed chunks; a tab opened before it 404s on its next
// lazy import and goes blank. Reload once to pick up the new build.
window.addEventListener("vite:preloadError", (event) => {
  try {
    if (sessionStorage.getItem("pksb-chunk-reload")) return;
    sessionStorage.setItem("pksb-chunk-reload", "1");
  } catch { return; }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
