import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({
    vacanciesApi: { get: vi.fn(), update: vi.fn() },
}));

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/vacancies/4/edit"]}>
            <Routes>
                <Route path="/vacancies/:id/edit" element={<VacancyEditPage />} />
            </Routes>
        </MemoryRouter>
    );
}

const VACANCY = {
    id: 4,
    role_title: "Backend Engineer",
    culture_dimensions: "",
    competency_expectations: "",
    skills: [],
};

describe("VacancyEditPage failure handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reports a load failure and recovers on retry instead of showing an empty form", async () => {
        vi.mocked(vacanciesApi.get).mockRejectedValueOnce(new Error("offline"));
        renderPage();

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("We could not load this vacancy.");
        expect(screen.queryByLabelText(/Role title/)).not.toBeInTheDocument();

        vi.mocked(vacanciesApi.get).mockResolvedValue({ data: { vacancy: VACANCY } } as never);
        fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

        await waitFor(() =>
            expect(screen.getByDisplayValue("Backend Engineer")).toBeInTheDocument()
        );
    });

    it("shows the API message inline when saving fails", async () => {
        vi.mocked(vacanciesApi.get).mockResolvedValue({ data: { vacancy: VACANCY } } as never);
        vi.mocked(vacanciesApi.update).mockRejectedValue({
            response: { status: 422, data: { errors: [{ message: "Time limit is invalid" }] } },
        });
        renderPage();

        await screen.findByDisplayValue("Backend Engineer");
        fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));

        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent("Time limit is invalid")
        );
    });

    it("falls back to a generic save error when the failure carries no API message", async () => {
        vi.mocked(vacanciesApi.get).mockResolvedValue({ data: { vacancy: VACANCY } } as never);
        vi.mocked(vacanciesApi.update).mockRejectedValue(new Error("offline"));
        renderPage();

        await screen.findByDisplayValue("Backend Engineer");
        fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));

        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent("Failed to save vacancy.")
        );
        expect(screen.getByRole("button", { name: /Save Changes/ })).toBeEnabled();
    });

    it("does not call the API when the required role title is cleared", async () => {
        vi.mocked(vacanciesApi.get).mockResolvedValue({ data: { vacancy: VACANCY } } as never);
        renderPage();

        fireEvent.change(await screen.findByDisplayValue("Backend Engineer"), { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));

        await waitFor(() =>
            expect(screen.getByRole("button", { name: /Save Changes/ })).toBeEnabled()
        );
        expect(vacanciesApi.update).not.toHaveBeenCalled();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("hydrates the saved culture notes and skill expectations into the form", async () => {
        vi.mocked(vacanciesApi.get).mockResolvedValue({
            data: {
                vacancy: {
                    ...VACANCY,
                    culture_dimensions: "Async-first, written by default",
                    competency_expectations: "Owns systems end to end",
                    skills: [{ id: 11, skill_label: "Ruby", expected_level: 4 }],
                },
            },
        } as never);
        renderPage();

        expect(await screen.findByDisplayValue("Async-first, written by default")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Owns systems end to end")).toBeInTheDocument();
        expect(screen.getByText("Ruby")).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: "L4" })).toBeChecked();
    });
});
