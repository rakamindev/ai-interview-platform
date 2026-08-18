import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import { vacanciesApi } from "@/services/vacancies";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: vi.fn() },
}));

function renderPage() {
  render(
    <MemoryRouter>
      <VacancyListPage />
    </MemoryRouter>
  );
}

describe("VacancyListPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(vacanciesApi.list).mockReset();
  });

  it("shows a loading skeleton, then renders the fetched vacancies", async () => {
    vi.mocked(vacanciesApi.list).mockResolvedValueOnce({
      data: {
        vacancies: [
          { id: 1, role_title: "Senior Backend Engineer", culture_dimensions: "", competency_expectations: "", skills: [] },
          { id: 2, role_title: "Frontend Engineer", culture_dimensions: "", competency_expectations: "", skills: [] },
        ],
        meta: { current_page: 1, total_pages: 1, total_count: 2 },
      },
    } as never);

    renderPage();

    expect(screen.getByText(/vacancies/i)).toBeInTheDocument();

    expect(await screen.findByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
  });

  it("shows an empty state with a create-your-first-vacancy action when there are no vacancies", async () => {
    vi.mocked(vacanciesApi.list).mockResolvedValueOnce({
      data: { vacancies: [], meta: { current_page: 1, total_pages: 1, total_count: 0 } },
    } as never);

    renderPage();

    expect(await screen.findByText(/no vacancies yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create your first vacancy/i })).toBeInTheDocument();
  });

  it("navigates to /vacancies/new when the New Vacancy button is clicked", async () => {
    vi.mocked(vacanciesApi.list).mockResolvedValueOnce({
      data: { vacancies: [], meta: { current_page: 1, total_pages: 1, total_count: 0 } },
    } as never);
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => expect(vacanciesApi.list).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /new vacancy/i }));

    expect(navigateMock).toHaveBeenCalledWith("/vacancies/new");
  });
});
