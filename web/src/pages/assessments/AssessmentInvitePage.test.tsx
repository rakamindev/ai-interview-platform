import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "./AssessmentInvitePage";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  getSessions: vi.fn(),
  createSession: vi.fn(),
  regenerateInvite: vi.fn(),
}));

vi.mock("@/services/assessments", () => ({ assessmentsApi: mocks }));

const sessions = [
  {
    id: 3,
    assessment_id: 1,
    candidate_name: "Ayu Pratama",
    invite_token: "ayu",
    invite_url: "http://example.com/interview/ayu",
    status: "pending" as const,
  },
  {
    id: 2,
    assessment_id: 1,
    candidate_name: "Budi Santoso",
    invite_token: "budi",
    invite_url: "http://example.com/interview/budi",
    status: "ended" as const,
    end_reason: "error",
    error_message: "Connection failed",
  },
  {
    id: 1,
    assessment_id: 1,
    candidate_name: "Citra Dewi",
    invite_token: "citra",
    invite_url: "http://example.com/interview/citra",
    status: "ended" as const,
    end_reason: "manual_candidate",
  },
];

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
  it("searches candidates and filters them by status", async () => {
    mocks.get.mockResolvedValue({ data: { assessment: { id: 1, name: "Backend Engineer", time_limit_min: 30, skills: [] } } });
    mocks.getSessions.mockResolvedValue({ data: { sessions } });
    const user = userEvent.setup();
    renderPage();

    const search = await screen.findByPlaceholderText("Search candidate...");
    await user.type(search, "Ayu");
    expect(screen.getByText("Ayu Pratama")).toBeInTheDocument();
    expect(screen.queryByText("Budi Santoso")).not.toBeInTheDocument();

    await user.clear(search);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Failed" }));

    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.queryByText("Ayu Pratama")).not.toBeInTheDocument();
    expect(screen.queryByText("Citra Dewi")).not.toBeInTheDocument();
    expect(screen.getByText("(1 of 3)")).toBeInTheDocument();
  });
});
