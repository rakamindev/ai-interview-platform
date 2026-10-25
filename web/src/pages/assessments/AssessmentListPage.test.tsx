// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AssessmentListPage from "./AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
  },
}));

const list = vi.mocked(assessmentsApi.list);

function renderPage() {
  return render(
    <MemoryRouter>
      <AssessmentListPage />
    </MemoryRouter>
  );
}

describe("AssessmentListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows operational counts and recent assessments from the API", async () => {
    list.mockResolvedValue({
      data: {
        assessments: [
          { id: 1, name: "Frontend", time_limit_min: 45, latest_session: { status: "active" } },
          { id: 2, name: "Backend", time_limit_min: 30, latest_session: { status: "ended", end_reason: "error" } },
          { id: 3, name: "Product", time_limit_min: 30, latest_session: { status: "ended", end_reason: "completed" } },
        ],
        meta: { current_page: 1, total_pages: 1, total_count: 3, per_page: 20 },
      },
    } as never);

    renderPage();

    expect(await screen.findByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Total assessments").parentElement?.parentElement).toHaveTextContent("3");
    expect(screen.getByText("Live sessions").parentElement?.parentElement).toHaveTextContent("1");
    expect(screen.getByText("Completed").parentElement?.parentElement).toHaveTextContent("1");
    expect(screen.getByText("Needs attention").parentElement?.parentElement).toHaveTextContent("1");
    expect(screen.getByText("Last: failed")).toBeInTheDocument();
  });

  it("shows an empty state when the API returns no assessments", async () => {
    list.mockResolvedValue({ data: { assessments: [], meta: {} } } as never);

    renderPage();

    expect(await screen.findByText("No assessments yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create your first assessment/i })).toBeInTheDocument();
  });

  it("shows a recoverable error when the API request fails", async () => {
    list.mockRejectedValue(new Error("network failure"));

    renderPage();

    await waitFor(() => expect(screen.getByText("Failed to load assessments. Please refresh the page.")).toBeInTheDocument());
  });
});
