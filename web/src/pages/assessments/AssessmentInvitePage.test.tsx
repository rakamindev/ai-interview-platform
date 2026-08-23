import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "./AssessmentInvitePage";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  getSessions: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/services/assessments", () => ({
  assessmentsApi: api,
}));

describe("AssessmentInvitePage", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({
      data: {
        assessment: {
          id: 1,
          name: "Senior Frontend Engineer",
          time_limit_min: 45,
          skills: [],
        },
      },
    });
    api.getSessions.mockResolvedValue({ data: { sessions: [] } });
    api.createSession.mockRejectedValue({
      response: {
        data: {
          errors: [{ message: "Assessment must include at least one skill before inviting a candidate" }],
        },
      },
    });
  });

  it("keeps the dialog open and shows a backend rubric-validation error", async () => {
    render(
      <MemoryRouter initialEntries={["/assessments/1/invite"]}>
        <Routes>
          <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Senior Frontend Engineer");
    fireEvent.click(screen.getByRole("button", { name: "Invite Candidate" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create Link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Assessment must include at least one skill before inviting a candidate"
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
