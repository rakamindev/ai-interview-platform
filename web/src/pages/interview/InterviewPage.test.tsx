import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

vi.mock("@/services/sessions", () => ({ sessionsApi: { getCandidateInfo: vi.fn(), audioComplete: vi.fn() } }));
vi.mock("@/hooks/useAudioWebSocket", () => ({ useAudioWebSocket: vi.fn() }));
vi.mock("@/hooks/useAudioCapture", () => ({
    useAudioCapture: () => ({ start: vi.fn(), stop: vi.fn(), mute: vi.fn(), unmute: vi.fn(), isCapturing: false }),
}));
vi.mock("@/hooks/useAudioPlayback", () => ({
    useAudioPlayback: () => ({ playChunk: vi.fn(), stop: vi.fn(), scheduleAfterPlayback: vi.fn(), waitForDrain: vi.fn(), cancelDrain: vi.fn() }),
}));

type SocketOptions = { onStateChange: (state: string) => void; onReconnected: () => void };
let socket: SocketOptions;

beforeEach(() => {
    vi.mocked(useAudioWebSocket).mockImplementation((options) => {
        socket = options as unknown as SocketOptions;
        return { connect: vi.fn(), send: vi.fn(), sendJson: vi.fn(), disconnect: vi.fn(), connectionState: "connected" } as never;
    });
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({ data: {
        session_id: 7, role_title: "Contoh Assessment", time_limit_min: 30, session_status: "active",
    } } as never);
});

// The candidate could dismiss the "Reconnected" message only with a button a
// screen reader announced as "✕".
describe("InterviewPage reconnected message", () => {
    it("has a named dismiss button that closes the message", async () => {
        render(
            <MemoryRouter initialEntries={["/interview/contoh-token"]}>
                <Routes><Route path="/interview/:token" element={<InterviewPage />} /></Routes>
            </MemoryRouter>,
        );
        await screen.findByText("Contoh Assessment");

        act(() => socket.onStateChange("active"));
        act(() => socket.onReconnected());

        fireEvent.click(screen.getByRole("button", { name: "Dismiss reconnected message" }));
        expect(screen.queryByText(/Reconnected/)).not.toBeInTheDocument();
    });
});
