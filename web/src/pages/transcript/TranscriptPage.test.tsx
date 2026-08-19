import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { act, fireEvent, screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import TranscriptPage from "./TranscriptPage";
import type { TranscriptTurn } from "@/types";

const { sessionsApiMock } = vi.hoisted(() => ({
  sessionsApiMock: {
    get: vi.fn(),
    live: vi.fn(),
    endSession: vi.fn(),
    revoke: vi.fn(),
    getCoverage: vi.fn(),
    getTranscript: vi.fn(),
    getPortfolio: vi.fn(),
    regeneratePortfolio: vi.fn(),
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

vi.mock("@/services/sessions", () => ({ sessionsApi: sessionsApiMock }));

const turns: TranscriptTurn[] = [
  {
    id: 1,
    turn_number: 1,
    speaker: "ai",
    text: "Welcome, tell me about your experience.",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    turn_number: 2,
    speaker: "candidate",
    text: "I led a migration to TypeScript.",
    created_at: "2025-01-01T00:00:05Z",
  },
];

function mockTranscript(
  overrides: { turns?: TranscriptTurn[]; candidate_name?: string | null } = {},
) {
  sessionsApiMock.getTranscript.mockResolvedValue({ data: { turns: overrides.turns ?? turns } });
  sessionsApiMock.get.mockResolvedValue({
    data: { session: { candidate_name: overrides.candidate_name ?? "Siti" } },
  });
}

function renderTranscript(route = "/assessments/9/sessions/42/transcript") {
  renderWithProviders(
    <Routes>
      <Route path="/assessments/:id/sessions/:sessionId/transcript" element={<TranscriptPage />} />
    </Routes>,
    { route },
  );
}

describe("TranscriptPage", () => {
  const readBlob = (blob: Blob) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading skeletons while fetching", () => {
    sessionsApiMock.getTranscript.mockReturnValue(new Promise(() => {}));
    renderTranscript();

    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(6);
  });

  it("renders transcript turns with speaker labels", async () => {
    mockTranscript();
    renderTranscript();

    expect(await screen.findByText("Interview Transcript")).toBeInTheDocument();
    expect(screen.getByText("Siti")).toBeInTheDocument();
    expect(screen.getByText("AI Interviewer")).toBeInTheDocument();
    expect(screen.getByText("Welcome, tell me about your experience.")).toBeInTheDocument();
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText("I led a migration to TypeScript.")).toBeInTheDocument();
    expect(screen.getByText("Turn 2")).toBeInTheDocument();
  });

  it("renders the empty state", async () => {
    mockTranscript({ turns: [] });
    renderTranscript();

    expect(
      await screen.findByText("No transcript available for this session."),
    ).toBeInTheDocument();
  });

  it("shows an error banner when loading fails", async () => {
    sessionsApiMock.getTranscript.mockRejectedValue(new Error("boom"));
    renderTranscript();

    expect(
      await screen.findByText("Failed to load transcript. Please refresh."),
    ).toBeInTheDocument();
  });

  it("filters turns by speaker", async () => {
    mockTranscript();
    renderTranscript();
    await screen.findByText("AI Interviewer");

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Candidate" }));

    expect(screen.queryByText("Welcome, tell me about your experience.")).not.toBeInTheDocument();
    expect(screen.getByText("I led a migration to TypeScript.")).toBeInTheDocument();
  });

  it("searches the transcript and highlights matches", async () => {
    mockTranscript();
    renderTranscript();
    await screen.findByText("AI Interviewer");

    fireEvent.change(screen.getByLabelText("Search transcript"), {
      target: { value: "TypeScript" },
    });

    expect(screen.queryByText("Welcome, tell me about your experience.")).not.toBeInTheDocument();
    const mark = document.querySelector("mark");
    expect(mark).toHaveTextContent("TypeScript");
  });

  it("shows the no-match message when filters exclude everything", async () => {
    mockTranscript();
    renderTranscript();
    await screen.findByText("AI Interviewer");

    fireEvent.change(screen.getByLabelText("Search transcript"), {
      target: { value: "zzz" },
    });

    expect(screen.getByText("No turns match the current filter.")).toBeInTheDocument();
  });

  it("downloads the transcript as JSON", async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:mock";
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockTranscript();
    renderTranscript();
    await screen.findByText("AI Interviewer");

    fireEvent.click(screen.getByRole("button", { name: ".json" }));

    const text = await readBlob(blobs[0]);
    expect(text).toContain("session_id");
    expect(text).toContain("I led a migration to TypeScript.");
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("downloads the transcript as plain text", async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:mock";
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockTranscript();
    renderTranscript();
    await screen.findByText("AI Interviewer");

    fireEvent.click(screen.getByRole("button", { name: ".txt" }));

    const text = await readBlob(blobs[0]);
    expect(text).toMatch(/\[Candidate/);
    expect(text).toContain("I led a migration to TypeScript.");
    clickSpy.mockRestore();
  });

  it("renders audio duration only for turns with valid timing", async () => {
    mockTranscript({
      turns: [
        { ...turns[0], audio_start_ms: 1000, audio_end_ms: 65_000 },
        { ...turns[1], audio_start_ms: 1000, audio_end_ms: 500 },
      ],
    });
    renderTranscript();
    await screen.findByText("AI Interviewer");

    expect(screen.getByText("(1m 4s)")).toBeInTheDocument();
    expect(screen.getAllByText(/\(\d+m \d+s\)/)).toHaveLength(1);
    expect(screen.getAllByText(/Turn \d/)).toHaveLength(2);
  });

  it("scrolls to and highlights the anchored turn, then clears it", async () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    mockTranscript();
    renderTranscript("/assessments/9/sessions/42/transcript?turn=2");
    await screen.findByText("AI Interviewer");

    const row = document.getElementById("turn-2");
    expect(row).toHaveClass("ring-2");
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });
    expect(row).not.toHaveClass("ring-2");
  });

  it("cleans up the highlight timer on unmount", async () => {
    mockTranscript();
    const { unmount } = renderWithProviders(
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/transcript"
          element={<TranscriptPage />}
        />
      </Routes>,
      { route: "/assessments/9/sessions/42/transcript?turn=2" },
    );
    await screen.findByText("AI Interviewer");
    expect(document.getElementById("turn-2")).toHaveClass("ring-2");

    unmount();
  });

  it("ignores a non-numeric turn anchor", async () => {
    mockTranscript();
    renderTranscript("/assessments/9/sessions/42/transcript?turn=abc");
    await screen.findByText("AI Interviewer");

    expect(document.getElementById("turn-1")).toBeInTheDocument();
    expect(document.getElementById("turn-2")).toBeInTheDocument();
    expect(document.getElementById("turn-1")).not.toHaveClass("ring-2");
  });
});
