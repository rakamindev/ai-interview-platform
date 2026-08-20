import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AssessmentListPage from "./AssessmentListPage";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { list: mocks.list },
}));

describe("AssessmentListPage", () => {
  it("renders recruiter-facing candidate status summaries", async () => {
    mocks.list.mockResolvedValue({
      data: {
        assessments: [{
          id: 1,
          name: "Backend Engineer",
          time_limit_min: 30,
          session_summary: { total: 8, awaiting: 2, in_progress: 1, completed: 4, failed: 1 },
        }],
        meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 20 },
      },
    });

    render(<MemoryRouter><AssessmentListPage /></MemoryRouter>);

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Total").parentElement).toHaveTextContent("8");
    expect(screen.getByText("Awaiting").parentElement).toHaveTextContent("2");
    expect(screen.getByText("In progress").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Completed").parentElement).toHaveTextContent("4");
    expect(screen.getByText("Failed").parentElement).toHaveTextContent("1");
  });
});
