import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, afterEach } from "vitest";
import AssessmentEditPage from "../AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { get: vi.fn(), update: vi.fn() },
}));

const assessment = {
  id: 5,
  name: "Backend Engineer",
  time_limit_min: 45,
  language: "en",
  skills: [{ id: 1, skill_label: "Ruby on Rails", is_custom: false, expected_level: 3, display_order: 0 }],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/5/edit"]}>
      <Routes>
        <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AssessmentEditPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows a retryable error instead of an empty form when loading fails", async () => {
    vi.mocked(assessmentsApi.get)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ data: { assessment } } as any);

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load this assessment");
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByDisplayValue("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(assessmentsApi.get).toHaveBeenCalledTimes(2);
  });

  it("points the breadcrumb back to the assessment it is editing", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment } } as any);

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue("Backend Engineer")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Assessment" })).toHaveAttribute("href", "/assessments/5/invite");
    // Language cannot be changed after creation.
    expect(screen.queryByText("Interview language")).not.toBeInTheDocument();
  });
});
