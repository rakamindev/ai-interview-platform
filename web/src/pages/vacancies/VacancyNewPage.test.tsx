import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VacancyNewPage from "@/pages/vacancies/VacancyNewPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({
    vacanciesApi: { create: vi.fn() },
}));

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/vacancies/new"]}>
            <Routes>
                <Route path="/vacancies/new" element={<VacancyNewPage />} />
                <Route path="/vacancies" element={<p>Vacancy list</p>} />
            </Routes>
        </MemoryRouter>
    );
}

function submit() {
    fireEvent.click(screen.getByRole("button", { name: /Save Vacancy/ }));
}

describe("VacancyNewPage error handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the API validation message inline and stays on the form", async () => {
        vi.mocked(vacanciesApi.create).mockRejectedValue({
            response: { status: 422, data: { errors: [{ message: "Role title has already been taken" }] } },
        });

        renderPage();
        fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Backend Engineer" } });
        submit();

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Role title has already been taken");
        expect(vacanciesApi.create).toHaveBeenCalledWith(
            expect.objectContaining({ role_title: "Backend Engineer" })
        );
        expect(screen.queryByText("Vacancy list")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Save Vacancy/ })).toBeEnabled();
    });

    it("surfaces a rejected submit as an inline error instead of an unhandled rejection", async () => {
        vi.mocked(vacanciesApi.create).mockRejectedValue(new Error("offline"));

        renderPage();
        fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Backend Engineer" } });
        submit();

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Failed to save vacancy.");
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /Save Vacancy/ })).toBeEnabled()
        );
    });

    it("does not call the API when the required role title is missing", async () => {
        renderPage();
        submit();

        await waitFor(() =>
            expect(screen.getByRole("button", { name: /Save Vacancy/ })).toBeEnabled()
        );
        expect(vacanciesApi.create).not.toHaveBeenCalled();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
