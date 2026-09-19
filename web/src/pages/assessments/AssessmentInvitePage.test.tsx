import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AssessmentInvitePage from "./AssessmentInvitePage";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

import { assessmentsApi } from "@/services/assessments";

const assessment = {
  id: 2,
  name: "Backend Developer",
  time_limit_min: 30,
  skills: [
    { id: 1, skill_label: "Python", expected_level: 3 },
  ],
};

const session = {
  id: 5,
  status: "pending",
  candidate_name: "Budi Santoso",
  invite_url: "http://example.test/invite/abc",
  started_at: null,
  end_reason: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/2/invite"]}>
      <Routes>
        <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

function mockSuccessLoad(sessions: typeof session[] = [session]) {
  vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment } } as any);
  vi.mocked(assessmentsApi.getSessions).mockResolvedValue({ data: { sessions } } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AssessmentInvitePage", () => {
  it("shows a load error banner instead of the 'No candidates yet' empty state", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValue({ data: { assessment } } as any);
    vi.mocked(assessmentsApi.getSessions).mockRejectedValue(new Error("boom"));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("We couldn't load this assessment. Please try again.")).toBeInTheDocument()
    );
    expect(screen.queryByText("No candidates yet")).not.toBeInTheDocument();
  });

  it("renders the 404 page when the assessment is not found", async () => {
    vi.mocked(assessmentsApi.get).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(assessmentsApi.getSessions).mockRejectedValue({ response: { status: 404 } });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("The page you're looking for doesn't exist.")).toBeInTheDocument()
    );
    expect(screen.queryByText("Invite Candidate")).not.toBeInTheDocument();
  });

  it("shows the 'No candidates yet' empty state when the load succeeds with zero sessions", async () => {
    mockSuccessLoad([]);

    renderPage();

    await waitFor(() => expect(screen.getByText("No candidates yet")).toBeInTheDocument());
  });

  it("keeps the invite dialog open with an error when invite creation fails", async () => {
    mockSuccessLoad();
    vi.mocked(assessmentsApi.createSession).mockRejectedValue(new Error("boom"));

    renderPage();

    await waitFor(() => expect(screen.getByText("Backend Developer")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /invite candidate/i }));

    fireEvent.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() =>
      expect(screen.getByText("Could not create the invite link. Please try again.")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /create link/i })).toBeInTheDocument();
  });
});