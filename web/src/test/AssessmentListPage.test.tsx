import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessmentListPage from "../pages/assessments/AssessmentListPage";
import { assessmentsApi } from "../services/assessments";

vi.mock("../services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("AssessmentListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders assessments and pagination controls when data is returned", async () => {
    const mockData = {
      data: {
        assessments: [
          {
            id: 1,
            name: "Senior Backend Engineer",
            time_limit_min: 45,
            latest_session: { status: "active" },
          },
          {
            id: 2,
            name: "Frontend Architect",
            time_limit_min: 30,
            latest_session: { status: "ended", end_reason: "completed" },
          },
        ],
        meta: {
          current_page: 1,
          total_pages: 3,
          total_count: 6,
          per_page: 2,
        },
      },
    };

    (assessmentsApi.list as any).mockResolvedValue(mockData);

    render(
      <MemoryRouter>
        <AssessmentListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
      expect(screen.getByText("Frontend Architect")).toBeInTheDocument();
      expect(screen.getByText(/Live now/i)).toBeInTheDocument();
      expect(screen.getByText(/Last: completed/i)).toBeInTheDocument();
    });

    // Verify pagination controls
    expect(screen.getByText(/Showing Page 1 of 3 \(6 total\)/i)).toBeInTheDocument();
    const prevButton = screen.getByRole("button", { name: /Previous/i });
    const nextButton = screen.getByRole("button", { name: /Next/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it("handles delete action failure gracefully with error alert (e.g. sessions exist)", async () => {
    const mockData = {
      data: {
        assessments: [
          {
            id: 1,
            name: "Cannot Delete This One",
            time_limit_min: 45,
          },
        ],
        meta: {
          current_page: 1,
          total_pages: 1,
          total_count: 1,
          per_page: 10,
        },
      },
    };

    (assessmentsApi.list as any).mockResolvedValue(mockData);
    (assessmentsApi.delete as any).mockRejectedValue({
      response: {
        status: 422,
        data: { error: "Cannot delete assessment with existing candidate sessions." },
      },
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MemoryRouter>
        <AssessmentListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Cannot Delete This One")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle("Delete Assessment");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot delete assessment with existing candidate sessions\./i)
      ).toBeInTheDocument();
    });
  });
});
