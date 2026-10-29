// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { LiveServiceBlock } from "./LiveServiceBlock";
import type { AirportService } from "../../engine/liveService";

const direction = (over: Partial<AirportService["southbound"]> = {}) => ({
  published: [495, 600, 700],
  departed: [573, 602],
  arrived: [704, 727],
  publishedTripMin: 130,
  recordedTripMin: 128,
  publishedGapMin: 102.5,
  recordedGapMin: 29,
  stillDue: 1,
  lastRecordedMin: 602,
  nextPublishedMin: 700,
  ...over,
});

const service: AirportService = {
  date: "2026-10-28",
  finished: false,
  computedAt: "2026-10-28T12:00:00.000Z",
  southbound: direction(),
  northbound: direction({ departed: [406, 467], arrived: [534, 592], recordedTripMin: 125, lastRecordedMin: 467 }),
  busesSeen: 43,
  tripsRecorded: 50,
  fixes: 26_022,
  lines: [],
};

describe("LiveServiceBlock", () => {
  it("puts the plan and the record side by side, without adding them up", () => {
    const { container } = render(<LiveServiceBlock service={service} status="live" error={null} />);
    expect(screen.getByText("Airport → Rawai")).toBeInTheDocument();
    expect(screen.getByText("Rawai → Airport")).toBeInTheDocument();

    const ran = [...container.querySelectorAll(".v2-service__ran")].map((el) => el.textContent?.trim());
    expect(ran).toEqual(["2 departed", "2 departed"]);

    const trips = [...container.querySelectorAll(".v2-service__trip")].map((el) => el.textContent?.trim());
    expect(trips[0]).toBe("128 min plan 130");
    expect(trips[1]).toBe("125 min plan 130");

    // The header carries the day's totals, not a difference between them:
    // "21 of 40" would read as a verdict on what ran.
    expect(container.querySelector(".v2-service__head-meta")?.textContent).toBe(
      "4 departed · 4 arrived · 2 still due · plan 6 a day",
    );
  });

  it("states the rule that makes the count what it is", () => {
    render(<LiveServiceBlock service={service} status="live" error={null} />);
    // Without this the reader would take the count for the whole service, and
    // the record undercounts by design. The two counts differ all day, and the
    // block says why.
    expect(screen.getByText(/both undercount the service/i)).toBeInTheDocument();
    expect(screen.getByText(/only when it arrives/i)).toBeInTheDocument();
    // The count is of what the record holds. It is not a verdict on what ran.
    expect(screen.getByText(/not a verdict on what ran/i)).toBeInTheDocument();
  });

  it("says so when the record has not answered, instead of showing zeroes", () => {
    const { container } = render(<LiveServiceBlock service={null} status="offline" error="403" />);
    expect(screen.getByText(/did not answer/i)).toBeInTheDocument();
    expect(container.querySelector(".v2-service__ran")).toBeNull();
  });
});
