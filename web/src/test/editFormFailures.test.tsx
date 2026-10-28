import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { networkError } from "@/test/portfolioFixtures";
import { ASSESSMENT, VACANCY, ok, renderAt } from "@/test/pageHarness";

vi.mock("@/services/assessments", () => ({
    assessmentsApi: { get: vi.fn(), getSessions: vi.fn(), update: vi.fn(), createSession: vi.fn() },
}));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { get: vi.fn(), update: vi.fn() } }));
vi.mock("@/services/skillTaxonomies", () => ({ skillTaxonomiesApi: { list: vi.fn() } }));

afterEach(() => vi.resetAllMocks());

// A failed load used to be swallowed (.catch(() => {})), leaving an empty form
// whose Save sent the empty values over the real record. Failed saves were
// silent too.
describe("edit forms when loading fails", () => {
    it("shows an error instead of an empty assessment form that could be saved, and retries", async () => {
        vi.mocked(assessmentsApi.get).mockRejectedValueOnce(networkError).mockResolvedValueOnce(ok({ assessment: ASSESSMENT }));
        renderAt("/assessments/1/edit", "/assessments/:id/edit", <AssessmentEditPage />);

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Could not load this assessment");
        expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Role title/)).not.toBeInTheDocument();

        fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
        expect(await screen.findByLabelText(/Role title/)).toHaveValue("Contoh Assessment Backend");
        expect(assessmentsApi.update).not.toHaveBeenCalled();
    });

    it("shows an error instead of an empty vacancy form that could be saved", async () => {
        vi.mocked(vacanciesApi.get).mockRejectedValue(networkError);
        renderAt("/vacancies/9/edit", "/vacancies/:id/edit", <VacancyEditPage />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this vacancy");
        expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
        expect(vacanciesApi.update).not.toHaveBeenCalled();
    });
});

describe("overwriting after a failed load", () => {
    it("cannot send empty culture and competency text over a vacancy that failed to load", async () => {
        vi.mocked(vacanciesApi.get).mockRejectedValue(networkError);
        renderAt("/vacancies/9/edit", "/vacancies/:id/edit", <VacancyEditPage />);
        await screen.findByText(/Could not load this vacancy|Role title/);

        // What an assessor would do with the old empty form: fill the required
        // title (the first text box; the old label was not linked to it) and
        // save. With the error state there is nothing to fill in.
        const title = screen.queryAllByRole("textbox")[0];
        if (title) {
            fireEvent.change(title, { target: { value: "Contoh Judul Baru" } });
            fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(vacanciesApi.update).not.toHaveBeenCalled();
    });
});

describe("failed saves", () => {
    it("tells the user when saving a vacancy fails", async () => {
        vi.mocked(vacanciesApi.get).mockResolvedValue(ok({ vacancy: VACANCY }));
        vi.mocked(vacanciesApi.update).mockRejectedValue(networkError);
        renderAt("/vacancies/9/edit", "/vacancies/:id/edit", <VacancyEditPage />);

        fireEvent.click(await screen.findByRole("button", { name: "Save Changes" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Failed to save vacancy.");
    });

    it("tells the user when creating an invite link fails", async () => {
        vi.mocked(assessmentsApi.get).mockResolvedValue(ok({ assessment: ASSESSMENT }));
        vi.mocked(assessmentsApi.getSessions).mockResolvedValue(ok({ sessions: [] }));
        vi.mocked(assessmentsApi.createSession).mockRejectedValue(networkError);
        renderAt("/assessments/1/invite", "/assessments/:id/invite", <AssessmentInvitePage />);

        fireEvent.click(await screen.findByRole("button", { name: "Invite Candidate" }));
        fireEvent.click(await screen.findByRole("button", { name: "Create Link" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Could not create the invite link");
    });
});
