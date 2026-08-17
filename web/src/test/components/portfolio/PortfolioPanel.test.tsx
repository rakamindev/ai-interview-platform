import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PortfolioPanel from "@/components/portfolio/PortfolioPanel";
import { portfoliosApi } from "@/services/portfolios";
import type { Portfolio, PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getOverride: vi.fn(),
  },
}));

const getOverrideMock = vi.mocked(portfoliosApi.getOverride);

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "React",
    is_discovered: false,
    ai_level: 4,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "Strong.",
    ...overrides,
  };
}

function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 1,
    session_id: 9,
    generation_status: "complete",
    verdict: "pass",
    skills: [skill()],
    overrides: [],
    ...overrides,
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof PortfolioPanel>> = {}) {
  return render(
    <MemoryRouter>
      <PortfolioPanel
        portfolio={portfolio()}
        overrides={{}}
        transcriptHref="/assessments/1/sessions/9/transcript"
        {...props}
      />
    </MemoryRouter>
  );
}

describe("PortfolioPanel", () => {
  it("renders the zero-skills empty state with the given transcript link", () => {
    renderPanel({ portfolio: portfolio({ verdict: null, skills: [] }) });

    expect(screen.getByText("No skills were assessed")).toBeInTheDocument();
    expect(screen.getByText("View transcript").closest("a")).toHaveAttribute(
      "href",
      "/assessments/1/sessions/9/transcript"
    );
  });

  it("renders the verdict badge and Configured Skills when skills exist", () => {
    renderPanel();

    expect(screen.getByText("Pass")).toBeInTheDocument();
    expect(screen.getByText("Configured Skills")).toBeInTheDocument();
  });

  it("shows the override control by default (not read-only)", () => {
    renderPanel({ onOverrideSaved: vi.fn() });

    expect(screen.getByText("Override rating ▼")).toBeInTheDocument();
  });

  it("hides all override controls when readOnly", () => {
    renderPanel({ readOnly: true, onOverrideSaved: vi.fn() });

    expect(screen.queryByText("Override rating ▼")).not.toBeInTheDocument();
  });

  it("passes the correct skill id through to onOverrideSaved when a save succeeds", async () => {
    getOverrideMock.mockResolvedValue({
      data: { override: { id: 1, portfolio_skill_id: 1, ai_level: 4, override_level: 5, assessor_notes: "" } },
    } as any);
    const onOverrideSaved = vi.fn();

    renderPanel({
      portfolio: portfolio({ skills: [skill({ id: 1 })] }),
      onOverrideSaved,
    });

    fireEvent.click(screen.getByText("Override rating ▼"));
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));

    await waitFor(() => expect(onOverrideSaved).toHaveBeenCalledWith(1, expect.objectContaining({ id: 1 })));
  });
});
