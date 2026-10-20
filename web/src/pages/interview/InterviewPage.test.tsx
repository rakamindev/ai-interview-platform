import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import type { CandidateInfo, ConsentState, InterviewState } from "@/types";

vi.mock("@/services/sessions", () => ({
    sessionsApi: {
        getCandidateInfo: vi.fn(),
        acceptConsent: vi.fn(),
        declineConsent: vi.fn(),
        audioComplete: vi.fn(),
    },
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
    useAudioWebSocket: vi.fn(),
}));

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

const PENDING: ConsentState = { required: true, accepted: false, declined: false, version: "v1" };
const ACCEPTED: ConsentState = { ...PENDING, accepted: true };

function candidateInfo(overrides: Partial<CandidateInfo> = {}): CandidateInfo {
    return {
        session_id: 2,
        role_title: "Backend Engineer",
        time_limit_min: 45,
        session_status: "pending",
        consent: PENDING,
        ...overrides,
    };
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/interview/tok-123"]}>
            <Routes>
                <Route path="/interview/:token" element={<InterviewPage />} />
            </Routes>
        </MemoryRouter>
    );
}

let socketHandlers: {
    onStateChange: (state: InterviewState) => void;
    onReconnected: () => void;
} | null = null;

beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers = null;
    vi.mocked(useAudioWebSocket).mockImplementation((handlers) => {
        socketHandlers = handlers as {
            onStateChange: (state: InterviewState) => void;
            onReconnected: () => void;
        };
        return {
            connect: vi.fn(),
            send: vi.fn(),
            sendJson: vi.fn(),
            disconnect: vi.fn(),
            connectionState: "disconnected",
        } as never;
    });
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({ data: candidateInfo() } as never);
});

describe("InterviewPage invite failures", () => {
    it("treats a missing invite as invalid, not as a finished interview", async () => {
        vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue({ response: { status: 404 } });

        renderPage();

        expect(
            await screen.findByRole("heading", { name: "This invitation link is not valid" })
        ).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Interview Complete" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "Before you start" })
        ).not.toBeInTheDocument();
        expect(screen.queryByText("OS & browser")).not.toBeInTheDocument();
    });

    it("offers a retry when the invite cannot be loaded, and opens the interview on retry", async () => {
        vi.mocked(sessionsApi.getCandidateInfo)
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValue({ data: candidateInfo({ consent: ACCEPTED }) } as never);

        renderPage();

        expect(
            await screen.findByRole("heading", { name: "We could not load your interview" })
        ).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Interview Complete" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        expect(await screen.findByText("OS & browser")).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "We could not load your interview" })
        ).not.toBeInTheDocument();
    });

    it("shows a finished interview without re-checking consent or hardware", async () => {
        vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
            data: candidateInfo({ session_status: "ended" }),
        } as never);

        renderPage();

        expect(
            await screen.findByRole("heading", { name: "Interview Complete" })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "Before you start" })
        ).not.toBeInTheDocument();
        expect(screen.queryByText("OS & browser")).not.toBeInTheDocument();
    });
});

describe("InterviewPage consent gate", () => {
    it("shows the notice before any hardware check", async () => {
        renderPage();

        expect(await screen.findByRole("heading", { name: "Before you start" })).toBeInTheDocument();
        expect(screen.queryByText("OS & browser")).not.toBeInTheDocument();
        expect(screen.queryByText(/This is a voice interview/)).not.toBeInTheDocument();
    });

    it("opens the interview only after the decision is recorded", async () => {
        vi.mocked(sessionsApi.acceptConsent).mockResolvedValue({
            data: { consent: { ...PENDING, accepted: true } },
        } as never);

        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "I agree and continue" }));

        await waitFor(() => expect(sessionsApi.acceptConsent).toHaveBeenCalledWith("tok-123", "v1"));
        expect(await screen.findByText("OS & browser")).toBeInTheDocument();
    });

    it("stays gated and says so when the decision cannot be recorded", async () => {
        vi.mocked(sessionsApi.acceptConsent).mockRejectedValue(new Error("offline"));

        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "I agree and continue" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("We could not record your consent");
        expect(screen.queryByText("OS & browser")).not.toBeInTheDocument();
    });

    it("blocks a candidate who declines", async () => {
        vi.mocked(sessionsApi.declineConsent).mockResolvedValue({
            data: { consent: { ...PENDING, declined: true } },
        } as never);

        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "I do not agree" }));

        await waitFor(() => expect(sessionsApi.declineConsent).toHaveBeenCalledWith("tok-123", "v1"));
        expect(
            await screen.findByRole("heading", { name: "You cannot continue without consent." })
        ).toBeInTheDocument();
        expect(screen.queryByText("OS & browser")).not.toBeInTheDocument();
    });

    it("keeps a previously declined candidate blocked on reload", async () => {
        vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
            data: candidateInfo({ consent: { ...PENDING, declined: true } }),
        } as never);

        renderPage();

        expect(
            await screen.findByRole("heading", { name: "You cannot continue without consent." })
        ).toBeInTheDocument();
    });

    it("does not gate an already recorded acceptance", async () => {
        vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
            data: candidateInfo({ consent: { ...PENDING, accepted: true } }),
        } as never);

        renderPage();

        expect(await screen.findByText("OS & browser")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Before you start" })).not.toBeInTheDocument();
    });
});

describe("InterviewPage active interview", () => {
    it("names the control that collapses the reconnection notice", async () => {
        vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
            data: candidateInfo({ consent: ACCEPTED }),
        } as never);

        renderPage();
        await screen.findByText("OS & browser");

        act(() => socketHandlers?.onStateChange("active"));

        expect(screen.queryByText(/Reconnected — please say/)).not.toBeInTheDocument();

        act(() => socketHandlers?.onReconnected());

        fireEvent.click(await screen.findByRole("button", { name: "Dismiss reconnection notice" }));

        expect(
            screen.queryByRole("button", { name: "Dismiss reconnection notice" })
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/Reconnected — please say/)).not.toBeInTheDocument();
    });
});
