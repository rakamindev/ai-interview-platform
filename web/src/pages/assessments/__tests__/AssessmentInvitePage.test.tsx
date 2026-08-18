import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment, Session } from "@/types";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

const assessment: Assessment = {
  id: 1,
  name: "Frontend Engineer Assessment",
  time_limit_min: 45,
  skills: [
    { id: 1, skill_label: "React", is_custom: false, expected_level: 3, display_order: 1 },
  ],
};

const pendingSession: Session = {
  id: 10,
  assessment_id: 1,
  candidate_name: "Budi Santoso",
  invite_token: "tok-1",
  invite_url: "https://app.example.com/invite/tok-1",
  status: "pending",
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/invite"]}>
      <Routes>
        <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentInvitePage", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.get).mockReset();
    vi.mocked(assessmentsApi.getSessions).mockReset();
    vi.mocked(assessmentsApi.createSession).mockReset();
  });

  it("shows a loading state before data resolves", () => {
    vi.mocked(assessmentsApi.get).mockReturnValueOnce(new Promise(() => {}) as never);
    vi.mocked(assessmentsApi.getSessions).mockReturnValueOnce(new Promise(() => {}) as never);

    const { container } = render(
      <MemoryRouter initialEntries={["/assessments/1/invite"]}>
        <Routes>
          <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("renders assessment details and the candidate session list on success", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({ data: { assessment } } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValueOnce({
      data: { sessions: [pendingSession] },
    } as never);

    renderPage();

    expect(await screen.findByText("Frontend Engineer Assessment")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("shows an empty state when there are no candidates yet", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({ data: { assessment } } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValueOnce({
      data: { sessions: [] },
    } as never);

    renderPage();

    expect(await screen.findByText(/no candidates yet/i)).toBeInTheDocument();
  });

  it("copies the invite link for a pending session when 'Copy link' is clicked", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({ data: { assessment } } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValueOnce({
      data: { sessions: [pendingSession] },
    } as never);
    const user = userEvent.setup();

    renderPage();

    const writeTextSpy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    await screen.findByText("Budi Santoso");
    await user.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() =>
      expect(writeTextSpy).toHaveBeenCalledWith(pendingSession.invite_url)
    );
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });
});
