import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({ assessmentsApi: { get: vi.fn(), update: vi.fn() } }));
vi.mock("@/services/skillTaxonomies", () => ({ skillTaxonomiesApi: { list: vi.fn() } }));

function skills(isCustom: boolean) {
    return ["Contoh Skill A", "Contoh Skill B", "Contoh Skill C"].map((label, index) => ({
        id: index + 1, skill_id: isCustom ? undefined : index + 10, skill_label: label, is_custom: isCustom,
        expected_level: 3, display_order: index,
    }));
}

async function renderPage(isCustom: boolean) {
    vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment: {
        id: 1, name: "Contoh Assessment", time_limit_min: 30, skills: skills(isCustom),
    } } } as never);
    render(
        <MemoryRouter initialEntries={["/assessments/1/edit"]}>
            <Routes><Route path="/assessments/:id/edit" element={<AssessmentEditPage />} /></Routes>
        </MemoryRouter>,
    );
    return screen.findAllByRole("radiogroup");
}

function checked(group: HTMLElement) {
    return within(group).getAllByRole("radio").find((radio) => radio.getAttribute("aria-checked") === "true")?.getAttribute("value");
}

// Same LevelRadio data bug as the vacancy form, for taxonomy and custom skills.
describe("AssessmentEditPage expected levels", () => {
    afterEach(() => vi.clearAllMocks());

    it.each([
        ["taxonomy", false],
        ["custom", true],
    ])("changes only the third %s skill when its L5 label is clicked", async (_kind, isCustom) => {
        const groups = await renderPage(isCustom);
        expect(groups).toHaveLength(3);

        fireEvent.click(within(groups[2]).getByText("L5"));

        expect(groups.map(checked)).toEqual(["3", "3", "5"]);
    });
});
