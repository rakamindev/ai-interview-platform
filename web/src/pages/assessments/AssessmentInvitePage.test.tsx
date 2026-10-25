import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AssessmentInvitePage from "./AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/invite"]}>
      <Routes>
        <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentInvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a not-found state instead of a broken page when the assessment 404s", async () => {
    (assessmentsApi.get as any).mockRejectedValue({ response: { status: 404 } });
    (assessmentsApi.getSessions as any).mockRejectedValue({ response: { status: 404 } });

    renderPage();

    expect(await screen.findByText("Assessment not found")).toBeInTheDocument();
    expect(screen.queryByText(/invite candidate/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error message on a non-404 failure", async () => {
    (assessmentsApi.get as any).mockRejectedValue({ response: { status: 500 } });
    (assessmentsApi.getSessions as any).mockRejectedValue({ response: { status: 500 } });

    renderPage();

    expect(await screen.findByText(/failed to load assessment/i)).toBeInTheDocument();
  });

  it("renders the assessment and its sessions when loaded successfully", async () => {
    (assessmentsApi.get as any).mockResolvedValue({
      data: { assessment: { id: 1, name: "Backend Engineer", time_limit_min: 45, skills: [] } },
    });
    (assessmentsApi.getSessions as any).mockResolvedValue({ data: { sessions: [] } });

    renderPage();

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText(/no candidates yet/i)).toBeInTheDocument();
  });

  it("shows an inline error instead of failing silently when invite creation fails", async () => {
    (assessmentsApi.get as any).mockResolvedValue({
      data: { assessment: { id: 1, name: "Backend Engineer", time_limit_min: 45, skills: [] } },
    });
    (assessmentsApi.getSessions as any).mockResolvedValue({ data: { sessions: [] } });
    (assessmentsApi.createSession as any).mockRejectedValue({ response: { status: 404 } });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /invite candidate/i }));
    fireEvent.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to create invite link/i)).toBeInTheDocument()
    );
  });
});
