import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AssessmentEditPage from "./AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { get: vi.fn(), update: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/edit"]}>
      <Routes>
        <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a not-found state instead of a blank form when the assessment 404s", async () => {
    (assessmentsApi.get as any).mockRejectedValue({ response: { status: 404 } });

    renderPage();

    expect(await screen.findByText(/assessment not found/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/role title/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error message on a non-404 failure", async () => {
    (assessmentsApi.get as any).mockRejectedValue({ response: { status: 500 } });

    renderPage();

    expect(await screen.findByText(/failed to load assessment/i)).toBeInTheDocument();
  });

  it("renders the form pre-filled when the assessment loads successfully", async () => {
    (assessmentsApi.get as any).mockResolvedValue({
      data: {
        assessment: {
          id: 1,
          name: "Backend Engineer",
          time_limit_min: 45,
          skills: [],
        },
      },
    });

    renderPage();

    expect(await screen.findByDisplayValue("Backend Engineer")).toBeInTheDocument();
  });
});
