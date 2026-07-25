// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbcdefFramework, ProgramArchive } from "./ProgramArchive";

describe("Programme story and framework", () => {
  it("identifies ABCDEF as the project's framework", () => {
    render(<AbcdefFramework />);

    expect(screen.getByText(/project’s mode-choice framework/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ABCDEF: six tests/i })).toBeInTheDocument();
    expect(screen.getByText("Accessibility")).toBeInTheDocument();
    expect(screen.getByText("Freedom")).toBeInTheDocument();
  });

  it("keeps the programme chronology concise and exposes deeper archive views", async () => {
    render(<ProgramArchive />);

    expect(screen.getByRole("heading", { name: /Four years. Eight cities/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trust before templates" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "What changed" }));
    expect(screen.getByRole("heading", { name: "Stay long enough" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "People + network" }));
    expect(screen.getByRole("heading", { name: "Roshan Desai" })).toBeInTheDocument();
    expect(screen.getByText(/Phuket ↔ Las Vegas/)).toBeInTheDocument();
  });
});
