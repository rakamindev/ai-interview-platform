import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "Node.js / Backend Development",
    is_discovered: false,
    ai_level: 4,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

function renderCard(cardSkill = skill(), override?: AssessorOverride) {
  return render(
    <SkillPortfolioCard skill={cardSkill} override={override} onOverrideSaved={vi.fn()} />,
  );
}

const LONG_QUOTE =
  "Saya pernah refactor service pembayaran yang tadinya monolit jadi tiga service terpisah, dan yang paling susah itu memastikan idempotency waktu retry, terutama kalau downstream service-nya timeout di tengah proses.";

describe("SkillPortfolioCard", () => {
  it("H5: warns about low confidence with the yellow attention accent, never red", () => {
    renderCard(skill({ ai_confidence: "low" }));

    expect(screen.getByText(/only briefly explored/i)).toBeInTheDocument();
    expect(screen.getByText(/follow-up session is recommended/i)).toBeInTheDocument();

    // The warning must use the yellow (attention) treatment, never destructive red.
    const warning = screen.getByText(/only briefly explored/i).closest("div") as HTMLElement;
    expect(warning.className).not.toContain("destructive");
    expect(screen.getByText("Confidence: LOW").className).not.toContain("destructive");
  });

  it("H6: explains when there is no evidence instead of rendering an empty shell", () => {
    renderCard(skill({ evidence: [] }));
    expect(screen.getByText("No quotes captured for this skill.")).toBeInTheDocument();
  });

  it("H7: shows the first two quotes and reveals the rest behind Show all", () => {
    renderCard(skill({ evidence: [LONG_QUOTE, "Kedua.", "Ketiga.", "Keempat."] }));

    expect(screen.getByText(/Saya pernah refactor/)).toBeInTheDocument();
    expect(screen.getByText(/Kedua\./)).toBeInTheDocument();
    expect(screen.queryByText(/Ketiga\./)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show all \(2 more\)/i }));
    expect(screen.getByText(/Ketiga\./)).toBeInTheDocument();
    expect(screen.getByText(/Keempat\./)).toBeInTheDocument();
  });

  it("H14: renders the candidate's own words in the serif face", () => {
    renderCard(skill({ evidence: [LONG_QUOTE] }));

    const quote = screen.getByText(/Saya pernah refactor/);
    expect(quote.closest("blockquote")?.className).toContain("font-serif");
  });

  it("H8: a very long skill name and a four-sentence quote do not break the layout", () => {
    const longName =
      "Event-Driven Architecture & Asynchronous Messaging Systems in Distributed Backend Platforms";
    renderCard(skill({ skill_label: longName, evidence: [LONG_QUOTE] }));

    expect(screen.getByText(longName)).toBeInTheDocument();
    expect(screen.getByText(/Saya pernah refactor/)).toBeInTheDocument();
    // The name is wrapped defensively so the track and numbers are not pushed out.
    expect(screen.getByText("L4")).toBeInTheDocument();
  });

  it("shows the level through the shared track instrument", () => {
    renderCard(skill({ ai_level: 3 }));
    expect(screen.getByRole("img", { name: "Level 3 of 5" })).toBeInTheDocument();
  });

  it("marks discovered skills with a calm marker", () => {
    renderCard(skill({ is_discovered: true }));
    expect(screen.getByText("Discovered")).toBeInTheDocument();
  });

  it("surfaces an assessor override: corrected level primary, AI level struck through", () => {
    const override: AssessorOverride = {
      id: 9,
      portfolio_skill_id: 1,
      ai_level: 2,
      override_level: 3,
      assessor_notes: "Candidate described partitioning correctly, the AI missed it.",
      overridden_by: 7,
    };

    renderCard(skill({ ai_level: 2 }), override);

    // Corrected level is primary; original AI level is struck-through context.
    expect(screen.getByRole("img", { name: "Level 3 of 5" })).toBeInTheDocument();
    const struck = screen.getAllByText("L2");
    expect(struck.length).toBeGreaterThan(0);
    expect(struck.every((el) => el.className.includes("line-through"))).toBe(true);
    expect(screen.getByText(/Candidate described partitioning correctly/)).toBeInTheDocument();
    expect(screen.getByText(/— Assessor/)).toBeInTheDocument();
    expect(screen.getByText("Override saved")).toBeInTheDocument();
  });
});
