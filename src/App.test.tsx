// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { getMockApiPayload } from "./test/fixtures/appApiFixtures";

const mockUserLocation: [number, number] = [7.55, 98.12];

vi.mock("./components/LiveMap", () => ({
  LiveMap: ({
    routes,
    mode,
    userLocation,
    selectedStop,
    testId = "live-map"
  }: {
    routes: Array<{ id: string }>;
    mode: "route" | "stop";
    userLocation: [number, number] | null;
    selectedStop: { id: string } | null;
    testId?: string;
  }) => (
    <div data-testid={testId}>
      <div>{`routes:${routes.map((route) => route.id).join(",")}`}</div>
      <div>{`mode:${mode}`}</div>
      <div>{userLocation ? "user-location:on" : "user-location:off"}</div>
      <div>{selectedStop ? `selected-stop:${selectedStop.id}` : "selected-stop:none"}</div>
    </div>
  )
}));

describe("App", () => {
  beforeEach(() => {
    // This branch reserves / for the toolkit showcase. An unreserved path
    // still resolves to the rider app and keeps that surface independently
    // testable without changing its default Map state.
    window.history.replaceState({}, "", "/tourist");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.dispatchEvent(new Event("resize"));
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: mockUserLocation[0],
              longitude: mockUserLocation[1],
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({})
            },
            timestamp: Date.now(),
            toJSON: () => ({})
          } as GeolocationPosition)
        )
      }
    });

    const mockFetch = vi.fn((input: string | URL) => {
      const payload = getMockApiPayload(input);
      if (payload !== null) {
        return Promise.resolve(new Response(JSON.stringify(payload)));
      }
      return Promise.reject(new Error(`Unhandled ${String(input)}`));
    });

    vi.stubGlobal("fetch", mockFetch);
    window.fetch = mockFetch as typeof window.fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("boots the map view with two-tab navigation", async () => {
    render(<App />);

    expect(await screen.findByTestId("live-map")).toBeInTheDocument();
    expect(screen.getByText(/routes:rawai-airport,patong-old-bus-station/)).toBeInTheDocument();
    expect(screen.getByText("mode:route")).toBeInTheDocument();
    expect(screen.getByText("user-location:on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Bus" })).toBeInTheDocument();
  });

  it("lands on the bus front door, not the toolkit — the hub stays on its own path", async () => {
    // The toolkit publishes from the `depa-usdot.nonarkara.org` branch, which
    // carries its own index.html. On this branch `main` serves bus.nonarkara.org,
    // so "/" is the bus system (passenger app on a phone, the dual-audience
    // shell on desktop) and the operator wall is at /ops. Serving the hub at "/"
    // also made the hub's own "Live system ↗" link a self-link.
    window.history.replaceState({}, "", "/");
    render(<App />);

    await waitFor(
      () => {
        expect(window.location.pathname === "/" || window.location.pathname === "/ops").toBe(true);
      },
      { timeout: 15_000 }
    );
    expect(
      screen.queryByRole("heading", { name: /what if an airport passenger can find the bus/i })
    ).not.toBeInTheDocument();
  }, 30_000);

  it("serves the toolkit hub at the explicit /toolkit path", async () => {
    window.history.replaceState({}, "", "/toolkit");
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /what if an airport passenger can find the bus/i
      }, { timeout: 15_000 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Ten questions/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence status legend")).toHaveTextContent(
      /Observed.*cited or published record/i
    );
    expect(screen.getByRole("tab", { name: /Field Notes/i })).toBeInTheDocument();
  }, 30_000);

  it("shows the PassengerApp desktop portal — not the legacy tourist shell or toolkit — on the rider domain", async () => {
    // PassengerApp now owns both rider-domain viewports: the single-task
    // phone view and a desktop portal that keeps the rider board beside the
    // live corridor. The old mobile-only host gate silently sent laptops to
    // the legacy /tourist shell even after this portal existed.
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, hostname: "bus.nonarkara.org", pathname: "/" }
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("min-width: 960px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })) as typeof window.matchMedia;
    window.dispatchEvent(new Event("resize"));
    window.history.replaceState({}, "", "/");

    try {
      render(<App />);

      expect(await screen.findByRole(
        "link",
        { name: /Ops Console/i },
        { timeout: 15_000 }
      )).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Preview phone/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Next buses/i })).toBeInTheDocument();
      expect(screen.getByRole("complementary", { name: /Phuket Island Live Transit Stage/i })).toBeInTheDocument();
      // Toolkit hub heading must NOT appear at / on the rider domain.
      expect(
        screen.queryByRole("heading", { name: /what if an airport passenger can find the bus/i })
      ).not.toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });

  it("switches between Map and More tabs", async () => {
    render(<App />);

    await screen.findByTestId("live-map");

    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("button", { name: "Stops" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(screen.getByRole("heading", { name: "My QR code" })).toBeInTheDocument();
    expect(screen.getByText("QR boarding code")).toBeInTheDocument();
  });
});
