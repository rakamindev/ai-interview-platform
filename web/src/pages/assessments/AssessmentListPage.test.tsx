import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentListPage from "./AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
    bulkArchive: vi.fn(),
    bulkUnarchive: vi.fn(),
    unarchive: vi.fn(),
  },
}));

const mockedAssessmentsApi = vi.mocked(assessmentsApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments"]}>
      <AssessmentListPage />
    </MemoryRouter>
  );
}

describe("AssessmentListPage archive workflow", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockedAssessmentsApi.list.mockResolvedValue({
      data: {
        assessments: [{ id: 42, name: "Frontend Engineer", time_limit_min: 30 }],
      },
    } as never);
    mockedAssessmentsApi.bulkArchive.mockResolvedValue({ data: {} } as never);
    mockedAssessmentsApi.bulkUnarchive.mockResolvedValue({ data: {} } as never);
    mockedAssessmentsApi.unarchive.mockResolvedValue({ data: {} } as never);
  });

  it("keeps checkboxes hidden until selection mode and archives selected assessments", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Frontend Engineer")).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Select Frontend Engineer" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Archive selected" }));

    await waitFor(() => expect(mockedAssessmentsApi.bulkArchive).toHaveBeenCalledWith([42]));
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
  });

  it("selects an assessment when its body is clicked in selection mode", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Select" }));
    await user.click(screen.getByText("Frontend Engineer"));

    expect(screen.getByRole("checkbox", { name: "Select Frontend Engineer" })).toBeChecked();
  });

  it("loads archived assessments and supports unarchiving", async () => {
    const user = userEvent.setup();
    mockedAssessmentsApi.list
      .mockResolvedValueOnce({ data: { assessments: [] } } as never)
      .mockResolvedValueOnce({
        data: { assessments: [{ id: 42, name: "Archived Assessment", time_limit_min: 30 }] },
      } as never);

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Archived" }));

    expect(await screen.findByText("Archived Assessment")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Unarchive" }));

    await waitFor(() => expect(mockedAssessmentsApi.unarchive).toHaveBeenCalledWith(42));
  });

  it("bulk unarchives selected archived assessments", async () => {
    const user = userEvent.setup();
    mockedAssessmentsApi.list.mockResolvedValue({
      data: {
        assessments: [
          { id: 42, name: "Archived Assessment", time_limit_min: 30 },
          { id: 43, name: "Archived Assessment 2", time_limit_min: 45 },
        ],
        meta: { current_page: 1, total_pages: 1, total_count: 2, per_page: 20, active_count: 1, archived_count: 2 },
      },
    } as never);

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Archived" }));
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: "Unarchive selected" }));

    await waitFor(() => expect(mockedAssessmentsApi.bulkUnarchive).toHaveBeenCalledWith([42, 43]));
  });
});
