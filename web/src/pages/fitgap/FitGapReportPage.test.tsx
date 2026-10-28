import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/portfolios", () => ({
    portfoliosApi: { getFitGap: vi.fn(), triggerFitGap: vi.fn(), regenerateFitGap: vi.fn(), exportPortfolio: vi.fn() },
}));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn(), get: vi.fn() } }));

function report(status: string) {
    return {
        data: {
            report: {
                portfolio_id: 5,
                vacancy_id: 9,
                summary: { total: 1, evidenced: 1, match: 1, exceed: 0, gap: 0, not_assessed: 0, low_confidence: 0, overridden: 0, confirmed: 0 },
                comparisons: [
                    { skill_label: "Contoh Rails", expected_level: 3, candidate_level: 3, ai_level: 3, level_source: "ai",
                      is_override: false, confidence: "high", result: "match", delta: 0, counts_toward_fit: true },
                ],
                follow_up: [],
                narrative: { status, source: status === "complete" ? "ai" : null,
                             label: "AI generated, not a hiring decision",
                             culture: null, overall: status === "complete" ? "Contoh narasi." : null },
            },
        },
    };
}

function renderPage() {
    render(
        <MemoryRouter initialEntries={["/assessments/1/sessions/2/fitgap/9"]}>
            <Routes>
                <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
            </Routes>
        </MemoryRouter>,
    );
}

const sessionResponse = { data: { session: { id: 2, candidate_name: "Kandidat Contoh A" }, assessment: { id: 1, name: "Contoh" } } };

// AC-95 / D1: polling only reads; it never enqueues a job, and stops on a final state.
describe("FitGapReportPage", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio: { id: 5, skills: [] } } } as never);
        vi.mocked(sessionsApi.get).mockResolvedValue(sessionResponse as never);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("polls with GET only while the narrative is generating and stops when it completes", async () => {
        vi.mocked(portfoliosApi.getFitGap)
            .mockResolvedValueOnce(report("generating") as never)
            .mockResolvedValue(report("complete") as never);

        renderPage();
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByText("Contoh Rails")).toBeInTheDocument();
        // Required and Candidate columns both show L3 (the Required column used to be empty).
        expect(screen.getAllByText("L3")).toHaveLength(2);

        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(screen.getByText("Contoh narasi.")).toBeInTheDocument();
        expect(screen.getByText(/AI generated, not a hiring decision/)).toBeInTheDocument();

        const callsAtCompletion = vi.mocked(portfoliosApi.getFitGap).mock.calls.length;
        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });

        expect(vi.mocked(portfoliosApi.getFitGap).mock.calls.length).toBe(callsAtCompletion);
        expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Slice 6a: every state of the redesigned page.

type Row = Record<string, unknown>;

function row(label: string, overrides: Row = {}): Row {
    return { skill_label: label, skill_id: null, expected_level: 3, ai_level: 3, candidate_level: 3, level_source: "ai",
             is_override: false, override_notes: null, confidence: "high", result: "match", delta: 0,
             counts_toward_fit: true, not_assessed_reason: null, tentative_direction: null,
             portfolio_skill_id: null, probe_count: 3, review: null, ...overrides };
}

const REVIEW = { action: "override", ai_level: 2, notes: "Contoh: tugas tertulis kuat.", actor_id: 7,
                 at: "2026-10-25T08:00:00.000Z" };

const PARTIAL = [
    row("Contoh Exceed", { candidate_level: 4, ai_level: 4, result: "exceed", delta: 1 }),
    row("Contoh Match"),
    row("Contoh SQL", { ai_level: 3, candidate_level: 2, expected_level: 3, result: "gap", delta: -1,
                        level_source: "assessor_override", is_override: true, confidence: null,
                        portfolio_skill_id: 11, probe_count: 2, review: { ...REVIEW, ai_level: 3 } }),
    row("Contoh System Design", { expected_level: 4, ai_level: null, candidate_level: null, level_source: null,
                                  confidence: null, result: "not_assessed", delta: null, counts_toward_fit: false,
                                  not_assessed_reason: "not_covered", probe_count: null }),
    row("Contoh API", { candidate_level: 4, ai_level: 4, confidence: "low", result: "low_confidence", delta: 1,
                        counts_toward_fit: false, tentative_direction: "above", probe_count: 1 }),
];

