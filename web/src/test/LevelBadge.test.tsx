import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LevelBadge from "@/components/portfolio/LevelBadge";

describe("LevelBadge component", () => {
  it("renders L3 badge correctly", () => {
    render(<LevelBadge level={3} />);
    expect(screen.getByText("L3")).toBeInTheDocument();
  });

  it("renders description text in md size", () => {
    render(<LevelBadge level={3} size="md" />);
    expect(screen.getByText("Proficient")).toBeInTheDocument();
  });

  it("does not render description text in sm size", () => {
    render(<LevelBadge level={3} size="sm" />);
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.queryByText("Senior / Independent")).not.toBeInTheDocument();
  });
});
