import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { candidateInfo, notFound } from "../fixtures";

// The candidate has no account: the invite token in the link is all they have.
// Only the screens before and after the interview are covered here; the live
// interview needs a microphone and the Gemini Live WebSocket (constraint C1).

// The hardware check on the first screen measures the connection against
// third-party hosts (src/utils/internetSpeedTest.ts) unless VITE_SPEED_TEST_*
// is set. Those requests are answered here and recorded, so they're visible
// instead of leaking into whichever test runs next.
let thirdParty: string[] = [];

beforeEach(() => {
  thirdParty = [];
  server.use(
    http.all(/^https?:\/\/(?!api\.test\/)/, ({ request }) => {
      thirdParty.push(`${request.method} ${new URL(request.url).host}`);
      return new HttpResponse(null, { status: 200 });
    })
  );
});

describe("Candidate interview page", () => {
  it("opens from the invite link without signing in and explains what to expect", async () => {
    server.use(http.get(`${API}/sessions/tok-test-123/candidate`, () => HttpResponse.json(candidateInfo)));
    renderApp("/interview/tok-test-123", { token: null });

    expect(await screen.findByRole("heading", { name: "Senior Frontend Engineer" })).toBeInTheDocument();
    expect(screen.getAllByText(/45 minutes/).length).toBeGreaterThan(0);
    expect(screen.getByText(/This is a voice interview/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  describe("when the assessment requires camera and full-screen sharing", () => {
    const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
    const ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
    const EDGE = `${CHROME} Edg/130.0.0.0`;

    afterEach(() => vi.restoreAllMocks());

    function openAs(userAgent: string, proctoring_required = true) {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
      server.use(http.get(`${API}/sessions/tok-test-123/candidate`, () => HttpResponse.json({ ...candidateInfo, proctoring_required })));
      renderApp("/interview/tok-test-123", { token: null });
    }

    it("asks for the camera and the entire screen, with the notice, in Chrome on a computer", async () => {
      openAs(CHROME);

      expect(await screen.findByRole("heading", { name: "Camera and screen sharing" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Turn on camera" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Share your entire screen" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Start Interview" })).toBeDisabled();
    });

    it("explains that a phone or another browser can't take it", async () => {
      for (const ua of [ANDROID, EDGE]) {
        openAs(ua);
        expect(await screen.findByRole("heading", { name: "This interview needs Chrome on a computer" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Start Interview" })).not.toBeInTheDocument();
        cleanup();
        vi.restoreAllMocks();
      }
    });

    it("keeps today's voice-only setup when the assessment doesn't require it", async () => {
      openAs(ANDROID, false);

      expect(await screen.findByRole("heading", { name: "Senior Frontend Engineer" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Camera and screen sharing" })).not.toBeInTheDocument();
      expect(screen.queryByText(/needs Chrome on a computer/)).not.toBeInTheDocument();
    });
  });

  it("shows the closing screen when the interview has already ended", async () => {
    server.use(
      http.get(`${API}/sessions/tok-test-123/candidate`, () =>
        HttpResponse.json({ ...candidateInfo, session_status: "ended" })
      )
    );
    renderApp("/interview/tok-test-123", { token: null });

    expect(await screen.findByText("Interview Complete")).toBeInTheDocument();
  });

  it("P1-11: tells someone with a broken link that the link doesn't work, not that their interview was recorded", async () => {
    server.use(
      http.get(`${API}/sessions/not-a-token/candidate`, () =>
        HttpResponse.json(notFound("Invalid or expired invite token"), { status: 404 })
      )
    );
    renderApp("/interview/not-a-token", { token: null });

    expect(await screen.findByRole("heading", { name: "This interview link doesn't work" })).toBeInTheDocument();
    expect(screen.queryByText(/has been recorded/)).not.toBeInTheDocument();
  });

  describe("known defects", () => {
    it.fails("does not send the candidate's connection to third-party hosts before the interview", async () => {
      server.use(http.get(`${API}/sessions/tok-test-123/candidate`, () => HttpResponse.json(candidateInfo)));
      renderApp("/interview/tok-test-123", { token: null });
      await screen.findByRole("heading", { name: "Senior Frontend Engineer" });

      // Give the hardware check time to start its measurements, then expect none went out.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      expect(thirdParty).toEqual([]);
    });

    it.fails("P2-4: says before the interview starts that it is recorded and assessed by AI", async () => {
      server.use(http.get(`${API}/sessions/tok-test-123/candidate`, () => HttpResponse.json(candidateInfo)));
      renderApp("/interview/tok-test-123", { token: null });

      await screen.findByRole("heading", { name: "Senior Frontend Engineer" });
      expect(screen.getByText(/recorded/i)).toBeInTheDocument();
    });
  });
});
