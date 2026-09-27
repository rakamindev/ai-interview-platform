import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessmentListPage from "./AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
    assessmentsApi: { list: vi.fn() },
}));

function renderListPage(latestSession: object) {
    vi.mocked(assessmentsApi.list).mockResolvedValue({
        data: { assessments: [{ id: 1, name: "Backend Engineer", time_limit_min: 10, latest_session: latestSession }] },
    } as never);
    render(
        <MemoryRouter>
            <AssessmentListPage />
        </MemoryRouter>,
    );
}

describe("AssessmentListPage", () => {
    it("shows that the latest candidate could not start, and why", async () => {
        renderListPage({
            id: 5, status: "pending", end_reason: null,
            failure_code: "assessment_invalid", failure_message: "Assessment needs fixing (duplicate skills).",
        });

        expect(await screen.findByText(/Couldn't start/)).toBeInTheDocument();
        expect(screen.getByText(/Assessment needs fixing \(duplicate skills\)\./)).toBeInTheDocument();
        expect(screen.queryByText("Awaiting candidate")).not.toBeInTheDocument();
    });

    it("shows why the latest session failed", async () => {
        renderListPage({
            id: 5, status: "ended", end_reason: "error",
            failure_code: "candidate_disconnected", failure_message: "Candidate disconnected.",
        });

        expect(await screen.findByText(/Last: failed/)).toBeInTheDocument();
        expect(screen.getByText(/Candidate disconnected\./)).toBeInTheDocument();
    });

    it("says the reason was not recorded for an older failure", async () => {
        renderListPage({ id: 5, status: "ended", end_reason: "error", failure_code: null, failure_message: null });

        expect(await screen.findByText(/Last: failed/)).toBeInTheDocument();
        expect(screen.getByText(/Reason not recorded/)).toBeInTheDocument();
    });
});
