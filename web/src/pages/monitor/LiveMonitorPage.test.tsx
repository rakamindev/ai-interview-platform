import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import { sessionsApi } from "@/services/sessions";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";

vi.mock("@/services/sessions", () => ({ sessionsApi: { get: vi.fn(), getTranscript: vi.fn(), endSession: vi.fn() } }));
vi.mock("@/hooks/useCoverageWebSocket", () => ({ useCoverageWebSocket: vi.fn() }));

async function renderPage(status: string) {
    vi.mocked(useCoverageWebSocket).mockReturnValue({
        coverageMap: null, sessionEnded: false, sessionEndReason: null, isConnected: true,
    });
    vi.mocked(sessionsApi.get).mockResolvedValue({ data: { session: {
        id: 7, status, started_at: "2026-10-25T08:00:00Z", assessment: { name: "Contoh Assessment" },
    } } } as never);
    vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns: [
        { id: 1, turn_number: 1, speaker: "ai", text: "Ceritakan proyek terakhir Anda.", created_at: "2026-10-25T08:00:00Z" },
        { id: 2, turn_number: 2, speaker: "candidate", text: "Jawaban contoh.", created_at: "2026-10-25T08:00:10Z" },
    ] } } as never);
    render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/7/monitor"]}>
            <Routes><Route path="/assessments/:id/sessions/:sessionId/monitor" element={<LiveMonitorPage />} /></Routes>
        </MemoryRouter>,
    );
    await screen.findByText("Jawaban contoh.");
}

// The badge used to follow only the socket, so a finished session still said
// "Live". The assessor reads this transcript, so the candidate is not "You".
describe("LiveMonitorPage status and transcript", () => {
    afterEach(() => vi.clearAllMocks());

    it("says Ended, not Live, for a session that has ended", async () => {
        await renderPage("ended");

        expect(screen.queryByText("Live")).not.toBeInTheDocument();
        expect(screen.getByText("Ended")).toBeInTheDocument();
    });

    it("says Live while the session is active and the socket is connected", async () => {
        await renderPage("active");

        expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("labels candidate turns as Candidate for the assessor", async () => {
        await renderPage("active");

        expect(screen.getByText("Candidate")).toBeInTheDocument();
        expect(screen.queryByText("You")).not.toBeInTheDocument();
    });
});
