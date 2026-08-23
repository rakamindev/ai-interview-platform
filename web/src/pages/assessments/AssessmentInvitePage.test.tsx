import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "./AssessmentInvitePage";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  getSessions: vi.fn(),
  getVersions: vi.fn(),
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

  it("loads a captured rubric when an assessor clicks its session badge", async () => {
    api.getSessions.mockResolvedValue({
      data: {
        sessions: [{
          id: 10,
          assessment_id: 1,
          invite_token: "token",
          invite_url: "http://example.test/interview/token",
          status: "pending",
          rubric: { status: "captured", version: 1 },
        }],
      },
    });
    api.getVersions.mockResolvedValue({
      data: {
        versions: [{
          id: 101,
          rubric_version: 1,
          name: "Senior Frontend Engineer",
          time_limit_min: 45,
          language: "en",
          created_at: "2026-08-23T00:00:00Z",
          skills: [{ skill_id: "react", skill_label: "React", is_custom: false, expected_level: 3, display_order: 0, l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5" }],
        }],
      },
    });

    render(
      <MemoryRouter initialEntries={["/assessments/1/invite"]}>
        <Routes>
          <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "View changes for rubric version 1" }));

    expect(api.getVersions).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/Only rubric v1 has been captured so far/)).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });
});
