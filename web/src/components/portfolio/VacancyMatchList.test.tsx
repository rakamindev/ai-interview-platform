import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VacancyMatchList from "./VacancyMatchList";
import { portfoliosApi } from "@/services/portfolios";
import type { FitGapSummary, VacancyMatch } from "@/types";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { vacancyMatches: vi.fn() } }));
const api = vi.mocked(portfoliosApi);

const summary = (s: Partial<FitGapSummary>): FitGapSummary => ({
  total: 0, assessed: 0, not_assessed: 0, coverage_pct: 0, match: 0, gap: 0, exceed: 0, low_confidence: 0, ...s,
});

// Already ranked by the API, as it serialises them.
const matches: VacancyMatch[] = [
  { vacancy_id: 3, role_title: "Rails Developer", shortfall: 1, summary: summary({ total: 3, assessed: 3, coverage_pct: 100, match: 2, gap: 1 }) },
  { vacancy_id: 7, role_title: "Data Engineer", shortfall: 0, summary: summary({ total: 4, assessed: 1, not_assessed: 3, coverage_pct: 25, match: 1 }) },
  { vacancy_id: 9, role_title: "Draft role", shortfall: 0, summary: summary({}) },
];

function renderList() {
  render(
    <MemoryRouter>
      <VacancyMatchList portfolioId={5} fitGapPath={(v) => `/fitgap/${v}`} />
    </MemoryRouter>,
  );
}

const row = (title: string) => screen.getByText(title).closest("li")!;

describe("VacancyMatchList (F18)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps the API ranking and shows how much of each vacancy was interviewed", async () => {
    api.vacancyMatches.mockResolvedValue({ data: { matches } } as never);
    renderList();

    const items = await screen.findAllByRole("listitem");
    expect(items.map((li) => li.querySelector(".font-medium")?.textContent)).toEqual(["Rails Developer", "Data Engineer", "Draft role"]);
    expect(row("Rails Developer")).toHaveTextContent("3/3 skills interviewed · 2 match · 1 gap");
    expect(within(row("Rails Developer")).getByText("Best covered")).toBeInTheDocument();
  });

  it("warns when a vacancy was barely covered by the interview", async () => {
    api.vacancyMatches.mockResolvedValue({ data: { matches } } as never);
    renderList();

    expect(await screen.findByText("Low coverage")).toBeInTheDocument();
    expect(row("Data Engineer")).toHaveTextContent("1/4 skills interviewed");
    expect(row("Draft role")).toHaveTextContent("No required skills defined yet");
  });

  it("links each vacancy to its fit/gap report", async () => {
    api.vacancyMatches.mockResolvedValue({ data: { matches } } as never);
    renderList();

    expect(await screen.findByRole("link", { name: "View fit/gap for Data Engineer" })).toHaveAttribute("href", "/fitgap/7");
  });

  it("shows an empty state and an error state with retry", async () => {
    api.vacancyMatches.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ data: { matches: [] } } as never);
    renderList();

    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));

    expect(await screen.findByText(/No vacancies yet/)).toBeInTheDocument();
  });
});
