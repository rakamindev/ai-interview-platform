import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse, ws } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { activeSession, coverageMessages, portfolio, sessionShow, transcriptTurns, vacancies } from "../fixtures";

// The live monitor joins two channels: REST (session, transcript polling, end)
// and the coverage WebSocket. These tests run the real page, hook and services
// against both, with the WebSocket messages in the exact shape the API sends.
const PAGE = "/assessments/7/sessions/42/monitor";
const coverage = ws.link("ws://api.test/ws/sessions/42/coverage");

type Socket = {
  send: (data: string) => void;
  close: () => void;
  addEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
};

/** Serves REST, and hands each WebSocket connection to `onConnect`. Records what the page sends. */
function serve(onConnect: (client: Socket, received: unknown[]) => void, { turns = 2 } = {}) {
  const received: unknown[] = [];
  const transcriptCalls: (string | null)[] = [];
  let connections = 0;

  server.use(
    http.get(`${API}/sessions/42`, () => HttpResponse.json(activeSession)),
    http.get(`${API}/sessions/42/transcript`, ({ request }) => {
      const from = new URL(request.url).searchParams.get("from_turn");
      transcriptCalls.push(from);
      return HttpResponse.json(from ? transcriptTurns(Number(from), 1) : transcriptTurns(1, turns));
    }),
    coverage.addEventListener("connection", ({ client }) => {
      connections += 1;
      client.addEventListener("message", (event) => received.push(JSON.parse(String(event.data))));
      onConnect(client, received);
    })
  );

  return { received, transcriptCalls, connections: () => connections };
}

describe("Live monitor: REST + coverage WebSocket", () => {
  it("authenticates over the socket, then shows the coverage it is sent", async () => {
    const io = serve((client) => {
      // The real server sends the current state only after the auth message.
      client.addEventListener("message", () => client.send(JSON.stringify(coverageMessages.initial())));
    });
    renderApp(PAGE, { token: "assessor-jwt" });

    expect(await screen.findByText("Senior Frontend Engineer")).toBeInTheDocument();
    expect(await screen.findByText("React")).toBeInTheDocument();
    expect(screen.getByText("2 probes")).toBeInTheDocument();
    expect(screen.getByText(/Profiled with React DevTools/)).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(io.received[0]).toEqual({ type: "auth", token: "assessor-jwt" });
  });

  it("updates as the analysis publishes new coverage, including discovered skills", async () => {
    serve((client) => {
      client.addEventListener("message", () => {
        client.send(JSON.stringify(coverageMessages.initial()));
        setTimeout(() => client.send(JSON.stringify(coverageMessages.update())), 50);
      });
    });
    renderApp(PAGE);

    expect(await screen.findByText("5 probes")).toBeInTheDocument();
    expect(screen.getByText("Micro-frontend Architecture")).toBeInTheDocument();
    expect(screen.getByText("Discovered")).toBeInTheDocument();
  });

  it("shows the end of the session as soon as it is announced, and links to the portfolio", async () => {
    serve((client) => {
      client.addEventListener("message", () => {
        client.send(JSON.stringify(coverageMessages.initial()));
        setTimeout(() => client.send(JSON.stringify(coverageMessages.ended("time_ceiling"))), 50);
      });
    });
    renderApp(PAGE);

    expect(await screen.findByText("Session ended")).toBeInTheDocument();
    expect(screen.getByText(/time ceiling/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /View portfolio/ }).length).toBeGreaterThan(0);
  });

  it("polls the transcript from the last turn it has", async () => {
    const io = serve((client) => client.addEventListener("message", () => client.send(JSON.stringify(coverageMessages.initial()))));
    renderApp(PAGE);

    expect(await screen.findByText("Turn 2")).toBeInTheDocument();
    expect(await screen.findByText("Turn 3", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(io.transcriptCalls.slice(0, 2)).toEqual([null, "3"]);
  });

  it("ends the session over REST and opens the portfolio", async () => {
    let ended: unknown;
    serve((client) => client.addEventListener("message", () => client.send(JSON.stringify(coverageMessages.initial()))));
    server.use(
      http.post(`${API}/sessions/42/end_session`, async ({ request }) => {
        ended = await request.json();
        return HttpResponse.json(sessionShow);
      }),
      http.get(`${API}/sessions/42/portfolio`, () => HttpResponse.json({ portfolio })),
      http.get(`${API}/vacancies`, () => HttpResponse.json(vacancies))
    );
    const { user } = renderApp(PAGE);
    await screen.findByText("React");

    await user.click(screen.getByRole("button", { name: /End session/i }));
    await user.click(await screen.findByRole("button", { name: /^End session$|^End$|Confirm/i }));

    expect(await screen.findByText("Portfolio Results")).toBeInTheDocument();
    expect(ended).toEqual({ session: { reason: "manual_assessor" } });
  });

  describe("known defects", () => {
    // If the session ends while the monitor is reconnecting, the end only reaches
    // it as the initial coverage_update (status "ended"), which the hook ignores.
    it.fails("shows a session that ended while the monitor was disconnected as ended", async () => {
      serve((client) =>
        client.addEventListener("message", () => client.send(JSON.stringify(coverageMessages.initial("ended", "all_covered"))))
      );
      renderApp(PAGE);
      await screen.findByText("React");

      expect(await screen.findByText("Session ended")).toBeInTheDocument();
    });

    // After three failed reconnects (1 s, 2 s, 4 s) the hook stops trying, but the
    // header keeps saying "Reconnecting..." with no way to retry.
    it.fails("tells the assessor when the live connection is lost for good", async () => {
      const io = serve((client) => client.close());
      renderApp(PAGE);
      await screen.findByText("Live Monitor");

      await waitFor(() => expect(io.connections()).toBe(4), { timeout: 9000 });
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(screen.queryByText("Reconnecting...")).not.toBeInTheDocument();
    }, 14_000);
  });
});
