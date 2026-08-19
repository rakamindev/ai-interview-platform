import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import AssessmentInvitePage from "./AssessmentInvitePage";
import type { Assessment, Session } from "@/types";

const { assessmentsApiMock, sessionsApiMock } = vi.hoisted(() => ({
  assessmentsApiMock: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getSystemPrompt: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
  sessionsApiMock: { revoke: vi.fn() },
}));

vi.mock("@/services/assessments", () => ({ assessmentsApi: assessmentsApiMock }));
vi.mock("@/services/sessions", () => ({ sessionsApi: sessionsApiMock }));

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 5,
    name: "Backend Engineer",
    role_title: "Backend Engineer",
    time_limit_min: 30,
    skills: [{ id: 1, skill_label: "SQL", expected_level: 3 }],
    ...overrides,
  } as unknown as Assessment;
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 11,
    status: "pending",
    candidate_name: "Budi Santoso",
    invite_url: "https://invite.test/abc",
    ...overrides,
  } as unknown as Session;
}

function renderInvite(initialState?: unknown) {
  renderWithProviders(
    <Routes>
      <Route path="/assessments" element={<div>LIST PAGE</div>} />
      <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
      <Route path="/assessments/:id/edit" element={<div>EDIT PAGE</div>} />
      <Route path="/assessments/:id/sessions/:sid/monitor" element={<div>MONITOR PAGE</div>} />
      <Route path="/assessments/:id/sessions/:sid/portfolio" element={<div>PORTFOLIO PAGE</div>} />
      <Route
        path="/assessments/:id/sessions/:sid/transcript"
        element={<div>TRANSCRIPT PAGE</div>}
      />
    </Routes>,
    {
      route: "/assessments/5/invite",
      initialEntries: initialState
        ? [{ pathname: "/assessments/5/invite", state: initialState }]
        : undefined,
    },
  );
}

