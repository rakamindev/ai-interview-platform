import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VacancyNewPage from "@/pages/vacancies/VacancyNewPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { create: vi.fn() },
}));

vi.mock("@/components/assessment/SkillPicker", () => ({
  default: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (skill: { skill_id: string; skill_label: string }) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onSelect({ skill_id: "react", skill_label: "React" })}>
        Select React
      </button>
    ) : null,
}));

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/vacancies/new", element: <VacancyNewPage /> },
      { path: "/vacancies", element: <p>Vacancy list</p> },
    ],
    { initialEntries: ["/vacancies/new"] },
  );
  render(<RouterProvider router={router} />);
}

describe("VacancyNewPage", () => {
  beforeEach(() => {
    vi.mocked(vacanciesApi.create).mockReset();
  });

  it("requires every vacancy input needed for fit/gap analysis", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Role title/), "   ");
    await user.type(screen.getByLabelText(/Company culture/), "   ");
    await user.type(screen.getByLabelText(/Competency expectations/), "   ");
    await user.click(screen.getByRole("button", { name: "Save Vacancy" }));

    expect(await screen.findByText("Role title is required")).toBeInTheDocument();
    expect(screen.getByText("At least one skill is required")).toBeInTheDocument();
    expect(screen.getByText("Company culture is required")).toBeInTheDocument();
    expect(screen.getByText("Competency expectations are required")).toBeInTheDocument();
    expect(vacanciesApi.create).not.toHaveBeenCalled();
  });

  it("trims text fields before creating a complete vacancy", async () => {
    vi.mocked(vacanciesApi.create).mockResolvedValue(
      {} as Awaited<ReturnType<typeof vacanciesApi.create>>,
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Role title/), "  Senior Frontend Engineer  ");
    await user.click(screen.getByRole("button", { name: "Add skill expectation" }));
    await user.click(screen.getByRole("button", { name: "Select React" }));
    await user.type(screen.getByLabelText(/Company culture/), "  Async-first  ");
    await user.type(screen.getByLabelText(/Competency expectations/), "  Leads projects  ");
    await user.click(screen.getByRole("button", { name: "Save Vacancy" }));

    expect(vacanciesApi.create).toHaveBeenCalledWith({
      role_title: "Senior Frontend Engineer",
      culture_dimensions: "Async-first",
      competency_expectations: "Leads projects",
      vacancy_skills_attributes: [
        expect.objectContaining({
          skill_id: "react",
          skill_label: "React",
          expected_level: 3,
        }),
      ],
    });
  });
});
