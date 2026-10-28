import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CandidateHomePage from "@/pages/candidate/CandidateHomePage";
import { candidateApi } from "@/services/candidate";
import type { CandidateSession } from "@/types";

vi.mock("@/services/candidate", () => ({
    candidateApi: { mySessions: vi.fn() },
}));

const mySessions = vi.mocked(candidateApi.mySessions);

const session = (overrides: Partial<CandidateSession>): CandidateSession => ({
    id: 1,
    invite_token: "token-1",
    invite_url: "http://localhost:3001/interview/token-1",
    assessment_id: 1,
    role_title: "Backend engineer",
    time_limit_min: 45,
    status: "pending",
    created_at: "2026-10-27T09:00:00Z",
    ...overrides,
});

const responseWith = (sessions: CandidateSession[]) =>
    ({ data: { sessions } }) as unknown as Awaited<ReturnType<typeof candidateApi.mySessions>>;

const renderPage = () =>
    render(
        <MemoryRouter>
            <CandidateHomePage />
        </MemoryRouter>
    );

describe("CandidateHomePage dashboard", () => {
    beforeEach(() => {
        mySessions.mockReset();
    });

    it("groups the candidate's interviews by what they can do next", async () => {
        mySessions.mockResolvedValue(
            responseWith([
                session({ id: 1, status: "pending", role_title: "Backend engineer" }),
                session({
                    id: 2,
                    status: "active",
                    role_title: "Data engineer",
                    started_at: "2026-10-27T10:00:00Z",
                }),
                session({
                    id: 3,
                    status: "ended",
                    role_title: "QA engineer",
                    ended_at: "2026-10-26T10:00:00Z",
                    duration_seconds: 120,
                }),
            ])
        );

        renderPage();

        await waitFor(() => expect(screen.getByText("Backend engineer")).toBeInTheDocument());
        expect(screen.getByText("Data engineer")).toBeInTheDocument();
        expect(screen.getByText("QA engineer")).toBeInTheDocument();

        // Section headings, not the status badges repeated inside each row.
        expect(screen.getByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "In progress" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Completed" })).toBeInTheDocument();

        // Upcoming interviews can be started, live ones resumed.
        expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
    });

    it("shows an empty state when no interview is assigned", async () => {
        mySessions.mockResolvedValue(responseWith([]));

        renderPage();

        await waitFor(() => expect(screen.getByText("No interviews yet.")).toBeInTheDocument());
        expect(screen.queryByRole("heading", { name: "Upcoming" })).not.toBeInTheDocument();
    });

    it("explains itself instead of crashing when the list cannot be loaded", async () => {
        mySessions.mockRejectedValue(new Error("network down"));

        renderPage();

        await waitFor(() =>
            expect(screen.getByText(/couldn't load your interviews/i)).toBeInTheDocument()
        );
    });
});
