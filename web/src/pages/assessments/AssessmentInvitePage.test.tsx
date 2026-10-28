
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { getAssessment, getSessions, createSession } = vi.hoisted(() => ({
  getAssessment: vi.fn(),
  getSessions: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: getAssessment,
    getSessions,
    createSession,
  },
}));

import AssessmentInvitePage from "./AssessmentInvitePage";

describe("AssessmentInvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getAssessment.mockResolvedValue({
      data: {
        assessment: {
          id: 1,
          name: "Frontend Engineer Interview",
          time_limit_min: 30,
          skills: [
            { id: 1, skill_label: "React", expected_level: "intermediate" },
            { id: 2, skill_label: "TypeScript", expected_level: "intermediate" },
          ],
        },
      },
    });

    getSessions.mockResolvedValue({
      data: {
        sessions: [
          {
            id: 20,
            candidate_name: "Test Candidate",
            status: "ended",
            invite_url: "https://example.com/invite/test-token",
          },
        ],
      },
    });

    createSession.mockResolvedValue({
      data: {
        session: {
          id: 21,
          candidate_name: "New Candidate",
          status: "pending",
          invite_url: "https://example.com/invite/new-token",
        },
      },
    });
  });

  it("displays the assessment and existing candidate sessions", async () => {
    render(
      <MemoryRouter initialEntries={["/assessments/1/invite"]}>
        <Routes>
          <Route
            path="/assessments/:id/invite"
            element={<AssessmentInvitePage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Frontend Engineer Interview")
    ).toBeInTheDocument();

    expect(screen.getByText("Test Candidate")).toBeInTheDocument();

    expect(getAssessment).toHaveBeenCalledWith(1);
    expect(getSessions).toHaveBeenCalledWith(1);
  });
  it("creates an invite link for a candidate", async () => {
    const user = (await import("@testing-library/user-event")).default;
    const userEvent = user.setup();

    render(
      <MemoryRouter initialEntries={["/assessments/1/invite"]}>
        <Routes>
          <Route
            path="/assessments/:id/invite"
            element={<AssessmentInvitePage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Frontend Engineer Interview");

    await userEvent.click(
      screen.getByRole("button", { name: /undang kandidat/i })
    );

    await userEvent.type(
      document.getElementById("candidate-name")!,
      "New Candidate"
    );

    await userEvent.click(
      screen.getByRole("button", { name: /buat tautan undangan/i })
    );

    expect(
      await screen.findByText(/tautan undangan berhasil dibuat/i)
    ).toBeInTheDocument();

    expect(createSession).toHaveBeenCalledWith(1, "New Candidate");

    expect(
      screen.getByText("https://example.com/invite/new-token")
    ).toBeInTheDocument();
  });

  it("shows an error when invite creation fails", async () => {
    createSession.mockRejectedValueOnce(
      new Error("Network unavailable")
    );

    const user = (await import("@testing-library/user-event")).default;
    const userEvent = user.setup();

    render(
      <MemoryRouter initialEntries={["/assessments/1/invite"]}>
        <Routes>
          <Route
            path="/assessments/:id/invite"
            element={<AssessmentInvitePage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Frontend Engineer Interview");

    await userEvent.click(
      screen.getByRole("button", { name: /undang kandidat/i })
    );

    await userEvent.click(
      screen.getByRole("button", { name: /buat tautan undangan/i })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "Tautan undangan gagal dibuat. Periksa koneksi internet lalu coba lagi."
    );

    expect(createSession).toHaveBeenCalledWith(1, undefined);
  });

});
