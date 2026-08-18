import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AssessmentInvitePage from "@/pages/assessments/AssessmentInvitePage";

const { assessmentsApi, navigate } = vi.hoisted(() => ({
  assessmentsApi: { get: vi.fn(), getSessions: vi.fn(), createSession: vi.fn() },
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "1" }),
  useNavigate: () => navigate,
  Link: ({ children, to, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/services/assessments", () => ({ assessmentsApi }));

const assessment = { id: 1, name: "Backend Engineer", time_limit_min: 45, skills: [] };

const session = (over: Record<string, unknown> = {}) => ({
  id: 7,
  status: "ended",
  end_reason: "all_covered",
  candidate_name: "Rani",
  invite_url: "http://localhost:5173/interview/abc",
  started_at: "2026-08-16T00:00:00Z",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  assessmentsApi.get.mockResolvedValue({ data: { assessment } });
  assessmentsApi.getSessions.mockResolvedValue({ data: { sessions: [] } });
});

describe("AssessmentInvitePage", () => {
  it("gives a failed session a way through to its transcript", async () => {
    // The transcript exists in the database either way; before this, a failed
    // session rendered no button at all and the assessor had nowhere to click.
    assessmentsApi.getSessions.mockResolvedValue({
      data: { sessions: [session({ end_reason: "error" })] },
    });

    render(<AssessmentInvitePage />);

    expect(await screen.findByRole("button", { name: /transcript/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^results$/i })).toBeNull();
  });

  it("keeps sending a completed session to its results", async () => {
    assessmentsApi.getSessions.mockResolvedValue({ data: { sessions: [session()] } });

    render(<AssessmentInvitePage />);

    expect(await screen.findByRole("button", { name: /^results$/i })).toBeInTheDocument();
  });

  it("says the load failed instead of showing an empty candidate list", async () => {
    // An empty list means nobody was invited. A failed request means we do not
    // know. Rendering the first for the second misinforms the assessor.
    assessmentsApi.getSessions.mockRejectedValue(new Error("network"));

    render(<AssessmentInvitePage />);

    expect(await screen.findByTestId("invite-load-failed")).toBeInTheDocument();
    expect(screen.queryByText(/no candidates yet/i)).toBeNull();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("names the candidate list without calling it an invite page", async () => {
    render(<AssessmentInvitePage />);

    const crumbs = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs).toHaveTextContent("Assessments");
    expect(crumbs).toHaveTextContent("Backend Engineer");
  });
});
