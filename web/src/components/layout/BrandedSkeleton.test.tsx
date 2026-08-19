import { describe, it, expect } from "vite-plus/test";
import { screen, cleanup } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import BrandedSkeleton from "./BrandedSkeleton";

describe("BrandedSkeleton (route-aware)", () => {
  it("renders the auth silhouette on auth routes, without assessor nav", () => {
    for (const path of ["/login", "/signup", "/access-denied"]) {
      cleanup();
      renderWithProviders(<BrandedSkeleton />, { route: path });
      expect(screen.getByTestId("branded-skeleton-auth")).toBeInTheDocument();
      expect(screen.queryByTestId("branded-skeleton-assessor")).not.toBeInTheDocument();
      expect(screen.queryByTestId("assessor-nav")).not.toBeInTheDocument();
    }
  });

  it("renders the interview silhouette on the interview route, without assessor nav", () => {
    renderWithProviders(<BrandedSkeleton />, { route: "/interview/abc" });
    expect(screen.getByTestId("branded-skeleton-interview")).toBeInTheDocument();
    expect(screen.queryByTestId("branded-skeleton-assessor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("assessor-nav")).not.toBeInTheDocument();
  });

  it("renders the assessor silhouette (with nav) on authorized routes", () => {
    renderWithProviders(<BrandedSkeleton />, { route: "/assessments" });
    expect(screen.getByTestId("branded-skeleton-assessor")).toBeInTheDocument();
    expect(screen.getByTestId("assessor-nav")).toBeInTheDocument();
  });

  it("falls back to the assessor silhouette for unmatched routes", () => {
    renderWithProviders(<BrandedSkeleton />, { route: "/totally-unknown" });
    expect(screen.getByTestId("branded-skeleton-assessor")).toBeInTheDocument();
  });
});
