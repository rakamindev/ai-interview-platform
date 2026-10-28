import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverridePanel from "./OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { saveOverride: vi.fn() } }));
const saveOverride = vi.mocked(portfoliosApi.saveOverride);

const assessed: PortfolioSkill = {
  id: 1, skill_id: "SK-ENG-001", skill_label: "React", is_discovered: false, ai_level: 3, ai_confidence: "high",
  assessment_status: "assessed", status_reason: null, evidence: [], competency_summary: "",
};
const notAssessed: PortfolioSkill = {
  ...assessed, id: 2, skill_label: "Communication", ai_level: null, ai_confidence: null,
  assessment_status: "not_assessed", status_reason: "Not discussed in the interview.",
};

function renderPanel(skill: PortfolioSkill, onSaved = vi.fn()) {
  render(<OverridePanel skill={skill} onSaved={onSaved} onCancel={vi.fn()} />);
  return onSaved;
}

beforeEach(() => saveOverride.mockReset());

describe("OverridePanel", () => {
  it("starts from the AI level and saves the chosen level", async () => {
    saveOverride.mockResolvedValue({ data: { override: { id: 5, override_level: 4 } } } as never);
    const onSaved = renderPanel(assessed);

    expect(screen.getByRole("radio", { name: "L3" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "L4" }));
    await userEvent.click(screen.getByRole("button", { name: "Save override" }));

    expect(saveOverride).toHaveBeenCalledWith(1, { override_level: 4, assessor_notes: "" });
    expect(onSaved).toHaveBeenCalledWith({ id: 5, override_level: 4 });
  });

  it("asks for a level and a note when the skill was not assessed (AC6.3)", async () => {
    renderPanel(notAssessed);

    const save = screen.getByRole("button", { name: "Save override" });
    expect(screen.getByRole("radio", { name: "L1" })).not.toBeChecked();
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole("radio", { name: "L2" }));
    expect(save).toBeDisabled();
    expect(screen.getByText("Required: this skill was not discussed, so say what your rating is based on.")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox"), "Covered it in the follow-up call.");
    expect(save).toBeEnabled();
  });

  it("counts characters and stops at the 2,000 limit (AC6.4)", async () => {
    renderPanel(assessed);

    const notes = screen.getByRole("textbox");
    await userEvent.type(notes, "Twelve chars");

    expect(screen.getByText("12 / 2000")).toBeInTheDocument();
    expect(notes).toHaveAttribute("maxLength", "2000");
  });

  it("shows the API's reason when saving fails", async () => {
    // Once: the save is expected to be attempted exactly once (asserted below).
    saveOverride.mockRejectedValueOnce(
      Object.assign(new Error("Request failed with status code 422"), {
        response: { status: 422, data: { errors: [{ message: "Override level must be in 1..5" }] } },
      })
    );
    renderPanel(assessed);

    await userEvent.click(screen.getByRole("button", { name: "Save override" }));

    expect(await screen.findByText("Override level must be in 1..5")).toBeInTheDocument();
    expect(saveOverride).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Save override" })).toBeEnabled();
  });

  it("keeps the radio buttons of two open panels independent", () => {
    render(
      <>
        <OverridePanel skill={assessed} onSaved={vi.fn()} onCancel={vi.fn()} />
        <OverridePanel skill={{ ...assessed, id: 7 }} onSaved={vi.fn()} onCancel={vi.fn()} />
      </>
    );

    const [first, second] = screen.getAllByRole("radio", { name: "L4" });
    expect(first).not.toBe(second);
  });
});
