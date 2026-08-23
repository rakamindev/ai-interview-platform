import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RubricStatusBadge from "./RubricStatusBadge";

describe("RubricStatusBadge", () => {
  it("shows a captured assessment version", () => {
    render(<RubricStatusBadge rubric={{ status: "captured", version: 3 }} />);

    expect(screen.getByText("Rubric v3")).toBeInTheDocument();
  });

  it("marks sessions without a version as legacy", () => {
    render(<RubricStatusBadge rubric={{ status: "legacy", version: null }} />);

    expect(screen.getByText("Legacy template")).toBeInTheDocument();
  });
});
