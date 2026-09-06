// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { FieldChronicle } from "./FieldChronicle";

describe("Field chronicle — the woven record", () => {
  it("tells the whole story in chronological order on one line", () => {
    const { container } = render(<FieldChronicle />);
    const text = container.textContent || "";

    // The stations appear in strict order: Jakarta → Boston → the pause →
    // Ton → Johor Bahru → the toolkit → the running system.
    const jakarta = text.indexOf("The first time everyone was in the same room");
    const boston = text.indexOf("the survey critique lands");
    const pause = text.indexOf("The programme was suspended. The work was not.");
    const ton = text.indexOf("dedicated to our friend and colleague");
    const johor = text.indexOf("The last workshop");
    const toolkit = text.indexOf("The 23-page toolkit leaves the room");
    const system = text.indexOf("The report became a bus");

    for (const idx of [jakarta, boston, pause, ton, johor, toolkit, system]) {
      expect(idx).toBeGreaterThan(-1);
    }
    expect(jakarta).toBeLessThan(boston);
    expect(boston).toBeLessThan(pause);
    expect(pause).toBeLessThan(ton);
    expect(ton).toBeLessThan(johor);
    expect(johor).toBeLessThan(toolkit);
    expect(toolkit).toBeLessThan(system);
  });

  it("carries the memorial, the download, the people manifest and the lessons", () => {
    render(<FieldChronicle />);

    // The memorial — quiet, but present, and spelled correctly.
    expect(screen.getByText(/dedicated to our friend and colleague/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ton Jaitong/).length).toBeGreaterThanOrEqual(2);

    // The toolkit is downloadable from inside the chronicle.
    expect(screen.getByRole("link", { name: /Download the toolkit/i })).toHaveAttribute("href", expect.stringContaining("toolkit-source.pdf"));

    // The 39-person manifest and the network rows survived the weave.
    expect(screen.getByText("Roshan Desai")).toBeInTheDocument();
    expect(screen.getByText(/Phuket ↔ Las Vegas/)).toBeInTheDocument();

    // The eight lessons are always visible — no tabs hiding them.
    expect(screen.getByText("Stay long enough")).toBeInTheDocument();
    expect(screen.getByText("Leave an instrument behind")).toBeInTheDocument();

    // The terminal station links to the running system.
    expect(screen.getByRole("link", { name: /Open the live system/i })).toHaveAttribute("href", "https://bus.nonarkara.org/");
  });
});
