import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TranscriptPage from "../TranscriptPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getTranscript: vi.fn(),
  },
}));

describe("TranscriptPage - Turn Timestamps (TIME-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders timestamps next to speaker bubbles", async () => {
    vi.mocked(sessionsApi.get).mockResolvedValueOnce({
      data: {
        session: {
          id: 50,
          candidate_name: "Jane Doe",
          status: "ended",
        },
      },
    } as any);

    vi.mocked(sessionsApi.getTranscript).mockResolvedValueOnce({
      data: {
        turns: [
          {
            id: 1,
            turn_number: 1,
            speaker: "ai",
            text: "Hello, could you explain your experience with distributed systems?",
            created_at: "2026-10-17T03:30:15Z",
          },
          {
            id: 2,
            turn_number: 2,
            speaker: "candidate",
            text: "Sure, I have worked with distributed event queues and Redis.",
            created_at: "2026-10-17T03:30:45Z",
          },
        ],
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/50/transcript"]}>
        <Routes>
          <Route path="/assessments/:id/sessions/:sessionId/transcript" element={<TranscriptPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.getByText("AI Interviewer")).toBeInTheDocument();
      expect(screen.getByText("Candidate")).toBeInTheDocument();
    });

    const timestamps = screen.getAllByTestId("turn-timestamp");
    expect(timestamps).toHaveLength(2);
    expect(timestamps[0].textContent).toMatch(/30/);
    expect(timestamps[1].textContent).toMatch(/30/);
  });
});
