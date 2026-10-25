import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VacancyListPage from "./VacancyListPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    list: vi.fn(),
    bulkArchive: vi.fn(),
    bulkUnarchive: vi.fn(),
    unarchive: vi.fn(),
  },
}));

const mockedVacanciesApi = vi.mocked(vacanciesApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/vacancies"]}>
      <VacancyListPage />
    </MemoryRouter>
  );
}

describe("VacancyListPage archive workflow", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockedVacanciesApi.list.mockResolvedValue({
      data: { vacancies: [{ id: 7, role_title: "Frontend Engineer" }] },
    } as never);
    mockedVacanciesApi.bulkArchive.mockResolvedValue({ data: {} } as never);
    mockedVacanciesApi.unarchive.mockResolvedValue({ data: {} } as never);
  });

  it("keeps checkboxes hidden until selection mode and archives selected vacancies", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Frontend Engineer")).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Select Frontend Engineer" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Archive selected" }));

    await waitFor(() => expect(mockedVacanciesApi.bulkArchive).toHaveBeenCalledWith([7]));
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
  });

  it("loads archived vacancies and supports unarchiving", async () => {
    const user = userEvent.setup();
    mockedVacanciesApi.list
      .mockResolvedValueOnce({ data: { vacancies: [] } } as never)
      .mockResolvedValueOnce({
        data: { vacancies: [{ id: 7, role_title: "Archived Vacancy" }] },
      } as never);

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Archived" }));

    expect(await screen.findByText("Archived Vacancy")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Unarchive" }));

    await waitFor(() => expect(mockedVacanciesApi.unarchive).toHaveBeenCalledWith(7));
  });

  it("searches and paginates through vacancies", async () => {
    const user = userEvent.setup();
    mockedVacanciesApi.list.mockResolvedValue({
      data: {
        vacancies: [{ id: 7, role_title: "Frontend Engineer" }],
        meta: { current_page: 1, total_pages: 2, total_count: 2, per_page: 1, active_count: 2, archived_count: 0 },
      },
    } as never);

    renderPage();
    const search = await screen.findByRole("textbox", { name: "Search vacancies" });
    await user.type(search, "Frontend");

    await waitFor(() => expect(mockedVacanciesApi.list).toHaveBeenLastCalledWith(1, false, "Frontend"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(mockedVacanciesApi.list).toHaveBeenLastCalledWith(2, false, "Frontend"));
  });
});
