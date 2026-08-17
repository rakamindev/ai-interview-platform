import { describe, it, expect } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import LevelBadge from "./LevelBadge";

describe("LevelBadge", () => {
  it("renders the level label and description at md size", () => {
    render(<LevelBadge level={3} />);
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Proficient")).toBeInTheDocument();
  });

  it("hides the description at sm size", () => {
    render(<LevelBadge level={3} size="sm" />);
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.queryByText("Proficient")).not.toBeInTheDocument();
  });

  it("applies the per-level badge classes and custom className", () => {
    const { container } = render(<LevelBadge level={4} className="my-2" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("bg-purple-100");
    expect(badge.className).toContain("my-2");
  });
});
