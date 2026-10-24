import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AxiosResponse } from "axios";

import AssessmentInvitePage from "./AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment, Session } from "@/types";

vi.mock("@/services/assessments", () => ({
    assessmentsApi: {
        get: vi.fn(),
        getSessions: vi.fn(),
        createSession: vi.fn(),
    },
}));

const getAssessment = vi.mocked(assessmentsApi.get);
const getSessions = vi.mocked(assessmentsApi.getSessions);
const createSession = vi.mocked(assessmentsApi.createSession);

function ok<T>(data: T): AxiosResponse<T> {
    return { data } as AxiosResponse<T>;
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/assessments/2/invite"]}>
            <Routes>
                <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
            </Routes>
        </MemoryRouter>
    );
}

async function openDialogAndSubmit() {
    fireEvent.click(await screen.findByRole("button", { name: /invite candidate/i }));
    const input = await screen.findByLabelText(/candidate name/i);
    fireEvent.change(input, { target: { value: "Budi Santoso" } });
    fireEvent.click(screen.getByRole("button", { name: /create link/i }));
}

beforeEach(() => {
    vi.resetAllMocks();
    getAssessment.mockResolvedValue(
        ok({
            assessment: {
                id: 2,
                name: "Frontend Engineer Interview",
                time_limit_min: 45,
                skills: [],
            } as Assessment,
        })
    );
    getSessions.mockResolvedValue(ok({ sessions: [] }));
});

afterEach(() => {
    cleanup();
});

describe("AssessmentInvitePage invite dialog", () => {
    it("keeps the dialog open and shows an error when creation is rejected", async () => {
        createSession.mockRejectedValue({ isAxiosError: true, response: { status: 422 } });
        renderPage();

        await openDialogAndSubmit();

        expect(await screen.findByRole("alert")).toHaveTextContent(/rejected this invite/i);
        expect(screen.getByRole("button", { name: /create link/i })).toBeInTheDocument();
        expect(screen.queryByText(/link for/i)).not.toBeInTheDocument();
        expect(createSession).toHaveBeenCalledWith(2, "Budi Santoso");
    });

    it("keeps the dialog open and shows a connection error on network failures", async () => {
        createSession.mockRejectedValue(new Error("Network Error"));
        renderPage();

        await openDialogAndSubmit();

        expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't create the invite link/i);
        expect(screen.getByRole("button", { name: /create link/i })).toBeInTheDocument();
    });

    it("closes the dialog and shows the invite link when creation succeeds", async () => {
        createSession.mockResolvedValue(
            ok({
                session: {
                    id: 9,
                    candidate_name: "Budi Santoso",
                    invite_url: "http://localhost:5173/interview/abc123",
                    status: "pending",
                } as Session,
                invite_url: "http://localhost:5173/interview/abc123",
            })
        );
        renderPage();

        await openDialogAndSubmit();

        expect(await screen.findByText(/link for/i)).toBeInTheDocument();
        expect(screen.getByText("http://localhost:5173/interview/abc123")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /create link/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
