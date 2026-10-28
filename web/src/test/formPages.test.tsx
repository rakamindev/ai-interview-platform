import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentNewPage from "@/pages/assessments/AssessmentNewPage";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import VacancyNewPage from "@/pages/vacancies/VacancyNewPage";
import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { networkError } from "@/test/portfolioFixtures";
import { ASSESSMENT, VACANCY, expectPageStructure, ok, renderAt, renderInLayout } from "@/test/pageHarness";

vi.mock("@/services/assessments", () => ({ assessmentsApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock("@/services/skillTaxonomies", () => ({ skillTaxonomiesApi: { list: vi.fn() } }));

beforeEach(() => {
    vi.mocked(assessmentsApi.get).mockResolvedValue(ok({ assessment: ASSESSMENT }));
    vi.mocked(vacanciesApi.get).mockResolvedValue(ok({ vacancy: VACANCY }));
});
afterEach(() => vi.resetAllMocks());

describe.each([
    { path: "/assessments/new", route: "/assessments/new", element: <AssessmentNewPage />, action: "Save & Create Session", back: "Back to assessments" },
    { path: "/assessments/1/edit", route: "/assessments/:id/edit", element: <AssessmentEditPage />, action: "Save Changes", back: "Back to assessments" },
    { path: "/vacancies/new", route: "/vacancies/new", element: <VacancyNewPage />, action: "Save Vacancy", back: "Back to vacancies" },
    { path: "/vacancies/9/edit", route: "/vacancies/:id/edit", element: <VacancyEditPage />, action: "Save Changes", back: "Back to vacancies" },
])("page structure of $path", ({ path, route, element, action, back }) => {
    it("has main and nav landmarks, one h1, a named main action and a named back link", async () => {
        renderInLayout(path, route, element);
        await expectPageStructure(action, back);
    });
});

describe("required fields", () => {
    it("shows an inline error on an empty vacancy role title and does not save", async () => {
        renderAt("/vacancies/new", "/vacancies/new", <VacancyNewPage />);

        fireEvent.click(screen.getByRole("button", { name: "Save Vacancy" }));

        expect(await screen.findByText("Role title is required")).toBeInTheDocument();
        expect(screen.getByLabelText(/Role title/)).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByLabelText(/Role title/)).toHaveAccessibleDescription("Role title is required");
        expect(vacanciesApi.create).not.toHaveBeenCalled();
    });

    it("shows an inline error on an empty assessment role title and does not save", async () => {
        vi.mocked(assessmentsApi.get).mockResolvedValue(ok({ assessment: { ...ASSESSMENT, name: "" } }));
        renderAt("/assessments/1/edit", "/assessments/:id/edit", <AssessmentEditPage />);

        fireEvent.click(await screen.findByRole("button", { name: "Save Changes" }));

        expect(await screen.findByText("Role title is required")).toBeInTheDocument();
        expect(screen.getByLabelText(/Role title/)).toHaveAttribute("aria-invalid", "true");
        expect(assessmentsApi.update).not.toHaveBeenCalled();
    });
});

describe("named form controls", () => {
    it("names each remove button and level group after its skill", async () => {
        renderAt("/vacancies/9/edit", "/vacancies/:id/edit", <VacancyEditPage />);

        expect(await screen.findByRole("button", { name: "Remove Contoh Skill A" })).toBeInTheDocument();
        expect(screen.getByRole("radiogroup", { name: "Expected level for Contoh Skill A" })).toBeInTheDocument();
    });

    it("names the time limit and language selects by their labels", () => {
        renderAt("/assessments/new", "/assessments/new", <AssessmentNewPage />);

        expect(screen.getByRole("combobox", { name: /Session time limit/ })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Interview language" })).toBeInTheDocument();
    });

    it("moves focus to the heading after a successful retry", async () => {
        vi.mocked(assessmentsApi.get).mockRejectedValueOnce(networkError).mockResolvedValueOnce(ok({ assessment: ASSESSMENT }));
        renderAt("/assessments/1/edit", "/assessments/:id/edit", <AssessmentEditPage />);

        fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Try again" }));

        await screen.findByLabelText(/Role title/);
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Edit Assessment" }));
    });
});
