import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AnchorRail from "./AnchorRail";

describe("AnchorRail", () => {
  it("renders the skill label", () => {
    render(<AnchorRail skillLabel="React" requiredLevel={3} />);
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("renders all five level labels", () => {
    render(<AnchorRail skillLabel="React" requiredLevel={3} />);
    expect(screen.getByText("L1")).toBeInTheDocument();
    expect(screen.getByText("L2")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("L4")).toBeInTheDocument();
    expect(screen.getByText("L5")).toBeInTheDocument();
  });

  it("has an aria-label sentence for screen readers", () => {
    render(
      <AnchorRail skillLabel="React" requiredLevel={3} candidateLevel={4} confidence="high" />
    );
    const rail = screen.getByRole("img");
    expect(rail.getAttribute("aria-label")).toContain("React");
    expect(rail.getAttribute("aria-label")).toContain("candidate L4");
    expect(rail.getAttribute("aria-label")).toContain("requirement L3");
  });

  it("describes not assessed when no candidate level", () => {
    render(<AnchorRail skillLabel="Testing" requiredLevel={3} />);
    const rail = screen.getByRole("img");
    expect(rail.getAttribute("aria-label")).toContain("not assessed");
  });

  it("describes low confidence", () => {
    render(
      <AnchorRail skillLabel="Testing" requiredLevel={3} candidateLevel={2} confidence="low" />
    );
    const rail = screen.getByRole("img");
    expect(rail.getAttribute("aria-label")).toContain("low confidence");
  });
});
