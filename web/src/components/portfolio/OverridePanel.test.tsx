import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OverridePanel from "./OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { getOverride: vi.fn() } }));
const skill: PortfolioSkill = { id: 7, skill_label: "Communication", ai_level: "L3", ai_confidence: "high", is_discovered: false, evidence: [], competency_summary: "" };

describe("Override dialog", () => {
  it("retains edits after failure and sends the same payload on retry", async () => {
    const override = { id: 1, portfolio_skill_id: 7, ai_level: 3, override_level: 3, assessor_notes: "Interview evidence" };
    vi.mocked(portfoliosApi.getOverride).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { override } } as any);
    const onSaved = vi.fn();
    render(<OverridePanel skill={skill} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Override rating" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Override rating");
    fireEvent.change(screen.getByRole("textbox", { name: /Notes/ }), { target: { value: "Interview evidence" } });
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your rating and notes are still here");
    expect(screen.getByRole("textbox")).toHaveValue("Interview evidence");
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(portfoliosApi.getOverride).toHaveBeenLastCalledWith(7, { override_level: 3, assessor_notes: "Interview evidence" });
    expect(onSaved).toHaveBeenCalledWith(override);
    await waitFor(() => expect(screen.getByRole("button", { name: "Override rating" })).toHaveFocus());
  });

  it("cancel discards the draft and reopens with the saved values", async () => {
    render(<OverridePanel skill={skill} onSaved={vi.fn()} existingOverride={{ id: 1, portfolio_skill_id: 7, ai_level: 3, override_level: 4, assessor_notes: "Saved evidence" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit override" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsaved draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit override" }));
    expect(screen.getByRole("textbox")).toHaveValue("Saved evidence");
  });
});
