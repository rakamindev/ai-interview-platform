import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptPage from "@/pages/transcript/TranscriptPage";
import { sessionsApi } from "@/services/sessions";
import type { Session, TranscriptTurn } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getTranscript: vi.fn(),
  },
}));

const session: Session = {
  id: 99,
  assessment_id: 1,
  candidate_name: "Budi Santoso",
  invite_token: "tok",
  invite_url: "https://app.example.com/invite/tok",
  status: "ended",
};

const turns: TranscriptTurn[] = [
  { id: 1, turn_number: 1, speaker: "ai", text: "Tell me about yourself.", created_at: "2026-08-01T00:00:00Z" },
  { id: 2, turn_number: 2, speaker: "candidate", text: "I am a frontend engineer.", created_at: "2026-08-01T00:01:00Z" },
];

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/99/transcript"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/transcript"
          element={<TranscriptPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("TranscriptPage", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.get).mockReset();
    vi.mocked(sessionsApi.getTranscript).mockReset();
  });

  it("shows a loading state before data resolves", () => {
    vi.mocked(sessionsApi.get).mockReturnValueOnce(new Promise(() => {}) as never);
    vi.mocked(sessionsApi.getTranscript).mockReturnValueOnce(new Promise(() => {}) as never);

    const { container } = render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/99/transcript"]}>
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/transcript"
            element={<TranscriptPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("renders candidate name and transcript turns on success", async () => {
    vi.mocked(sessionsApi.getTranscript).mockResolvedValueOnce({
      data: { turns, total: turns.length },
    } as never);
    vi.mocked(sessionsApi.get).mockResolvedValueOnce({
      data: { session, assessment: { id: 1, name: "Assessment", time_limit_min: 45 } },
    } as never);

    renderPage();

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Tell me about yourself.")).toBeInTheDocument();
    expect(screen.getByText("I am a frontend engineer.")).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(sessionsApi.getTranscript).mockRejectedValueOnce(new Error("network error"));
    vi.mocked(sessionsApi.get).mockResolvedValueOnce({
      data: { session, assessment: { id: 1, name: "Assessment", time_limit_min: 45 } },
    } as never);

    renderPage();

    expect(await screen.findByText(/failed to load transcript/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no turns", async () => {
    vi.mocked(sessionsApi.getTranscript).mockResolvedValueOnce({
      data: { turns: [], total: 0 },
    } as never);
    vi.mocked(sessionsApi.get).mockResolvedValueOnce({
      data: { session, assessment: { id: 1, name: "Assessment", time_limit_min: 45 } },
    } as never);

    renderPage();

    expect(await screen.findByText(/no transcript available/i)).toBeInTheDocument();
  });

  it("allows downloading the transcript without crashing", async () => {
    vi.mocked(sessionsApi.getTranscript).mockResolvedValueOnce({
      data: { turns, total: turns.length },
    } as never);
    vi.mocked(sessionsApi.get).mockResolvedValueOnce({
      data: { session, assessment: { id: 1, name: "Assessment", time_limit_min: 45 } },
    } as never);
    const user = userEvent.setup();

    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();

    renderPage();

    const downloadButton = await screen.findByRole("button", { name: /download/i });
    await user.click(downloadButton);

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });
});
