import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import { sessionsApi } from "@/services/sessions";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import type { CoverageMap } from "@/types";

vi.mock("@/services/sessions", () => ({
    sessionsApi: {
        get: vi.fn(),
        getTranscript: vi.fn(),
        endSession: vi.fn(),
    },
}));

vi.mock("@/hooks/useCoverageWebSocket", () => ({
    useCoverageWebSocket: vi.fn(),
}));

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/assessments/2/sessions/2/monitor"]}>
            <Routes>
                <Route
                    path="/assessments/:id/sessions/:sessionId/monitor"
                    element={<LiveMonitorPage />}
                />
            </Routes>
        </MemoryRouter>
    );
}

const TURNS = [
    { id: 1, turn_number: 1, speaker: "ai", text: "Tell me about your last project." },
    { id: 2, turn_number: 2, speaker: "candidate", text: "I built an ingestion pipeline." },
];

const SESSION = { id: 2, status: "active", assessment: { name: "Backend Screen" } };

const COVERAGE: CoverageMap = {
    skills: [
        {
            id: 11,
            skill_id: "system-design",
            skill_label: "System Design",
            is_discovered: false,
            state: "partial",
            probe_count: 2,
            last_signal: "sharding",
        },
        {
            id: 12,
            skill_id: "testing",
            skill_label: "Testing",
            is_discovered: false,
            state: "not_yet",
            probe_count: 0,
        },
    ],
    discovered: [
        {
            id: 13,
            skill_id: "observability",
            skill_label: "Observability",
            is_discovered: true,
            state: "initiated",
            probe_count: 1,
        },
    ],
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

function mockCoverage(coverageMap: CoverageMap | null) {
    vi.mocked(useCoverageWebSocket).mockReturnValue({
        coverageMap,
        sessionEnded: false,
        sessionEndReason: null,
        isConnected: true,
    } as never);
}

beforeEach(() => {
    vi.resetAllMocks();
    mockCoverage({ skills: [], discovered: [] });
});

describe("LiveMonitorPage failure handling", () => {
    it("reports a load failure and recovers on retry", async () => {
        vi.mocked(sessionsApi.get).mockRejectedValueOnce(new Error("offline"));
        vi.mocked(sessionsApi.getTranscript).mockRejectedValueOnce(new Error("offline"));
        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent("We could not load this session.");

        vi.mocked(sessionsApi.get).mockResolvedValue({
            data: { session: { id: 2, status: "active", assessment: { name: "Backend Screen" } } },
        } as never);
        vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns: TURNS } } as never);

        fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

        expect(await screen.findByText("Live monitor")).toBeInTheDocument();
    });

    it("announces a stalled transcript poll without dropping the turns it already has", async () => {
        vi.useFakeTimers();
        vi.mocked(sessionsApi.get).mockResolvedValue({
            data: { session: { id: 2, status: "active", assessment: { name: "Backend Screen" } } },
        } as never);
        vi.mocked(sessionsApi.getTranscript)
            .mockResolvedValueOnce({ data: { turns: TURNS } } as never)
            .mockRejectedValue(new Error("offline"));

        renderPage();
        await act(async () => {});

        expect(screen.getByRole("log")).toHaveTextContent("I built an ingestion pipeline.");
        expect(screen.queryByText(/Transcript updates are paused/)).not.toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(3100);
        });
        await act(async () => {});

        expect(screen.getByText(/Transcript updates are paused/)).toBeInTheDocument();
        expect(screen.getByRole("log")).toHaveTextContent("I built an ingestion pipeline.");

        vi.useRealTimers();
    });

    it("announces the end-session failure", async () => {
        vi.mocked(sessionsApi.get).mockResolvedValue({
            data: { session: { id: 2, status: "active", assessment: { name: "Backend Screen" } } },
        } as never);
        vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns: TURNS } } as never);
        vi.mocked(sessionsApi.endSession).mockRejectedValue(new Error("offline"));

        renderPage();
        await waitFor(() => expect(screen.getByRole("log")).toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: "End Session" }));
        fireEvent.click(await screen.findByRole("button", { name: "End Session" }));

        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent("Failed to end session")
        );
    });
});

