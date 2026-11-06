import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "./InterviewPage";

const getCandidateInfo = vi.fn();
const giveConsent = vi.fn();

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: (...args: unknown[]) => getCandidateInfo(...args),
    giveConsent: (...args: unknown[]) => giveConsent(...args),
    audioComplete: vi.fn(),
  },
}));

// Device checks need real media APIs, which jsdom does not provide.
vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart?: () => void }) => (
    <button onClick={onStart}>Start Interview</button>
  ),
}));

function renderInterview(token = "token-123") {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function inviteError(code: string, status = 410) {
  return {
    response: {
      status,
      data: { errors: [{ status, message: "rejected", code }] },
    },
  };
}

describe("InterviewPage invite states", () => {
  beforeEach(() => {
    getCandidateInfo.mockReset();
    giveConsent.mockReset();
  });

  it("shows an expired state instead of a fake completion screen", async () => {
    getCandidateInfo.mockRejectedValue(inviteError("invite_expired"));

    renderInterview();

    expect(await screen.findByTestId("access-title")).toHaveTextContent("expired");
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Wawancara Selesai")).not.toBeInTheDocument();
  });

  it("shows a revoked state with an explanation", async () => {
    getCandidateInfo.mockRejectedValue(inviteError("invite_revoked"));

    renderInterview();

    expect(await screen.findByTestId("access-title")).toHaveTextContent("cancelled");
  });

  it("requires consent before offering the device check", async () => {
    const user = userEvent.setup();

    getCandidateInfo.mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "Senior Frontend Engineer",
        time_limit_min: 30,
        session_status: "pending",
        language: "en",
        invite_status: "pending",
        consent_required: true,
        consent_given_at: null,
      },
    });
    giveConsent.mockResolvedValue({
      data: { consent_given_at: new Date().toISOString(), consent_required: false },
    });

    renderInterview();

    expect(await screen.findByText("Before you begin")).toBeInTheDocument();
    expect(screen.queryByText("Start Interview")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("consent-checkbox"));
    await user.click(screen.getByTestId("consent-continue"));

    await waitFor(() => expect(giveConsent).toHaveBeenCalledWith("token-123"));
    expect(await screen.findByRole("heading", { name: "Senior Frontend Engineer" })).toBeInTheDocument();
  });

  it("skips consent when it was already recorded", async () => {
    getCandidateInfo.mockResolvedValue({
      data: {
        session_id: 2,
        role_title: "Backend Engineer",
        time_limit_min: 25,
        session_status: "pending",
        language: "id",
        invite_status: "pending",
        consent_required: false,
        consent_given_at: "2026-11-01T10:00:00Z",
      },
    });

    renderInterview();

    expect(await screen.findByText(/Mikrofon Anda aktif/)).toBeInTheDocument();
    expect(screen.queryByText("Sebelum memulai")).not.toBeInTheDocument();
  });
});
