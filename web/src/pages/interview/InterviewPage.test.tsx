import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError } from "axios";

import InterviewPage from "./InterviewPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

const mockedGetCandidateInfo = vi.mocked(sessionsApi.getCandidateInfo);

function renderInterview(token = "test-token") {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage candidate entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while candidate information is being fetched", async () => {
    mockedGetCandidateInfo.mockReturnValue(
      new Promise(() => {}) as ReturnType<typeof sessionsApi.getCandidateInfo>
    );

    renderInterview();

    expect(screen.getByText("Loading interview...")).toBeInTheDocument();
  });

  it("shows the interview setup when the invitation is valid", async () => {
    mockedGetCandidateInfo.mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "Senior Full Stack Engineer",
        time_limit_min: 45,
        session_status: "pending",
      },
    } as any);

    renderInterview();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Senior Full Stack Engineer" })).toBeInTheDocument();
    });

    expect(screen.getByText("45 minutes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeInTheDocument();
  });

  it("shows an invalid invitation error for a 404 response", async () => {
    const error = new AxiosError(
      "Request failed with status code 404",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: {} as any,
        data: {
          errors: [
            {
              status: 404,
              message: "Invalid or expired invite token",
            },
          ],
        },
      }
    );

    mockedGetCandidateInfo.mockRejectedValue(error);

    renderInterview("invalid-token");

    await waitFor(() => {
      expect(
        screen.getByText("Invalid or expired invitation")
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("does not treat API failures as a completed interview", async () => {
    mockedGetCandidateInfo.mockRejectedValue(new Error("Network error"));

    renderInterview();

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load your interview")
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });
});
