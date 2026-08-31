import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { vacanciesApi } from "@/services/vacancies";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import MOCK_SKILL_TAXONOMIES from "@/testing/__mocks__/skillTaxonomies.mock";
import VacancyListPage from "../VacancyListPage";
import VacancyNewPage from "../VacancyNewPage";
import MOCK_VACANCY_POST from "../__mocks__/vacancyPost.mock";

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Vacancies Page", () => {
  it("Empty state when there are no vacancies", async () => {
    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: {
        vacancies: [],
        meta: {
          current_page: 1,
          total_pages: 1,
          total_count: 1,
          per_page: 20,
        },
      },
    } as never);

    render(
      <MemoryRouter>
        <VacancyListPage />
      </MemoryRouter>,
    );

    const emptyState = await screen.findByText(/No vacancies yet/i);
    expect(emptyState).toBeDefined();
  });

  it("Crew New Vacancy flow", async () => {
    vi.mocked(vacanciesApi.list).mockResolvedValue({
      data: {
        vacancies: [MOCK_VACANCY_POST],
        meta: {
          current_page: 1,
          total_pages: 1,
          total_count: 1,
          per_page: 20,
        },
      },
    } as never);
    vi.mocked(skillTaxonomiesApi.list).mockResolvedValue({
      data: MOCK_SKILL_TAXONOMIES,
    } as never);

    vi.mocked(vacanciesApi.create).mockResolvedValue({
      data: { vacancy: MOCK_VACANCY_POST },
    } as never);

    render(
      <MemoryRouter initialEntries={["/vacancies"]}>
        <Routes>
          <Route path="/vacancies" element={<VacancyListPage />} />
          <Route path="/vacancies/new" element={<VacancyNewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const btnNewVacancy = await screen.findByRole("button", {
      name: /New Vacancy/i,
    });
    expect(btnNewVacancy).toBeDefined();

    await userEvent.click(btnNewVacancy);

    const inputRoleTitle = await screen.findByLabelText(/Role title/i);
    await userEvent.type(inputRoleTitle, "Master Frontend Engineer");

    const btnAddSkill = screen.getByRole("button", {
      name: /Add skill expectation/i,
    });
    await userEvent.click(btnAddSkill);

    const skillOption = await screen.findByRole("button", {
      name: /React \/ Frontend Development Core/i,
    });
    await userEvent.click(skillOption);

    const addedSkill = await screen.findByText(
      "React / Frontend Development Core",
    );
    expect(addedSkill).toBeDefined();

    expect(screen.getByRole("radio", { name: "L3" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "L5" }));
    expect(screen.getByRole("radio", { name: "L5" })).toBeChecked();

    await userEvent.type(
      screen.getByLabelText(/company culture/i),
      "Result Driven, Blame skidipapap",
    );
    await userEvent.type(
      screen.getByLabelText(/competency expectations/i),
      "Chil",
    );

    await userEvent.click(screen.getByText(/save vacancy/i));

    expect(await screen.findByText(MOCK_VACANCY_POST.role_title)).toBeDefined();
  });

  it.todo("Edit vacancy flow");
});
