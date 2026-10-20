import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentListPage from "../AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
  },
}));

describe("AssessmentListPage - Pagination UI (PAGE-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pagination controls when total_pages > 1 and navigates to page 2", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValueOnce({
      data: {
        assessments: [
          { id: 1, name: "Assessment 1", time_limit_min: 45 },
          { id: 2, name: "Assessment 2", time_limit_min: 45 },
        ],
        meta: {
          current_page: 1,
          total_pages: 3,
          total_count: 45,
          per_page: 20,
        },
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/assessments"]}>
        <Routes>
          <Route path="/assessments" element={<AssessmentListPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Assessment 1")).toBeInTheDocument();
    });

    const page2Button = screen.getByRole("button", { name: /Page 2/i });
    expect(page2Button).toBeInTheDocument();

    vi.mocked(assessmentsApi.list).mockResolvedValueOnce({
      data: {
        assessments: [
          { id: 21, name: "Assessment 21", time_limit_min: 45 },
        ],
        meta: {
          current_page: 2,
          total_pages: 3,
          total_count: 45,
          per_page: 20,
        },
      },
    } as any);

    fireEvent.click(page2Button);

    await waitFor(() => {
      expect(assessmentsApi.list).toHaveBeenCalledWith(2);
    });
  });
});
