import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptPage from "@/pages/transcript/TranscriptPage";
import { sessionsApi } from "@/services/sessions";
import { renderWithQueryClient } from "@/test/renderWithQueryClient";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getTranscript: vi.fn(), get: vi.fn() },
}));

const turns = [
  { id: 1, turn_number: 1, speaker: "ai", text: "Question", created_at: "2026-01-01" },
  { id: 2, turn_number: 2, speaker: "candidate", text: "Answer", created_at: "2026-01-01" },
];

function renderPage(entry: string) {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/transcript" element={<TranscriptPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (sessionsApi.getTranscript as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { turns } });
  (sessionsApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: { candidate_name: "Candidate" } } });
  Element.prototype.scrollIntoView = vi.fn();
});

describe("TranscriptPage citation navigation", () => {
  it("focuses and highlights a valid target turn after loading", async () => {
    renderPage("/assessments/1/sessions/2/transcript?turn=2");

    const target = await screen.findByLabelText("Candidate, turn 2");
    await waitFor(() => expect(target).toHaveFocus());
    expect(target).toHaveClass("ring-2");
    expect(target.scrollIntoView).toHaveBeenCalled();
  });

  it("keeps the transcript usable when the target does not exist", async () => {
    renderPage("/assessments/1/sessions/2/transcript?turn=99");

    expect(await screen.findByRole("status")).toHaveTextContent("requested transcript turn is unavailable");
    expect(screen.getByLabelText("Candidate, turn 2")).toHaveTextContent("Answer");
  });
});
