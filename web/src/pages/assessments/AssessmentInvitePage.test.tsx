import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import type { Session } from "@/types";
import { showRequestError } from "@/lib/requestToast";
vi.mock("@/services/assessments", () => ({
    assessmentsApi: { get: vi.fn(), getSessions: vi.fn(), createSession: vi.fn() },
}));
vi.mock("@/lib/requestToast", () => ({ showRequestError: vi.fn() }));
const ASSESSMENT = {
    id: 2,
    name: "Backend Screen",
    time_limit_min: 45,
    language: "en" as const,
    skills: [],
};

const SESSION = {
    id: 11,
    status: "pending",
    candidate_name: "Budi",
    invite_url: "http://localhost:5173/interview/tok-123",
} as Session;

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/assessments/2/invite"]}>
            <Routes>
                <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
            </Routes>
        </MemoryRouter>
    );
}

async function openInviteDialog() {
    await screen.findByText("Backend Screen");
    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    return screen.findByRole("dialog");
}

describe("AssessmentInvitePage failure handling", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment: ASSESSMENT } } as never);
        vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions: [] } } as never);
    });

    it("reports a load failure with retry", async () => {
        vi.mocked(assessmentsApi.get).mockRejectedValueOnce(new Error("offline"));
        vi.mocked(assessmentsApi.getSessions).mockRejectedValueOnce(new Error("offline"));
        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "We could not load this assessment's invitations."
        );

        vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment: ASSESSMENT } } as never);
        vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions: [] } } as never);
        fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

        expect(await screen.findByText("Backend Screen")).toBeInTheDocument();
    });

    it("keeps the invite dialog open and explains the failure", async () => {
        vi.mocked(assessmentsApi.createSession).mockRejectedValue({
            response: { status: 422, data: { errors: [{ message: "Candidate name is too long" }] } },
        });
        renderPage();

        const dialog = await openInviteDialog();
        fireEvent.change(within(dialog).getByLabelText("Candidate name"), { target: { value: "Budi" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Create Link" }));

        await waitFor(() =>
            expect(showRequestError).toHaveBeenCalledWith(
                expect.objectContaining({ response: expect.any(Object) }),
                "Couldn’t create the invite link. Please try again."
            )
        );
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Budi")).toBeInTheDocument();
        expect(assessmentsApi.createSession).toHaveBeenCalledWith(2, "Budi");
    });

    it("falls back to showing the link when the browser refuses to copy", async () => {
        vi.mocked(assessmentsApi.createSession).mockResolvedValue({ data: { session: SESSION } } as never);
        renderPage();

        const dialog = await openInviteDialog();
        fireEvent.click(within(dialog).getByRole("button", { name: "Create Link" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        const copy = await screen.findByRole("button", { name: "Copy invite link" });
        fireEvent.click(copy);

        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent("http://localhost:5173/interview/tok-123")
        );
    });
});
