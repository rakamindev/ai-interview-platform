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

describe("AnchorRail — compact mode", () => {
  it("hides skill label in compact mode", () => {
    render(<AnchorRail skillLabel="React" requiredLevel={3} compact />);
    expect(screen.queryByText("React")).not.toBeInTheDocument();
  });

  it("hides level tick labels (L1–L5) in compact mode", () => {
    render(<AnchorRail skillLabel="React" requiredLevel={3} compact />);
    expect(screen.queryByText("L1")).not.toBeInTheDocument();
    expect(screen.queryByText("L2")).not.toBeInTheDocument();
    expect(screen.queryByText("L3")).not.toBeInTheDocument();
    expect(screen.queryByText("L4")).not.toBeInTheDocument();
    expect(screen.queryByText("L5")).not.toBeInTheDocument();
  });

  it("still renders the rail in compact mode", () => {
    const { container } = render(
      <AnchorRail skillLabel="React" requiredLevel={3} compact />
    );
    const rail = container.querySelector('[role="img"]');
    expect(rail).toBeInTheDocument();
  });

  it("renders required mark in compact mode", () => {
    const { container } = render(
      <AnchorRail skillLabel="React" requiredLevel={3} compact />
    );
    const rail = container.querySelector('[role="img"]');
    // Required mark is a triangle (border-based CSS shape)
    const marks = rail!.querySelectorAll("span");
    expect(marks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders candidate mark when candidateLevel provided in compact mode", () => {
    const { container } = render(
      <AnchorRail
        skillLabel="React"
        requiredLevel={3}
        candidateLevel={4}
        confidence="high"
        compact
      />
    );
    const rail = container.querySelector('[role="img"]');
    // Should have required mark + candidate mark (at least 2 spans)
    const marks = rail!.querySelectorAll("span");
    expect(marks.length).toBeGreaterThanOrEqual(2);
  });

  it("shows dash label for not_assessed in compact mode", () => {
    render(<AnchorRail skillLabel="Testing" requiredLevel={3} compact />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("does not show dash label when candidateLevel exists in compact mode", () => {
    render(
      <AnchorRail
        skillLabel="Testing"
        requiredLevel={3}
        candidateLevel={2}
        confidence="high"
        compact
      />
    );
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("adds dashed outline class for insufficient_evidence in compact mode", () => {
    const { container } = render(
      <AnchorRail
        skillLabel="React"
        requiredLevel={3}
        candidateLevel={2}
        confidence="medium"
        result="insufficient_evidence"
        compact
      />
    );
    const rail = container.querySelector('[role="img"]');
    // Candidate dot is the last span inside the rail div (band may precede it)
    const allSpans = rail!.querySelectorAll("span");
    const candidateDot = allSpans[allSpans.length - 1];
    expect(candidateDot.className).toContain("ring");
  });

  it("shows override indicator in compact mode when isOverride is true", () => {
    const { container } = render(
      <AnchorRail
        skillLabel="React"
        requiredLevel={3}
        candidateLevel={4}
        confidence="high"
        isOverride
        compact
      />
    );
    const rail = container.querySelector('[role="img"]');
    // Should contain an override indicator element
    const overrideIndicator = rail!.querySelector('[aria-label*="override"], [title*="override"], [data-override]');
    expect(overrideIndicator).toBeInTheDocument();
  });

  it("renders wider band for low confidence in compact mode", () => {
    const { container: lowContainer } = render(
      <AnchorRail
        skillLabel="React"
        requiredLevel={3}
        candidateLevel={4}
        confidence="low"
        compact
      />
    );
    const { container: highContainer } = render(
      <AnchorRail
        skillLabel="React"
        requiredLevel={3}
        candidateLevel={4}
        confidence="high"
        compact
      />
    );
    // Low confidence should have a band element (wider span)
    const lowRail = lowContainer.querySelector('[role="img"]');
    const highRail = highContainer.querySelector('[role="img"]');
    // Low confidence renders band + dot; high renders dot only
    const lowSpans = lowRail!.querySelectorAll("span").length;
    const highSpans = highRail!.querySelectorAll("span").length;
    expect(lowSpans).toBeGreaterThan(highSpans);
  });
});
