import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { getMockApiPayload, mockAirportLocation } from "./test/fixtures/appApiFixtures";

vi.mock("./components/LiveMap", () => ({
  LiveMap: ({
    routes,
    mode,
    userLocation,
    selectedStop,
    highlightStopIds,
    highlightVehicleId,
    testId = "live-map",
    onModeChange
  }: {
    routes: Array<{ id: string }>;
    mode: "route" | "stop";
    userLocation: [number, number] | null;
    selectedStop: { id: string } | null;
    highlightStopIds?: string[];
    highlightVehicleId?: string | null;
    testId?: string;
    onModeChange: (mode: "route" | "stop") => void;
  }) => (
    <div data-testid={testId}>
      <div>{`routes:${routes.map((route) => route.id).join(",")}`}</div>
      <div>{`mode:${mode}`}</div>
      <div>{userLocation ? "user-location:on" : "user-location:off"}</div>
      <div>{selectedStop ? `selected-stop:${selectedStop.id}` : "selected-stop:none"}</div>
      <div>{`highlight-stop:${(highlightStopIds ?? []).join(",") || "none"}`}</div>
      <div>{`highlight-vehicle:${highlightVehicleId ?? "none"}`}</div>
      <button type="button" onClick={() => onModeChange("route")}>
        mock-route-view
      </button>
      <button type="button" onClick={() => onModeChange("stop")}>
        mock-stop-focus
      </button>
    </div>
  )
}));

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: mockAirportLocation[0],
              longitude: mockAirportLocation[1],
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

  it("renders map view with live map and bottom nav", async () => {
    render(<App />);

    expect(await screen.findByTestId("live-map")).toBeInTheDocument();
    expect(await screen.findByText("routes:rawai-airport,patong-old-bus-station")).toBeInTheDocument();
    expect(screen.getByText("mode:route")).toBeInTheDocument();
    expect(screen.getByText("user-location:on")).toBeInTheDocument();

    // Bottom nav tabs present (exact text)
    expect(screen.getByRole("button", { name: "Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stops" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument();

    // Language toggle on map
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "TH" })).toBeInTheDocument();
  });

  it("navigates between tabs and switches language", async () => {
    render(<App />);

    expect(await screen.findByTestId("live-map")).toBeInTheDocument();

    // Navigate to stops
    await userEvent.click(screen.getByRole("button", { name: "Stops" }));
    expect(screen.queryByTestId("live-map")).not.toBeInTheDocument();

    // Navigate to pass
    await userEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(await screen.findByRole("heading", { name: /qr/i })).toBeInTheDocument();

    // Switch language to Thai
    await userEvent.click(screen.getByRole("button", { name: "TH" }));
    expect(screen.getByRole("button", { name: "TH" })).toHaveClass("is-active");
  });

});
