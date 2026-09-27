import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentInvitePage from "./AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import type { Session } from "@/types";

vi.mock("@/services/assessments", () => ({
    assessmentsApi: { get: vi.fn(), getSessions: vi.fn() },
}));

const baseSession = {
    assessment_id: 3,
    invite_token: "test-token",
    invite_url: "http://localhost:5173/interview/test-token",
    end_reason: undefined,
    failure_code: null,
    failure_message: null,
};

function renderInvitePage(sessions: Session[]) {
    vi.mocked(assessmentsApi.get).mockResolvedValue({
        data: { assessment: { id: 3, name: "Jr. Frontend Engineer", time_limit_min: 10, skills: [] } },
    } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions } } as never);

    render(
        <MemoryRouter initialEntries={["/assessments/3/invite"]}>
            <Routes>
                <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("AssessmentInvitePage", () => {
    it("shows why an ended session failed", async () => {
        renderInvitePage([{
            ...baseSession, id: 1, candidate_name: "Test Candidate A", status: "ended", end_reason: "error",
            failure_code: "ai_connection_lost", failure_message: "Connection to the AI interviewer was lost",
        }]);

        expect(await screen.findByText("Failed")).toBeInTheDocument();
        expect(screen.getByText("Connection to the AI interviewer was lost")).toBeInTheDocument();
    });

    it("says the reason was not recorded for a failure from before reasons existed", async () => {
        renderInvitePage([{
            ...baseSession, id: 1, candidate_name: "Test Candidate A", status: "ended", end_reason: "error",
        }]);

        expect(await screen.findByText("Failed")).toBeInTheDocument();
        expect(screen.getByText("Reason not recorded")).toBeInTheDocument();
    });

    it("shows that a pending session could not start, and why, while keeping the invite link", async () => {
        renderInvitePage([{
            ...baseSession, id: 1, candidate_name: "Test Candidate A", status: "pending",
            failure_code: "assessment_invalid",
            failure_message: "Interview couldn't start: the assessment's skills need fixing (Skill 'RESTful API Design' is listed more than once)",
        }]);

        expect(await screen.findByText("Couldn't start")).toBeInTheDocument();
        expect(screen.getByText(/Skill 'RESTful API Design' is listed more than once/)).toBeInTheDocument();
        expect(screen.queryByText("Awaiting candidate")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Copy link/ })).toBeInTheDocument();
    });

    it("keeps showing a pending session without a failure as awaiting the candidate", async () => {
        renderInvitePage([{ ...baseSession, id: 1, candidate_name: "Test Candidate A", status: "pending" }]);

        expect(await screen.findByText("Awaiting candidate")).toBeInTheDocument();
    });
});
