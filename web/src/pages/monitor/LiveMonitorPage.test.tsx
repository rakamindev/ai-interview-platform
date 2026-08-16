import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";

const { sessionsApi, coverage } = vi.hoisted(() => ({
  sessionsApi: { get: vi.fn(), getTranscript: vi.fn(), endSession: vi.fn() },
  coverage: { value: null as any },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "1", sessionId: "2" }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/services/sessions", () => ({ sessionsApi }));
vi.mock("@/hooks/useCoverageWebSocket", () => ({
  useCoverageWebSocket: () => ({
    coverageMap: coverage.value,
    sessionEnded: false,
    sessionEndReason: null,
    isConnected: true,
  }),
}));

const skill = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  skill_id: 1,
  skill_label: "Communication",
  is_discovered: false,
  state: "covered",
  probe_count: 3,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionsApi.get.mockResolvedValue({
    data: { session: { started_at: new Date().toISOString(), status: "active", assessment: { name: "Backend Engineer" } } },
  });
  sessionsApi.getTranscript.mockResolvedValue({ data: { turns: [] } });
  coverage.value = null;
});

describe("LiveMonitorPage coverage panel", () => {
  it("leads with the number of skills nobody has asked about yet", async () => {
    coverage.value = {
      skills: [
        skill({ id: 1, skill_label: "Communication", state: "covered" }),
        skill({ id: 2, skill_label: "System design", state: "not_yet", probe_count: 0 }),
        skill({ id: 3, skill_label: "Debugging", state: "not_yet", probe_count: 0 }),
      ],
      discovered: [],
    };

    render(<LiveMonitorPage />);

    const summary = await screen.findByTestId("coverage-summary");
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent(/of 3 skills not probed yet/);
    // While the interview is still running an unprobed skill is a prompt to
    // act, so it carries the attention accent rather than being silent.
    expect(summary.querySelector(".text-attention")).not.toBeNull();
    expect(summary).toHaveTextContent("1/3 covered");
  });

  it("says so plainly once every skill has been touched", async () => {
    coverage.value = {
      skills: [skill({ id: 1, state: "partial" }), skill({ id: 2, skill_label: "Testing", state: "covered" })],
      discovered: [],
    };

    render(<LiveMonitorPage />);

    const summary = await screen.findByTestId("coverage-summary");
    expect(summary).toHaveTextContent("Every skill has been probed at least once.");
    expect(summary.querySelector(".text-attention")).toBeNull();
  });

  it("counts discovered skills in the same tally as configured ones", async () => {
    coverage.value = {
      skills: [skill({ id: 1, state: "covered" })],
      discovered: [
        skill({ id: 2, skill_label: "Mentoring", is_discovered: true, state: "not_yet", probe_count: 0 }),
      ],
    };

    render(<LiveMonitorPage />);

    const summary = await screen.findByTestId("coverage-summary");
    expect(summary).toHaveTextContent(/1[\s\S]*of 2 skills not probed yet/);
  });

  it("names the candidate rather than calling them 'You' on an observer screen", async () => {
    sessionsApi.getTranscript.mockResolvedValue({
      data: {
        turns: [
          { id: 1, turn_number: 1, speaker: "candidate", text: "I led the migration.", created_at: "" },
        ],
      },
    });
    coverage.value = { skills: [skill()], discovered: [] };

    render(<LiveMonitorPage />);

    await waitFor(() => expect(screen.getByText("Candidate")).toBeInTheDocument());
    expect(screen.queryByText("You")).toBeNull();
    // Verbatim speech is quoted material and carries the serif everywhere.
    const quote = screen.getByText("I led the migration.");
    expect(quote.className).toContain("font-serif");
  });

  it("draws an unprobed skill dashed instead of as a zeroed bar", async () => {
    coverage.value = {
      skills: [skill({ id: 1, skill_label: "System design", state: "not_yet", probe_count: 0 })],
      discovered: [],
    };

    render(<LiveMonitorPage />);

    const track = await screen.findByRole("img", { name: "Not probed" });
    expect(track.querySelectorAll(".border-dashed")).toHaveLength(3);
    expect(track.querySelector(".bg-ok")).toBeNull();
  });
});
