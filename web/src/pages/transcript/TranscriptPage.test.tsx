import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TranscriptPage from "@/pages/transcript/TranscriptPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
    sessionsApi: { get: vi.fn(), getTranscript: vi.fn() },
}));

const TURNS = [
    { id: 1, turn_number: 1, speaker: "ai", text: "Walk me through a hard bug you fixed." },
    { id: 2, turn_number: 2, speaker: "candidate", text: "I traced a race condition in the queue." },
];

const SESSION = { data: { session: { id: 5, candidate_name: "Ada Lovelace" } } } as never;

const createObjectURL = vi.fn(() => "blob:transcript-session");
const revokeObjectURL = vi.fn();

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/assessments/2/sessions/5/transcript"]}>
            <Routes>
                <Route path="/assessments/:id/sessions/:sessionId/transcript" element={<TranscriptPage />} />
            </Routes>
        </MemoryRouter>
    );
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

describe("TranscriptPage states", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        Object.assign(URL, { createObjectURL, revokeObjectURL });
    });

    it("holds the skeleton state until both requests settle, then renders the turns", async () => {
        const transcript = deferred<unknown>();
        const session = deferred<unknown>();
        vi.mocked(sessionsApi.getTranscript).mockReturnValue(transcript.promise as never);
        vi.mocked(sessionsApi.get).mockReturnValue(session.promise as never);

        renderPage();

        expect(screen.getByRole("heading", { name: "Interview Transcript" })).toBeInTheDocument();
        expect(screen.queryByText("Walk me through a hard bug you fixed.")).not.toBeInTheDocument();
        expect(screen.queryByText("No transcript available for this session.")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Download .txt/ })).not.toBeInTheDocument();

        await act(async () => {
            transcript.resolve({ data: { turns: TURNS } });
            session.resolve(SESSION);
        });

        expect(await screen.findByText("AI Interviewer")).toBeInTheDocument();
        expect(screen.getByText("Candidate")).toBeInTheDocument();
        expect(screen.getByText("Walk me through a hard bug you fixed.")).toBeInTheDocument();
        expect(screen.queryByText("No transcript available for this session.")).not.toBeInTheDocument();
    });

    it("reports a load failure when the transcript cannot be fetched", async () => {
        vi.mocked(sessionsApi.getTranscript).mockRejectedValue(new Error("offline"));
        vi.mocked(sessionsApi.get).mockResolvedValue(SESSION as never);

        renderPage();

        expect(await screen.findByText("Failed to load transcript. Please refresh.")).toBeInTheDocument();
        expect(screen.queryByText("No transcript available for this session.")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Download .txt/ })).not.toBeInTheDocument();
    });

    it("states that no transcript exists instead of offering a download", async () => {
        vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns: [] } } as never);
        vi.mocked(sessionsApi.get).mockResolvedValue(SESSION as never);

        renderPage();

        expect(await screen.findByText("No transcript available for this session.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Download .txt/ })).not.toBeInTheDocument();
    });

    it("downloads the turns as a labelled text file and releases the object URL", async () => {
        const clicked: { href: string; download: string }[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            clicked.push({ href: this.href, download: this.download });
        });
        vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns: TURNS } } as never);
        vi.mocked(sessionsApi.get).mockResolvedValue(SESSION as never);

        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: /Download .txt/ }));

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        const blob = (createObjectURL.mock.calls as unknown as Array<[Blob]>)[0][0];
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe("text/plain");
        expect(blob.size).toBeGreaterThan(0);
        expect(clicked).toEqual([{ href: "blob:transcript-session", download: "transcript-session-5.txt" }]);
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:transcript-session");
    });
});
