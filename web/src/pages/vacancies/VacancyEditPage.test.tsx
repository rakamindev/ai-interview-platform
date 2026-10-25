import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import VacancyEditPage from "./VacancyEditPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { get: vi.fn(), update: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/vacancies/1/edit"]}>
      <Routes>
        <Route path="/vacancies/:id/edit" element={<VacancyEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VacancyEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a not-found state instead of a blank form when the vacancy 404s", async () => {
    (vacanciesApi.get as any).mockRejectedValue({ response: { status: 404 } });

    renderPage();

    expect(await screen.findByText("Vacancy not found")).toBeInTheDocument();
    expect(screen.queryByLabelText(/role title/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error message on a non-404 failure", async () => {
    (vacanciesApi.get as any).mockRejectedValue({ response: { status: 500 } });

    renderPage();

    expect(await screen.findByText(/failed to load vacancy/i)).toBeInTheDocument();
  });

  it("renders the form pre-filled when the vacancy loads successfully", async () => {
    (vacanciesApi.get as any).mockResolvedValue({
      data: {
        vacancy: {
          id: 1,
          role_title: "Backend Engineer",
          culture_dimensions: "",
          competency_expectations: "",
          skills: [],
        },
      },
    });

    renderPage();

    expect(await screen.findByDisplayValue("Backend Engineer")).toBeInTheDocument();
  });
});
