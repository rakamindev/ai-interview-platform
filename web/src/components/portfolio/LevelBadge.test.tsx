import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LevelBadge from "./LevelBadge";

describe("LevelBadge", () => {
  it("renders level label and description for default 'md' size", () => {
    render(<LevelBadge level={3} />);

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Proficient")).toBeInTheDocument();
  });

  it("renders compact badge without description for 'sm' size", () => {
    render(<LevelBadge level={4} size="sm" />);

    expect(screen.getByText("L4")).toBeInTheDocument();
    expect(screen.queryByText("Advanced")).not.toBeInTheDocument();
  });
});
