import { describe, it, expect, vi, beforeEach } from "vitest";
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

function apiErrorWithCode(code: string, status = 404) {
  return {
    response: {
      status,
      data: { errors: [{ status, message: "irrelevant", code }] },
    },
  };
}

describe("InterviewPage — invite expiry states", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset();
  });

  it("shows an 'invite expired' state distinct from the completed-interview state", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue(apiErrorWithCode("invite_expired"));

    renderAtToken("some-expired-token");

    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hardware-check-stub/i)).not.toBeInTheDocument();
  });

  it("shows an 'invalid link' state for a token that was never found, distinct from expired", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue(apiErrorWithCode("invite_not_found"));

    renderAtToken("garbage-token");

    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/expired/i)).not.toBeInTheDocument();
  });

  it("still renders the normal hardware-check flow for a valid, non-expired invite", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "Senior Frontend Engineer",
        time_limit_min: 45,
        session_status: "pending",
      },
    } as any);

    renderAtToken("valid-token");

    await waitFor(() => {
      expect(screen.getByText("hardware-check-stub")).toBeInTheDocument();
    });
  });
});
