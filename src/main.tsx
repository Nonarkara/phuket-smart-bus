import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "leaflet/dist/leaflet.css";

// NON visitor tracker — fire-and-forget, one ping per session
(function () {
  if (sessionStorage.getItem("non_v")) return;
  sessionStorage.setItem("non_v", "1");
  const SH =
    "https://script.google.com/macros/s/AKfycbwzTwBNOseKkvkkjD-LH6B3GWrsFcwS6MTDbn7W5eb3zHxA-swtlHYuwJ3w5PAVXDhU7Q/exec";
  const b: Record<string, string> = {
    dashboard: "BUS",
    hostname: location.hostname,
    page: location.href,
    referrer: document.referrer || "Direct",
    userAgent: navigator.userAgent,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const send = (p: object) =>
    fetch(SH, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(p) }).catch(() => {});
  fetch("https://ipapi.co/json/")
    .then((r) => r.json())
    .then((d) => { b.ip = d.ip; b.country = d.country_name; b.region = d.region; b.city = d.city; send(b); })
    .catch(() => send(b));
})();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
