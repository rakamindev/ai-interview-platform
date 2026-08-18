import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRoute } from "@/test/testUtils";
import TranscriptPage from "./TranscriptPage";
import { sessionsApi } from "@/services/sessions";
import type { Session } from "@/types";

// AI generation failure transparency, transcript half (STEP 08): the empty state
// used to say "No transcript available" regardless of *why* — even though
// session.status (pending/active/ended) was already fetched in the same response.
// Splitting the message by status lets an assessor tell "hasn't started yet" apart
// from "ended with no transcript" (a real data-loss signal), and the latter is
// styled differently on purpose.
vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getTranscript: vi.fn(),
  },
}));

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 2,
    assessment_id: 1,
    invite_token: "tok",
    invite_url: "http://localhost:5173/interview/tok",
    status: "pending",
    ...overrides,
  };
}

function mockApis(status: Session["status"], turns: unknown[] = []) {
  vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns, total: turns.length } } as any);
  vi.mocked(sessionsApi.get).mockResolvedValue({
    data: { session: { ...makeSession({ status }), candidate_name: "Budi Santoso" } },
  } as any);
}

async function renderTranscriptPage() {
  return renderWithRoute(<TranscriptPage />, {
    path: "/assessments/:id/sessions/:sessionId/transcript",
    initialEntries: ["/assessments/1/sessions/2/transcript"],
  });
}

describe("TranscriptPage — status-aware empty states", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.get).mockReset();
    vi.mocked(sessionsApi.getTranscript).mockReset();
  });

  it("tells the assessor the candidate hasn't started yet when the session is pending", async () => {
    mockApis("pending");

    await renderTranscriptPage();

    const message = await screen.findByText("Candidate hasn't started the interview yet.");
    expect(message).not.toHaveClass("text-destructive");
  });

  it("tells the assessor the interview is still in progress when the session is active", async () => {
    mockApis("active");

    await renderTranscriptPage();

    const message = await screen.findByText(
      "Interview is still in progress — the transcript will be available once it ends."
    );
    expect(message).not.toHaveClass("text-destructive");
  });

  it("flags a genuine data-loss dead end, styled distinctly, when the session ended with no transcript", async () => {
    mockApis("ended");

    await renderTranscriptPage();

    const message = await screen.findByText(
      "Interview ended but no transcript was captured. This may indicate a recording issue — check the session logs."
    );
    expect(message).toHaveClass("text-destructive");
  });

  it("renders the transcript turns instead of an empty state when turns exist", async () => {
    mockApis("ended", [
      { id: 1, turn_number: 1, speaker: "ai", text: "Tell me about your last project.", created_at: "2026-08-18T03:00:00Z" },
    ]);

    await renderTranscriptPage();

    expect(await screen.findByText("Tell me about your last project.")).toBeInTheDocument();
    expect(screen.queryByText(/no transcript was captured/)).not.toBeInTheDocument();
  });
});
