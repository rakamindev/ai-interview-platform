import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AssessmentInvitePage from "./AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

const mockedApi = vi.mocked(assessmentsApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/invite"]}>
      <Routes>
        <Route
          path="/assessments/:id/invite"
          element={<AssessmentInvitePage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

const assessment = {
  id: 1,
  name: "Senior Backend Engineer",
  time_limit_min: 45,
  skills: [],
  language: "en",
};

beforeEach(() => {
  vi.clearAllMocks();

  mockedApi.get.mockResolvedValue({
    data: { assessment },
  } as any);

  mockedApi.getSessions.mockResolvedValue({
    data: { sessions: [] },
  } as any);
});

describe("AssessmentInvitePage candidate invitation", () => {
  it("shows the generated invite link after successful creation", async () => {
    mockedApi.createSession.mockResolvedValue({
      data: {
        session: {
          id: 10,
          assessment_id: 1,
          candidate_name: "Budi Santoso",
          invite_url: "http://localhost:5173/interview/test-token",
          status: "pending",
        },
        invite_url: "http://localhost:5173/interview/test-token",
      },
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/i }));

    const input = await screen.findByLabelText("Candidate name");
    fireEvent.change(input, { target: { value: "Budi Santoso" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Link" }));

    await waitFor(() => {
      expect(
        screen.getByText("http://localhost:5173/interview/test-token")
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows an error when creation fails", async () => {
    mockedApi.createSession.mockRejectedValue(new Error("Network error"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/i }));

    const input = await screen.findByLabelText("Candidate name");
    fireEvent.change(input, { target: { value: "Budi Santoso" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Link" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Unable to create the invitation link. Please try again."
        )
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Link" })).toBeInTheDocument();
  });
});
