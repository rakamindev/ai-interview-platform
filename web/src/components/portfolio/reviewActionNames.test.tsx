import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { overrideFixture, skillFixture } from "@/test/portfolioFixtures";

vi.mock("@/services/portfolios", () => ({
    portfoliosApi: { getOverride: vi.fn(), confirmRating: vi.fn(), revertOverride: vi.fn(), getOverrideEvents: vi.fn() },
}));

// Every skill card had buttons called "Override rating" and "Confirm AI
// rating", so a screen reader's list of buttons showed five identical names
// (walkthrough finding W1). The visible text stays short; the name says which
// skill the action is for.
describe("review action names", () => {
    it("names each action after its skill so cards can be told apart (W1)", () => {
        render(
            <>
                <SkillPortfolioCard skill={skillFixture({ id: 1, skill_label: "Contoh SQL" })} onOverrideSaved={vi.fn()} />
                <SkillPortfolioCard skill={skillFixture({ id: 2, skill_label: "Contoh Docker" })} onOverrideSaved={vi.fn()} />
            </>,
        );

        for (const label of ["Contoh SQL", "Contoh Docker"]) {
            expect(screen.getByRole("button", { name: `Override rating for ${label}` })).toHaveTextContent(/^Override rating/);
            expect(screen.getByRole("button", { name: `Confirm AI rating for ${label}` })).toBeInTheDocument();
        }
        // The review actions are unique per card. (The confidence badge reads the same on
        // cards with the same confidence; it is information, not an action.)
        const actions = screen.getAllByRole("button", { name: /^(Override rating|Confirm AI rating|Review history)/ })
            .map((button) => button.textContent);
        expect(actions).toHaveLength(6);
        expect(new Set(actions).size).toBe(6);
    });

    it("names Change rating and Undo override after the skill too", () => {
        const skill = skillFixture({ skill_label: "Contoh SQL", effective_level: 3, level_source: "assessor_override" });
        render(<SkillPortfolioCard skill={skill} override={overrideFixture()} onOverrideSaved={vi.fn()} />);

        expect(screen.getByRole("button", { name: "Change rating for Contoh SQL" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Undo override for Contoh SQL" })).toBeInTheDocument();
    });

    it("names the level group in the override dialog after the skill (W2)", () => {
        render(<SkillPortfolioCard skill={skillFixture({ skill_label: "Contoh SQL" })} onOverrideSaved={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: /^Override rating/ }));

        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByRole("radiogroup", { name: "New level for Contoh SQL" })).toBeInTheDocument();
    });
});
