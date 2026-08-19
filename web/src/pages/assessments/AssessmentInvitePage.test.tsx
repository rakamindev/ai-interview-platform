import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRoute } from "@/test/testUtils";
import AssessmentInvitePage from "./AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import type { Session, Assessment } from "@/types";

// STEP 07/08 (EXPLORATION_LOG.md): started_at/ended_at/duration_seconds were
// computed by the backend and sent in the API response, but never rendered
// anywhere in the frontend. This covers the fix: the candidate list row now
// surfaces "Completed HH:mm · Xm Ys" once a session has ended.
vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return { id: 1, name: "QA Engineer Screening", time_limit_min: 45, skills: [], ...overrides };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    assessment_id: 1,
    invite_token: "tok",
    invite_url: "http://localhost:5173/interview/tok",
    status: "pending",
    ...overrides,
  };
}

async function renderInvitePage() {
  renderWithRoute(<AssessmentInvitePage />, {
    path: "/assessments/:id/invite",
    initialEntries: ["/assessments/1/invite"],
  });
}

describe("AssessmentInvitePage — session lifecycle visibility", () => {
  beforeEach(() => {
    vi.mocked(assessmentsApi.get).mockReset();
    vi.mocked(assessmentsApi.getSessions).mockReset();
  });

  it("shows completed time and duration for an ended session", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment: makeAssessment() } } as any);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
      data: {
        sessions: [
          makeSession({
            id: 2,
            candidate_name: "Budi Santoso",
            status: "ended",
            end_reason: "manual_candidate",
            ended_at: "2026-08-18T03:54:00Z",
            duration_seconds: 347,
          }),
        ],
      },
    } as any);

    await renderInvitePage();

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    // Regex requires a digit right after "Completed" to target the timing line
    // specifically — the status badge elsewhere on the row also renders the bare
    // word "Completed" with no timestamp, which would otherwise make this ambiguous.
    expect(screen.getByText(/Completed \d/)).toHaveTextContent(/Completed.*5m 47s/);
  });

  it("shows no completed/duration line while a session is still pending or live", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment: makeAssessment() } } as any);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
      data: {
        sessions: [
          makeSession({ id: 3, candidate_name: "Ani (pending)", status: "pending" }),
          makeSession({ id: 4, candidate_name: "Citra (live)", status: "active", started_at: "2026-08-18T03:00:00Z" }),
        ],
      },
    } as any);

    await renderInvitePage();

    expect(await screen.findByText("Ani (pending)")).toBeInTheDocument();
    expect(screen.getByText("Citra (live)")).toBeInTheDocument();
    expect(screen.queryByText(/Completed/)).not.toBeInTheDocument();
  });

  it("omits the duration segment when duration_seconds is missing, but still shows the completion time", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment: makeAssessment() } } as any);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
      data: {
        sessions: [
          makeSession({
            id: 5,
            candidate_name: "No Duration",
            status: "ended",
            end_reason: "manual_candidate",
            ended_at: "2026-08-18T03:54:00Z",
            duration_seconds: undefined,
          }),
        ],
      },
    } as any);

    await renderInvitePage();

    const completedLine = await screen.findByText(/Completed \d/);
    expect(completedLine).toBeInTheDocument();
    expect(completedLine.textContent).not.toMatch(/·/);
  });
});
