import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EvidenceReviewCard from "@/components/portfolio/EvidenceReviewCard";
import type { PortfolioSkill } from "@/types";

const baseSkill: PortfolioSkill = {
  id: 1,
  skill_label: "Communication",
  is_discovered: false,
  ai_level: "L2",
  ai_confidence: "medium",
  evidence: ["I framed it as a performance risk"],
  evidence_provenance: [{ quote_index: 0, transcript_turn_id: 10, turn_number: 6, verified: true }],
  competency_summary: "Clear communicator.",
  requires_review: false,
};

describe("EvidenceReviewCard", () => {
  it("shows a verified checkmark for evidence with provenance", () => {
    render(<EvidenceReviewCard skill={baseSkill} onReviewSaved={() => {}} onEvidenceClick={() => {}} />);
    // Verified indicator: the quote + its turn link are rendered, no "unverified" tag.
    expect(screen.getByText(/turn 6/i)).toBeInTheDocument();
    expect(screen.queryByText(/unverified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not assessed/i)).not.toBeInTheDocument();
  });

  it("marks evidence without provenance as unverified", () => {
    const skill: PortfolioSkill = {
      ...baseSkill,
      evidence_provenance: [{ quote_index: 0, transcript_turn_id: null, turn_number: null, verified: false }],
    };
    render(<EvidenceReviewCard skill={skill} onReviewSaved={() => {}} />);
    expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  });

  it("shows Not assessed when ai_level is null", () => {
    const skill: PortfolioSkill = {
      ...baseSkill,
      ai_level: null,
      ai_confidence: null,
      requires_review: true,
      review_reasons: ["no_valid_level"],
    };
    render(<EvidenceReviewCard skill={skill} onReviewSaved={() => {}} />);
    // The badge renders "—" and the "Not assessed" sub-label appears.
    expect(screen.getAllByText(/not assessed/i).length).toBeGreaterThan(0);
  });

  it("renders a needs-review banner with the reasons", () => {
    const skill: PortfolioSkill = {
      ...baseSkill,
      ai_level: null,
      ai_confidence: null,
      requires_review: true,
      review_reasons: ["no_valid_level", "unverified_evidence"],
    };
    render(<EvidenceReviewCard skill={skill} onReviewSaved={() => {}} />);
    expect(screen.getByText(/flagged/i)).toBeInTheDocument();
    expect(screen.getByText(/no valid level/i)).toBeInTheDocument();
  });

  it("calls onEvidenceClick with the turn number when a link is clicked", async () => {
    const user = userEvent.setup();
    const onEvidenceClick = vi.fn();
    render(
      <EvidenceReviewCard skill={baseSkill} onReviewSaved={() => {}} onEvidenceClick={onEvidenceClick} />
    );

    await user.click(screen.getByRole("button", { name: /turn 6/i }));
    expect(onEvidenceClick).toHaveBeenCalledWith(6);
  });
});
