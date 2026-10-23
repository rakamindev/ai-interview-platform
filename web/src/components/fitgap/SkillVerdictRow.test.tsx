import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SkillVerdictRow from "./SkillVerdictRow";
import { comparison, needsReview, notCovered } from "@/test/fixtures";
import type { SkillComparison } from "@/types";

function renderRow(c: SkillComparison, reviewHref?: string) {
  return render(
    <MemoryRouter>
      <ul>
        <SkillVerdictRow comparison={c} reviewHref={reviewHref} />
      </ul>
    </MemoryRouter>,
  );
}

describe("SkillVerdictRow", () => {
  it("shows a briefly-explored skill as needing review, never as a gap", () => {
    renderRow(needsReview(), "/portfolio#skill-12");

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.queryByText(/below by/i)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "AI suggested L2 (unconfirmed) · L4 expected" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /confirm a level/i })).toHaveAttribute("href", "/portfolio#skill-12");
  });

  it("says an uncovered skill is not a weakness", () => {
    renderRow(notCovered());

    expect(screen.getByText("Not covered")).toBeInTheDocument();
    expect(screen.getByText(/not evidence of weakness/i)).toBeInTheDocument();
  });

  it("marks a level an assessor confirmed", () => {
    renderRow(comparison({ result: "gap", candidate_level: 2, delta: -1, overridden: true }));

    expect(screen.getByText("Below by 1")).toBeInTheDocument();
    expect(screen.getByText("Assessor-confirmed")).toBeInTheDocument();
  });

  it("shows the AI confidence behind an unconfirmed verdict", () => {
    renderRow(comparison({ result: "exceed", candidate_level: 4, delta: 1, confidence: "medium" }));

    expect(screen.getByText("Exceeds by 1")).toBeInTheDocument();
    expect(screen.getByText("AI · medium confidence")).toBeInTheDocument();
  });

  it("wraps a very long skill name instead of overflowing", () => {
    const label = "Distributed systems design for multi-region event-driven payment reconciliation pipelines";
    renderRow(comparison({ skill_label: label }));

    expect(screen.getByRole("heading", { name: label })).toHaveClass("break-words");
  });
});
