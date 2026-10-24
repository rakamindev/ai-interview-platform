import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AxiosResponse } from "axios";

import InterviewPage from "./InterviewPage";
import { sessionsApi } from "@/services/sessions";
import type { CandidateInfo, InterviewState } from "@/types";

const audioWs = vi.hoisted(() => ({
    connect: vi.fn(),
    latestStateChange: undefined as ((state: InterviewState) => void) | undefined,
}));

vi.mock("@/services/sessions", () => ({
    sessionsApi: { getCandidateInfo: vi.fn() },
}));

// Audio hooks and the hardware check touch AudioContext/MediaDevices/network;
// the candidate-info states under test do not depend on any of them.
vi.mock("@/hooks/useAudioCapture", () => ({
    useAudioCapture: () => ({ start: vi.fn(), stop: vi.fn(), mute: vi.fn(), unmute: vi.fn() }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
    useAudioPlayback: () => ({
        playChunk: vi.fn(),
        stop: vi.fn(),
        scheduleAfterPlayback: vi.fn(),
        waitForDrain: vi.fn(),
        cancelDrain: vi.fn(),
    }),
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
    useAudioWebSocket: (options: { onStateChange: (state: InterviewState) => void }) => {
        audioWs.latestStateChange = options.onStateChange;
        return {
            connect: audioWs.connect,
            send: vi.fn(),
            sendJson: vi.fn(),
            disconnect: vi.fn(),
            connectionState: "disconnected",
        };
    },
}));

vi.mock("@/components/HardwareCheck", () => ({
    default: () => <div data-testid="hardware-check" />,
}));

const getCandidateInfo = vi.mocked(sessionsApi.getCandidateInfo);

const baseInfo: CandidateInfo = {
    session_id: 3,
    role_title: "Frontend Engineer Interview",
    time_limit_min: 45,
    session_status: "pending",
    interview_started: false,
    end_reason: null,
};

function ok(data: Partial<CandidateInfo>): AxiosResponse<CandidateInfo> {
    return { data: { ...baseInfo, ...data } } as AxiosResponse<CandidateInfo>;
}

function renderPage(token = "test-token") {
    return render(
        <MemoryRouter initialEntries={[`/interview/${token}`]}>
            <Routes>
                <Route path="/interview/:token" element={<InterviewPage />} />
            </Routes>
        </MemoryRouter>
    );
}

beforeEach(() => {
    vi.resetAllMocks();
});

afterEach(() => {
    cleanup();
});

describe("InterviewPage candidate info states", () => {
    it("shows a loading state while the invite is being resolved", () => {
        getCandidateInfo.mockReturnValue(new Promise<never>(() => {}));

        renderPage();

        expect(screen.getByText(/loading your interview/i)).toBeInTheDocument();
    });

    it("shows an invalid-link screen on 404 instead of the completion screen", async () => {
        getCandidateInfo.mockRejectedValue({ response: { status: 404 } });

        renderPage();

        expect(await screen.findByText(/this interview link is not valid/i)).toBeInTheDocument();
        expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/has been recorded/i)).not.toBeInTheDocument();
    });

    it("shows a retry screen on network failures and recovers on retry", async () => {
        getCandidateInfo.mockRejectedValueOnce(new Error("Network Error"));

        renderPage();

        const retry = await screen.findByRole("button", { name: /try again/i });
        expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();

        getCandidateInfo.mockResolvedValueOnce(ok({}));
        fireEvent.click(retry);

        expect(await screen.findByText("Frontend Engineer Interview")).toBeInTheDocument();
        expect(screen.getByTestId("hardware-check")).toBeInTheDocument();
        expect(getCandidateInfo).toHaveBeenCalledTimes(2);
    });

    it("keeps the completion screen for a session that ended after the interview ran", async () => {
        getCandidateInfo.mockResolvedValue(
            ok({ session_status: "ended", interview_started: true, end_reason: "all_covered" })
        );

        renderPage();

        expect(await screen.findByText(/interview complete/i)).toBeInTheDocument();
        expect(screen.getByText(/has been recorded/i)).toBeInTheDocument();
    });

    it("does not claim the interview was recorded when it ended with an error", async () => {
        getCandidateInfo.mockResolvedValue(
            ok({ session_status: "ended", interview_started: true, end_reason: "error" })
        );

        renderPage();

        expect(await screen.findByText(/this interview was interrupted/i)).toBeInTheDocument();
        expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/has been recorded/i)).not.toBeInTheDocument();
    });

    it("shows a closed-before-start screen when the session ended before the candidate joined", async () => {
        getCandidateInfo.mockResolvedValue(
            ok({ session_status: "ended", interview_started: false, end_reason: "manual_assessor" })
        );

        renderPage();

        expect(await screen.findByText(/closed before it started/i)).toBeInTheDocument();
        expect(screen.queryByText(/has been recorded/i)).not.toBeInTheDocument();
    });

    it("shows an unavailable screen for sessions in an unsupported state", async () => {
        getCandidateInfo.mockResolvedValue(ok({ session_status: "failed" }));

        renderPage();

        expect(await screen.findByText(/this interview is no longer available/i)).toBeInTheDocument();
        expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
    });

    it("shows a reconnect screen instead of completion when the interview connection is lost", async () => {
        getCandidateInfo.mockResolvedValue(ok({ session_status: "active", interview_started: true }));

        renderPage();
        await screen.findByTestId("hardware-check");

        act(() => audioWs.latestStateChange?.("connection_lost"));

        expect(screen.getByText(/lost the connection/i)).toBeInTheDocument();
        expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/has been recorded/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /reconnect/i }));
        expect(audioWs.connect).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Connecting...")).toBeInTheDocument();
    });
});