function fitGap(options: { comparisons?: Row[]; narrative?: Row; ratingsValidated?: boolean } = {}) {
    const comparisons = options.comparisons ?? PARTIAL;
    const count = (result: string) => comparisons.filter((c) => c.result === result).length;
    return {
        data: {
            report: {
                portfolio_id: 5, vacancy_id: 9, role_title: "Contoh Backend Engineer",
                ratings_validated: options.ratingsValidated ?? true,
                summary: { total: comparisons.length, evidenced: comparisons.filter((c) => c.counts_toward_fit).length,
                           match: count("match"), exceed: count("exceed"), gap: count("gap"),
                           not_assessed: count("not_assessed"), low_confidence: count("low_confidence"),
                           overridden: comparisons.filter((c) => c.level_source === "assessor_override").length,
                           confirmed: comparisons.filter((c) => c.level_source === "assessor_confirmed").length },
                comparisons,
                follow_up: comparisons.filter((c) => !c.counts_toward_fit).map((c) => c.skill_label),
                narrative: { status: "complete", source: "ai", label: "AI generated, not a hiring decision",
                             culture: null, overall: "Contoh narasi AI.", generated_at: null, error_code: null,
                             ...options.narrative },
            },
        },
    };
}

const SQL_SKILL = { id: 11, skill_label: "Contoh SQL", is_discovered: false, rating_status: "assessed",
                    ai_level: 3, ai_confidence: "low", evidence: ["Kandidat Contoh: kutipan tentang SQL."],
                    competency_summary: "Contoh ringkasan SQL.", coverage: { state: "partial", probe_count: 2 } };

function portfolioWith(skills: Row[] = [SQL_SKILL]) {
    return { data: { portfolio: { id: 5, generation_status: "complete", ratings_validated: true, skills, overrides: [] } } };
}

function httpError(status: number, data: Row = {}) {
    return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
}

const networkError = Object.assign(new Error("Network Error"), { request: {}, response: undefined });

async function renderLoaded() {
    renderPage();
    await screen.findByRole("heading", { name: /Fit\/Gap Report/ });
}

