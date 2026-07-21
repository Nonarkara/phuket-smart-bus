// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
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

  it("uses the toolkit as the branch landing page", () => {
    window.history.replaceState({}, "", "/");
    render(<App />);

    expect(screen.getByRole("heading", { name: "The report was never the deliverable." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live system ↗" })).toHaveAttribute("href", "https://bus.nonarkara.org/");
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
