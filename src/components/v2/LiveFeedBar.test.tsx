// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { LiveFeedBar } from "./LiveFeedBar";

describe("LiveFeedBar", () => {
  it("separates live fleet telemetry from modelled demand and riders", () => {
    render(
      <LiveFeedBar
        status="live"
        detail={null}
        feedAgeSec={12}
        busesReporting={8}
        observedSinceMin={480}
        countersOnline={false}
        onOpenDevices={() => {}}
      />
    );

    expect(screen.getByText(/8 buses reporting/i)).toBeInTheDocument();
    expect(screen.getByText(/Fleet, trips & km: GPS/i)).toBeInTheDocument();
    expect(screen.getByText(/Demand, queues and dispatch: model/i)).toBeInTheDocument();
    expect(screen.getByText(/Riders: modelled load per run/i)).toBeInTheDocument();
  });
});
