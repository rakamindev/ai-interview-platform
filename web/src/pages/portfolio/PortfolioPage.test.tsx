import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { server } from "@/test/server";
import { renderWithRouter } from "@/test/utils";
import PortfolioPage from "./PortfolioPage";

const ROUTE = "/assessments/1/sessions/5/portfolio";

describe("PortfolioPage", () => {
  it("renders a completed portfolio with candidate name, skills and evidence", async () => {
    renderWithRouter(<PortfolioPage />, ROUTE);

    await waitFor(() =>
      expect(screen.getByText("Portfolio Results")).toBeInTheDocument()
    );
    expect(screen.getByText("Dewi Lestari")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer Assessment")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText(/complex state machine/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run Fit\/Gap/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PDF/i })).toBeInTheDocument();
  });

  it("shows the generating state while the portfolio is being built", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id/portfolio", () =>
        HttpResponse.json({ status: "generating" }, { status: 202 })
      )
    );

    renderWithRouter(<PortfolioPage />, ROUTE);

    await waitFor(() =>
      expect(screen.getByText("Generating portfolio...")).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /PDF/i })).not.toBeInTheDocument();
  });

  it("shows an error state (not a blank page) when the session cannot be loaded", async () => {
    server.use(
      http.get("*/api/v1/sessions/:id", () => HttpResponse.json(null, { status: 404 }))
    );

    renderWithRouter(<PortfolioPage />, ROUTE);

    await waitFor(() =>
      expect(screen.getByText(/could not load this portfolio/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});