import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({ vacanciesApi: { get: vi.fn(), update: vi.fn() } }));

const skills = ["Contoh Skill A", "Contoh Skill B", "Contoh Skill C"].map((label, index) => ({
    id: index + 1, skill_label: label, expected_level: 3,
}));

async function renderPage() {
    vi.mocked(vacanciesApi.get).mockResolvedValue({ data: { vacancy: {
        id: 9, role_title: "Contoh Backend Engineer", culture_dimensions: "", competency_expectations: "", skills,
    } } } as never);
    render(
        <MemoryRouter initialEntries={["/vacancies/9/edit"]}>
            <Routes><Route path="/vacancies/:id/edit" element={<VacancyEditPage />} /></Routes>
        </MemoryRouter>,
    );
    return screen.findAllByRole("radiogroup");
}

function checked(group: HTMLElement) {
    return within(group).getAllByRole("radio").find((radio) => radio.getAttribute("aria-checked") === "true")?.getAttribute("value");
}

// Data bug since the initial import: every LevelRadio used the ids level-1..5,
// so a label in one skill switched the radio of the first skill.
describe("VacancyEditPage expected levels", () => {
    afterEach(() => vi.clearAllMocks());

    it("changes only the third skill when its L5 label is clicked", async () => {
        const groups = await renderPage();
        expect(groups).toHaveLength(3);

        fireEvent.click(within(groups[2]).getByText("L5"));

        expect(groups.map(checked)).toEqual(["3", "3", "5"]);
    });
});
