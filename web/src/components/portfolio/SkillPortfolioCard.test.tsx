import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill, CoverageSource } from "@/types";

vi.mock("./OverridePanel", () => ({
    default: () => null,
}));

function buildSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
    return {
        id: 1,
        skill_label: "React / Frontend Development",
        is_discovered: false,
        ai_level: "L3",
        ai_confidence: "high",
        covered_by: "analyzer" as CoverageSource,
        evidence: ["I split the context into a read only provider and a write provider."],
        competency_summary: "Handles complex state architecture with clear tradeoff reasoning.",
        ...overrides,
    };
}

function renderCard(skill: PortfolioSkill) {
    return render(
        <SkillPortfolioCard skill={skill} onOverrideSaved={() => undefined} />
    );
}

describe("SkillPortfolioCard", () => {
    it("shows the confidence the analyzer earned without a caveat", () => {
        renderCard(buildSkill());

        expect(screen.getByText(/Confidence: HIGH/)).toBeInTheDocument();
        expect(screen.queryByTitle(/analysis window timeout/i)).not.toBeInTheDocument();
    });

    it("marks a skill promoted by the window timeout as unverified", () => {
        renderCard(buildSkill({ ai_confidence: "low", covered_by: "window_timeout" }));

        expect(screen.getByTitle(/analysis window timeout/i)).toBeInTheDocument();
        expect(screen.getByText(/No evidence check ran against the transcript/i)).toBeInTheDocument();
    });

    it("does not call a swept skill briefly explored", () => {
        renderCard(buildSkill({ ai_confidence: "low", covered_by: "window_timeout" }));

        expect(screen.queryByText(/Only briefly explored/i)).not.toBeInTheDocument();
    });

    it("keeps the thin evidence note for a low confidence skill that was never swept", () => {
        renderCard(buildSkill({ ai_confidence: "low", covered_by: null }));

        expect(screen.getByText(/Only briefly explored/i)).toBeInTheDocument();
        expect(screen.queryByTitle(/analysis window timeout/i)).not.toBeInTheDocument();
    });

    it("renders the evidence quotes it was given", () => {
        renderCard(buildSkill());

        expect(screen.getByText(/read only provider/)).toBeInTheDocument();
    });

    it("survives a skill with no evidence and no summary", () => {
        renderCard(buildSkill({ evidence: [], competency_summary: "" }));

        expect(screen.getByText("React / Frontend Development")).toBeInTheDocument();
        expect(screen.queryByText(/Evidence from interview/i)).not.toBeInTheDocument();
    });
});
