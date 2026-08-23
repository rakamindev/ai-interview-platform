import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("opens a captured rubric when the parent provides a view action", () => {
    const onView = vi.fn();
    render(<RubricStatusBadge rubric={{ status: "captured", version: 3 }} onView={onView} />);

    fireEvent.click(screen.getByRole("button", { name: "View changes for rubric version 3" }));

    expect(onView).toHaveBeenCalledWith(3);
  });
});
