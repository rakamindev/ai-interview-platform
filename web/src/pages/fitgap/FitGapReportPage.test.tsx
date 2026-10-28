import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage from "./FitGapReportPage";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";

// Polling dimatikan di tes. Satu putaran polling ditiru dengan memanggil fungsinya langsung.
const polling = vi.hoisted(() => ({
  fn: null as null | (() => void | Promise<void>),
}));

vi.mock("@/hooks/usePolling", () => ({
  usePolling: (fn: () => void | Promise<void>) => {
    polling.fn = fn;
  },
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getPortfolio: vi.fn() },
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

const portofolio = { id: 7, session_id: 2, skills: [], overrides: [] };

const laporan = {
  id: 1,
  portfolio_id: 7,
  vacancy_id: 4,
  skill_comparisons: [
    {
      skill_label: "Ruby on Rails",
      expected_level: 3,
      candidate_level: 3,
      result: "match",
      delta: 0,
      confidence: "high",
      is_override: false,
    },
  ],
  culture_narrative: "Narasi contoh untuk tes.",
  overall_narrative: "",
  generated_at: "2026-10-25T00:00:00Z",
};

function galat(status: number) {
  return { response: { status } };
}

function tampilkanHalaman() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/fitgap/4"]}>
      <Routes>
        <Route
          path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId"
          element={<FitGapReportPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("FitGapReportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    polling.fn = null;
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { portfolio: portofolio },
    } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("menampilkan pesan dan tombol coba lagi saat laporan gagal dimuat", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(galat(500));

    tampilkanHalaman();

    const peringatan = await screen.findByRole("alert");
    expect(peringatan.textContent).toMatch(/could not load the fit\/gap report/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("menampilkan pesan saat pembuatan laporan gagal dipicu", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(galat(404));
    vi.mocked(portfoliosApi.triggerFitGap).mockRejectedValue(galat(422));

    tampilkanHalaman();

    const peringatan = await screen.findByRole("alert");
    expect(peringatan.textContent).toMatch(/could not start generating/i);
  });

  it("menampilkan pesan saat portofolio kandidat gagal dimuat", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockRejectedValue(galat(500));

    tampilkanHalaman();

    const peringatan = await screen.findByRole("alert");
    expect(peringatan.textContent).toMatch(/could not load the candidate portfolio/i);
  });

  it("menjelaskan bahwa portofolio belum siap, bukan halaman kosong", async () => {
    vi.mocked(sessionsApi.getPortfolio).mockResolvedValue({
      data: { status: "generating" },
    } as never);

    tampilkanHalaman();

    const peringatan = await screen.findByRole("alert");
    expect(peringatan.textContent).toMatch(/portfolio is not ready/i);
  });

  it("tidak memicu pembuatan laporan lagi saat polling masih menunggu", async () => {
    vi.mocked(portfoliosApi.getFitGap).mockRejectedValue(galat(404));
    vi.mocked(portfoliosApi.triggerFitGap).mockResolvedValue({
      data: { status: "generating" },
    } as never);

    tampilkanHalaman();

    expect(await screen.findByText(/generating fit\/gap report/i)).toBeTruthy();
    expect(vi.mocked(portfoliosApi.triggerFitGap)).toHaveBeenCalledTimes(1);

    await act(async () => {
      await polling.fn?.();
      await polling.fn?.();
    });

    expect(vi.mocked(portfoliosApi.triggerFitGap)).toHaveBeenCalledTimes(1);
  });

  it("tidak memicu pembuatan ganda saat menunggu hasil regenerate", async () => {
    vi.mocked(portfoliosApi.getFitGap)
      .mockResolvedValueOnce({ data: { report: laporan } } as never)
      .mockRejectedValue(galat(404));
    vi.mocked(portfoliosApi.regenerateFitGap).mockResolvedValue({
      data: { status: "generating" },
    } as never);

    tampilkanHalaman();

    fireEvent.click(await screen.findByRole("button", { name: /regenerate/i }));
    expect(await screen.findByText(/generating fit\/gap report/i)).toBeTruthy();

    await act(async () => {
      await polling.fn?.();
    });

    expect(vi.mocked(portfoliosApi.triggerFitGap)).not.toHaveBeenCalled();
  });

  it("tombol coba lagi memuat ulang dan menampilkan laporan", async () => {
    vi.mocked(portfoliosApi.getFitGap)
      .mockRejectedValueOnce(galat(500))
      .mockResolvedValue({ data: { report: laporan } } as never);

    tampilkanHalaman();

    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Skill Comparison")).toBeTruthy();
    expect(screen.getByText("Narasi contoh untuk tes.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
