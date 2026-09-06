import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import VacancyListPage from "./VacancyListPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: vi.fn(), delete: vi.fn() },
}));

const listMock = vacanciesApi.list as unknown as ReturnType<typeof vi.fn>;
const deleteMock = vacanciesApi.delete as unknown as ReturnType<typeof vi.fn>;

const vacancies = [
  {
    id: 1,
    role_title: "Backend Engineer",
    culture_dimensions: "",
    competency_expectations: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    role_title: "Frontend Engineer",
    culture_dimensions: "",
    competency_expectations: "",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/vacancies"]}>
      <Routes>
        <Route path="/vacancies" element={<VacancyListPage />} />
        <Route path="/vacancies/:id/edit" element={<div>Edit page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VacancyListPage delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({ data: { vacancies } });
    deleteMock.mockResolvedValue({ data: { message: "Vacancy deleted" } });
  });

  it("shows a delete button per vacancy", async () => {
    renderPage();

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Frontend Engineer" })).toBeInTheDocument();
  });

  it("cancelling the confirmation does not delete", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Backend Engineer" }));
    expect(await screen.findByText("Delete vacancy?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
  });

  it("deletes a vacancy and removes it from the list", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Backend Engineer" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await screen.findByText("Frontend Engineer");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument();
  });

  it("shows the backend error and keeps the vacancy when deletion fails", async () => {
    deleteMock.mockRejectedValue({
      response: { data: { errors: [{ message: "Something went wrong" }] } },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Frontend Engineer" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
  });
});