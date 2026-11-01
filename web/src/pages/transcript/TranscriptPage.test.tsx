import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TranscriptPage from "@/pages/transcript/TranscriptPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getTranscript: vi.fn(), get: vi.fn() },
}));

type TranscriptResponse = Awaited<ReturnType<typeof sessionsApi.getTranscript>>;
type SessionResponse = Awaited<ReturnType<typeof sessionsApi.get>>;

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/transcript"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/transcript"
          element={<TranscriptPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TranscriptPage", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getTranscript).mockReset();
    vi.mocked(sessionsApi.get).mockReset();
  });

  it("explains a failed load and recovers on retry", async () => {
    vi.mocked(sessionsApi.getTranscript)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        data: {
          turns: [{ id: 1, turn_number: 1, speaker: "candidate", text: "I led the migration." }],
        },
      } as TranscriptResponse);
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { candidate_name: "Budi" } },
    } as SessionResponse);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Failed to load the transcript.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retry/ }));

    expect(await screen.findByText("I led the migration.")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load the transcript.")).not.toBeInTheDocument();
  });
});
