import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TranscriptPage from "@/pages/transcript/TranscriptPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getTranscript: vi.fn(),
    get: vi.fn(),
  },
}));

const getTranscriptMock = vi.mocked(sessionsApi.getTranscript);
const getMock = vi.mocked(sessionsApi.get);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/9/transcript"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/transcript" element={<TranscriptPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue({ data: { session: { candidate_name: "Alice" } } } as any);
});

describe("TranscriptPage", () => {
  it("shows the generic empty state when there's simply no transcript", async () => {
    getTranscriptMock.mockResolvedValue({ data: { turns: [], total: 0, transcript_capture_failed: false } } as any);

    renderPage();

    expect(await screen.findByText("No transcript available for this session.")).toBeInTheDocument();
  });

  it("shows a distinct failure banner when transcript capture failed, not the generic empty state", async () => {
    getTranscriptMock.mockResolvedValue({ data: { turns: [], total: 0, transcript_capture_failed: true } } as any);

    renderPage();

    expect(await screen.findByText(/Transcript capture failed during this interview/)).toBeInTheDocument();
    expect(screen.queryByText("No transcript available for this session.")).not.toBeInTheDocument();
  });

  it("renders turns normally when transcript capture succeeded", async () => {
    getTranscriptMock.mockResolvedValue({
      data: {
        turns: [{ id: 1, turn_number: 1, speaker: "ai", text: "Hello" }],
        total: 1,
        transcript_capture_failed: false,
      },
    } as any);

    renderPage();

    expect(await screen.findByText("Hello")).toBeInTheDocument();
  });
});
