import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FitGapReportPage from "@/pages/fitgap/FitGapReportPage";

const { sessionsApi, portfoliosApi } = vi.hoisted(() => ({
  sessionsApi: { getPortfolio: vi.fn() },
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "1", sessionId: "2", vacancyId: "3" }),
  // Router Link renders an anchor with href; keep that so role queries work.
  Link: ({ children, to, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/services/sessions", () => ({ sessionsApi }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi }));
vi.mock("@/hooks/usePolling", () => ({ usePolling: () => undefined }));

const portfolio = {
  id: 9,
  session_id: 2,
  generation_status: "complete",
  skills: [
    {
      id: 1,
      skill_label: "Communication",
      is_discovered: false,
      ai_level: 2,
      ai_confidence: "medium",
      evidence: ["Saya biasa menjelaskan trade-off teknis ke tim non-teknis."],
      competency_summary: "",
    },
    {
      id: 2,
      skill_label: "Incident Response",
      is_discovered: true,
      ai_level: 3,
      ai_confidence: "low",
      evidence: [],
      competency_summary: "",
    },
  ],
  overrides: [],
};

const report = {
  id: 5,
  portfolio_id: 9,
  vacancy_id: 3,
  skill_comparisons: [
    { skill_label: "Communication", expected_level: 3, candidate_level: 2, result: "gap", delta: -1 },
    { skill_label: "Micro-frontends", expected_level: 2, result: "not_assessed" },
  ],
  culture_narrative: "Works well with product counterparts.",
  overall_narrative: "",
  generated_at: "2026-08-14T10:00:00Z",
};

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a skeleton that mirrors the layout while loading", async () => {
    sessionsApi.getPortfolio.mockReturnValue(new Promise(() => {}));

    render(<FitGapReportPage />);

    expect(screen.getByTestId("report-skeleton")).toBeInTheDocument();
  });

  it("renders the comparison with candidate evidence attached", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({ data: { portfolio } });
    portfoliosApi.getFitGap.mockResolvedValue({ data: { report } });

    render(<FitGapReportPage />);

    expect(await screen.findByText("Communication")).toBeInTheDocument();
    expect(
      screen.getByText(/Saya biasa menjelaskan trade-off teknis/),
    ).toBeInTheDocument();
    expect(screen.getByText("Works well with product counterparts.")).toBeInTheDocument();
  });

  it("says plainly when skills were never covered, and does not call them weaknesses", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({ data: { portfolio } });
    portfoliosApi.getFitGap.mockResolvedValue({ data: { report } });

    render(<FitGapReportPage />);

    expect(await screen.findByText(/never covered by the interview/i)).toBeInTheDocument();
    expect(screen.getByText(/unknown, not weaknesses/i)).toBeInTheDocument();
  });

  it("keeps the comparison visible while the narrative is still generating", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({ data: { portfolio } });
    portfoliosApi.getFitGap.mockResolvedValue({
      data: { report: { ...report, culture_narrative: "", overall_narrative: "" } },
    });

    render(<FitGapReportPage />);

    expect(await screen.findByText("Communication")).toBeInTheDocument();
    expect(screen.getByTestId("narrative-pending")).toBeInTheDocument();
    expect(screen.getByText(/written summary is still being generated/i)).toBeInTheDocument();
  });

  it("explains a failed report and offers a retry, without leaking provider errors", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({ data: { portfolio } });
    portfoliosApi.getFitGap.mockRejectedValue({
      response: { status: 500, data: { error: "Gemini API returned 400" } },
    });

    render(<FitGapReportPage />);

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/interview and its transcript are unaffected/i)).toBeInTheDocument();
    expect(screen.queryByText(/Gemini/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => expect(sessionsApi.getPortfolio).toHaveBeenCalledTimes(2));
  });

  it("offers a way forward when there is no portfolio to compare", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({ data: {} });

    render(<FitGapReportPage />);

    expect(await screen.findByText(/No skill portfolio yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open portfolio/i })).toBeInTheDocument();
  });

  it("lists skills the interview discovered outside the role's requirements", async () => {
    sessionsApi.getPortfolio.mockResolvedValue({ data: { portfolio } });
    portfoliosApi.getFitGap.mockResolvedValue({ data: { report } });

    render(<FitGapReportPage />);

    expect(await screen.findByText("Incident Response")).toBeInTheDocument();
    expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
  });
});
