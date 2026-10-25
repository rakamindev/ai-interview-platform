import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFitGapQuery } from "./useFitGapQuery";
import { portfoliosApi } from "../services/portfolios";

vi.mock("../services/portfolios", () => ({
  portfoliosApi: {
    getFitGap: vi.fn(),
    triggerFitGap: vi.fn(),
    regenerateFitGap: vi.fn(),
  },
}));

describe("TanStack Query: useFitGapQuery", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 60000 },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("returns cached/existing fit-gap report when getFitGap succeeds", async () => {
    const mockReport = {
      id: 1,
      portfolio_id: 10,
      vacancy_id: 20,
      skill_comparisons: [],
      culture_narrative: "Strong alignment.",
      overall_narrative: "Recommended.",
      generated_at: new Date().toISOString(),
    };

    vi.mocked(portfoliosApi.getFitGap).mockResolvedValueOnce({
      data: { report: mockReport },
    } as any);

    const { result } = renderHook(() => useFitGapQuery(10, 20), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.report?.id).toBe(1);
    expect(result.current.data?.status).toBe("complete");
  });

  it("propagates 404 error when vacancy is not found or belongs to another tenant", async () => {
    const notFoundError = {
      response: {
        status: 404,
        data: { errors: [{ status: 404, message: "Vacancy not found" }] },
      },
    };

    vi.mocked(portfoliosApi.getFitGap).mockRejectedValueOnce(notFoundError);
    vi.mocked(portfoliosApi.triggerFitGap).mockRejectedValueOnce(notFoundError);

    const { result } = renderHook(() => useFitGapQuery(10, 999), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(portfoliosApi.triggerFitGap).toHaveBeenCalledWith(10, 999);
  });
});
