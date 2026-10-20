import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, server } from "../server";
import { renderApp } from "../render";
import { portfolio, sessionShow, vacancies } from "../fixtures";

const PAGE = "/assessments/7/sessions/42/portfolio";

afterEach(() => vi.restoreAllMocks());

function serve(portfolioResponse: () => Response) {
  server.use(
    http.get(`${API}/sessions/42/portfolio`, portfolioResponse),
    http.get(`${API}/sessions/42`, () => HttpResponse.json(sessionShow)),
    http.get(`${API}/vacancies`, () => HttpResponse.json(vacancies))
  );
}

function card(label: string) {
  return screen.getByText(label, { selector: "span.font-semibold" }).closest(".bg-card") as HTMLElement;
}

describe("Portfolio review", () => {
  it("shows each skill's level, confidence, evidence and summary, with discovered skills apart", async () => {
    serve(() => HttpResponse.json({ portfolio }));
    renderApp(PAGE);

    expect(await screen.findByText("Portfolio Results")).toBeInTheDocument();
    expect(await screen.findByText("Test Candidate")).toBeInTheDocument();

    const react = card("React");
    expect(within(react).getByText("L3")).toBeInTheDocument();
    expect(within(react).getByText("Confidence: HIGH")).toBeInTheDocument();
    expect(within(react).getByText(/We moved critical real-time data/)).toBeInTheDocument();
    expect(within(react).getByText("Handles complex state with clear trade-offs.")).toBeInTheDocument();

    expect(within(card("Communication")).getByText("L2")).toBeInTheDocument();
    expect(screen.getByText("Discovered Skills")).toBeInTheDocument();
    expect(within(card("Micro-frontend Architecture")).getByText(/Only briefly explored/)).toBeInTheDocument();
  });

  it("shows progress while the portfolio is generated, then the result", async () => {
    let ready = false;
    serve(() => (ready ? HttpResponse.json({ portfolio }) : HttpResponse.json({ status: "generating" }, { status: 202 })));
    renderApp(PAGE);

    expect(await screen.findByText("Generating portfolio...")).toBeInTheDocument();

    ready = true;
    expect(await screen.findByText("React", {}, { timeout: 7000 })).toBeInTheDocument();
    expect(screen.queryByText("Generating portfolio...")).not.toBeInTheDocument();
  }, 10_000);

  it("offers a retry when generation failed, and asks the API to regenerate", async () => {
    let regenerated = false;
    serve(() =>
      HttpResponse.json({
        portfolio: { ...portfolio, generation_status: "failed", generation_error: "Gemini API timeout", skills: [] },
        error: "Gemini API timeout",
      })
    );
    server.use(
      http.post(`${API}/sessions/42/portfolio/regenerate`, () => {
        regenerated = true;
        return HttpResponse.json({ message: "queued", portfolio: { ...portfolio, generation_status: "pending" } });
      })
    );
    const { user } = renderApp(PAGE);

    expect(await screen.findByText("Portfolio generation failed.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retry/ }));

    expect(await screen.findByText("Generating portfolio...")).toBeInTheDocument();
    expect(regenerated).toBe(true);
  });

  it("saves an assessor's override with a note and shows it next to the AI's level", async () => {
    let sent: unknown;
    serve(() => HttpResponse.json({ portfolio }));
    server.use(
      http.post(`${API}/portfolio_skills/102/override`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(
          { override: { id: 1, portfolio_skill_id: 102, ai_level: 2, override_level: 3, assessor_notes: "Strong written follow-up.", overridden_by: 1 } },
          { status: 201 }
        );
      })
    );
    const { user } = renderApp(PAGE);
    await screen.findByText("Communication");

    const communication = card("Communication");
    await user.click(within(communication).getByRole("button", { name: /Override rating/ }));
    await user.click(within(communication).getByRole("radio", { name: /L3/ }));
    await user.type(within(communication).getByLabelText(/Notes/), "Strong written follow-up.");
    await user.click(within(communication).getByRole("button", { name: "Save override" }));

    await waitFor(() =>
      expect(sent).toEqual({ override: { override_level: 3, assessor_notes: "Strong written follow-up." } })
    );
    expect(await within(card("Communication")).findByRole("button", { name: /Edit override/ })).toBeInTheDocument();
  });

  it("keeps the override form open with a message when saving fails", async () => {
    serve(() => HttpResponse.json({ portfolio }));
    server.use(http.post(`${API}/portfolio_skills/101/override`, () => HttpResponse.json({}, { status: 500 })));
    const { user } = renderApp(PAGE);
    await screen.findByText("React");

    const react = card("React");
    await user.click(within(react).getByRole("button", { name: /Override rating/ }));
    await user.click(within(react).getByRole("button", { name: "Save override" }));

    expect(await within(react).findByText("Failed to save override. Please try again.")).toBeInTheDocument();
    expect(within(react).getByRole("button", { name: "Save override" })).toBeEnabled();
  });

  describe("skills that weren't assessed (AC-24)", () => {
    const unrated = (skillFields: object) => ({
      ...portfolio.skills[1], ai_level: null, ai_confidence: null, evidence: [], competency_summary: null,
      assessment_status: "not_assessed", not_assessed_reason: "not_reached", ...skillFields,
    });

    function serveEnded(end_reason: string, duration_seconds: number) {
      serve(() => HttpResponse.json({
        portfolio: { ...portfolio, skills: [portfolio.skills[0], unrated({}), unrated({ id: 103, skill_label: "System Design" })] },
      }));
      server.use(http.get(`${API}/sessions/42`, () =>
        HttpResponse.json({ session: { ...sessionShow.session, end_reason, duration_seconds } })));
    }

    it("says how many skills weren't assessed, and how the interview ended", async () => {
      serveEnded("manual_candidate", 6 * 60 + 10);
      renderApp(PAGE);

      expect(await screen.findByText(
        "2 of 3 skills weren't assessed. The interview ended after 6 minutes (ended by the candidate)."
      )).toBeInTheDocument();
    });

    it("doesn't repeat an end reason that contradicts the result", async () => {
      // "all_covered" can be sent by anyone with the invite link (P1-10), so it isn't repeated here.
      serveEnded("all_covered", 6 * 60);
      renderApp(PAGE);

      expect(await screen.findByText(
        "2 of 3 skills weren't assessed. The interview ended after 6 minutes, before they were reached."
      )).toBeInTheDocument();
    });
  });

  it("tells the assessor why generation failed, in the API's safe words", async () => {
    serve(() => HttpResponse.json({
      portfolio: { ...portfolio, generation_status: "failed", skills: [], generation_error_category: "model_timeout",
                   generation_error: "Model timeout: the AI didn't answer in time." },
      error: "Model timeout: the AI didn't answer in time.",
    }));
    renderApp(PAGE);

    expect(await screen.findByText("Model timeout: the AI didn't answer in time.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("says how often the camera and screen share were off in a proctored interview", async () => {
    serve(() => HttpResponse.json({ portfolio }));
    server.use(
      http.get(`${API}/sessions/42`, () =>
        HttpResponse.json({
          session: { ...sessionShow.session, proctoring: { camera: { stops: 1, off_seconds: 45 }, screen: { stops: 0, off_seconds: 0 } } },
        })
      )
    );
    renderApp(PAGE);

    expect(await screen.findByText(/The camera was off once \(45 s in total\)/)).toBeInTheDocument();
  });

  it("says when a second screen was connected during a proctored interview", async () => {
    serve(() => HttpResponse.json({ portfolio }));
    const quiet = { stops: 0, off_seconds: 0 };
    server.use(
      http.get(`${API}/sessions/42`, () =>
        HttpResponse.json({
          session: { ...sessionShow.session, proctoring: { camera: quiet, screen: quiet, second_screen: { connected: 1, seconds: 40 } } },
        })
      )
    );
    renderApp(PAGE);

    expect(await screen.findByText(/A second screen was connected once \(40 s in total\)/)).toBeInTheDocument();
  });

  it("AC-27: offers a retry when the portfolio can't be loaded, and recovers", async () => {
    let fail = true;
    serve(() => (fail ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json({ portfolio })));
    const { user } = renderApp(PAGE);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load the portfolio/i);

    fail = false;
    await user.click(screen.getByRole("button", { name: /Try again/ }));

    expect(await screen.findByText("React", { selector: "span.font-semibold" })).toBeInTheDocument();
  });

  describe("known defects (assessment/03-problem-and-gap.md)", () => {
    // Today a null level doesn't render as L1 here: parseLevel(null) throws and the
    // whole page is replaced by "Something went wrong." The API fix alone would
    // break this screen, so both sides of the seam must ship together.
    it("P0-1: never shows a level for a skill the AI could not rate", async () => {
      const unrated = { ...portfolio.skills[1], ai_level: null, ai_confidence: null, evidence: [], competency_summary: null };
      serve(() => HttpResponse.json({ portfolio: { ...portfolio, skills: [portfolio.skills[0], unrated] } }));
      renderApp(PAGE);
      await screen.findByText("Communication");

      const communication = card("Communication");
      expect(within(communication).queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
      expect(within(communication).getByText(/not assessed/i)).toBeInTheDocument();
    });

    it("P2-1: tells the assessor when the portfolio can't be loaded, instead of a blank page", async () => {
      serve(() => HttpResponse.json({ errors: [{ status: 500 }] }, { status: 500 }));
      renderApp(PAGE);

      expect(await screen.findByText("Portfolio Results")).toBeInTheDocument();
      expect(await screen.findByRole("alert")).toBeInTheDocument();
    });

    // Found when the Sidekiq container had stopped: the page promised "about 2 minutes" and spun for hours.
    it("P2-22: stops waiting after three minutes and says so, instead of spinning forever", async () => {
      serve(() => HttpResponse.json({ status: "generating" }, { status: 202 }));
      renderApp(PAGE);
      expect(await screen.findByText("Generating portfolio...")).toBeInTheDocument();

      const start = Date.now();
      vi.spyOn(Date, "now").mockImplementation(() => start + 3 * 60_000 + 1);

      expect(await screen.findByRole("alert", {}, { timeout: 7000 })).toHaveTextContent(/taking longer than expected/i);
      expect(screen.queryByText("Generating portfolio...")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
    }, 10_000);
  });
});
