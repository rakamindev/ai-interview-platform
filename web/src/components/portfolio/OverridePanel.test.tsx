import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OverridePanel from "@/components/portfolio/OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import { httpError, networkError, overrideFixture, skillFixture } from "@/test/portfolioFixtures";
import type { PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { getOverride: vi.fn() } }));

const skill: PortfolioSkill = {
    id: 1,
    skill_label: "Contoh SQL",
    is_discovered: false,
    rating_status: "assessed",
    ai_level: 2,
    ai_confidence: "medium",
    evidence: ["Kandidat Contoh: kutipan."],
    competency_summary: "Contoh.",
};

// AC-20 on the web side: an override is human-review evidence, so the note is required.
describe("OverridePanel", () => {
    it("asks for a required note and only enables saving once a note is written", () => {
        render(<OverridePanel skill={skill} onSaved={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: /override rating/i }));
        fireEvent.click(screen.getByLabelText(/L3/));

        const save = screen.getByRole("button", { name: /save override/i });
        expect(screen.getByLabelText(/reason for the change/i)).toBeRequired();
        expect(save).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/reason for the change/i), { target: { value: "   " } });
        expect(save).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/reason for the change/i), { target: { value: "Contoh alasan." } });
        expect(save).toBeEnabled();
    });
});

// Slice 6b: the override is a dialog with a required note, a visible
// comparison with the AI level, and failures that never drop the input.
describe("OverridePanel dialog", () => {
    afterEach(() => vi.clearAllMocks());

    function open(props: Partial<Parameters<typeof OverridePanel>[0]> = {}) {
        const onSaved = vi.fn();
        const onConflict = vi.fn();
        const utils = render(<OverridePanel skill={skillFixture()} onSaved={onSaved} onConflict={onConflict} {...props} />);
        const trigger = screen.getByRole("button", { name: /override rating|change rating|rate manually/i });
        trigger.focus();
        fireEvent.click(trigger);
        return { ...utils, trigger, onSaved, onConflict };
    }

    function fill(level: string, note: string) {
        fireEvent.click(screen.getByLabelText(level));
        fireEvent.change(screen.getByLabelText(/reason for the change/i), { target: { value: note } });
    }

    it("moves focus into the dialog, closes on Escape and returns focus to the trigger", async () => {
        const { trigger } = open();

        const dialog = await screen.findByRole("dialog", { name: "Override rating: Contoh SQL" });
        expect(dialog).toContainElement(document.activeElement as HTMLElement);

        fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(document.activeElement).toBe(trigger);
    });

    it("shows the AI level next to the chosen level before saving", () => {
        open();
        fill("L3", "Contoh alasan.");

        expect(screen.getByText("AI L2, your rating L3")).toBeInTheDocument();
    });

    it("rejects the current level on the client with a clear message", () => {
        open();
        fill("L2", "Contoh alasan.");

        expect(screen.getByText("L2 is already the current level. Choose a different level.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save override/i })).toBeDisabled();
    });

    it("counts the note up to 2,000 characters", () => {
        open();
        fill("L3", "Contoh");

        expect(screen.getByText("6 / 2000")).toBeInTheDocument();
        expect(screen.getByLabelText(/reason for the change/i)).toHaveAttribute("maxLength", "2000");
    });

    it("saves the level, the trimmed note and the lock version, then closes", async () => {
        vi.mocked(portfoliosApi.getOverride).mockResolvedValue({ data: { override: overrideFixture({ lock_version: 4 }) } } as never);
        const { onSaved } = open({ existingOverride: overrideFixture({ override_level: 3, lock_version: 3 }),
                                   skill: skillFixture({ effective_level: 3, level_source: "assessor_override" }) });
        fill("L4", "  Contoh alasan.  ");

        fireEvent.click(screen.getByRole("button", { name: /save override/i }));

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(portfoliosApi.getOverride).toHaveBeenCalledWith(1, { override_level: 4, assessor_notes: "Contoh alasan.", lock_version: 3 });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("cannot be submitted twice while saving", () => {
        vi.mocked(portfoliosApi.getOverride).mockReturnValue(new Promise(() => {}) as never);
        open();
        fill("L3", "Contoh alasan.");

        const save = screen.getByRole("button", { name: /save override/i });
        fireEvent.click(save);
        fireEvent.click(save);

        expect(portfoliosApi.getOverride).toHaveBeenCalledTimes(1);
        expect(save).toBeDisabled();
    });

    it("shows the server validation message and keeps the input", async () => {
        vi.mocked(portfoliosApi.getOverride).mockRejectedValue(httpError(422, { errors: [{ status: 422, message: "No change: the skill is already at L3" }] }));
        open();
        fill("L3", "Contoh alasan.");

        fireEvent.click(screen.getByRole("button", { name: /save override/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No change: the skill is already at L3");
        expect(screen.getByLabelText(/reason for the change/i)).toHaveValue("Contoh alasan.");
    });

    it("explains a network failure in plain words and keeps the input", async () => {
        vi.mocked(portfoliosApi.getOverride).mockRejectedValue(networkError);
        open();
        fill("L3", "Contoh alasan.");

        fireEvent.click(screen.getByRole("button", { name: /save override/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Could not save. Check your connection and try again.");
        expect(screen.getByLabelText(/reason for the change/i)).toHaveValue("Contoh alasan.");
    });

    it("on a 409 keeps the input, offers to load the latest rating and then shows it", async () => {
        vi.mocked(portfoliosApi.getOverride).mockRejectedValue(
            httpError(409, { errors: [{ status: 409, message: "This rating was changed by someone else. Reload and try again." }] }));
        const { onConflict, rerender, onSaved } = open();
        fill("L3", "Contoh alasan.");
        fireEvent.click(screen.getByRole("button", { name: /save override/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("This skill was changed by someone else");
        fireEvent.click(screen.getByRole("button", { name: "Load the latest rating" }));
        expect(onConflict).toHaveBeenCalledTimes(1);

        rerender(<OverridePanel skill={skillFixture({ effective_level: 4, level_source: "assessor_override" })}
                                existingOverride={overrideFixture({ override_level: 4, lock_version: 5 })}
                                onSaved={onSaved} onConflict={onConflict} />);

        expect(screen.getByText("Latest rating: L4 (assessor override)")).toBeInTheDocument();
        expect(screen.getByLabelText(/reason for the change/i)).toHaveValue("Contoh alasan.");
    });

    it("shows the current assessor rating when changing an override", () => {
        open({ existingOverride: overrideFixture({ override_level: 3 }),
               skill: skillFixture({ effective_level: 3, level_source: "assessor_override" }) });

        expect(screen.getByText("Current rating: L3 (assessor override)")).toBeInTheDocument();
    });

    it("offers Rate manually for a not-assessed skill and says the AI has no level", async () => {
        open({ skill: skillFixture({ rating_status: "not_assessed", not_assessed_reason: "not_covered", ai_level: null,
                                     ai_confidence: null, effective_level: null, level_source: null }) });
        fill("L3", "Contoh alasan.");

        expect(screen.getByText("AI not assessed, your rating L3")).toBeInTheDocument();
    });
});
