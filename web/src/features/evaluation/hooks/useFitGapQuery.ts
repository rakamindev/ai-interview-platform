import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portfoliosApi } from "../services/portfolios";
import { queryKeys } from "@/lib/queryKeys";
import type { FitGapReport } from "@/types";

export interface FitGapApiResponse {
  report?: FitGapReport;
  status?: string;
  message?: string;
}

export function useFitGapQuery(
  portfolioId: number | string | undefined,
  vacancyId: number | string | undefined
) {
  const pId = Number(portfolioId);
  const vId = Number(vacancyId);

  return useQuery({
    queryKey: queryKeys.fitgap.detail(pId, vId),
    queryFn: async (): Promise<FitGapApiResponse> => {
      try {
        const res = await portfoliosApi.getFitGap(pId, vId);
        return { report: res.data.report, status: "complete" };
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 202) {
          // Trigger generation if not found or accepted; allow 404/422 errors (e.g. invalid/cross-tenant vacancy) to propagate
          const triggerRes = await portfoliosApi.triggerFitGap(pId, vId);
          if (triggerRes?.data && "report" in triggerRes.data) {
            return { report: triggerRes.data.report, status: "complete" };
          }
          return { status: "generating" };
        }
        throw err;
      }
    },
    enabled: !isNaN(pId) && pId > 0 && !isNaN(vId) && vId > 0,
    refetchInterval: (query) => {
      if (query.state.status === "error") {
        return false;
      }
      const data = query.state.data;
      if (data?.status === "generating") {
        return 3000;
      }
      return false;
    },
  });
}

export function useRegenerateFitGapMutation(
  portfolioId: number | string | undefined,
  vacancyId: number | string | undefined
) {
  const queryClient = useQueryClient();
  const pId = Number(portfolioId);
  const vId = Number(vacancyId);

  return useMutation({
    mutationFn: async () => {
      const res = await portfoliosApi.regenerateFitGap(pId, vId);
      return res.data;
    },
    onSuccess: (data: any) => {
      if (data?.report) {
        queryClient.setQueryData(queryKeys.fitgap.detail(pId, vId), {
          report: data.report,
          status: "complete",
        });
      } else {
        queryClient.setQueryData(queryKeys.fitgap.detail(pId, vId), {
          status: "generating",
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.fitgap.detail(pId, vId) });
    },
  });
}