describe("LiveMonitorPage live view", () => {
    it("keeps the loading state until the session and its transcript have both arrived", async () => {
        const session = deferred<never>();
        const transcript = deferred<never>();
        vi.mocked(sessionsApi.get).mockImplementationOnce(() => session.promise);
        vi.mocked(sessionsApi.getTranscript).mockImplementationOnce(() => transcript.promise);

        renderPage();

        // No half-loaded page: neither an empty transcript nor an empty coverage card.
        expect(screen.queryByRole("log")).not.toBeInTheDocument();
        expect(screen.queryByText("Coverage Status")).not.toBeInTheDocument();
        expect(screen.queryByText("No transcript yet.")).not.toBeInTheDocument();

        await act(async () => {
            session.resolve({ data: { session: SESSION } } as never);
            transcript.resolve({ data: { turns: TURNS } } as never);
        });

        expect(screen.getByText("Live monitor")).toBeInTheDocument();
        expect(screen.getByText("Coverage Status")).toBeInTheDocument();
        expect(screen.getByRole("log")).toHaveTextContent("Tell me about your last project.");
    });

    it("appends polled turns to the announced live transcript", async () => {
        vi.useFakeTimers();
        vi.mocked(sessionsApi.get).mockResolvedValue({ data: { session: SESSION } } as never);
        vi.mocked(sessionsApi.getTranscript)
            .mockResolvedValueOnce({ data: { turns: TURNS } } as never)
            .mockResolvedValueOnce({
                data: {
                    turns: [
                        { id: 3, turn_number: 3, speaker: "ai", text: "How did you measure the lag?" },
                    ],
                },
            } as never);

        renderPage();
        await act(async () => {});

        const log = screen.getByRole("log");
        expect(log).toHaveAttribute("aria-live", "polite");
        expect(log).toHaveTextContent("I built an ingestion pipeline.");
        expect(log).not.toHaveTextContent("How did you measure the lag?");

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });
        await act(async () => {});

        expect(sessionsApi.getTranscript).toHaveBeenLastCalledWith(2, 3);
        expect(screen.getByRole("log")).toHaveTextContent("How did you measure the lag?");
        expect(screen.getByRole("log")).toHaveTextContent("I built an ingestion pipeline.");

        vi.useRealTimers();
    });

    it("shows each configured and discovered skill with its coverage state and probes", async () => {
        mockCoverage(COVERAGE);
        vi.mocked(sessionsApi.get).mockResolvedValue({ data: { session: SESSION } } as never);
        vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns: TURNS } } as never);

        renderPage();

        expect(await screen.findByText("System Design")).toBeInTheDocument();
        expect(screen.getByText("Testing")).toBeInTheDocument();
        expect(screen.getByText(/partial/)).toBeInTheDocument();
        expect(screen.getByText("not yet")).toBeInTheDocument();
        expect(screen.getByText(/2 probes/)).toBeInTheDocument();
        expect(screen.queryByText(/0 probes/)).not.toBeInTheDocument();
        expect(screen.getByText('"sharding"')).toBeInTheDocument();

        expect(screen.getByText("Discovered")).toBeInTheDocument();
        expect(screen.getByText("Observability")).toBeInTheDocument();
        expect(screen.getByText(/initiated/)).toBeInTheDocument();
        expect(screen.getByText(/1 probe/)).toBeInTheDocument();

        expect(screen.queryByText("Waiting for interview to begin...")).not.toBeInTheDocument();
    });

    it("says the interview has not begun while there is no coverage and no transcript", async () => {
        vi.mocked(sessionsApi.get).mockResolvedValue({ data: { session: SESSION } } as never);
        vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns: [] } } as never);

        renderPage();

        expect(await screen.findByText("Waiting for interview to begin...")).toBeInTheDocument();
        expect(screen.getByText("No transcript yet.")).toBeInTheDocument();
        expect(screen.getByText("Discovered")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
