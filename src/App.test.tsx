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

  it("renders the rider prototype and switches language", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Bus or taxi?" })).toBeInTheDocument();
    expect(await screen.findByText("You appear to be at Phuket Airport")).toBeInTheDocument();
    expect(await screen.findByText("100 THB")).toBeInTheDocument();
    expect(await screen.findByText(/1,000/)).toBeInTheDocument();
    expect(await screen.findByText("Save about 900 THB versus a typical airport taxi ride.")).toBeInTheDocument();
    expect((await screen.findAllByText("Rain moving across the airport corridor")).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(
        "Keep a small buffer in case rain or wind slows boarding at the airport stop."
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Turn left after you come out and head to the Smart Bus stop by Cafe Amazon.")
    ).toBeInTheDocument();
    expect(await screen.findByText("Phuket time")).toBeInTheDocument();
    expect(screen.getByText("UTC+7 boarding clock", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My QR" })).toBeInTheDocument();
    expect(screen.getByTestId("airport-map-preview")).toBeInTheDocument();
    expect(screen.getByText("highlight-stop:rawai-airport-42")).toBeInTheDocument();
    expect(screen.queryByText("Airport approach is slower")).not.toBeInTheDocument();
    expect(screen.getByText("A mock-up for rider testing and future GPS and camera integration.")).toBeInTheDocument();
    expect(screen.getByText("Copyright 2026 Dr. Non Arkaraprasertkul")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "My stop" }));

    expect(await screen.findByText("Airport approach is slower")).toBeInTheDocument();
    expect(screen.getByText("12 seated")).toBeInTheDocument();
    expect(screen.getByText("4 on · 1 off")).toBeInTheDocument();
    expect(screen.queryByTestId("live-map")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Live map" }));

    expect(screen.getByTestId("live-map")).toBeInTheDocument();
    expect(screen.getByText("North-south corridor")).toBeInTheDocument();
    expect(await screen.findByText("routes:rawai-airport,patong-old-bus-station")).toBeInTheDocument();
    expect(screen.getByText("mode:route")).toBeInTheDocument();
    expect(screen.getByText("user-location:on")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "mock-stop-focus" }));

    expect(await screen.findByText("mode:stop")).toBeInTheDocument();
    expect(screen.getByText("routes:rawai-airport")).toBeInTheDocument();
    expect(screen.getByText("selected-stop:rawai-airport-42")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "mock-route-view" }));
    await userEvent.click(screen.getByRole("button", { name: /Patong Line/i }));

    expect(await screen.findByText("routes:patong-old-bus-station")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "My QR" }));

    expect(await screen.findByRole("heading", { name: "My QR code" })).toBeInTheDocument();
    expect(screen.getAllByText("24h pass")).toHaveLength(2);
    expect(screen.getByText("7-day pass")).toBeInTheDocument();
    expect(screen.getByText("Time left")).toBeInTheDocument();
    expect(screen.getByText("QR boarding code")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "7-day pass" }));

    expect(screen.getAllByText("7-day pass")).toHaveLength(2);
    expect(screen.getByText("PKSB-WEEK-7-1124")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "TH" }));
    await userEvent.click(screen.getByRole("button", { name: "สนามบิน" }));

    expect(screen.getByRole("heading", { name: "รถบัสหรือแท็กซี่?" })).toBeInTheDocument();
    expect(screen.getByText("100 THB")).toBeInTheDocument();
    expect(screen.getByText("ดูเหมือนว่าคุณอยู่ที่สนามบินภูเก็ต")).toBeInTheDocument();
    expect(screen.getAllByText("มีกลุ่มฝนเคลื่อนผ่านแนวสนามบิน").length).toBeGreaterThan(0);
    expect(screen.getByText("เวลาภูเก็ต")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "คิวอาร์ของฉัน" })).toBeInTheDocument();
  });
});
