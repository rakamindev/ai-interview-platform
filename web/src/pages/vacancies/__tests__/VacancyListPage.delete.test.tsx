import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import { vacanciesApi } from "@/services/vacancies";
import type { Vacancy } from "@/types";

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

function vacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 1,
    role_title: "Senior Frontend Engineer",
    culture_dimensions: "",
    competency_expectations: "",
    skills: [],
    fit_gap_reports_count: 0,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <VacancyListPage />
    </MemoryRouter>
  );
}

describe("VacancyListPage — delete (F-009)", () => {
  beforeEach(() => {
    vi.mocked(vacanciesApi.delete).mockReset();
  });

  it("shows a plain confirmation for a vacancy with no fit-gap reports", async () => {
    const user = userEvent.setup();
    vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [vacancy()] } } as any);
    vi.mocked(vacanciesApi.delete).mockResolvedValue({} as any);

    renderPage();

    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    expect(screen.queryByText(/fit-gap report/i)).not.toBeInTheDocument();

    const confirmButton = await screen.findByRole("button", { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(vacanciesApi.delete).toHaveBeenCalledWith(1);
    });
  });

  it("warns explicitly, naming the count, when the vacancy has fit-gap reports", async () => {
    const user = userEvent.setup();
    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: { vacancies: [vacancy({ fit_gap_reports_count: 3 })] },
    } as any);

    renderPage();

    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    expect(await screen.findByText(/3 fit-gap report/i)).toBeInTheDocument();
  });
});
