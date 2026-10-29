// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { RiderDecisionCard } from "./RiderDecisionCard";

vi.mock("../../engine/time", () => ({ getBangkokNowMinutes: () => 930 })); // 15:30

const airport = { routeId: "rawai-airport", index: 0 };
const rawai = { routeId: "rawai-airport", index: 29 };

describe("RiderDecisionCard never states a wait it does not have", () => {
  it("a live bus gives the wait, and says where it came from", () => {
    render(<RiderDecisionCard currentStopRef={airport} stopName="Phuket Airport" liveEtaMin={12.4} timetableNextStr="16:00" />);
    expect(screen.getByText("12 min")).toBeInTheDocument();
    expect(screen.getByText("live GPS pace")).toBeInTheDocument();
    expect(screen.getByText(/Take the bus/)).toBeInTheDocument();
    expect(screen.getByText(/from the bus's live GPS/)).toBeInTheDocument();
  });

  it("at the airport with no live bus, the answer is the timetable's, in real minutes", () => {
    render(<RiderDecisionCard currentStopRef={airport} stopName="Phuket Airport" liveEtaMin={null} timetableNextStr="16:00" />);
    expect(screen.getByText("Next 16:00")).toBeInTheDocument();
    expect(screen.getByText("scheduled · in 30 min")).toBeInTheDocument();
    expect(screen.getByText(/Worth the wait: save ฿650 for 30 min/)).toBeInTheDocument();
  });

  it("anywhere else with no live bus there is no wait — it used to say 35 minutes", () => {
    const { container } = render(<RiderDecisionCard currentStopRef={rawai} stopName="Rawai Beach" liveEtaMin={null} timetableNextStr="16:00" />);
    expect(screen.getByText("No bus yet")).toBeInTheDocument();
    expect(screen.getByText(/No bus is on its way to Rawai Beach right now/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/35/);
    // the airport timetable is not Rawai's timetable
    expect(container.textContent).not.toMatch(/16:00/);
  });

  it("a past departure rolls to tomorrow instead of going negative", () => {
    render(<RiderDecisionCard currentStopRef={airport} stopName="Phuket Airport" liveEtaMin={null} timetableNextStr="08:15" />);
    // 15:30 → 08:15 next day = 16 h 45 min
    expect(screen.getByText("scheduled · in 1005 min")).toBeInTheDocument();
    expect(screen.getByText(/Short on time/)).toBeInTheDocument();
  });

  it("carries no invented revenue or CO₂ figures — the what-if lives on the console", () => {
    const { container } = render(<RiderDecisionCard currentStopRef={airport} stopName="Phuket Airport" liveEtaMin={12} timetableNextStr={null} />);
    expect(container.textContent).not.toMatch(/38,000|64,000|1,600 kg|Daily Revenue/);
    expect(container.querySelector('a[href$="/ops"]')).not.toBeNull();
  });
});
