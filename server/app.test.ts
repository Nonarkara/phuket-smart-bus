import { createApp } from "./app.js";

describe("server app", () => {
  it("registers the prototype API routes", () => {
    const app = createApp();
    const paths = app._router.stack
      .filter((layer: { route?: { path?: string } }) => layer.route?.path)
      .map((layer: { route: { path: string } }) => layer.route.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/health",
        "/api/routes",
        "/api/routes/:routeId/stops",
        "/api/routes/:routeId/vehicles",
        "/api/routes/:routeId/advisories",
        "/api/operations/overview",
        "/api/integrations/vehicle-telemetry",
        "/api/integrations/seat-camera",
        "/api/integrations/driver-monitor",
        "/api/integrations/passenger-flow",
        "/api/decision-summary",
        "*"
      ])
    );
  });

  it("exposes an express handler function", () => {
    const app = createApp();

    expect(typeof app).toBe("function");
    expect(typeof app.use).toBe("function");
    expect(typeof app.get).toBe("function");
  });
});
