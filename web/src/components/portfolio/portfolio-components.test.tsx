import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LevelTrack from "./LevelTrack";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import SkillPortfolioCard from "./SkillPortfolioCard";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { notAssessedSkill, override, skill } from "@/test/fixtures";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { saveOverride: vi.fn() } }));

function rungStates(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-state]")).map((el) => el.getAttribute("data-state"));
}

describe("LevelTrack", () => {
  it("fills rungs up to the candidate level and marks the required rung", () => {
    const { container } = render(<LevelTrack level={2} required={4} highlightShortfall />);

    expect(screen.getByRole("img", { name: "Candidate L2, required L4" })).toBeInTheDocument();
    expect(rungStates(container)).toEqual(["filled", "filled", "shortfall", "shortfall", "empty"]);
    expect(container.querySelector('[data-rung="4"] [data-required]')).not.toBeNull();
  });

  it("draws no filled rung when there is no evidence, so it can't read as L1", () => {
    const { container } = render(<LevelTrack level={null} required={3} />);

    expect(screen.getByRole("img", { name: "No evidence, required L3" })).toBeInTheDocument();
    expect(rungStates(container)).toEqual(Array(5).fill("no-evidence"));
  });
});

describe("LevelBadge", () => {
  it("shows 'Not assessed' instead of a level when there is none", () => {
    render(<LevelBadge level={null} />);

    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(screen.queryByText(/^L\d$/)).not.toBeInTheDocument();
  });

  it("shows the level and its description", () => {
    render(<LevelBadge level={3} />);

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Proficient")).toBeInTheDocument();
  });
});

describe("ConfidenceIndicator", () => {
  it("renders nothing for a not-assessed skill", () => {
    const { container } = render(<ConfidenceIndicator confidence={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels low confidence in words", () => {
    render(<ConfidenceIndicator confidence="low" />);
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
  });
});

describe("SkillPortfolioCard", () => {
  it("presents a not-assessed skill as missing evidence with a way to rate it", async () => {
    render(<SkillPortfolioCard skill={notAssessedSkill()} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("No evidence in the interview")).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /rate manually/i }));

    expect(screen.getByText("Rate this skill yourself")).toBeInTheDocument();
    // No level is preselected: the assessor must choose one.
    expect(screen.getByRole("button", { name: "Save rating" })).toBeDisabled();
  });

  it("saves an assessor rating for a not-assessed skill and reports it", async () => {
    const saved = override({ override_level: 2 });
    vi.mocked(portfoliosApi.saveOverride).mockResolvedValueOnce({ data: { override: saved } } as never);
    const onSaved = vi.fn();
    render(<SkillPortfolioCard skill={notAssessedSkill()} onOverrideSaved={onSaved} />);

    await userEvent.click(screen.getByRole("button", { name: /rate manually/i }));
    await userEvent.click(screen.getByLabelText("L2"));
    await userEvent.type(screen.getByLabelText(/reason/i), "Follow-up call");
    await userEvent.click(screen.getByRole("button", { name: "Save rating" }));

    expect(portfoliosApi.saveOverride).toHaveBeenCalledWith(2, { override_level: 2, assessor_notes: "Follow-up call" });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("keeps the form open and explains a failed save", async () => {
    vi.mocked(portfoliosApi.saveOverride).mockRejectedValueOnce(new Error("offline"));
    render(<SkillPortfolioCard skill={skill()} onOverrideSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /adjust rating/i }));
    await userEvent.click(screen.getByRole("button", { name: "Save rating" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the rating");
    expect(screen.getByRole("button", { name: "Save rating" })).toBeEnabled();
  });

  it("flags a low-confidence rating that no assessor has confirmed", () => {
    render(<SkillPortfolioCard skill={skill({ ai_level: 1, effective_level: 1, ai_confidence: "low" })} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText(/weak signal/i)).toBeInTheDocument();
  });

  it("shows who changed the rating and why", () => {
    const rated = notAssessedSkill({ override: override({ override_level: 2 }), effective_level: 2 });
    render(<SkillPortfolioCard skill={rated} onOverrideSaved={vi.fn()} />);

    expect(screen.getByText("Rated L2 by assessor")).toBeInTheDocument();
    expect(screen.getByText(/owns the staging environment/)).toBeInTheDocument();
  });

  it("clamps long summaries behind a toggle", async () => {
    render(<SkillPortfolioCard skill={skill({ competency_summary: "Detail. ".repeat(80) })} onOverrideSaved={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: "Show more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });
});

describe("LevelRadio", () => {
  // Regression: every instance used id="level-N", so a label click selected the first card's radio.
  it("keeps two instances on one page independent", async () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <>
        <div data-testid="first"><LevelRadio value={null} onChange={first} /></div>
        <div data-testid="second"><LevelRadio value={null} onChange={second} /></div>
      </>,
    );

    await userEvent.click(within(screen.getByTestId("second")).getByText("L3"));

    expect(second).toHaveBeenCalledWith(3);
    expect(first).not.toHaveBeenCalled();
  });
});
