import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import VacancyNewPage from "./VacancyNewPage";

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

function renderNew() {
  renderWithProviders(
    <Routes>
      <Route path="/vacancies" element={<div>LIST PAGE</div>} />
      <Route path="/vacancies/new" element={<VacancyNewPage />} />
    </Routes>,
    { route: "/vacancies/new" },
  );
}

async function addSkillFromTaxonomy() {
  skillTaxonomiesApiMock.list.mockResolvedValue({
    data: {
      skill_taxonomies: [{ skill_id: 1, skill_label: "React", scope_include: "components" }],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: /Add skill expectation/ }));
  fireEvent.click(await screen.findByRole("button", { name: "React" }));
}

describe("VacancyNewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vacanciesApiMock.create.mockResolvedValue({ data: { vacancy: { id: 1 } } });
  });

  it("requires a role title before submitting", async () => {
    renderNew();

    fireEvent.click(screen.getByRole("button", { name: "Save Vacancy" }));
    expect(vacanciesApiMock.create).not.toHaveBeenCalled();
  });

  it("creates a vacancy with selected skills and navigates back", async () => {
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), {
      target: { value: "Frontend Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/Company culture/), {
      target: { value: "async-first" },
    });
    fireEvent.change(screen.getByLabelText(/Competency expectations/), {
      target: { value: "strong communicator" },
    });
    await addSkillFromTaxonomy();

    expect(screen.getByText("React")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Vacancy" }));

    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(vacanciesApiMock.create).toHaveBeenCalledWith({
      role_title: "Frontend Engineer",
      culture_dimensions: "async-first",
      competency_expectations: "strong communicator",
      vacancy_skills_attributes: [
        expect.objectContaining({ skill_label: "React", expected_level: 3 }),
      ],
    });
  });

  it("removes an added skill", async () => {
    renderNew();
    await addSkillFromTaxonomy();
    expect(screen.getByText("React")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(screen.getByText("No skills added yet.")).toBeInTheDocument();
  });

  it("surfaces server-side errors", async () => {
    vacanciesApiMock.create.mockRejectedValue({
      response: { data: { errors: [{ message: "Role already exists" }] } },
    });
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Vacancy" }));

    expect(await screen.findByText("Role already exists")).toBeInTheDocument();
  });

  it("changes the expected level of an added skill", async () => {
    renderNew();
    await addSkillFromTaxonomy();

    fireEvent.click(screen.getByRole("radio", { name: "L4" }));
    fireEvent.change(screen.getByLabelText(/Role title/), {
      target: { value: "Frontend Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Vacancy" }));

    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(vacanciesApiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vacancy_skills_attributes: [
          expect.objectContaining({ skill_label: "React", expected_level: 4 }),
        ],
      }),
    );
  });

  it("cancels back to the vacancy list", async () => {
    renderNew();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(vacanciesApiMock.create).not.toHaveBeenCalled();
  });

  it("falls back to a generic error when the failure has no shape", async () => {
    vacanciesApiMock.create.mockRejectedValue(new Error("boom"));
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Vacancy" }));

    expect(await screen.findByText("Failed to save vacancy.")).toBeInTheDocument();
  });

  it("disables Save and shows a spinner while the request is in flight", async () => {
    let resolveCreate: (v: unknown) => void = () => {};
    vacanciesApiMock.create.mockReturnValue(
      new Promise((res) => {
        resolveCreate = res;
      }),
    );
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Vacancy" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Vacancy" })).toBeDisabled(),
    );
    resolveCreate({ data: { vacancy: { id: 1 } } });
    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
