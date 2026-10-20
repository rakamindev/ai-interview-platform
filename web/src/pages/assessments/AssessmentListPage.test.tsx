import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react-router-dom")>();
    return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("@/services/assessments", () => ({
    assessmentsApi: { list: vi.fn() },
}));

const ASSESSMENTS: Assessment[] = [
    {
        id: 2,
        name: "Backend Engineer Screen",
        time_limit_min: 45,
        language: "en",
        skills: [],
        latest_session: undefined,
    },
    {
        id: 3,
        name: "Data Analyst Screen",
        time_limit_min: 30,
        language: "en",
        skills: [],
        latest_session: undefined,
    },
];

async function renderList() {
    vi.mocked(assessmentsApi.list).mockResolvedValue({ data: { assessments: ASSESSMENTS, meta: { current_page: 1, total_pages: 1, total_count: ASSESSMENTS.length, per_page: 20 } } } as never);
    render(
        <MemoryRouter>
            <Routes>
                <Route path="/" element={<AssessmentListPage />} />
            </Routes>
        </MemoryRouter>
    );
    await screen.findByText("Backend Engineer Screen");
}

describe("AssessmentListPage", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("opens an assessment with Enter", async () => {
        await renderList();

        const card = screen.getByRole("button", { name: "Open Backend Engineer Screen" });
        card.focus();
        fireEvent.keyDown(card, { key: "Enter" });

        expect(navigateSpy).toHaveBeenCalledWith("/assessments/2");
    });

    it("opens an assessment with the space key", async () => {
        await renderList();

        const card = screen.getByRole("button", { name: "Open Data Analyst Screen" });
        fireEvent.keyDown(card, { key: " " });

        expect(navigateSpy).toHaveBeenCalledWith("/assessments/3");
    });

    it("surfaces a load failure as an alert", async () => {
        vi.mocked(assessmentsApi.list).mockRejectedValue(new Error("boom"));
        render(
            <MemoryRouter>
                <Routes>
                    <Route path="/" element={<AssessmentListPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent("Failed to load assessments")
        );
    });
});
