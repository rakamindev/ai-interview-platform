import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { server } from "@/test/server";
import { renderWithRouter } from "@/test/utils";
import FitGapReportPage from "./FitGapReportPage";

const ROUTE = "/assessments/1/sessions/5/fitgap/7";

describe("FitGapReportPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a ready fit/gap report", async () => {
    renderWithRouter(<FitGapReportPage />, ROUTE);

    await waitFor(() =>
      expect(screen.getByText("Skill Comparison")).toBeInTheDocument()
    );
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Strong cultural alignment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Regenerate/i })).toBeInTheDocument();
  });

  it("shows a waiting state when the portfolio itself is still generating", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id/portfolio", () =>
        HttpResponse.json({ status: "generating" }, { status: 202 })
      )
    );

    renderWithRouter(<FitGapReportPage />, ROUTE);

    await waitFor(() =>
      expect(screen.getByText(/portfolio is still generating/i)).toBeInTheDocument()
    );
  });

  it("queues fit/gap generation exactly once while the report is generating", async () => {
    let triggerCount = 0;
    server.use(
      http.get("*/api/v1/portfolios/:pid/fitgap/:vid", () =>
        HttpResponse.json(null, { status: 404 })
      ),
      http.post("*/api/v1/portfolios/:pid/fitgap", () => {
        triggerCount += 1;
        return HttpResponse.json(
          { status: "generating", message: "queued" },
          { status: 202 }
        );
      })
    );

    vi.useFakeTimers();
    renderWithRouter(<FitGapReportPage />, ROUTE);

    await act(async () => {});
    await act(async () => {});

    expect(screen.getByText("Generating fit/gap report...")).toBeInTheDocument();
    expect(triggerCount).toBe(1);

    vi.advanceTimersByTime(5000);
    await act(async () => {});
    vi.advanceTimersByTime(5000);
    await act(async () => {});

    expect(triggerCount).toBe(1);
  });
});