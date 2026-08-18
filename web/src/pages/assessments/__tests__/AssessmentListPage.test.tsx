import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { list: vi.fn() },
}));

function renderListPage() {
  render(
    <MemoryRouter>
      <AssessmentListPage />
    </MemoryRouter>
  );
}

describe("AssessmentListPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(assessmentsApi.list).mockReset();
  });

  it("shows a loading skeleton while fetching, then renders the assessments", async () => {
    let resolveList!: (value: { data: { assessments: Assessment[] } } ) => void;
    vi.mocked(assessmentsApi.list).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve;
      }) as never
    );

    const { container } = render(
      <MemoryRouter>
        <AssessmentListPage />
      </MemoryRouter>
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    resolveList({
      data: {
        assessments: [
          { id: 1, name: "Senior Frontend Engineer", time_limit_min: 45 },
        ] as Assessment[],
      },
    });

    expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
  });

  it("shows an empty state with a create-first-assessment action when there are none", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValueOnce({
      data: { assessments: [] },
    } as never);

    renderListPage();

    expect(await screen.findByText(/no assessments yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create your first assessment/i })
    ).toBeInTheDocument();
  });

  it("shows an error message when the fetch fails", async () => {
    vi.mocked(assessmentsApi.list).mockRejectedValueOnce(new Error("network error"));

    renderListPage();

    expect(
      await screen.findByText(/failed to load assessments/i)
    ).toBeInTheDocument();
  });

  it("navigates to /assessments/new when the New Assessment button is clicked", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValueOnce({
      data: { assessments: [] },
    } as never);
    const user = userEvent.setup();

    renderListPage();

    await waitFor(() => expect(assessmentsApi.list).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /new assessment/i }));

    expect(navigateMock).toHaveBeenCalledWith("/assessments/new");
  });

  it("navigates to the assessment invite page when a row is clicked", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValueOnce({
      data: {
        assessments: [
          { id: 7, name: "Backend Engineer", time_limit_min: 30 },
        ] as Assessment[],
      },
    } as never);
    const user = userEvent.setup();

    renderListPage();

    const row = await screen.findByText("Backend Engineer");
    await user.click(row);

    expect(navigateMock).toHaveBeenCalledWith("/assessments/7/invite");
  });
});
