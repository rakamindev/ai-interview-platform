import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: () => <div>hardware-check-stub</div>,
}));

function renderAtToken(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage — candidate identity disclosure (F-003)", () => {
  it("shows a disclaimer naming the candidate when candidate_name is present", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "Senior Frontend Engineer",
        time_limit_min: 45,
        session_status: "pending",
        candidate_name: "Budi Santoso",
      },
    } as any);

    renderAtToken("valid-token");

    await waitFor(() => {
      expect(screen.getByText(/Budi Santoso/)).toBeInTheDocument();
    });
    expect(screen.getByText(/if this is not you/i)).toBeInTheDocument();
  });

  it("shows no identity disclaimer when candidate_name is absent", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "Senior Frontend Engineer",
        time_limit_min: 45,
        session_status: "pending",
        candidate_name: null,
      },
    } as any);

    renderAtToken("valid-token");

    await waitFor(() => {
      expect(screen.getByText("hardware-check-stub")).toBeInTheDocument();
    });
    expect(screen.queryByText(/if this is not you/i)).not.toBeInTheDocument();
  });
});
