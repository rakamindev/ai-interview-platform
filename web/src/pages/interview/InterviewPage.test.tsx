import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import InterviewPage from "./InterviewPage";

const mocks = vi.hoisted(() => ({
  getCandidateInfo: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: mocks.getCandidateInfo,
  },
}));

describe("InterviewPage", () => {
  it("shows an honest failure state for a model connection error", async () => {
    mocks.getCandidateInfo.mockResolvedValue({
      data: {
        session_id: 7,
        role_title: "Backend Engineer",
        time_limit_min: 30,
        session_status: "ended",
        end_reason: "error",
        error_message: "The AI interview service could not be reached after several attempts.",
      },
    });

    render(
      <MemoryRouter initialEntries={["/interview/invite-token"]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Interview Couldn’t Be Completed" })).toBeInTheDocument();
    expect(screen.getByText(/AI interview service could not be reached/i)).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });
});
