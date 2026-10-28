import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PortfolioPage from "@/pages/portfolio/PortfolioPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { httpError, networkError, overrideFixture, skillFixture } from "@/test/portfolioFixtures";
import type { PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({
    portfoliosApi: { getOverride: vi.fn(), confirmRating: vi.fn(), revertOverride: vi.fn(), getOverrideEvents: vi.fn(), exportPortfolio: vi.fn() },
}));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn(), get: vi.fn(), regeneratePortfolio: vi.fn() } }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: vi.fn() } }));

const SQL = skillFixture({ id: 1, skill_label: "Contoh SQL" });
const DESIGN = skillFixture({ id: 2, skill_label: "Contoh System Design", rating_status: "not_assessed", not_assessed_reason: "not_covered",
                             ai_level: null, ai_confidence: null, effective_level: null, level_source: null, evidence: [],
                             coverage: { state: "not_yet", probe_count: 0 } });
const DOCKER = skillFixture({ id: 3, skill_label: "Contoh Docker", is_discovered: true });

function portfolio(options: { skills?: PortfolioSkill[]; status?: string; validated?: boolean; overrides?: unknown[]; errorMessage?: string } = {}) {
    return { data: { portfolio: { id: 5, session_id: 2, generation_status: options.status ?? "complete",
        generation_error_message: options.errorMessage ?? null, ratings_validated: options.validated ?? true,
        skills: options.skills ?? [SQL, DESIGN, DOCKER], overrides: options.overrides ?? [] } } };
}

function renderPage(path = "/assessments/1/sessions/2/portfolio") {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
            </Routes>
        </MemoryRouter>,
    );
}

async function renderLoaded(path?: string) {
    renderPage(path);
    await screen.findByRole("heading", { level: 1, name: "Portfolio" });
}