describe("AssessmentInvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assessmentsApiMock.get.mockResolvedValue({ data: { assessment: assessment() } });
    assessmentsApiMock.getSessions.mockResolvedValue({ data: { sessions: [] } });
  });

  it("loads and renders the assessment header and session list", async () => {
    assessmentsApiMock.getSessions.mockResolvedValue({
      data: {
        sessions: [
          session({ id: 1, status: "pending" }),
          session({ id: 2, status: "active" }),
          session({ id: 3, status: "ended", end_reason: "completed" }),
          session({ id: 4, status: "ended", end_reason: "error" }),
        ],
      },
    });
    renderInvite();

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText(/30 min · 1 skills/)).toBeInTheDocument();
    expect(screen.getByText("Awaiting candidate")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(screen.getByText(/expected/)).toBeInTheDocument();
  });

  it("renders the empty state when there are no sessions", async () => {
    renderInvite();

    expect(await screen.findByText("No candidates yet")).toBeInTheDocument();
  });

  it("shows the retry state on load failure and retries", async () => {
    assessmentsApiMock.get.mockRejectedValueOnce(new Error("boom"));
    renderInvite();

    expect(await screen.findByText("Failed to load this assessment.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
  });

  it("creates an invite link for a named candidate", async () => {
    assessmentsApiMock.createSession.mockResolvedValue({
      data: {
        session: session({ id: 99, candidate_name: "Siti" }),
        invite_url: "https://invite.test/new",
      },
    });
    renderInvite();
    await screen.findByText("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    fireEvent.change(screen.getByLabelText("Candidate name"), { target: { value: "Siti" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Link" }));

    expect(await screen.findByText(/ready — share with your candidate/)).toBeInTheDocument();
    expect(assessmentsApiMock.createSession).toHaveBeenCalledWith(5, "Siti");
    expect(screen.getAllByText("Siti").length).toBeGreaterThanOrEqual(2);
  });

  it("creates a session without a candidate name", async () => {
    assessmentsApiMock.createSession.mockResolvedValue({
      data: {
        session: session({ id: 98, candidate_name: undefined }),
        invite_url: "https://invite.test/anon",
      },
    });
    renderInvite();
    await screen.findByText("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create Link" }));

    expect(await screen.findByText(/New invite link ready/)).toBeInTheDocument();
    expect(assessmentsApiMock.createSession).toHaveBeenCalledWith(5, undefined);
  });

  it("copies the invite link to the clipboard", async () => {
    assessmentsApiMock.getSessions.mockResolvedValue({
      data: { sessions: [session({ id: 1 })] },
    });
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    renderInvite();

    fireEvent.click(await screen.findByRole("button", { name: /Copy link/ }));
    expect(writeText).toHaveBeenCalledWith("https://invite.test/abc");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    writeText.mockRestore();
  });

  it("revokes a pending invite after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    sessionsApiMock.revoke.mockResolvedValue({
      data: { session: session({ id: 1, revoked: true }) },
    });
    assessmentsApiMock.getSessions.mockResolvedValue({ data: { sessions: [session({ id: 1 })] } });
    renderInvite();

    fireEvent.click(await screen.findByRole("button", { name: /Revoke/ }));
    expect(await screen.findByText("Revoked")).toBeInTheDocument();
    expect(sessionsApiMock.revoke).toHaveBeenCalledWith(1);
    confirmSpy.mockRestore();
  });

  it("does not revoke when the confirmation is dismissed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    assessmentsApiMock.getSessions.mockResolvedValue({ data: { sessions: [session({ id: 1 })] } });
    renderInvite();

    fireEvent.click(await screen.findByRole("button", { name: /Revoke/ }));
    await waitFor(() => expect(sessionsApiMock.revoke).not.toHaveBeenCalled());
  });

  it("shows an action error when revoking fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    sessionsApiMock.revoke.mockRejectedValue(new Error("boom"));
    assessmentsApiMock.getSessions.mockResolvedValue({ data: { sessions: [session({ id: 1 })] } });
    renderInvite();

    fireEvent.click(await screen.findByRole("button", { name: /Revoke/ }));
    expect(
      await screen.findByText("Failed to revoke the invite. Please try again."),
    ).toBeInTheDocument();
  });

  it("marks expired pending sessions as expired without invite actions", async () => {
    assessmentsApiMock.getSessions.mockResolvedValue({
      data: {
        sessions: [session({ id: 1, expires_at: "2020-01-01T00:00:00Z", status: "pending" })],
      },
    });
    renderInvite();

    expect(await screen.findByText("Expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy link/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it("navigates to monitor, portfolio and transcript views from session rows", async () => {
    assessmentsApiMock.getSessions.mockResolvedValue({
      data: {
        sessions: [
          session({ id: 1, status: "active" }),
          session({ id: 2, status: "ended", end_reason: "completed" }),
        ],
      },
    });
    renderInvite();

    fireEvent.click(await screen.findByRole("button", { name: /Monitor/ }));
    expect(screen.getByText("MONITOR PAGE")).toBeInTheDocument();
  });

  it("opens the edit page from the header action", async () => {
    renderInvite();
    await screen.findByText("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.getByText("EDIT PAGE")).toBeInTheDocument();
  });

  it("surfaces an invite link created together with the assessment", async () => {
    renderInvite({
      createdSession: session({
        id: 77,
        candidate_name: "Dewi",
        invite_url: "https://invite.test/77",
      }),
    });

    expect(await screen.findByText(/ready — share with your candidate/)).toBeInTheDocument();
  });

  it("shows the start date of a session", async () => {
    assessmentsApiMock.getSessions.mockResolvedValue({
      data: {
        sessions: [session({ id: 1, status: "active", started_at: "2026-08-01T10:00:00Z" })],
      },
    });
    renderInvite();

    expect(await screen.findByText(/8\/1\/2026/)).toBeInTheDocument();
  });

  it("shows the revoked badge and hides invite actions", async () => {
    assessmentsApiMock.getSessions.mockResolvedValue({
      data: { sessions: [session({ id: 1, status: "pending", revoked: true })] },
    });
    renderInvite();

    expect(await screen.findByText("Revoked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy link/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it("copies the newly created invite link", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    assessmentsApiMock.createSession.mockResolvedValue({
      data: {
        session: session({ id: 99, candidate_name: "Siti", invite_url: "https://invite.test/new" }),
        invite_url: "https://invite.test/new",
      },
    });
    renderInvite();
    await screen.findByText("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create Link" }));
    await screen.findByText(/ready — share with your candidate/);

    fireEvent.click(screen.getAllByRole("button", { name: /Copy link/ })[0]);
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("https://invite.test/new");
    writeText.mockRestore();
  });

  it("creates the invite when the candidate name input is submitted with Enter", async () => {
    assessmentsApiMock.createSession.mockResolvedValue({
      data: {
        session: session({ id: 99, candidate_name: "Siti" }),
        invite_url: "https://invite.test/new",
      },
    });
    renderInvite();
    await screen.findByText("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    fireEvent.keyDown(screen.getByLabelText("Candidate name"), { key: "Enter" });

    expect(await screen.findByText(/ready — share with your candidate/)).toBeInTheDocument();
    expect(assessmentsApiMock.createSession).toHaveBeenCalledWith(5, undefined);
  });

  it("dismisses the invite dialog without creating a session", async () => {
    renderInvite();
    await screen.findByText("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Candidate name")).not.toBeInTheDocument();
    expect(assessmentsApiMock.createSession).not.toHaveBeenCalled();
  });

  it("hides the skills section when the assessment has no skills", async () => {
    assessmentsApiMock.get.mockResolvedValue({
      data: { assessment: assessment({ skills: [] }) },
    });
    renderInvite();
    await screen.findByText("Backend Engineer");

    expect(screen.queryByText("Skills assessed")).not.toBeInTheDocument();
  });
});
