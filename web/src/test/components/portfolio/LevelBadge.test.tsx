import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LevelBadge from "@/components/portfolio/LevelBadge";

describe("LevelBadge", () => {
  it.each([
    [1, "L1", "Foundational"],
    [2, "L2", "Functional"],
    [3, "L3", "Proficient"],
    [4, "L4", "Advanced"],
    [5, "L5", "Expert"],
  ])("renders label and description for level %i", (level, label, description) => {
    render(<LevelBadge level={level} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it("hides the description line at size=sm", () => {
    render(<LevelBadge level={3} size="sm" />);

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.queryByText("Proficient")).not.toBeInTheDocument();
  });
});