describe("PortfolioPage", () => {
    beforeEach(() => {
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(portfolio() as never);
        vi.mocked(sessionsApi.get).mockResolvedValue({ data: { session: { id: 2, candidate_name: "Kandidat Contoh A" }, assessment: { id: 1 } } } as never);
        vi.mocked(vacanciesApi.list).mockResolvedValue({ data: { vacancies: [{ id: 9, role_title: "Contoh Backend Engineer" }] } } as never);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("shows a skeleton shaped like the cards while loading", () => {
        vi.mocked(sessionsApi.getPortfolio).mockReturnValue(new Promise(() => {}) as never);
        renderPage();

        expect(screen.getByLabelText("Loading portfolio")).toHaveAttribute("aria-busy", "true");
    });

    it("shows the candidate, the transcript link and the exports in the header", async () => {
        await renderLoaded();

        expect(await screen.findByText("Kandidat Contoh A")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Transcript/ })).toHaveAttribute("href", "/assessments/1/sessions/2/transcript");
        expect(screen.getByRole("button", { name: /Export PDF/ })).toBeInTheDocument();
    });

    it("separates configured and discovered skills in tabs", async () => {
        await renderLoaded();

        expect(screen.getByRole("tab", { name: "Configured skills (2)" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("heading", { name: "Contoh SQL" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Contoh Docker" })).not.toBeInTheDocument();

        const discovered = screen.getByRole("tab", { name: "Discovered skills (1)" });
        fireEvent.mouseDown(discovered);
        fireEvent.click(discovered);
        expect(await screen.findByRole("heading", { name: "Contoh Docker" })).toBeInTheDocument();
    });

    it("shows no tabs when nothing was discovered", async () => {
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(portfolio({ skills: [SQL, DESIGN] }) as never);
        await renderLoaded();

        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Contoh SQL" })).toBeInTheDocument();
    });

    it("summarises how many configured skills have a level", async () => {
        await renderLoaded();

        expect(screen.getByText("1 of 2 configured skills have a level")).toBeInTheDocument();
        expect(screen.getByRole("group", { name: "Not assessed: 1" })).toBeInTheDocument();
    });

    it("shows not assessed clearly with its reason", async () => {
        await renderLoaded();

        const card = screen.getByRole("article", { name: "Contoh System Design" });
        expect(within(card).getByText("Not assessed")).toBeInTheDocument();
        expect(within(card).getByText(/not covered in the interview/i)).toBeInTheDocument();
    });

    it("shows the legacy banner without changing the levels", async () => {
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(portfolio({ validated: false }) as never);
        await renderLoaded();

        expect(screen.getByRole("note", { name: "Legacy portfolio" })).toBeInTheDocument();
        expect(within(screen.getByRole("article", { name: "Contoh SQL" })).getByRole("img", { name: "Level L2" })).toBeInTheDocument();
    });

    it("explains an empty portfolio", async () => {
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(portfolio({ skills: [] }) as never);
        await renderLoaded();

        expect(screen.getByRole("heading", { name: "This portfolio has no skills" })).toBeInTheDocument();
    });

    it("polls with GET only while the portfolio is generating and stops when it is complete", async () => {
        vi.useFakeTimers();
        // Real contract: while generating, GET answers 202 { status: "generating" } without a portfolio.
        vi.mocked(sessionsApi.getPortfolio)
            .mockResolvedValueOnce({ status: 202, data: { status: "generating" } } as never)
            .mockResolvedValue(portfolio() as never);
        renderPage();
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });

        expect(screen.getByText(/Generating the portfolio/)).toBeInTheDocument();
        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(screen.getByRole("heading", { name: "Contoh SQL" })).toBeInTheDocument();

        const calls = vi.mocked(sessionsApi.getPortfolio).mock.calls.length;
        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
        expect(vi.mocked(sessionsApi.getPortfolio).mock.calls.length).toBe(calls);
        expect(sessionsApi.regeneratePortfolio).not.toHaveBeenCalled();
    });

    it("explains a failed generation and retries only when asked", async () => {
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue(portfolio({ status: "failed", skills: [],
            errorMessage: "The AI model took too long to respond. Please retry." }) as never);
        vi.mocked(sessionsApi.regeneratePortfolio).mockResolvedValue({ data: {} } as never);
        await renderLoaded();

        const failed = screen.getByRole("note", { name: "Portfolio generation failed" });
        expect(failed).toHaveTextContent("The AI model took too long to respond.");
        expect(sessionsApi.regeneratePortfolio).not.toHaveBeenCalled();

        const retry = screen.getByRole("button", { name: "Retry generation" });
        retry.focus();
        fireEvent.click(retry);
        await waitFor(() => expect(sessionsApi.regeneratePortfolio).toHaveBeenCalledTimes(1));

        // The button is replaced by the generating notice, so focus moves to the heading.
        await screen.findByText(/Generating the portfolio/);
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Portfolio" }));
    });

    it("treats 404 as not found without saying whether the data exists", async () => {
        vi.mocked(sessionsApi.getPortfolio).mockRejectedValue(httpError(404));
        await renderLoaded();

        expect(screen.getByRole("alert")).toHaveTextContent("We could not find this portfolio");
    });

    it("recovers from a network error with Try again and moves focus to the heading", async () => {
        vi.mocked(sessionsApi.getPortfolio).mockRejectedValueOnce(networkError).mockResolvedValue(portfolio() as never);
        await renderLoaded();

        const tryAgain = screen.getByRole("button", { name: "Try again" });
        tryAgain.focus();
        fireEvent.click(tryAgain);

        await screen.findByRole("heading", { name: "Contoh SQL" });
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Portfolio" }));
    });

    it("after an override, refreshes the portfolio and announces the result politely", async () => {
        vi.mocked(portfoliosApi.getOverride).mockResolvedValue({ data: { override: overrideFixture() } } as never);
        await renderLoaded();
        const card = screen.getByRole("article", { name: "Contoh SQL" });

        fireEvent.click(within(card).getByRole("button", { name: "Override rating for Contoh SQL" }));
        fireEvent.click(screen.getByLabelText("L3"));
        fireEvent.change(screen.getByLabelText(/reason for the change/i), { target: { value: "Contoh alasan." } });
        const callsBefore = vi.mocked(sessionsApi.getPortfolio).mock.calls.length;
        fireEvent.click(screen.getByRole("button", { name: /save override/i }));

        const status = screen.getByRole("status", { name: "Review status" });
        await waitFor(() => expect(status).toHaveTextContent("Saved: Contoh SQL is now L3 (assessor override)."));
        expect(status).toHaveAttribute("aria-live", "polite");
        expect(status).toHaveTextContent(/fit\/gap narratives .* outdated/i);
        expect(vi.mocked(sessionsApi.getPortfolio).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it("returns focus to the opener when the dialog is cancelled", async () => {
        await renderLoaded();
        const trigger = within(screen.getByRole("article", { name: "Contoh SQL" })).getByRole("button", { name: "Override rating for Contoh SQL" });
        trigger.focus();
        fireEvent.click(trigger);

        fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(document.activeElement).toBe(trigger);
    });

    it("after confirming, moves focus to the card's rating button because Confirm disappears", async () => {
        vi.mocked(portfoliosApi.confirmRating).mockResolvedValue({ data: {} } as never);
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValueOnce(portfolio() as never)
            .mockResolvedValue(portfolio({ skills: [{ ...SQL, level_source: "assessor_confirmed", assessor_confirmed: true }, DESIGN, DOCKER] }) as never);
        await renderLoaded();
        const card = screen.getByRole("article", { name: "Contoh SQL" });

        fireEvent.click(within(card).getByRole("button", { name: "Confirm AI rating for Contoh SQL" }));
        fireEvent.click(await screen.findByRole("button", { name: "Confirm rating" }));

        await waitFor(() => expect(within(card).queryByRole("button", { name: "Confirm AI rating for Contoh SQL" })).not.toBeInTheDocument());
        await waitFor(() => expect(document.activeElement).toBe(within(card).getByRole("button", { name: "Override rating for Contoh SQL" })));
        expect(screen.getByRole("status", { name: "Review status" })).toHaveTextContent("Confirmed: Contoh SQL stays at L2");
    });

    it("on a 409 loads the latest portfolio when asked", async () => {
        vi.mocked(portfoliosApi.getOverride).mockRejectedValue(httpError(409, { errors: [{ status: 409, message: "changed" }] }));
        await renderLoaded();
        fireEvent.click(within(screen.getByRole("article", { name: "Contoh SQL" })).getByRole("button", { name: "Override rating for Contoh SQL" }));
        fireEvent.click(screen.getByLabelText("L3"));
        fireEvent.change(screen.getByLabelText(/reason for the change/i), { target: { value: "Contoh alasan." } });
        fireEvent.click(screen.getByRole("button", { name: /save override/i }));
        await screen.findByText(/changed by someone else/);
        const callsBefore = vi.mocked(sessionsApi.getPortfolio).mock.calls.length;

        fireEvent.click(screen.getByRole("button", { name: "Load the latest rating" }));

        await waitFor(() => expect(vi.mocked(sessionsApi.getPortfolio).mock.calls.length).toBe(callsBefore + 1));
        expect(screen.getByLabelText(/reason for the change/i)).toHaveValue("Contoh alasan.");
    });

    it("opens the fit/gap report for the chosen vacancy and focuses the picker from a #fit-gap link", async () => {
        await renderLoaded("/assessments/1/sessions/2/portfolio#fit-gap");

        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Vacancy" })));
        expect(screen.getByRole("button", { name: "Open fit/gap report" })).toBeDisabled();
    });

    it("uses icons with text, never emoji", async () => {
        await renderLoaded();

        expect(document.body.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}✅⭐⚠✏▼]/u);
    });
});
