import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { overrideFixture, skillFixture } from "@/test/portfolioFixtures";
import type { PortfolioSkill } from "@/types";

const notAssessed: PortfolioSkill = {
    id: 1,
    skill_label: "Contoh System Design",
    is_discovered: false,
    rating_status: "not_assessed",
    not_assessed_reason: "not_covered",
    ai_level: null,
    ai_confidence: null,
    evidence: [],
    competency_summary: "",
};

describe("SkillPortfolioCard", () => {
    it("renders a not-assessed skill without a level or a confidence", () => {
        render(<SkillPortfolioCard skill={notAssessed} onOverrideSaved={vi.fn()} />);

        expect(screen.getByText("Contoh System Design")).toBeInTheDocument();
        expect(screen.getByText("Not assessed")).toBeInTheDocument();
        expect(screen.getByText(/not covered in the interview/i)).toBeInTheDocument();
        expect(screen.queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Confidence:/)).not.toBeInTheDocument();
    });
});

// Slice 6b: one card per skill with level, confidence, source, evidence and
// the review actions that apply to its state.
describe("SkillPortfolioCard review actions", () => {
    it("shows level, confidence with probes and the AI source, with override, confirm and history", () => {
        render(<SkillPortfolioCard skill={skillFixture({ effective_level: 3, ai_level: 3 })} onOverrideSaved={vi.fn()} />);

        expect(screen.getByRole("img", { name: "Level L3" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "High confidence, 3 probes" })).toBeInTheDocument();
        expect(screen.getByText("AI rating, not reviewed")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Override rating for Contoh SQL" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirm AI rating for Contoh SQL" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Review history for Contoh SQL" })).toBeInTheDocument();
    });

    it("hides Confirm for a not-assessed skill but still allows a manual rating", () => {
        render(<SkillPortfolioCard skill={notAssessed} onOverrideSaved={vi.fn()} />);

        expect(screen.queryByRole("button", { name: "Confirm AI rating for Contoh System Design" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Rate manually for Contoh System Design" })).toBeInTheDocument();
    });

    it("shows an override with its AI level, note and assessor, and offers change and undo but not confirm", () => {
        const skill = skillFixture({ effective_level: 3, level_source: "assessor_override",
            review: { action: "override", ai_level: 2, notes: "Contoh: tugas tertulis.", actor_id: 7, at: "2026-10-25T08:00:00.000Z" } });
        render(<SkillPortfolioCard skill={skill} override={overrideFixture()} onOverrideSaved={vi.fn()} />);

        expect(screen.getByText("Assessor override (AI L2)")).toBeInTheDocument();
        expect(screen.getByText("Assessor #7, 25 Oct 2026, 08:00 UTC")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Change rating for Contoh SQL" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Undo override for Contoh SQL" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Confirm AI rating for Contoh SQL" })).not.toBeInTheDocument();
    });

    it("does not offer Confirm again for a rating an assessor already confirmed", () => {
        render(<SkillPortfolioCard skill={skillFixture({ level_source: "assessor_confirmed", assessor_confirmed: true })} onOverrideSaved={vi.fn()} />);

        expect(screen.getByText("Confirmed by assessor")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Confirm AI rating for Contoh SQL" })).not.toBeInTheDocument();
    });

    it("opens the evidence from the interview", () => {
        render(<SkillPortfolioCard skill={skillFixture()} onOverrideSaved={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Evidence from the interview (1) for Contoh SQL" }));

        expect(screen.getByText("Kandidat Contoh: kutipan tentang SQL.")).toBeInTheDocument();
    });

    it("nests the evidence heading (h4) under the skill name (h3)", () => {
        render(<SkillPortfolioCard skill={skillFixture()} onOverrideSaved={vi.fn()} />);

        expect(screen.getByRole("heading", { level: 3, name: "Contoh SQL" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 4, name: /Evidence from the interview/ })).toBeInTheDocument();
    });

    it("wraps a 255-character skill name", () => {
        const label = "S".repeat(255);
        render(<SkillPortfolioCard skill={skillFixture({ skill_label: label })} onOverrideSaved={vi.fn()} />);

        expect(screen.getByRole("heading", { name: label })).toHaveClass("[overflow-wrap:anywhere]");
    });
});
