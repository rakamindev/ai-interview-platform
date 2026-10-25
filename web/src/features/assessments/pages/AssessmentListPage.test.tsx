import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AssessmentListPage from "./AssessmentListPage";
import { assessmentsApi } from "../services/assessments";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("../services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
  },
}));

describe("AssessmentListPage Component", () => {
  it("renders list of assessments", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValueOnce({
      data: {
        assessments: [
          {
            id: 1,
            name: "Senior Backend Engineer — Demo",
            time_limit_min: 45,
            skills: [],
            latest_session: {
              id: 1,
              candidate_name: "Budi Santoso",
              status: "ended",
            },
          },
        ],
      },
    } as any);

    renderWithProviders(<AssessmentListPage />);

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer — Demo")).toBeInTheDocument();
      expect(screen.getByText(/45 min/i)).toBeInTheDocument();
    });
  });

  it("renders empty state when no assessments exist", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValueOnce({
      data: {
        assessments: [],
      },
    } as any);

    renderWithProviders(<AssessmentListPage />);

    await waitFor(() => {
      expect(screen.getByText(/No assessments yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Create your first assessment/i)).toBeInTheDocument();
    });
  });
});
