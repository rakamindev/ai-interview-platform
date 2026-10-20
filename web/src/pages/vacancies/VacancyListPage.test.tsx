import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({
    vacanciesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

const VACANCIES = [
    { id: 4, role_title: "Backend Engineer", culture_dimensions: "", competency_expectations: "", skills: [] },
    { id: 5, role_title: "Product Designer", culture_dimensions: "", competency_expectations: "", skills: [] },
];

function listResponse(vacancies = VACANCIES) {
    return { data: { vacancies, meta: { current_page: 1, total_pages: 1, total_count: vacancies.length } } } as never;
}

function EditProbe() {
    const { id } = useParams<{ id: string }>();
    return <p>Editing vacancy {id}</p>;
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/vacancies"]}>
            <Routes>
                <Route path="/vacancies" element={<VacancyListPage />} />
                <Route path="/vacancies/new" element={<p>New vacancy form</p>} />
                <Route path="/vacancies/:id/edit" element={<EditProbe />} />
            </Routes>
        </MemoryRouter>
    );
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

describe("VacancyListPage states", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("hides rows while the request is pending, then renders the loaded vacancies", async () => {
        const pending = deferred<never>();
        vi.mocked(vacanciesApi.list).mockReturnValue(pending.promise);

        renderPage();

        expect(screen.getByRole("heading", { name: "Vacancies" })).toBeInTheDocument();
        expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument();
        expect(screen.queryByText("No vacancies yet.")).not.toBeInTheDocument();

        await act(async () => {
            pending.resolve(listResponse());
        });

        expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
        expect(screen.getByText("Product Designer")).toBeInTheDocument();
        expect(screen.queryByText("No vacancies yet.")).not.toBeInTheDocument();
    });

    it("shows the empty state and offers the create form once the list comes back empty", async () => {
        vi.mocked(vacanciesApi.list).mockResolvedValue(listResponse([]));

        renderPage();

        expect(await screen.findByText("No vacancies yet.")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Create your first vacancy/ }));

        expect(await screen.findByRole("heading", { name: "Create vacancy" })).toBeInTheDocument();
    });

    it("reports a load failure instead of showing the empty state", async () => {
        vi.mocked(vacanciesApi.list).mockRejectedValue(new Error("offline"));

        renderPage();

        expect(
            await screen.findByText("Failed to load vacancies. Please refresh the page.")
        ).toBeInTheDocument();
        expect(screen.queryByText("No vacancies yet.")).not.toBeInTheDocument();
    });

    it("opens the edit route for the vacancy the user picks", async () => {
        vi.mocked(vacanciesApi.list).mockResolvedValue(listResponse());
        vi.mocked(vacanciesApi.get).mockResolvedValue({ data: { vacancy: { ...VACANCIES[1], skills: [] } } } as never);

        renderPage();

        await screen.findByText("Product Designer");
        fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
        expect(await screen.findByRole("heading", { name: "Edit vacancy" })).toBeInTheDocument();
    });
});
