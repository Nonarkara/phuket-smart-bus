// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { AbcdefFramework } from "./ProgramArchive";

describe("Programme story and framework", () => {
  it("identifies ABCDEF as the project's framework", () => {
    render(<AbcdefFramework />);

    expect(screen.getByText(/project’s mode-choice framework/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ABCDEF: six tests/i })).toBeInTheDocument();
    expect(screen.getByText("Accessibility")).toBeInTheDocument();
    expect(screen.getByText("Freedom")).toBeInTheDocument();
  });
});
