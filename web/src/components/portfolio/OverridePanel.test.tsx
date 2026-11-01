import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OverridePanel from "@/components/portfolio/OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { getOverride: vi.fn() } }));

const skill = (ai_level: number): PortfolioSkill => ({
  id: 9,
  skill_label: "React",
  is_discovered: false,
  ai_level,
  ai_confidence: "medium",
  evidence: [],
  competency_summary: "",
});

describe("OverridePanel", () => {
  beforeEach(() => {
    vi.mocked(portfoliosApi.getOverride).mockReset();
  });

  it("shows the API's reason when saving fails", async () => {
    const config = { headers: new AxiosHeaders() };
    vi.mocked(portfoliosApi.getOverride).mockRejectedValueOnce(
      new AxiosError("Unprocessable", "ERR_BAD_REQUEST", config, null, {
        status: 422,
        statusText: "",
        headers: {},
        config,
        data: { errors: [{ message: "Override level must be in 1..5" }] },
      }),
    );
    const user = userEvent.setup();
    render(<OverridePanel skill={skill(3)} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Override rating/ }));
    await user.click(screen.getByRole("button", { name: "Save override" }));

    expect(await screen.findByText("Override level must be in 1..5")).toBeInTheDocument();
  });

  it("discards the draft on Cancel", async () => {
    const user = userEvent.setup();
    render(<OverridePanel skill={skill(3)} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Override rating/ }));
    await user.type(screen.getByLabelText(/Notes/), "draft note");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: /Override rating/ }));

    expect(screen.getByLabelText(/Notes/)).toHaveValue("");
  });

  it("requires a level to be chosen when the AI rating is invalid", async () => {
    const user = userEvent.setup();
    render(<OverridePanel skill={skill(0)} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Override rating/ }));

    expect(screen.getByRole("button", { name: "Save override" })).toBeDisabled();
    await user.click(screen.getByText("L2"));
    expect(screen.getByRole("button", { name: "Save override" })).toBeEnabled();
  });

  it("shows the AI level beside a saved override", () => {
    render(
      <OverridePanel
        skill={skill(3)}
        existingOverride={{
          id: 1,
          portfolio_skill_id: 9,
          ai_level: 3,
          override_level: 4,
          assessor_notes: "",
        }}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("L4")).toBeInTheDocument();
    expect(screen.getByText("Overridden by you")).toBeInTheDocument();
  });
});
