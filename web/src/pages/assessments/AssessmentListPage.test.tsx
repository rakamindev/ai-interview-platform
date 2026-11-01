import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

vi.mock("@/services/assessments", () => ({ assessmentsApi: { list: vi.fn() } }));

const assessment = (id: number): Assessment => ({ id, name: `Role ${id}`, time_limit_min: 30 });

function listResponse(items: Assessment[], currentPage: number, totalPages: number) {
  return {
    data: {
      assessments: items,
      meta: { current_page: currentPage, total_pages: totalPages, total_count: 0, per_page: 20 },
    },
  } as Awaited<ReturnType<typeof assessmentsApi.list>>;
}

function renderPage() {
  render(
    <MemoryRouter>
      <AssessmentListPage />
    </MemoryRouter>,
  );
}

describe("AssessmentListPage", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.list).mockReset();
  });

  it("shows only the error, not the empty state, when loading fails", async () => {
    vi.mocked(assessmentsApi.list).mockRejectedValueOnce(new Error("boom"));
    renderPage();

    expect(await screen.findByText("Failed to load assessments.")).toBeInTheDocument();
    expect(screen.queryByText("No assessments yet.")).not.toBeInTheDocument();
  });

  it("loads the next page on request", async () => {
    vi.mocked(assessmentsApi.list)
      .mockResolvedValueOnce(listResponse([assessment(1)], 1, 2))
      .mockResolvedValueOnce(listResponse([assessment(2)], 2, 2));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Role 2")).toBeInTheDocument();
    expect(screen.getByText("Role 1")).toBeInTheDocument();
    expect(assessmentsApi.list).toHaveBeenLastCalledWith(2);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("links each assessment to its invite page and shows the latest session status", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValueOnce(
      listResponse(
        [
          { ...assessment(1), latest_session: { status: "active" } },
          { ...assessment(2), latest_session: { status: "ended", end_reason: "error" } },
        ],
        1,
        1,
      ),
    );
    renderPage();

    const row = (await screen.findByText("Role 1")).closest("a");
    expect(row).toHaveAttribute("href", "/assessments/1/invite");
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
