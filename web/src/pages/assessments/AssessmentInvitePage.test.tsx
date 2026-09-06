import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AssessmentInvitePage from "./AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import { dashboardApi } from "@/services/dashboard";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

vi.mock("@/services/dashboard", () => ({
  dashboardApi: { stats: vi.fn(), assessment: vi.fn() },
}));

const getMock = assessmentsApi.get as unknown as ReturnType<typeof vi.fn>;
const getSessionsMock = assessmentsApi.getSessions as unknown as ReturnType<typeof vi.fn>;
const deleteSessionMock = assessmentsApi.deleteSession as unknown as ReturnType<typeof vi.fn>;
const assessmentStatMock = dashboardApi.assessment as unknown as ReturnType<typeof vi.fn>;

const assessment = {
  id: 1,
  name: "Backend Engineer",
  time_limit_min: 45,
  language: "en",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  skills: [],
};

const sessions = [
  {
    id: 1,
    assessment_id: 1,
    candidate_name: "Budi",
    invite_token: "tok-1",
    invite_url: "http://localhost:3001/interview/tok-1",
    status: "pending",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    assessment_id: 1,
    candidate_name: "Siti",
    invite_token: "tok-2",
    invite_url: "http://localhost:3001/interview/tok-2",
    status: "active",
    started_at: "2026-01-02T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 3,
    assessment_id: 1,
    candidate_name: "Agus",
    invite_token: "tok-3",
    invite_url: "http://localhost:3001/interview/tok-3",
    status: "ended",
    end_reason: "all_covered",
    started_at: "2026-01-01T10:00:00Z",
    ended_at: "2026-01-01T10:30:00Z",
    created_at: "2026-01-01T00:00:00Z",
  },
];

const assessmentStat = {
  assessment_id: 1,
  name: "Backend Engineer",
  time_limit_min: 45,
  started: 3,
  completion_rate: 66.7,
  avg_duration_seconds: 600,
  totals: { pending: 1, active: 1, ended: 1, failed: 1 },
  ended_reasons: [
    { reason: "all_covered", count: 1 },
    { reason: "error", count: 1 },
  ],
  last_started_at: "2026-01-02T00:00:00Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/invite"]}>
      <Routes>
        <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentInvitePage remove candidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { assessment } });
    getSessionsMock.mockResolvedValue({ data: { sessions } });
    deleteSessionMock.mockResolvedValue({ data: { message: "Session deleted" } });
    assessmentStatMock.mockResolvedValue({ data: assessmentStat });
  });

  it("shows a remove button for pending and ended candidates but not live", async () => {
    renderPage();

    expect(await screen.findByText("Budi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Budi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Agus" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Siti" })).not.toBeInTheDocument();
  });

  it("cancelling the confirmation does not delete", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Remove Budi" }));
    expect(await screen.findByText("Remove candidate?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteSessionMock).not.toHaveBeenCalled();
    expect(screen.getByText("Budi")).toBeInTheDocument();
  });

  it("removes the candidate and updates the list", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Remove Budi" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    await screen.findByText("Siti");
    expect(deleteSessionMock).toHaveBeenCalledTimes(1);
    expect(deleteSessionMock).toHaveBeenCalledWith(1, 1);
    expect(screen.queryByText("Budi")).not.toBeInTheDocument();
  });

  it("shows the backend error and keeps the candidate when deletion fails", async () => {
    deleteSessionMock.mockRejectedValue({
      response: {
        data: {
          errors: [{ message: "Session is currently in progress" }],
        },
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Remove Budi" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    expect(
      await screen.findByText("Session is currently in progress")
    ).toBeInTheDocument();
    expect(screen.getByText("Budi")).toBeInTheDocument();
  });
});

describe("AssessmentInvitePage statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { assessment } });
    getSessionsMock.mockResolvedValue({ data: { sessions } });
    assessmentStatMock.mockResolvedValue({ data: assessmentStat });
  });

  it("renders the assessment statistics block with totals and derived metrics", async () => {
    renderPage();

    expect(await screen.findByText("Statistics")).toBeInTheDocument();
    expect(screen.getByText("66.7%")).toBeInTheDocument();
    expect(screen.getByText("10m")).toBeInTheDocument();
    expect(screen.getByText(/Last started/)).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getByText(/All skills covered/)).toBeInTheDocument();
    expect(screen.getByText(/Error/)).toBeInTheDocument();
  });

  it("hides the statistics block when the dashboard request fails", async () => {
    assessmentStatMock.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText("Budi")).toBeInTheDocument();
    expect(screen.queryByText("Statistics")).not.toBeInTheDocument();
  });
});