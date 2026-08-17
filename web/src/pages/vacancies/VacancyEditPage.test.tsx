import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import VacancyEditPage from "./VacancyEditPage";

const { vacanciesApiMock, skillTaxonomiesApiMock } = vi.hoisted(() => ({
  vacanciesApiMock: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  skillTaxonomiesApiMock: { list: vi.fn() },
}));

vi.mock("@/services/vacancies", () => ({ vacanciesApi: vacanciesApiMock }));
vi.mock("@/services/skillTaxonomies", () => ({ skillTaxonomiesApi: skillTaxonomiesApiMock }));

const loadedVacancy = {
  id: 3,
  role_title: "Backend Engineer",
  culture_dimensions: "ownership-driven",
  competency_expectations: "designs APIs",
  skills: [{ skill_id: 2, skill_label: "SQL", expected_level: 4 }],
};

function renderEdit() {
  renderWithProviders(
    <Routes>
      <Route path="/vacancies" element={<div>LIST PAGE</div>} />
      <Route path="/vacancies/:id/edit" element={<VacancyEditPage />} />
    </Routes>,
    { route: "/vacancies/3/edit" },
  );
}

describe("VacancyEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vacanciesApiMock.get.mockResolvedValue({ data: { vacancy: loadedVacancy } });
    vacanciesApiMock.update.mockResolvedValue({ data: { vacancy: loadedVacancy } });
  });

  it("renders loading skeletons while fetching", () => {
    vacanciesApiMock.get.mockReturnValue(new Promise(() => {}));
    renderEdit();

    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(2);
  });

  it("loads the vacancy into the form", async () => {
    renderEdit();

    expect(await screen.findByDisplayValue("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(vacanciesApiMock.get).toHaveBeenCalledWith(3);
  });

  it("saves changes and navigates back to the list", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(vacanciesApiMock.update).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        role_title: "Backend Engineer",
        culture_dimensions: "ownership-driven",
        competency_expectations: "designs APIs",
        vacancy_skills_attributes: [expect.objectContaining({ skill_label: "SQL" })],
      }),
    );
  });

  it("adds a skill from the taxonomy picker", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    skillTaxonomiesApiMock.list.mockResolvedValue({
      data: { skill_taxonomies: [{ skill_id: 9, skill_label: "Go", scope_include: "" }] },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add skill/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Go" }));

    expect(screen.getByText("Go")).toBeInTheDocument();
  });

  it("removes an existing skill", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(screen.queryByText("SQL")).not.toBeInTheDocument();
  });

  it("changes the expected level of an existing skill", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("radio", { name: "L5" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(vacanciesApiMock.update).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        vacancy_skills_attributes: [
          expect.objectContaining({ skill_label: "SQL", expected_level: 5 }),
        ],
      }),
    );
  });

  it("cancels back to the vacancy list", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(vacanciesApiMock.update).not.toHaveBeenCalled();
  });

  it("defaults the level radio to L3 when a loaded skill has no expected level", async () => {
    vacanciesApiMock.get.mockResolvedValue({
      data: { vacancy: { ...loadedVacancy, skills: [{ skill_id: 2, skill_label: "SQL" }] } },
    });
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    expect(screen.getByRole("radio", { name: "L3" })).toBeChecked();
  });

  it("disables Save and shows a spinner while the update is in flight", async () => {
    let resolveUpdate: (v: unknown) => void = () => {};
    vacanciesApiMock.update.mockReturnValue(
      new Promise((res) => {
        resolveUpdate = res;
      }),
    );
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled(),
    );
    resolveUpdate({ data: { vacancy: loadedVacancy } });
    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("loads a vacancy that has no skills without crashing", async () => {
    vacanciesApiMock.get.mockResolvedValue({
      data: { vacancy: { ...loadedVacancy, skills: undefined } },
    });
    renderEdit();

    expect(await screen.findByDisplayValue("Backend Engineer")).toBeInTheDocument();
    expect(screen.queryByText("SQL")).not.toBeInTheDocument();
  });
});
