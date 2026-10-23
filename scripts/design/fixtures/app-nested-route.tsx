// A fake App.tsx for the coverage proof. The point is the NESTED route:
// `startsWith("/fleet/export")` is a different route from
// `startsWith("/fleet")`, and a derivation that stopped at the first slash
// would read the nested one as its parent — which is already in the gate's
// list, so the new route would be silently missed. The check exists to
// catch a route nobody measures; it must be able to see a nested one.
//
// Every route the real app serves is here too, so the check has only ONE
// thing to report: the nested route.
export function App() {
  const pathname = window.location.pathname;
  if (pathname.startsWith("/ops")) return <Ops />;
  if (pathname.startsWith("/fleet/export")) return <FleetExport />;
  if (pathname.startsWith("/fleet/raw")) return <FleetRaw />;
  if (pathname.startsWith("/fleet")) return <Fleet />;
  if (pathname.startsWith("/study")) return <Study />;
  if (pathname.startsWith("/research")) return <Research />;
  if (pathname.startsWith("/capacity")) return <Capacity />;
  if (pathname.startsWith("/info")) return <Info />;
  if (pathname.startsWith("/more")) return <More />;
  if (pathname.startsWith("/stops")) return <Stops />;
  if (pathname.startsWith("/pass")) return <Pass />;
  if (pathname.startsWith("/ride")) return <Ride />;
  if (pathname.startsWith("/compare")) return <Compare />;
  if (pathname.startsWith("/governor")) return <Governor />;
  if (pathname.startsWith("/driver/")) return <Driver />;
  if (pathname.startsWith("/roi")) return <Roi />;
  if (pathname.startsWith("/toolkit")) return <Toolkit />;
  if (pathname.startsWith("/v2")) return <V2 />;
  return <Map />;
}
