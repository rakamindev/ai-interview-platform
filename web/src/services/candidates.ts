import api from "./api";
import type { Candidate, PaginationMeta } from "@/types";

export const candidatesApi = {
  list: (page = 1, q?: string) =>
    api.get<{ candidates: Candidate[]; meta: PaginationMeta }>("/candidates", {
      params: { page, ...(q ? { q } : {}) },
    }),

  get: (id: number) =>
    api.get<{ candidate: Candidate }>(`/candidates/${id}`),
};
