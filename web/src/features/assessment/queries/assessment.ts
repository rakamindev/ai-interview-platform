import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { AssessmentDetail, AssessmentList, AssessmentSearch, SessionList } from "../schemas/assessment";

export const assessmentQueries = {
  all: () => ["assessment"] as const,
  listKey: (filters?: AssessmentSearch) => [...assessmentQueries.all(), "list", filters] as const,
  list: (filters: AssessmentSearch) =>
    queryOptions({
      queryKey: assessmentQueries.listKey(filters),
      queryFn: async ({ signal }) =>
        await apiClient.get<AssessmentList>("/assessments", {
          searchParams: filters,
          signal,
        }),
    }),
  detailKey: (id: number) => [...assessmentQueries.all(), "detail", id] as const,
  detail: (id: number) =>
    queryOptions({
      queryKey: assessmentQueries.detailKey(id),
      queryFn: async ({ signal }) =>
        await apiClient.get<{ assessment: AssessmentDetail }>(`/assessments/${id}`, {
          signal,
        }),
    }),
  sessionsKey: (id: number) => [...assessmentQueries.all(), "sessions", id] as const,
  sessions: (id: number) =>
    queryOptions({
      queryKey: assessmentQueries.sessionsKey(id),
      queryFn: async ({ signal }) =>
        await apiClient.get<SessionList>(`/assessments/${id}/sessions`, {
          signal,
        }),
    }),
};
