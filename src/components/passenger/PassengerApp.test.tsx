// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PassengerApp } from "./PassengerApp";

vi.mock("../../engine/fleetSimulator", () => ({
  getAirportDepartures: () => [780],
  getPublishedTravelMinutesFromAirport: () => 70,
  // headlineMetrics reads getVehiclesNow + getSimulatedMinutes; the test
  // doesn't exercise the operator pane, so empty values are fine.
  getVehiclesNow: () => [],
  getSimulatedMinutes: () => 750,
  // simulation.computeSimState pulls these; empty array keeps the engine
  // a no-op for the chrome-only assertions this file makes.
  getAirportboundTrips: () => []
}));

vi.mock("../../engine/time", () => ({
  getBangkokNowFractionalMinutes: () => 750,
  // The headline-metrics engine pulls in fleetSimulator → which loads
  // parseScheduleEntries from this module. The PassengerApp test only
  // checks the chrome (countdown, decision panel, ticket copy), not the
  // engine's internal math, so the timetable parser can be a no-op stub.
  parseScheduleEntries: () => [],
  buildTimetableSummary: () => ({}),
  getBangkokNowMinutes: () => 750,
  formatClockLabel: (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`,
  parseClockMinutes: () => 0
}));

vi.mock("../../engine/adsbFlights", () => ({
  ADSB_POLL_MS: 45_000,
  fetchAdsbAroundHkt: () => new Promise(() => {})
}));

describe("PassengerApp", () => {
  it("shows the timetable-based passenger decision before the ticket choices", () => {
    render(<PassengerApp />);

    expect(screen.getByText("Next scheduled bus leaves in")).toBeInTheDocument();
    expect(screen.getByText("30:00")).toBeInTheDocument();
    expect(screen.getByText(/70 min to Patong on the published timetable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Buy single ride/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Buy 3-day pass/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Will the terminal get busy?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /official AOT live flight status/i })).toHaveAttribute(
      "href",
      "https://phuket.airportthai.co.th/flight"
    );
    expect(document.documentElement).toHaveClass("passenger-site-mode");
  });

  it("turns a destination request into a single-ride boarding token", async () => {
    const user = userEvent.setup();
    render(<PassengerApp />);

    await user.click(screen.getByRole("button", { name: /Buy single ride/i }));
    await user.click(screen.getByRole("button", { name: "Patong Beach" }));
    await user.click(screen.getByRole("button", { name: /Reserve ride/i }));

    expect(screen.getByRole("heading", { name: /Show this to the driver/i })).toBeInTheDocument();
    expect(screen.getByText("Patong Beach")).toBeInTheDocument();
    expect(screen.getByText("Driver confirms the safe pull-over")).toBeInTheDocument();
  });

  it("keeps the 3-day checkout explicitly in test mode", async () => {
    const user = userEvent.setup();
    render(<PassengerApp />);

    await user.click(screen.getByRole("button", { name: /Buy 3-day pass/i }));
    expect(screen.getByRole("group", { name: "Card details (Stripe)" })).toBeInTheDocument();
    expect(screen.getByText("test mode")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Cardholder name"), "Test Rider");
    await user.click(screen.getByRole("button", { name: /Pay ฿250/i }));

    expect(screen.getByText("72 hours from first scan")).toBeInTheDocument();
  });
});
