import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import { candidatesApi } from "@/services/candidates";
import type { Assessment, Session } from "@/types";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

vi.mock("@/services/candidates", () => ({
  candidatesApi: {
    list: vi.fn(),
  },
}));

const getMock = vi.mocked(assessmentsApi.get);
const getSessionsMock = vi.mocked(assessmentsApi.getSessions);
const createSessionMock = vi.mocked(assessmentsApi.createSession);
const listCandidatesMock = vi.mocked(candidatesApi.list);

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 1,
    name: "Backend Engineer",
    time_limit_min: 30,
    skills: [],
    ...overrides,
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 5,
    assessment_id: 1,
    invite_token: "xyz789",
    invite_url: "http://backend-host:3001/interview/xyz789",
    status: "pending",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/invite"]}>
      <Routes>
        <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue({ data: { assessment: assessment() } } as any);
  getSessionsMock.mockResolvedValue({ data: { sessions: [] } } as any);
  listCandidatesMock.mockResolvedValue({
    data: { candidates: [], meta: { current_page: 1, total_pages: 1, total_count: 0, per_page: 10 } },
  } as any);
});

describe("AssessmentInvitePage invite link", () => {
  it("displays the new invite link built from the frontend's own origin, not the backend's invite_url", async () => {
    createSessionMock.mockResolvedValue({
      data: { session: session(), invite_url: "http://backend-host:3001/interview/xyz789" },
    } as any);

    renderPage();
    await screen.findByText("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create Link" }));

    expect(await screen.findByText(`${window.location.origin}/interview/xyz789`)).toBeInTheDocument();
    expect(screen.queryByText("http://backend-host:3001/interview/xyz789")).not.toBeInTheDocument();
  });

  it("copies the frontend-origin link, not the backend's invite_url", async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    createSessionMock.mockResolvedValue({
      data: { session: session(), invite_url: "http://backend-host:3001/interview/xyz789" },
    } as any);

    renderPage();
    await screen.findByText("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create Link" }));
    await screen.findByText("Copy link");

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/interview/xyz789`)
    );
  });
});
