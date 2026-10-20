import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { fitGapReport, notFound, portfolio } from "../fixtures";

const PAGE = "/assessments/7/sessions/42/fitgap/5";

function row(label: string) {
  return screen.getByRole("cell", { name: label }).closest("tr") as HTMLElement;
}

/** Serves the portfolio, and the fit/gap report once `ready()` says so. Counts generation requests. */
function serve({ ready = () => true }: { ready?: () => boolean } = {}) {
  const calls = { triggers: 0 };
  server.use(
    http.get(`${API}/sessions/42/portfolio`, () => HttpResponse.json({ portfolio })),
    http.get(`${API}/portfolios/9/fitgap/5`, () =>
      ready() ? HttpResponse.json(fitGapReport) : HttpResponse.json(notFound("Fit/gap report not found"), { status: 404 })
    ),
    http.post(`${API}/portfolios/9/fitgap`, () => {
      calls.triggers += 1;
      return HttpResponse.json({ status: "generating", message: "queued" }, { status: 202 });
    })
  );
  return calls;
}

describe("Fit/gap report", () => {
  it("compares each skill with the vacancy and explains the result", async () => {
    serve();
    renderApp(PAGE);

    expect(await screen.findByText("Skill Comparison")).toBeInTheDocument();
    expect(within(row("React")).getByText(/Match/)).toBeInTheDocument();
    expect(within(row("Communication")).getByText(/Gap -1/)).toBeInTheDocument();
    expect(within(row("System Design")).getByText(/Exceeds? \+1/)).toBeInTheDocument();
    expect(within(row("Communication")).getByText("L2")).toBeInTheDocument();

    expect(screen.getByText("Strong ownership; probe async communication next.")).toBeInTheDocument();
    expect(screen.getByText(/Discovered Skills/)).toBeInTheDocument();
    expect(screen.getByText("Micro-frontend Architecture")).toBeInTheDocument();
  });

  it("asks for a report when none exists, waits, then shows it", async () => {
    let ready = false;
    const calls = serve({ ready: () => ready });
    renderApp(PAGE);

    expect(await screen.findByText("Generating fit/gap report...")).toBeInTheDocument();
    expect(calls.triggers).toBe(1);

    ready = true;
    expect(await screen.findByText("Skill Comparison", {}, { timeout: 7000 })).toBeInTheDocument();
  }, 10_000);

  // AC-23 on this page: a discovered skill the AI couldn't rate must not read as "confirmed".
  it("lists a discovered skill with no level as not assessed", async () => {
    const unrated = {
      ...portfolio.skills[3], ai_level: null, ai_confidence: null, evidence: [], competency_summary: null,
    };
    serve();
    server.use(
      http.get(`${API}/sessions/42/portfolio`, () =>
        HttpResponse.json({ portfolio: { ...portfolio, skills: [...portfolio.skills.slice(0, 3), unrated] } })
      )
    );
    renderApp(PAGE);

    const item = (await screen.findByText("Micro-frontend Architecture")).parentElement as HTMLElement;
    expect(within(item).getByText(/not assessed/i)).toBeInTheDocument();
    expect(within(item).queryByText(/confirmed/)).not.toBeInTheDocument();
  });

  it("AC-26: stops waiting after two minutes and offers a retry", async () => {
    serve({ ready: () => false });
    renderApp(PAGE);
    await screen.findByText("Generating fit/gap report...");

    const start = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => start + 2 * 60_000 + 1);

    expect(await screen.findByRole("alert", {}, { timeout: 7000 })).toHaveTextContent(/taking longer than expected/i);
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
    vi.restoreAllMocks();
  }, 10_000);

  it("AC-26: shows an error with a retry when the report can't be fetched", async () => {
    serve();
    server.use(http.get(`${API}/portfolios/9/fitgap/5`, () => HttpResponse.json({}, { status: 500 })));
    renderApp(PAGE);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load the fit\/gap report/i);
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });

  describe("known defects (assessment/03-problem-and-gap.md)", () => {
    // The API sends `expected_level`; the table reads `required_level`.
    it("P1-2: shows the level the vacancy requires", async () => {
      serve();
      renderApp(PAGE);
      await screen.findByText("Skill Comparison");

      const [, required] = within(row("Communication")).getAllByRole("cell");
      expect(required).toHaveTextContent("L3");
    });

    it("P2-5: shows a discovered skill's level as a level, not a bare number", async () => {
      serve();
      renderApp(PAGE);
      await screen.findByText("Micro-frontend Architecture");

      const line = screen.getByText("Micro-frontend Architecture").parentElement as HTMLElement;
      expect(line).toHaveTextContent("L2");
    });

    it("P1-6: asks the API to generate the report only once while it waits", async () => {
      const calls = serve({ ready: () => false });
      renderApp(PAGE);
      await screen.findByText("Generating fit/gap report...");

      await new Promise((resolve) => setTimeout(resolve, 5500));
      expect(calls.triggers).toBe(1);
    }, 10_000);
  });
});
