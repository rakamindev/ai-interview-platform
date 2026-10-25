import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

vi.mock("@/components/portfolio/OverridePanel", () => ({ default: () => null }));

const baseSkill: PortfolioSkill = {
  id: 9,
  skill_label: "React",
  is_discovered: false,
  ai_level: "L3",
  ai_confidence: "high",
  competency_summary: "Summary",
  evidence_status: "verified",
  evidence: [],
};

function renderCard(skill: PortfolioSkill) {
  return render(
    <MemoryRouter>
      <SkillPortfolioCard
        skill={skill}
        transcriptPath="/assessments/1/sessions/2/transcript"
        onOverrideSaved={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe("SkillPortfolioCard evidence provenance", () => {
  it("links verified evidence to its transcript turn with an accessible name", () => {
    renderCard({
      ...baseSkill,
      evidence: [{
        turn_id: 22,
        turn_number: 14,
        quote: "Canonical candidate quote",
        verification_status: "verified",
      }],
    });

    const link = screen.getByRole("link", { name: "View evidence in transcript, turn 14" });
    expect(link).toHaveAttribute("href", "/assessments/1/sessions/2/transcript?turn=14");
    expect(screen.getByText(/Canonical candidate quote/)).toBeInTheDocument();
  });

  it("labels legacy evidence and does not create a transcript link", () => {
    renderCard({
      ...baseSkill,
      evidence_status: "legacy",
      evidence: [{
        turn_id: null,
        turn_number: null,
        quote: "Detached historical text",
        verification_status: "legacy",
      }],
    });

    expect(screen.getByText("Legacy evidence — transcript link unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view evidence/i })).not.toBeInTheDocument();
  });

  it("makes the insufficient evidence policy visible", () => {
    renderCard({ ...baseSkill, evidence_status: "insufficient", evidence: [] });

    expect(screen.getByRole("status")).toHaveTextContent("Insufficient verified transcript evidence");
  });

  it("groups low confidence and insufficient evidence into one quality notice", () => {
    renderCard({
      ...baseSkill,
      ai_confidence: "low",
      evidence_status: "insufficient",
      evidence: [],
    });

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Evidence quality");
    expect(notice).toHaveTextContent("Only briefly explored");
    expect(notice).toHaveTextContent("Insufficient verified transcript evidence");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
