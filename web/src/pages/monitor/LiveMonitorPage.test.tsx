import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import { sessionsApi } from "@/services/sessions";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { copyText } from "@/utils/clipboard";
import type { TranscriptTurn } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getTranscript: vi.fn(),
    endSession: vi.fn(),
    resetAccess: vi.fn(),
  },
}));
vi.mock("@/hooks/useCoverageWebSocket", () => ({ useCoverageWebSocket: vi.fn() }));
vi.mock("@/utils/clipboard", () => ({ copyText: vi.fn() }));

function socketState(overrides: Partial<ReturnType<typeof useCoverageWebSocket>> = {}) {
  return {
    coverageMap: null,
    sessionEnded: false,
    sessionEndReason: null,
    isConnected: true,
    connectionFailed: false,
    reconnect: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/7/sessions/3/monitor"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/monitor" element={<LiveMonitorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LiveMonitorPage", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.get).mockReset();
    vi.mocked(sessionsApi.getTranscript).mockResolvedValue({
      data: { turns: [] as TranscriptTurn[], total: 0 },
    } as Awaited<ReturnType<typeof sessionsApi.getTranscript>>);
  });

  it("shows a retryable error when the session cannot be loaded", async () => {
    vi.mocked(useCoverageWebSocket).mockReturnValue(socketState());
    vi.mocked(sessionsApi.get).mockRejectedValueOnce(new Error("boom"));
    renderPage();

    expect(await screen.findByText("Failed to load the session.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End Session" })).not.toBeInTheDocument();
  });

  it("offers a manual reconnect once live updates are lost", async () => {
    vi.mocked(useCoverageWebSocket).mockReturnValue(
      socketState({ isConnected: false, connectionFailed: true }),
    );
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { status: "active", started_at: new Date().toISOString() } },
    } as Awaited<ReturnType<typeof sessionsApi.get>>);
    renderPage();

    expect(await screen.findByText("Live updates disconnected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(screen.queryByText("Reconnecting...")).not.toBeInTheDocument();
  });

  it("labels candidate turns as the candidate, not as the assessor", async () => {
    vi.mocked(useCoverageWebSocket).mockReturnValue(socketState());
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { status: "active", started_at: new Date().toISOString() } },
    } as Awaited<ReturnType<typeof sessionsApi.get>>);
    vi.mocked(sessionsApi.getTranscript).mockResolvedValue({
      data: {
        turns: [{ id: 1, turn_number: 1, speaker: "candidate", text: "I profiled the list." }],
        total: 1,
      },
    } as Awaited<ReturnType<typeof sessionsApi.getTranscript>>);
    renderPage();

    await screen.findByText("I profiled the list.");
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  describe("copying the invite link", () => {
    const inviteUrl = `${window.location.origin}/interview/tok`;

    function mockSession(status: string) {
      vi.mocked(useCoverageWebSocket).mockReturnValue(socketState());
      vi.mocked(copyText).mockReset();
      vi.mocked(sessionsApi.get).mockResolvedValue({
        data: { session: { status, started_at: new Date().toISOString(), invite_token: "tok" } },
      } as Awaited<ReturnType<typeof sessionsApi.get>>);
    }

    it("copies the link and confirms it", async () => {
      mockSession("active");
      vi.mocked(copyText).mockResolvedValue(true);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: /Copy invite link/ }));

      expect(copyText).toHaveBeenCalledWith(inviteUrl);
      expect(await screen.findByRole("button", { name: /Copied/ })).toBeInTheDocument();
    });

    it("shows the link to copy by hand when the clipboard fails", async () => {
      mockSession("active");
      vi.mocked(copyText).mockResolvedValue(false);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: /Copy invite link/ }));

      expect(await screen.findByText(/Couldn't copy the link/)).toBeInTheDocument();
      expect(screen.getByText(inviteUrl)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Copied/ })).not.toBeInTheDocument();
    });

    it("does not offer the link once the session has ended", async () => {
      mockSession("ended");
      renderPage();

      expect(await screen.findByRole("button", { name: /View portfolio/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Copy invite link/ })).not.toBeInTheDocument();
    });
  });

  describe("resetting candidate access", () => {
    beforeEach(() => {
      vi.mocked(useCoverageWebSocket).mockReturnValue(socketState());
      vi.mocked(sessionsApi.resetAccess).mockReset();
      vi.mocked(sessionsApi.get).mockResolvedValue({
        data: { session: { status: "active", started_at: new Date().toISOString() } },
      } as Awaited<ReturnType<typeof sessionsApi.get>>);
    });

    async function confirmReset(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole("button", { name: /Reset candidate access/ }));
      await user.click(await screen.findByRole("button", { name: "Reset access" }));
    }

    const resetSucceeded = {
      data: { reset: true },
    } as Awaited<ReturnType<typeof sessionsApi.resetAccess>>;

    it("resets access after confirmation and tells the assessor what happens next", async () => {
      vi.mocked(sessionsApi.resetAccess).mockResolvedValue(resetSucceeded);
      renderPage();
      await confirmReset(userEvent.setup());

      expect(sessionsApi.resetAccess).toHaveBeenCalledWith(
        3,
        expect.stringMatching(/^[0-9a-f]{32}$/),
      );
      expect(await screen.findByText(/Candidate access reset/)).toBeInTheDocument();
      expect(screen.getByText(/in a different browser or device/)).toBeInTheDocument();
    });

    it("explains the consequences before resetting", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: /Reset candidate access/ }));

      expect(await screen.findByText(/disconnected within a few seconds/)).toBeInTheDocument();
      expect(screen.getByText(/does not add time/)).toBeInTheDocument();
      expect(sessionsApi.resetAccess).not.toHaveBeenCalled();
    });

    it("reuses the reset id when retrying a failed attempt", async () => {
      vi.mocked(sessionsApi.resetAccess)
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(resetSucceeded);
      const user = userEvent.setup();
      renderPage();

      await confirmReset(user);
      expect(await screen.findByText(/Failed to reset candidate access/)).toBeInTheDocument();
      await confirmReset(user);

      await screen.findByText(/Candidate access reset/);
      const [firstCall, secondCall] = vi.mocked(sessionsApi.resetAccess).mock.calls;
      expect(secondCall[1]).toBe(firstCall[1]);
      expect(screen.queryByText(/Failed to reset candidate access/)).not.toBeInTheDocument();
    });

    it("uses a new reset id for a new reset after a success", async () => {
      vi.mocked(sessionsApi.resetAccess).mockResolvedValue(resetSucceeded);
      const user = userEvent.setup();
      renderPage();

      await confirmReset(user);
      await screen.findByText(/Candidate access reset/);
      await confirmReset(user);

      const [firstCall, secondCall] = vi.mocked(sessionsApi.resetAccess).mock.calls;
      expect(secondCall[1]).not.toBe(firstCall[1]);
    });

    it("does not offer the reset once the session has ended", async () => {
      vi.mocked(sessionsApi.get).mockResolvedValue({
        data: { session: { status: "ended" } },
      } as Awaited<ReturnType<typeof sessionsApi.get>>);
      renderPage();

      expect(await screen.findByRole("button", { name: /View portfolio/ })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Reset candidate access/ }),
      ).not.toBeInTheDocument();
    });
  });
});
