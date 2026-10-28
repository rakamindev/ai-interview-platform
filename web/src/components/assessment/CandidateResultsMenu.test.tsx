import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CandidateResultsMenu from "@/components/assessment/CandidateResultsMenu";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { httpError } from "@/test/portfolioFixtures";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { exportPortfolio: vi.fn() } }));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: vi.fn() } }));

function Where() {
    const location = useLocation();
    return <p data-testid="where">{location.pathname + location.hash}</p>;
}

function renderMenu() {
    render(
        <MemoryRouter initialEntries={["/assessments/1/invite"]}>
            <Routes>
                <Route path="*" element={<><CandidateResultsMenu assessmentId="1" sessionId={2} candidateName="Kandidat Contoh A" /><Where /></>} />
            </Routes>
        </MemoryRouter>,
    );
}

// The candidate row offers the main next step directly and lists the rest
// in a menu, so assessors can see what is available.
describe("CandidateResultsMenu", () => {
    afterEach(() => vi.clearAllMocks());

    async function openMenu() {
        const trigger = screen.getByRole("button", { name: "More results for Kandidat Contoh A" });
        trigger.focus();
        fireEvent.keyDown(trigger, { key: "Enter" });
        return screen.findAllByRole("menuitem");
    }

    it("opens the portfolio review directly", () => {
        renderMenu();

        fireEvent.click(screen.getByRole("button", { name: "Review results for Kandidat Contoh A" }));

        expect(screen.getByTestId("where")).toHaveTextContent("/assessments/1/sessions/2/portfolio");
    });

    it("lists the other results in a keyboard-operable menu", async () => {
        renderMenu();

        const items = await openMenu();
        expect(items.map((item) => item.textContent)).toEqual(["Portfolio and review", "Fit/Gap report", "Transcript", "Export PDF"]);

        fireEvent.click(screen.getByRole("menuitem", { name: "Fit/Gap report" }));
        expect(screen.getByTestId("where")).toHaveTextContent("/assessments/1/sessions/2/portfolio#fit-gap");
    });

    it("says so when the PDF export from the list fails", async () => {
        vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({ data: { portfolio: { id: 5 } } } as never);
        vi.mocked(portfoliosApi.exportPortfolio).mockRejectedValue(httpError(500));
        renderMenu();
        await openMenu();

        fireEvent.click(screen.getByRole("menuitem", { name: "Export PDF" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("The PDF could not be created. Open the results and try again.");
    });
});
