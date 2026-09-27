import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

// Mock hardware check and audio hooks to avoid real media/web audio calls in JSDOM
vi.mock("@/components/HardwareCheck", () => ({
    default: ({ onStart }: { onStart?: () => void }) => (
        <div data-testid="hardware-check">
            <span>Hardware Check Ready</span>
            <button onClick={onStart}>Simulate Hardware Pass</button>
        </div>
    ),
}));

vi.mock("@/hooks/useAudioCapture", () => ({
    useAudioCapture: () => ({
        isCapturing: false,
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
        mute: vi.fn(),
        unmute: vi.fn(),
        volume: 0,
        analyserNode: null,
    }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
    useAudioPlayback: () => ({
        playChunk: vi.fn(),
        stopPlayback: vi.fn(),
        scheduleAfterPlayback: vi.fn((cb) => cb()),
        waitForDrain: vi.fn((cb) => cb()),
        cancelDrain: vi.fn(),
        init: vi.fn().mockResolvedValue(undefined),
        isPlaying: false,
        analyserNode: null,
    }),
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
    useAudioWebSocket: () => ({
        connect: vi.fn(),
        send: vi.fn(),
        sendJson: vi.fn(),
        disconnect: vi.fn(),
        connectionState: "disconnected",
    }),
}));

describe("InterviewPage Characterization", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("characterizes GAP P3-5: invalid invite token displays Interview Complete screen instead of error", async () => {
        // When token is invalid, getCandidateInfo rejects with 404
        vi.spyOn(sessionsApi, "getCandidateInfo").mockRejectedValue(new Error("Invalid token"));

        render(
            <MemoryRouter initialEntries={["/interview/invalid-token-123"]}>
                <Routes>
                    <Route path="/interview/:token" element={<InterviewPage />} />
                </Routes>
            </MemoryRouter>
        );

        // Catch block sets interviewState to 'complete'
        await waitFor(() => {
            expect(screen.getByText(/Interview Complete/i)).toBeInTheDocument();
        });
    });

    it("enforces UU PDP affirmative consent gate before hardware check is accessible", async () => {
        vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValue({
            data: {
                session_id: 101,
                session_status: "pending",
                role_title: "Senior Fullstack Engineer",
                time_limit_min: 45,
            },
        } as any);

        render(
            <MemoryRouter initialEntries={["/interview/valid-token-101"]}>
                <Routes>
                    <Route path="/interview/:token" element={<InterviewPage />} />
                </Routes>
            </MemoryRouter>
        );

        // Candidate info renders
        await waitFor(() => {
            expect(screen.getByText("Senior Fullstack Engineer")).toBeInTheDocument();
        });

        // PreFlightConsentModal is displayed, Hardware check is NOT accessible yet
        expect(screen.getByTestId("pre-flight-consent-modal")).toBeInTheDocument();
        expect(screen.queryByTestId("hardware-check")).not.toBeInTheDocument();

        // Agreeing to UU PDP consent opens HardwareCheck
        const checkbox = screen.getByRole("checkbox");
        fireEvent.click(checkbox);
        const confirmBtn = screen.getByRole("button", { name: /Saya Menyetujui|Setuju/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(screen.getByTestId("hardware-check")).toBeInTheDocument();
        });
    });

    it("displays recruiter contact exit screen if candidate declines UU PDP consent", async () => {
        vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValue({
            data: {
                session_id: 103,
                session_status: "pending",
                role_title: "Senior Fullstack Engineer",
                time_limit_min: 45,
            },
        } as any);

        render(
            <MemoryRouter initialEntries={["/interview/valid-token-103"]}>
                <Routes>
                    <Route path="/interview/:token" element={<InterviewPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId("pre-flight-consent-modal")).toBeInTheDocument();
        });

        const declineBtn = screen.getByRole("button", { name: /Tolak|Decline/i });
        fireEvent.click(declineBtn);

        await waitFor(() => {
            expect(screen.getByText(/recruiter|perekrut/i)).toBeInTheDocument();
            expect(screen.queryByTestId("hardware-check")).not.toBeInTheDocument();
        });
    });

    it("displays Interview Complete directly when session status is already ended", async () => {
        vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValue({
            data: {
                session_id: 102,
                session_status: "ended",
                role_title: "Senior Fullstack Engineer",
                time_limit_min: 45,
            },
        } as any);

        render(
            <MemoryRouter initialEntries={["/interview/already-ended-token"]}>
                <Routes>
                    <Route path="/interview/:token" element={<InterviewPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Interview Complete/i)).toBeInTheDocument();
        });
    });

    it("transitions from consent to hardware check and initiates interview on user gesture", async () => {
        vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValue({
            data: {
                session_id: 104,
                session_status: "pending",
                role_title: "Staff Engineer",
                time_limit_min: 30,
            },
        } as any);

        render(
            <MemoryRouter initialEntries={["/interview/valid-token-104"]}>
                <Routes>
                    <Route path="/interview/:token" element={<InterviewPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId("pre-flight-consent-modal")).toBeInTheDocument();
        });

        // Affirmative opt-in
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: /Saya Menyetujui|Setuju/i }));

        await waitFor(() => {
            expect(screen.getByTestId("hardware-check")).toBeInTheDocument();
        });

        // Trigger hardware check onStart (candidate click gesture)
        fireEvent.click(screen.getByText("Simulate Hardware Pass"));

        // Transitions to connecting/active interview
        await waitFor(() => {
            expect(screen.getByText("Connecting...")).toBeInTheDocument();
        });
    });
});
