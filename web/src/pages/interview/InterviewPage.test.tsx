import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import InterviewPage from "./InterviewPage";
import { sessionsApi } from "@/services/sessions";

// HardwareCheck pulls in getUserMedia/AudioContext, neither of which jsdom
// implements — irrelevant to what these tests cover (the candidate-info
// fetch failure path), so it's stubbed out rather than polyfilling the Web
// Audio API just to let the component mount.
vi.mock("@/components/HardwareCheck", () => ({
  default: () => null,
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
  },
}));

function renderAt(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage", () => {
  // Regression: assessment/gap-analysis.md P0-3 — a broken/expired invite
  // link, or the backend being down, used to render the exact same
  // "Interview Complete — thank you" screen as a real successful finish.
  it("shows an explicit error screen when candidate info fails to load, not the completion screen", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue(new Error("network error"));

    renderAt("bad-token");

    expect(await screen.findByText("This interview link isn't working")).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("still shows the real completion screen for a session that has actually ended", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "Senior Engineer",
        time_limit_min: 45,
        session_status: "ended",
      },
    } as any);

    renderAt("good-token");

    expect(await screen.findByText("Interview Complete")).toBeInTheDocument();
    expect(screen.queryByText("This interview link isn't working")).not.toBeInTheDocument();
  });
});