describe("FitGapReportPage states", () => {
    beforeEach(() => {
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(portfolioWith() as never);
        vi.mocked(sessionsApi.get).mockResolvedValue(sessionResponse as never);
        vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(fitGap() as never);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("shows a skeleton shaped like the report while loading", () => {
        vi.mocked(sessionsApi.getPortfolio).mockReturnValue(new Promise(() => {}) as never);

        renderPage();

        const loading = screen.getByLabelText("Loading fit/gap report");
        expect(loading).toHaveAttribute("aria-busy", "true");
    });

    it("shows the candidate, vacancy, computation time and a PDF export in the header", async () => {
        await renderLoaded();

        expect(await screen.findByText("Kandidat Contoh A")).toBeInTheDocument();
        expect(screen.getByText("Contoh Backend Engineer")).toBeInTheDocument();
        expect(screen.getByText(/Computed from current ratings/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Export PDF/ })).toBeInTheDocument();
    });

    it("summarises the result and coverage, and says missing evidence is not a reason to reject", async () => {
        await renderLoaded();

        for (const name of ["Match: 1", "Exceeds: 1", "Gap: 1", "Not assessed: 1", "Low confidence: 1", "Assessor reviewed: 1"]) {
            expect(screen.getByRole("group", { name })).toBeInTheDocument();
        }
        expect(screen.getByText("3 of 5 required skills have enough evidence to count")).toBeInTheDocument();
        expect(screen.getByText(/Missing evidence is not a reason to reject/)).toBeInTheDocument();
    });

    it("lists gaps first, then low confidence and not assessed, then match and exceeds", async () => {
        await renderLoaded();

        const table = screen.getByRole("table", { name: "Skill comparison" });
        expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent))
            .toEqual(["Contoh SQL", "Contoh API", "Contoh System Design", "Contoh Match", "Contoh Exceed"]);
    });

    it("shows the level scale, confidence with probes and the level source per row", async () => {
        await renderLoaded();

        expect(screen.getByRole("img", { name: "Required L3, candidate L2" })).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Required L4, candidate not assessed" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Low confidence, 1 probe" })).toBeInTheDocument();
        expect(screen.getByText("Assessor override (AI L3)")).toBeInTheDocument();
        expect(screen.getByText("Tentatively above, not counted")).toBeInTheDocument();
    });

    it("opens the evidence, summary and review trail of a skill", async () => {
        await renderLoaded();

        fireEvent.click(screen.getByRole("button", { name: "Evidence and review for Contoh SQL" }));

        expect(await screen.findByText("Kandidat Contoh: kutipan tentang SQL.")).toBeInTheDocument();
        expect(screen.getByText("Contoh ringkasan SQL.")).toBeInTheDocument();
        expect(screen.getByText("Assessor #7, 25 Oct 2026, 08:00 UTC")).toBeInTheDocument();
        expect(screen.getByText("Contoh: tugas tertulis kuat.")).toBeInTheDocument();
    });

    it("says there is no interview evidence for a required skill missing from the portfolio", async () => {
        await renderLoaded();

        expect(screen.getAllByText("No interview evidence for this skill yet.").length).toBeGreaterThan(0);
    });

    it("writes the follow-up list as questions for the next interview", async () => {
        await renderLoaded();

        const followUp = screen.getByRole("region", { name: "Follow up in the next interview" });
        expect(followUp).toHaveTextContent(/Contoh System Design.*no evidence yet.*required L4/i);
        expect(followUp).toHaveTextContent(/Contoh API.*tentatively above L3 from 1 probe/i);
    });

    describe("narrative", () => {
        it("asks before generating: a Generate button, no request until it is clicked", async () => {
            vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(fitGap({ narrative: { status: "not_requested", source: null, overall: null } }) as never);
            vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue(fitGap({ narrative: { status: "generating", overall: null } }) as never);
            await renderLoaded();

            expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();
            fireEvent.click(screen.getByRole("button", { name: "Generate narrative" }));

            expect(await screen.findByText(/usually takes under a minute/)).toBeInTheDocument();
            expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
            expect(screen.getByRole("progressbar", { name: "Narrative progress" })).toBeInTheDocument();
        });

        it("explains a failure from its error code and retries only when asked", async () => {
            vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(fitGap({ narrative: { status: "failed", source: null, overall: null, error_code: "timeout" } }) as never);
            vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue(fitGap({ narrative: { status: "generating", overall: null } }) as never);
            await renderLoaded();

            expect(screen.getByText(/The AI service took too long to respond/)).toBeInTheDocument();
            expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole("button", { name: "Retry narrative" }));
            expect(portfoliosApi.triggerFitGap).toHaveBeenCalledTimes(1);
        });

        it("flags an outdated narrative, hides its old text and offers Regenerate", async () => {
            vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(fitGap({ narrative: { status: "outdated" } }) as never);
            await renderLoaded();

            expect(screen.getByRole("note", { name: "Narrative outdated" })).toBeInTheDocument();
            expect(screen.queryByText("Contoh narasi AI.")).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Regenerate narrative" })).toBeInTheDocument();
        });

        it("always shows the AI label and announces the status politely", async () => {
            await renderLoaded();

            expect(screen.getByText("AI generated, not a hiring decision")).toBeInTheDocument();
            const status = screen.getByRole("status", { name: "Narrative status" });
            expect(status).toHaveAttribute("aria-live", "polite");
            expect(status).toHaveTextContent("Ready");
        });
    });

    it("shows a banner on a legacy portfolio without changing its levels", async () => {
        vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(fitGap({ ratingsValidated: false }) as never);
        await renderLoaded();

        expect(screen.getByRole("note", { name: "Legacy portfolio" })).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Required L3, candidate L2" })).toBeInTheDocument();
    });

    it("explains an empty vacancy and links to adding skills", async () => {
        vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(httpError(422, { code: "vacancy_has_no_skills" }));
        await renderLoaded();

        expect(screen.getByRole("heading", { name: "This vacancy has no required skills" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Add required skills" })).toHaveAttribute("href", "/vacancies/9/edit");
    });

    it("says when the portfolio has no rated skills", async () => {
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(portfolioWith([]) as never);
        await renderLoaded();

        expect(screen.getByRole("note", { name: "This portfolio has no rated skills" })).toBeInTheDocument();
    });

    it("treats 404 as not found without saying whether the data exists elsewhere", async () => {
        vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(httpError(404, { errors: [{ message: "Portfolio not found" }] }));
        await renderLoaded();

        expect(screen.getByRole("alert")).toHaveTextContent("We could not find this report");
        expect(screen.getByRole("link", { name: "Back to the portfolio" })).toBeInTheDocument();
    });

    it("recovers from a server error with Try again", async () => {
        vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce(httpError(500)).mockResolvedValue(fitGap() as never);
        await renderLoaded();

        expect(screen.getByRole("alert")).toHaveTextContent("Could not load the report");
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        expect(await screen.findByRole("table", { name: "Skill comparison" })).toBeInTheDocument();
    });

    it("also reloads the candidate name when retrying after the connection came back", async () => {
        vi.mocked(sessionsApi.get).mockRejectedValueOnce(networkError);
        vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce(networkError).mockResolvedValue(fitGap() as never);
        await renderLoaded();
        expect(screen.queryByText("Kandidat Contoh A")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        expect(await screen.findByText("Kandidat Contoh A")).toBeInTheDocument();
    });

    it("tells the user when the server cannot be reached", async () => {
        vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(networkError);
        await renderLoaded();

        expect(screen.getByRole("alert")).toHaveTextContent("Cannot reach the server");
        expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("shows a portfolio that is still being generated instead of an error", async () => {
        vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(httpError(409, { code: "portfolio_not_ready", generation_status: "generating" }));
        await renderLoaded();

        expect(screen.getByText(/The portfolio is still being generated/)).toBeInTheDocument();
    });

    it("keeps long skill names and evidence inside the layout with an accessible expand", async () => {
        const longLabel = "Contoh" + "x".repeat(249);
        const longQuote = "Kutipan ".repeat(625);
        vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(fitGap({ comparisons: [row(longLabel, { portfolio_skill_id: 11 })] }) as never);
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(portfolioWith([{ ...SQL_SKILL, skill_label: longLabel, evidence: [longQuote] }]) as never);
        await renderLoaded();

        expect(screen.getByRole("rowheader")).toHaveTextContent(longLabel);
        expect(within(screen.getByRole("rowheader")).getByText(longLabel)).toHaveClass("[overflow-wrap:anywhere]");

        fireEvent.click(screen.getByRole("button", { name: `Evidence and review for ${longLabel}` }));
        expect(await screen.findByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");
    });

    it("reports a failed PDF export instead of failing silently", async () => {
        vi.mocked(portfoliosApi.exportPortfolio).mockRejectedValue(httpError(500, { errors: [{ code: "pdf_render_failed" }] }));
        await renderLoaded();

        fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));

        expect(await screen.findByText("The PDF could not be created. Try again or export JSON instead.")).toBeInTheDocument();
    });

    describe("keyboard focus after an action", () => {
        it("moves focus to the narrative status when Generate replaces the button", async () => {
            vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(fitGap({ narrative: { status: "not_requested", source: null, overall: null } }) as never);
            vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue(fitGap({ narrative: { status: "generating", overall: null } }) as never);
            await renderLoaded();

            const generate = screen.getByRole("button", { name: "Generate narrative" });
            generate.focus();
            fireEvent.click(generate);

            await screen.findByText(/usually takes under a minute/);
            expect(document.activeElement).toBe(screen.getByRole("status", { name: "Narrative status" }));
        });

        it("moves focus to the narrative status after Retry", async () => {
            vi.mocked(portfoliosApi.getFitGap).mockResolvedValue(fitGap({ narrative: { status: "failed", source: null, overall: null, error_code: "timeout" } }) as never);
            vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue(fitGap({ narrative: { status: "generating", overall: null } }) as never);
            await renderLoaded();

            const retry = screen.getByRole("button", { name: "Retry narrative" });
            retry.focus();
            fireEvent.click(retry);

            await screen.findByText(/usually takes under a minute/);
            expect(document.activeElement).toBe(screen.getByRole("status", { name: "Narrative status" }));
        });

        it("moves focus to the page heading when Try again brings the report back", async () => {
            vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce(httpError(500)).mockResolvedValue(fitGap() as never);
            await renderLoaded();

            const tryAgain = screen.getByRole("button", { name: "Try again" });
            tryAgain.focus();
            fireEvent.click(tryAgain);

            await screen.findByRole("table", { name: "Skill comparison" });
            expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Fit/Gap Report" }));
        });

        it("keeps the export button focused while exporting and ignores a second press", async () => {
            vi.mocked(portfoliosApi.exportPortfolio).mockReturnValue(new Promise(() => {}) as never);
            await renderLoaded();

            const exportPdf = screen.getByRole("button", { name: /Export PDF/ });
            exportPdf.focus();
            fireEvent.click(exportPdf);
            fireEvent.click(exportPdf);

            expect(exportPdf).not.toBeDisabled();
            expect(exportPdf).toHaveAttribute("aria-disabled", "true");
            expect(document.activeElement).toBe(exportPdf);
            expect(portfoliosApi.exportPortfolio).toHaveBeenCalledTimes(1);
        });
    });

    it("uses icons with text for every status, never emoji", async () => {
        await renderLoaded();

        expect(document.body.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}✅⭐⚠✏]/u);
    });
});
