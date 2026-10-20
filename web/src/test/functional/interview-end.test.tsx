import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { candidateInfo, notFound } from "../fixtures";
import { type Client, installDevices, openInvite, pressStart, send } from "../interview";
import { testInternetSpeed } from "@/utils/internetSpeedTest";

// How the candidate page ends: the server ends the interview, the connection breaks for good, or the page can't
// load the interview at all. The devices and the audio socket are faked in ../interview.

// The connection check is faked: it measures third-party hosts, which isn't what's under test here.
vi.mock("@/utils/internetSpeedTest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/internetSpeedTest")>()),
  testInternetSpeed: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(testInternetSpeed).mockResolvedValue({
    download: 56, upload: 8, ping: 32, passed: true, downloadTests: [], uploadTests: [], pingTests: [],
  });
  installDevices();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(testInternetSpeed).mockReset();
});

/** Opens the invite link, passes the hardware check, starts, and returns the interview's microphone track. */
async function startInterview(onConnect: (client: Client) => void) {
  openInvite({}, onConnect);
  return pressStart();
}

describe("The end of the candidate's interview", { timeout: 20000 }, () => {
  it("turns the microphone off when the server ends the interview", async () => {
    const mic = await startInterview((client) => {
      send(client, { type: "session_started" });
      setTimeout(() => send(client, { type: "session_ended" }), 200);
    });

    expect(await screen.findByRole("heading", { name: "Interview Complete" })).toBeInTheDocument();
    expect(mic.readyState).toBe("ended");
  });

  it("says the interview was interrupted, not complete, after an error it can't recover from", async () => {
    const mic = await startInterview((client) => {
      send(client, { type: "session_started" });
      setTimeout(() => send(client, { type: "error", code: "no_system_prompt", recoverable: false }), 200);
    });

    expect(await screen.findByRole("heading", { name: "The interview was interrupted" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Interview Complete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejoin the interview" })).toBeInTheDocument();
    expect(mic.readyState).toBe("ended");
  });

  it("says a link that doesn't exist doesn't work, instead of thanking the candidate", async () => {
    server.use(
      http.get(`${API}/sessions/tok-wrong/candidate`, () =>
        HttpResponse.json(notFound("Invalid or expired invite token"), { status: 404 })
      )
    );
    renderApp("/interview/tok-wrong", { token: null });

    expect(await screen.findByRole("heading", { name: "This interview link doesn't work" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Interview Complete" })).not.toBeInTheDocument();
  });

  it("offers Try again when the interview can't be loaded, and recovers", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/sessions/tok-test-123/candidate`, () => {
        calls += 1;
        return calls === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(candidateInfo);
      })
    );
    renderApp("/interview/tok-test-123", { token: null });

    expect(await screen.findByRole("heading", { name: "We couldn't load your interview" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Interview Complete" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Senior Frontend Engineer" })).toBeInTheDocument();
  });
});
