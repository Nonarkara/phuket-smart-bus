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
    // The basis line names where each number comes from. The record is the
    // day's service — measured, not observed by this tab; demand and riders
    // are still the model, and the bar says so.
    expect(screen.getByText(/Fleet & positions: GPS/i)).toBeInTheDocument();
    expect(screen.getByText(/Service: the day’s record/i)).toBeInTheDocument();
    expect(screen.getByText(/Demand, queues & dispatch: model/i)).toBeInTheDocument();
    expect(screen.getByText(/Riders: modelled — no counter reports/i)).toBeInTheDocument();
  });

  it("says when a counter does report", () => {
    render(
      <LiveFeedBar
        status="live"
        detail={null}
        feedAgeSec={12}
        busesReporting={8}
        observedSinceMin={480}
        countersOnline={true}
        onOpenDevices={() => {}}
      />
    );
    expect(screen.getByText(/Riders: counted where available, else modelled/i)).toBeInTheDocument();
  });
});
