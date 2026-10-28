import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
    assessmentsApi: { get: vi.fn(), getSessions: vi.fn(), createSession: vi.fn() },
}));

function renderPage() {
    render(
        <MemoryRouter initialEntries={["/assessments/1/invite"]}>
            <Routes>
                <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("AssessmentInvitePage", () => {
    beforeEach(() => {
        vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment: {
            id: 1, name: "Contoh Assessment", time_limit_min: 30,
            skills: [
                { id: 1, skill_label: "Contoh Rails", expected_level: 3, is_custom: true, display_order: 0 },
                { id: 2, skill_label: "Contoh API", expected_level: null, is_custom: true, display_order: 1 },
            ],
        } } } as never);
        vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions: [] } } as never);
    });
    afterEach(() => vi.clearAllMocks());

    it("names the back link for screen readers", async () => {
        renderPage();

        expect(await screen.findByRole("link", { name: "Back to assessments" })).toHaveAttribute("href", "/assessments");
    });

    it("shows the expected level only when there is one, never an empty bracket", async () => {
        renderPage();

        const rails = (await screen.findByText("Contoh Rails")).closest("li") as HTMLElement;
        const api = screen.getByText("Contoh API").closest("li") as HTMLElement;
        expect(rails).toHaveTextContent("(expected L3)");
        expect(api).not.toHaveTextContent("expected");
    });
});
