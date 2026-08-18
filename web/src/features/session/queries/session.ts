import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { CoverageMap, SessionDetail, TranscriptResponse } from "../schemas/session";

export const sessionQueries = {
  all: () => ["session"] as const,
  detailKey: (id: number) => [...sessionQueries.all(), "detail", id] as const,
  detail: (id: number) =>
    queryOptions({
      queryKey: sessionQueries.detailKey(id),
      queryFn: async ({ signal }) =>
        await apiClient.get<{ session: SessionDetail }>(`/sessions/${id}`, {
          signal,
        }),
    }),
  coverageKey: (id: number) => [...sessionQueries.all(), "coverage", id] as const,
  coverage: (id: number) =>
    queryOptions({
      queryKey: sessionQueries.coverageKey(id),
      queryFn: async ({ signal }) =>
        await apiClient.get<CoverageMap>(`/sessions/${id}/coverage`, {
          signal,
        }),
    }),
  transcriptKey: (id: number, fromTurn: number) =>
    [...sessionQueries.all(), "transcript", id, fromTurn] as const,
  transcript: (id: number, fromTurn: number) =>
    queryOptions({
      queryKey: sessionQueries.transcriptKey(id, fromTurn),
      queryFn: async ({ signal }) =>
        await apiClient.get<TranscriptResponse>(`/sessions/${id}/transcript`, {
          searchParams: fromTurn > 1 ? { from_turn: fromTurn } : undefined,
          signal,
        }),
    }),
};
