import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LevelBadge from "./LevelBadge";

describe("LevelBadge", () => {
  it("renders correct level badge for levels 1 to 4", () => {
    const { rerender } = render(<LevelBadge level={1} />);
    expect(screen.getByText("L1")).toBeDefined();

    rerender(<LevelBadge level={2} />);
    expect(screen.getByText("L2")).toBeDefined();

    rerender(<LevelBadge level={3} />);
    expect(screen.getByText("L3")).toBeDefined();

    rerender(<LevelBadge level={4} />);
    expect(screen.getByText("L4")).toBeDefined();
  });

  it("handles level 0 as unassessed with dash and description", () => {
    render(<LevelBadge level={0} />);
    expect(screen.getByText("—")).toBeDefined();
    expect(screen.getByText("Unassessed")).toBeDefined();
  });
});
