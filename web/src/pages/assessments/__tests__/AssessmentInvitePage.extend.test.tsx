import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import { sessionsApi } from "@/services/sessions";
import type { Assessment, Session } from "@/types";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    extendInvite: vi.fn(),
  },
}));

const assessment: Assessment = {
  id: 1,
  name: "Senior Frontend Engineer",
  time_limit_min: 45,
  skills: [],
} as unknown as Assessment;

function pendingSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 10,
    assessment_id: 1,
    candidate_name: "Budi",
    invite_token: "abc123",
    invite_url: "http://localhost:5173/interview/abc123",
    status: "pending",
    invite_expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    ...overrides,
  } as Session;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions"]}>
      <Routes>
        <Route path="/assessments/:id/sessions" element={<AssessmentInvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentInvitePage — invite extend", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment } } as any);
    vi.mocked(sessionsApi.extendInvite).mockReset();
  });

  it("shows a Resend/Extend button instead of Copy link for an expired pending invite", async () => {
    const expired = pendingSession({ invite_expires_at: new Date(Date.now() - 1000).toISOString() });
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions: [expired] } } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /resend|extend/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy link/i })).not.toBeInTheDocument();
  });

  it("shows Copy link (not Resend/Extend) for a still-valid pending invite", async () => {
    const valid = pendingSession();
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions: [valid] } } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /resend|extend/i })).not.toBeInTheDocument();
  });

  it("does not show Resend/Extend for an active or ended session", async () => {
    const active = pendingSession({ id: 11, status: "active", started_at: new Date().toISOString() });
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions: [active] } } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Live/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /resend|extend/i })).not.toBeInTheDocument();
  });

  it("calls sessionsApi.extendInvite and refreshes the row when Resend/Extend is clicked", async () => {
    const user = userEvent.setup();
    const expired = pendingSession({ invite_expires_at: new Date(Date.now() - 1000).toISOString() });
    const extended = { ...expired, invite_expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString() };

    vi.mocked(assessmentsApi.getSessions).mockResolvedValueOnce({ data: { sessions: [expired] } } as any);
    vi.mocked(sessionsApi.extendInvite).mockResolvedValue({ data: { session: extended } } as any);

    renderPage();

    const button = await screen.findByRole("button", { name: /resend|extend/i });
    await user.click(button);

    await waitFor(() => {
      expect(sessionsApi.extendInvite).toHaveBeenCalledWith(expired.id);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    });
  });
});
