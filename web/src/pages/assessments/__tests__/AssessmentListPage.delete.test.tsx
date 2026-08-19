import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 1,
    name: "Senior Frontend Engineer",
    time_limit_min: 45,
    has_sessions: false,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AssessmentListPage />
    </MemoryRouter>
  );
}

describe("AssessmentListPage — delete (F-009)", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.delete).mockReset();
  });

  it("shows a delete button that is disabled when the assessment has sessions", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValue({
      data: { assessments: [assessment({ has_sessions: true })] },
    } as any);

    renderPage();

    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  it("confirms and calls delete for an assessment with no sessions", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.list).mockResolvedValue({
      data: { assessments: [assessment({ has_sessions: false })] },
    } as any);
    vi.mocked(assessmentsApi.delete).mockResolvedValue({} as any);

    renderPage();

    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    expect(deleteButton).not.toBeDisabled();
    await user.click(deleteButton);

    const confirmButton = await screen.findByRole("button", { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(assessmentsApi.delete).toHaveBeenCalledWith(1);
    });
  });

  it("clicking a disabled delete button does not navigate to the assessment's detail page (regression: disabled buttons never fire onClick, so a click falls through to the card underneath)", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.list).mockResolvedValue({
      data: { assessments: [assessment({ has_sessions: true })] },
    } as any);

    render(
      <MemoryRouter initialEntries={["/assessments"]}>
        <Routes>
          <Route path="/assessments" element={<AssessmentListPage />} />
          <Route path="/assessments/:id/invite" element={<div>assessment-detail-stub</div>} />
        </Routes>
      </MemoryRouter>
    );

    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    expect(deleteButton).toBeDisabled();

    await user.click(deleteButton);

    expect(screen.queryByText("assessment-detail-stub")).not.toBeInTheDocument();
    expect(screen.getByText("Senior Frontend Engineer")).toBeInTheDocument();
  });
});
