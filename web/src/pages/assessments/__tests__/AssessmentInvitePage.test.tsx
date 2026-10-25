import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import { renderWithQueryClient } from "@/test/renderWithQueryClient";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

const getMock = assessmentsApi.get as ReturnType<typeof vi.fn>;
const getSessionsMock = assessmentsApi.getSessions as ReturnType<typeof vi.fn>;
const createSessionMock = assessmentsApi.createSession as ReturnType<typeof vi.fn>;

const assessmentPayload = {
  id: 42,
  name: "Frontend Engineer Assessment",
  time_limit_min: 45,
  skills: [],
};

beforeEach(() => {
  getMock.mockReset();
  getSessionsMock.mockReset();
  createSessionMock.mockReset();

  getMock.mockResolvedValue({ data: { assessment: assessmentPayload } });
  getSessionsMock.mockResolvedValue({ data: { sessions: [] } });
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/assessments/42/invite"]}>
      <Routes>
        <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentInvitePage — F-26 & NEW-F-01", () => {
  it("shows a load-failure banner with retry instead of a silent catch", async () => {
    getMock.mockRejectedValue({
      response: { status: 500, data: { error: { code: "internal_error", message: "Server exploded" } } },
    });

    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load this assessment/i)).toBeInTheDocument();

    // Retry re-fetches and recovers the page.
    getMock.mockResolvedValue({ data: { assessment: assessmentPayload } });
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Frontend Engineer Assessment")).toBeInTheDocument();
  });

  it("NEW-F-01: keeps the dialog open and shows an inline error when creation fails", async () => {
    createSessionMock.mockRejectedValue({
      response: { status: 500, data: { error: { code: "internal_error", message: "Server exploded" } } },
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Frontend Engineer Assessment");

    await user.click(screen.getByRole("button", { name: /invite candidate/i }));
    await user.type(screen.getByLabelText(/candidate name/i), "Budi Santoso");
    await user.click(screen.getByRole("button", { name: /create link/i }));

    // Dialog stays open with an inline error — no silent close (NEW-F-01).
    const dialog = await screen.findByRole("dialog");
    expect(await screen.findByText(/couldn't create the invite/i)).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(createSessionMock).toHaveBeenCalledWith(42, "Budi Santoso");
  });

  it("closes the dialog and shows the new invite link on success", async () => {
    createSessionMock.mockResolvedValue({
      data: {
        session: {
          id: 7,
          invite_url: "https://invite.test/abc",
          candidate_name: "Budi Santoso",
          status: "pending",
        },
      },
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Frontend Engineer Assessment");

    await user.click(screen.getByRole("button", { name: /invite candidate/i }));
    await user.type(screen.getByLabelText(/candidate name/i), "Budi Santoso");
    await user.click(screen.getByRole("button", { name: /create link/i }));

    expect(await screen.findByText("https://invite.test/abc")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("RHF: blocks submit with a field error for whitespace-only names (dialog stays open)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Frontend Engineer Assessment");

    await user.click(screen.getByRole("button", { name: /invite candidate/i }));
    await user.type(screen.getByLabelText(/candidate name/i), "   ");
    await user.click(screen.getByRole("button", { name: /create link/i }));

    expect(await screen.findByText("Candidate name can't be only spaces.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("RHF: empty name is allowed (optional) and submits undefined", async () => {
    createSessionMock.mockResolvedValue({
      data: {
        session: { id: 8, invite_url: "https://invite.test/xyz", candidate_name: null, status: "pending" },
      },
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Frontend Engineer Assessment");

    await user.click(screen.getByRole("button", { name: /invite candidate/i }));
    await user.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith(42, undefined);
    });
    expect(await screen.findByText("https://invite.test/xyz")).toBeInTheDocument();
  });
});
