// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DesignThinkingStudy, FeasibilityStudy } from "./ToolkitStudy";

describe("Toolkit research studies", () => {
  it("turns a what-if shock into a measurable operating experiment", async () => {
    render(<DesignThinkingStudy />);

    await userEvent.click(screen.getByRole("button", { name: "One charger fails" }));

    expect(screen.getByText(/single point of drama/i)).toBeInTheDocument();
    expect(screen.getByText(/duty-cycle and charger-availability stress test/i)).toBeInTheDocument();
    expect(screen.getByText(/vehicle availability, missed trips and kWh per service-km/i)).toBeInTheDocument();
  });

  it("shows a conservative lending case and recalculates its coverage", () => {
    render(<FeasibilityStudy />);

    expect(screen.getAllByText("1.13×")).toHaveLength(2);
    expect(screen.getByText("฿0.80m")).toBeInTheDocument();

    fireEvent.input(screen.getByRole("slider", { name: /Demand realised/i }), { target: { value: "100" } });

    expect(screen.getAllByText("1.86×")).toHaveLength(2);
    expect(screen.getByText("฿0")).toBeInTheDocument();
    expect(screen.getByText(/conditional proceed to a 90-day instrumented pilot/i)).toBeInTheDocument();
    expect(screen.queryByText(/research priorities, not survey results/i)).not.toBeInTheDocument();
  });
});
