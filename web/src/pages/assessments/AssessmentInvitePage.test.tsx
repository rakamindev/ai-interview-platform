import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "./AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

const mockedAssessmentsApi = vi.mocked(assessmentsApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/42/invite"]}>
      <Routes>
        <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentInvitePage archive workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAssessmentsApi.get.mockResolvedValue({
      data: {
        assessment: {
          id: 42,
          name: "Archived Assessment",
          time_limit_min: 30,
          archived_at: "2026-10-24T12:00:00Z",
          skills: [],
        },
      },
    } as never);
    mockedAssessmentsApi.getSessions.mockResolvedValue({ data: { sessions: [] } } as never);
  });

  it("disables candidate invitations and explains how to restore them", async () => {
    renderPage();

    const inviteButton = await screen.findByRole("button", { name: "Invite Candidate" });
    await waitFor(() => expect(inviteButton).toBeDisabled());
    expect(screen.getByText(/only available for unarchived assessments/i)).toBeVisible();
    expect(mockedAssessmentsApi.createSession).not.toHaveBeenCalled();
  });
});
