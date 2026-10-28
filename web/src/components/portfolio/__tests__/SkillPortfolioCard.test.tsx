import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SkillPortfolioCard from "../SkillPortfolioCard";
import { portfoliosApi } from "@/services/portfolios";
import { renderWithRouter } from "@/test/render";
import { notAssessed, override, skill } from "@/test/fixtures";

const transcriptPath = "/assessments/1/sessions/7/transcript";

function renderCard(props: Partial<Parameters<typeof SkillPortfolioCard>[0]> = {}) {
  const onOverrideSaved = vi.fn();
  renderWithRouter(
    <SkillPortfolioCard skill={skill()} onOverrideSaved={onOverrideSaved} transcriptPath={transcriptPath} {...props} />
  );
  return { onOverrideSaved };
}

describe("SkillPortfolioCard", () => {
  it("shows the level, confidence and verified quotes linked to their transcript turn", () => {
    renderCard();

    expect(screen.getByLabelText("L3 Proficient")).toBeInTheDocument();
    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /found in transcript · turn 4/i })).toHaveAttribute(
      "href",
      `${transcriptPath}#turn-4`
    );
    expect(screen.queryByText(/needs your review/i)).not.toBeInTheDocument();
  });

  it("shows a not-assessed skill without any level and explains it is not a low score", () => {
    renderCard({ skill: notAssessed() });

    expect(screen.getByLabelText("Not assessed")).toBeInTheDocument();
    expect(screen.queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
    expect(screen.getByText("Not reached in the interview")).toBeInTheDocument();
    expect(screen.getByText(/not a low score/)).toBeInTheDocument();
    expect(screen.getByText(/needs your review/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add your rating/i })).toBeInTheDocument();
  });

  it("warns when none of the AI's quotes could be found in the transcript", () => {
    renderCard({ skill: skill({ evidence: [], evidence_refs: [], unverified_evidence_count: 2, ai_confidence: "low" }) });

    expect(screen.getByText(/none of the quotes the ai cited could be found/i)).toBeInTheDocument();
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
  });

  it("says how many unverifiable quotes were removed", () => {
    renderCard({ skill: skill({ unverified_evidence_count: 1 }) });
    expect(screen.getByText(/1 other quote cited by the ai could not be found/i)).toBeInTheDocument();
  });

  it("keeps very long labels and summaries readable", () => {
    const longLabel = "Distributed-systems-observability-and-incident-response ".repeat(4).trim();
    renderCard({ skill: skill({ skill_label: longLabel, competency_summary: "word ".repeat(600) }) });

    expect(screen.getByRole("heading", { name: longLabel })).toHaveClass("break-words");
    expect(screen.getByText(/^(word )+/)).toHaveClass("line-clamp-4");
  });

  it("shows the assessor's rating instead of the AI's once overridden", () => {
    renderCard({ skill: notAssessed(), override: override({ override_level: 4 }) });

    expect(screen.getByLabelText("L4 Advanced")).toBeInTheDocument();
    expect(screen.getByText(/rated l4 by an assessor/i)).toBeInTheDocument();
    expect(screen.getByText(/ai did not rate this skill/i)).toBeInTheDocument();
    expect(screen.queryByText(/needs your review/i)).not.toBeInTheDocument();
  });

  describe("rating a skill the AI could not assess", () => {
    it("requires a note before saving", async () => {
      const user = userEvent.setup();
      const save = vi.spyOn(portfoliosApi, "saveOverride");
      renderCard({ skill: notAssessed() });

      await user.click(screen.getByRole("button", { name: /add your rating/i }));
      const saveButton = screen.getByRole("button", { name: /save rating/i });
      expect(saveButton).toBeDisabled();

      await user.type(screen.getByLabelText(/what is this rating based on/i), "Follow-up call");
      expect(saveButton).toBeEnabled();
      expect(save).not.toHaveBeenCalled();
    });

    it("saves and reports the new override", async () => {
      const user = userEvent.setup();
      const saved = override({ override_level: 2 });
      vi.spyOn(portfoliosApi, "saveOverride").mockResolvedValue({ data: { override: saved } } as never);
      const { onOverrideSaved } = renderCard({ skill: notAssessed() });

      await user.click(screen.getByRole("button", { name: /add your rating/i }));
      await user.click(screen.getByLabelText("L2"));
      await user.type(screen.getByLabelText(/what is this rating based on/i), "  Follow-up call  ");
      await user.click(screen.getByRole("button", { name: /save rating/i }));

      expect(portfoliosApi.saveOverride).toHaveBeenCalledWith(2, { override_level: 2, assessor_notes: "Follow-up call" });
      expect(onOverrideSaved).toHaveBeenCalledWith(saved);
    });

    it("shows the server's error and keeps the form open when saving fails", async () => {
      const user = userEvent.setup();
      vi.spyOn(portfoliosApi, "saveOverride").mockRejectedValue({
        response: { data: { errors: [{ message: "Assessor notes is too long" }] } },
      });
      renderCard({ skill: notAssessed() });

      await user.click(screen.getByRole("button", { name: /add your rating/i }));
      await user.type(screen.getByLabelText(/what is this rating based on/i), "note");
      await user.click(screen.getByRole("button", { name: /save rating/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Assessor notes is too long");
      expect(screen.getByRole("button", { name: /save rating/i })).toBeEnabled();
    });
  });
});
