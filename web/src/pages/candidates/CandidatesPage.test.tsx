import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidatesPage from "@/pages/candidates/CandidatesPage";

const { sessionsApi } = vi.hoisted(() => ({
  sessionsApi: { listCandidates: vi.fn() },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/services/sessions", () => ({ sessionsApi }));

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  assessment_id: 9,
  candidate_name: "Rani Prameswari",
  status: "ended",
  end_reason: "all_covered",
  portfolio_status: "complete",
  ended_at: new Date().toISOString(),
  assessment: { id: 9, name: "Backend Engineer" },
  ...over,
});

const respond = (rows: unknown[]) =>
  sessionsApi.listCandidates.mockResolvedValue({ data: { sessions: rows } });

beforeEach(() => {
  vi.clearAllMocks();
  respond([]);
});

describe("CandidatesPage", () => {
  it("leads with how many people are waiting on a decision", async () => {
    respond([
      row({ id: 1 }),
      row({ id: 2, portfolio_status: "complete" }),
      row({ id: 3, status: "active", end_reason: null, portfolio_status: null }),
    ]);

    render(<CandidatesPage />);

    const summary = await screen.findByTestId("candidates-summary");
    expect(summary).toHaveTextContent(/2\s*ready to review/);
    expect(summary).toHaveTextContent(/1\s*in progress/);
    expect(summary).toHaveTextContent("3 total");
  });

  it("counts a finished interview without a report as not yet reviewable", async () => {
    // The interview ended but the AI has not produced anything, so nobody can
    // make a decision yet. Counting it as ready would send someone to an
    // empty screen.
    respond([row({ portfolio_status: "generating" })]);

    const summary = (render(<CandidatesPage />), await screen.findByTestId("candidates-summary"));
    expect(summary).toHaveTextContent(/0\s*ready to review/);
    expect(screen.getByText("Building report")).toBeInTheDocument();
  });

  it("surfaces a failed interview instead of hiding it among the finished", async () => {
    respond([row({ end_reason: "error", portfolio_status: null })]);

    render(<CandidatesPage />);

    const summary = await screen.findByTestId("candidates-summary");
    expect(summary).toHaveTextContent(/1\s*interview broke before finishing/);
    // Scoped to the row: the filter chip carries a similar word on purpose.
    const candidateRow = screen.getByTestId("candidate-row");
    expect(within(candidateRow).getByText("Interview error")).toBeInTheDocument();
    // A failed session still has a transcript, and it is the one worth reading.
    expect(screen.getByRole("link", { name: /transcript/i })).toBeInTheDocument();
  });

  it("names the assessment on every row so the list reads on its own", async () => {
    respond([row()]);

    render(<CandidatesPage />);

    const candidateRow = await screen.findByTestId("candidate-row");
    expect(within(candidateRow).getByText("Rani Prameswari")).toBeInTheDocument();
    expect(within(candidateRow).getByText("Backend Engineer")).toBeInTheDocument();
  });

  it("offers Monitor while an interview is running", async () => {
    respond([row({ status: "active", end_reason: null, portfolio_status: null })]);

    render(<CandidatesPage />);

    expect(await screen.findByRole("link", { name: /monitor/i })).toBeInTheDocument();
  });

  it("filters down to the people ready to review", async () => {
    respond([
      row({ id: 1, candidate_name: "Rani Prameswari" }),
      row({ id: 2, candidate_name: "Bagas Nurhadi", status: "active", end_reason: null, portfolio_status: null }),
    ]);

    render(<CandidatesPage />);
    await screen.findByTestId("candidates-summary");

    await userEvent.click(screen.getByRole("button", { name: "Ready to review" }));

    expect(screen.getByText("Rani Prameswari")).toBeInTheDocument();
    expect(screen.queryByText("Bagas Nurhadi")).toBeNull();
  });

  it("takes a reviewed candidate out of the queue", async () => {
    // A queue nobody can clear stops carrying information: after fifty
    // candidates "ready to review" would just mean "everyone who finished".
    respond([
      row({ id: 1, candidate_name: "Rani Prameswari" }),
      row({ id: 2, candidate_name: "Bagas Nurhadi", reviewed_at: new Date().toISOString() }),
    ]);

    render(<CandidatesPage />);

    const summary = await screen.findByTestId("candidates-summary");
    expect(summary).toHaveTextContent(/1\s*ready to review/);

    await userEvent.click(screen.getByRole("button", { name: "Reviewed" }));
    expect(screen.getByText("Bagas Nurhadi")).toBeInTheDocument();
    expect(screen.queryByText("Rani Prameswari")).toBeNull();
  });

  it("keeps a finished interview with no report out of both queues", async () => {
    respond([row({ portfolio_status: "failed" })]);

    render(<CandidatesPage />);

    const summary = await screen.findByTestId("candidates-summary");
    expect(summary).toHaveTextContent(/0\s*ready to review/);
    const candidateRow = screen.getByTestId("candidate-row");
    expect(within(candidateRow).getByText("No report")).toBeInTheDocument();
  });

  it("says the load failed rather than showing an empty list", async () => {
    sessionsApi.listCandidates.mockRejectedValue(new Error("network"));

    render(<CandidatesPage />);

    expect(await screen.findByTestId("candidates-failed")).toBeInTheDocument();
    expect(screen.queryByTestId("candidates-empty")).toBeNull();
  });

  it("explains what to do when nobody has been invited yet", async () => {
    render(<CandidatesPage />);

    expect(await screen.findByTestId("candidates-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("candidates-failed")).toBeNull();
  });
});
