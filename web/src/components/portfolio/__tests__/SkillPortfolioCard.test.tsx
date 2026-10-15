import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SkillPortfolioCard from "../SkillPortfolioCard";
import { notAssessedSkill, ratedSkill } from "@/test/fixtures";
import { portfoliosApi } from "@/services/portfolios";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: {} }));

const api = portfoliosApi as { saveOverride: (...args: unknown[]) => Promise<unknown> };

function renderCard(props: Partial<Parameters<typeof SkillPortfolioCard>[0]> = {}) {
  const onOverrideSaved = vi.fn();
  render(
    <MemoryRouter>
      <SkillPortfolioCard
        skill={ratedSkill()}
        transcriptPath="/assessments/1/sessions/9/transcript"
        onOverrideSaved={onOverrideSaved}
        {...props}
      />
    </MemoryRouter>
  );
  return { onOverrideSaved };
}

describe("SkillPortfolioCard", () => {
  beforeEach(() => {
    api.saveOverride = vi.fn();
  });

  it("links each quote to the transcript turn it came from", () => {
    renderCard();

    expect(screen.getByText("I split the context into read and write providers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Turn 4" })).toHaveAttribute(
      "href",
      "/assessments/1/sessions/9/transcript#turn-4"
    );
  });

  it("explains confidence in terms of how much the skill was probed", () => {
    renderCard();

    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getByText("· 4 questions, fully covered")).toBeInTheDocument();
  });

  describe("a skill the interview never reached", () => {
    it("shows no level, says it is not counted, and offers no override", () => {
      renderCard({ skill: notAssessedSkill() });

      expect(screen.queryByText("L1")).not.toBeInTheDocument();
      expect(screen.getByText("Not assessed")).toBeInTheDocument();
      expect(screen.getByText(/not counted for or against/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /override/i })).not.toBeInTheDocument();
    });
  });

  describe("overriding a rating", () => {
    it("requires a reason before saving", async () => {
      const user = userEvent.setup();
      renderCard();

      await user.click(screen.getByRole("button", { name: "Override rating" }));
      const save = screen.getByRole("button", { name: "Save override" });
      expect(save).toBeDisabled();

      await user.type(screen.getByLabelText(/Reason for the change/), "   ");
      expect(save).toBeDisabled();
    });

    it("saves the level and reason, then shows the change", async () => {
      const user = userEvent.setup();
      const saved = {
        id: 5, portfolio_skill_id: 1, ai_level: 3, override_level: 4, assessor_notes: "Strong follow-up call",
      };
      vi.mocked(api.saveOverride).mockResolvedValue({ data: { override: saved } });
      const { onOverrideSaved } = renderCard();

      await user.click(screen.getByRole("button", { name: "Override rating" }));
      await user.click(screen.getByLabelText("L4"));
      await user.type(screen.getByLabelText(/Reason for the change/), "Strong follow-up call");
      await user.click(screen.getByRole("button", { name: "Save override" }));

      expect(api.saveOverride).toHaveBeenCalledWith(1, {
        override_level: 4,
        assessor_notes: "Strong follow-up call",
      });
      expect(onOverrideSaved).toHaveBeenCalledWith(saved);
    });

    it("shows the server's reason when saving fails", async () => {
      const user = userEvent.setup();
      const serverError = Object.assign(new Error("Request failed with status code 422"), {
        response: { status: 422, data: { errors: [{ message: "Assessor notes can't be blank" }] } },
      });
      vi.mocked(portfoliosApi.saveOverride).mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(serverError), 0)));
      renderCard();

      await user.click(screen.getByRole("button", { name: "Override rating" }));
      await user.type(screen.getByLabelText(/Reason for the change/), "x");
      await user.click(screen.getByRole("button", { name: "Save override" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Assessor notes can't be blank");
    });
  });

  it("collapses long summaries", async () => {
    const user = userEvent.setup();
    renderCard({ skill: ratedSkill({ competency_summary: "word ".repeat(200) }) });

    const toggle = screen.getByRole("button", { name: "Show more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });
});
