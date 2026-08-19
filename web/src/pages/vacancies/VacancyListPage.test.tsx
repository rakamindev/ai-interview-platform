import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import VacancyListPage from "./VacancyListPage";
import type { Vacancy } from "@/types";

const { vacanciesApiMock } = vi.hoisted(() => ({
  vacanciesApiMock: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/services/vacancies", () => ({ vacanciesApi: vacanciesApiMock }));

function vacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 1,
    role_title: "Frontend Engineer",
    culture_dimensions: "async-first, ownership-driven",
    competency_expectations: "",
    skills: [{ skill_label: "React", expected_level: 3 }],
    ...overrides,
  } as unknown as Vacancy;
}

function renderList() {
  renderWithProviders(
    <Routes>
      <Route path="/vacancies" element={<VacancyListPage />} />
      <Route path="/vacancies/new" element={<div>NEW PAGE</div>} />
      <Route path="/vacancies/:id/edit" element={<div>EDIT PAGE</div>} />
    </Routes>,
    { route: "/vacancies" },
  );
}

describe("VacancyListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders vacancies with their skills and culture notes", async () => {
    vacanciesApiMock.list.mockResolvedValue({
      data: {
        vacancies: [
          vacancy({ id: 1, role_title: "Frontend Engineer" }),
          vacancy({
            id: 2,
            role_title: "Backend Engineer",
            skills: [{ skill_label: "SQL", expected_level: 4 }],
            culture_dimensions: "no meetings",
          }),
        ],
        meta: {},
      },
    });
    renderList();

    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(screen.getByText("no meetings")).toBeInTheDocument();
  });

  it("filters by role title and by skill", async () => {
    vacanciesApiMock.list.mockResolvedValue({
      data: {
        vacancies: [
          vacancy({ id: 1, role_title: "Frontend Engineer" }),
          vacancy({
            id: 2,
            role_title: "Data Analyst",
            skills: [{ skill_label: "Python", expected_level: 3 }],
          }),
        ],
        meta: {},
      },
    });
    renderList();
    await screen.findByText("Frontend Engineer");

    fireEvent.change(screen.getByLabelText("Search vacancies"), { target: { value: "front" } });
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Data Analyst")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search vacancies"), { target: { value: "python" } });
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
  });

  it("shows the no-match state", async () => {
    vacanciesApiMock.list.mockResolvedValue({ data: { vacancies: [vacancy()], meta: {} } });
    renderList();
    await screen.findByText("Frontend Engineer");

    fireEvent.change(screen.getByLabelText("Search vacancies"), { target: { value: "zzz" } });
    expect(screen.getByText('No vacancies match "zzz".')).toBeInTheDocument();
  });

  it("renders the empty state", async () => {
    vacanciesApiMock.list.mockResolvedValue({ data: { vacancies: [], meta: {} } });
    renderList();

    expect(await screen.findByText("No vacancies yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create your first vacancy/ }));
    expect(screen.getByText("NEW PAGE")).toBeInTheDocument();
  });

  it("shows an error banner on load failure", async () => {
    vacanciesApiMock.list.mockRejectedValue(new Error("boom"));
    renderList();

    expect(
      await screen.findByText("Failed to load vacancies. Please refresh the page."),
    ).toBeInTheDocument();
  });

  it("navigates to the edit page when a vacancy is clicked", async () => {
    vacanciesApiMock.list.mockResolvedValue({
      data: { vacancies: [vacancy({ id: 7 })] },
      meta: {},
    });
    renderList();

    fireEvent.click(await screen.findByText("Frontend Engineer"));
    expect(screen.getByText("EDIT PAGE")).toBeInTheDocument();
  });

  it("renders a vacancy whose skills are absent without crashing", async () => {
    vacanciesApiMock.list.mockResolvedValue({
      data: {
        vacancies: [vacancy({ id: 9, role_title: "Ops Lead", skills: undefined })],
        meta: {},
      },
    });
    renderList();

    expect(await screen.findByText("Ops Lead")).toBeInTheDocument();
    expect(screen.getByText("No skills configured")).toBeInTheDocument();
  });
});
