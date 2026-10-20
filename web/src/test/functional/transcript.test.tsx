import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { sessionShow } from "../fixtures";

const turns = {
  turns: [
    { id: 1, turn_number: 1, speaker: "ai", text: "Tell me about a hard React bug.", audio_start_ms: null, audio_end_ms: null, created_at: "2026-10-01T09:00:00Z" },
    { id: 2, turn_number: 2, speaker: "candidate", text: "We moved hot data into useRef.\nRenders dropped by half.", audio_start_ms: null, audio_end_ms: null, created_at: "2026-10-01T09:00:30Z" },
  ],
  total: 2,
};

function serveTranscript(body: object = turns, status = 200) {
  server.use(
    http.get(`${API}/sessions/42/transcript`, () => HttpResponse.json(body, { status })),
    http.get(`${API}/sessions/42`, () => HttpResponse.json(sessionShow))
  );
}

const path = "/assessments/7/sessions/42/transcript";

describe("Transcript", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows each turn with who said it, for the named candidate", async () => {
    serveTranscript();
    renderApp(path);

    expect(await screen.findByText("Tell me about a hard React bug.")).toBeInTheDocument();
    expect(screen.getByText("Test Candidate")).toBeInTheDocument();
    expect(screen.getByText("AI Interviewer")).toBeInTheDocument();
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText(/Renders dropped by half/)).toBeInTheDocument();
  });

  it("downloads the transcript as labelled plain text", async () => {
    serveTranscript();
    let blob: Blob | undefined;
    const createObjectURL = vi.fn((b: Blob) => { blob = b; return "blob:transcript"; });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { user } = renderApp(path);

    await user.click(await screen.findByRole("button", { name: /Download .txt/ }));

    expect(click).toHaveBeenCalled();
    expect(await blob?.text()).toBe(
      "[AI]\nTell me about a hard React bug.\n\n[Candidate]\nWe moved hot data into useRef.\nRenders dropped by half."
    );
  });

  it("says when there is no transcript, and offers no download", async () => {
    serveTranscript({ turns: [], total: 0 });
    renderApp(path);

    expect(await screen.findByText("No transcript available for this session.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("says when the transcript can't be loaded", async () => {
    serveTranscript({}, 500);
    renderApp(path);

    expect(await screen.findByText("Failed to load transcript. Please refresh.")).toBeInTheDocument();
  });
});
