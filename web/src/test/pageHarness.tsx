import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect } from "vitest";
import AssessorLayout from "@/components/layout/AssessorLayout";

// Shared dummy data and helpers for page tests. Services are mocked in each
// test file (vi.mock is hoisted per file).
export const SKILL = { id: 1, skill_label: "Contoh Skill A", is_custom: true, expected_level: 3, display_order: 0 };
export const ASSESSMENT = { id: 1, name: "Contoh Assessment Backend", time_limit_min: 30, language: "id", skills: [SKILL],
                            created_at: "2026-10-25T08:00:00Z", latest_session: { status: "pending" } };
export const VACANCY = { id: 9, role_title: "Contoh Backend Engineer", culture_dimensions: "", competency_expectations: "",
                         created_at: "2026-10-25T08:00:00Z", updated_at: "2026-10-25T08:00:00Z", skills: [SKILL] };
export const SESSION = { id: 2, status: "ended", candidate_name: "Kandidat Contoh A", started_at: "2026-10-25T08:00:00Z",
                         invite_url: "http://localhost/interview/contoh", assessment: { name: ASSESSMENT.name } };
export const TURNS = [{ id: 1, turn_number: 1, speaker: "candidate", text: "Jawaban contoh.", created_at: "2026-10-25T08:00:00Z" }];

export function ok(data: unknown) {
    return { status: 200, data } as never;
}

export function renderAt(path: string, route: string, element: React.ReactElement) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes><Route path={route} element={element} /></Routes>
        </MemoryRouter>,
    );
}

export function renderInLayout(path: string, route: string, element: React.ReactElement) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<AssessorLayout />}>
                    <Route path={route} element={element} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );
}

// The layout's main and nav landmarks, exactly one h1, a named main action
// and, where there is one, a named back link.
export async function expectPageStructure(action: string, back?: string) {
    const main = screen.getByRole("main");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    await waitFor(() => {
        const control = within(main).queryByRole("button", { name: action }) ?? within(main).queryByRole("link", { name: action });
        expect(control).toBeInTheDocument();
    });
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    if (back) expect(within(main).getByRole("link", { name: back })).toBeInTheDocument();
}
