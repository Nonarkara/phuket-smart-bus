// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeAll } from "vitest";
import { FleetDetail } from "./FleetDetail";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("FleetDetail component", () => {
  it("renders the interactive map, efficiency telemetry, and telemetry ledger", () => {
    render(<FleetDetail />);

    // Header
    expect(screen.getByText(/Every bus, every detail/i)).toBeInTheDocument();

    // Map section
    expect(screen.getByText(/Interactive Fleet Map/i)).toBeInTheDocument();
    expect(screen.getByRole("application", { name: /Interactive map of real bus fleet/i })).toBeInTheDocument();

    // Inspector placeholder
    expect(screen.getByText(/Fleet Live Pulse/i)).toBeInTheDocument();
    expect(screen.getByText(/Click any bus to inspect/i)).toBeInTheDocument();

    // Fleet Efficiency analytics
    expect(screen.getByText(/Fleet Efficiency & Inefficiency Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/Fleet Operating State & Dwell Ratio/i)).toBeInTheDocument();
    expect(screen.getByText(/Speed Spectrum & Congestion/i)).toBeInTheDocument();
    expect(screen.getByText(/Corridor Spacing & Bunching Inefficiency/i)).toBeInTheDocument();

    // All Buses table
    expect(screen.getByText(/All 54 Buses — Telemetry Ledger & Raw Inspector/i)).toBeInTheDocument();
  });
});
