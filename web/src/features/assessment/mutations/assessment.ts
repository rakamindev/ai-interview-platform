import { mutationOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { CreateAssessment, CreateSession, CreateSessionResponse } from "../schemas/assessment";

export const assessmentMutations = {
  all: () => ["assessment"] as const,
  create: () =>
    mutationOptions({
      mutationKey: [...assessmentMutations.all(), "create"],
      mutationFn: async (payload: CreateAssessment) => {
        return await apiClient.post("/assessments", payload);
      },
    }),
  update: (id: number) =>
    mutationOptions({
      mutationKey: [...assessmentMutations.all(), "update", id],
      mutationFn: async (payload: CreateAssessment) => {
        return await apiClient.put(`/assessments/${id}`, payload);
      },
    }),
  createSession: (assessmentId: number) =>
    mutationOptions({
      mutationKey: [...assessmentMutations.all(), "create-session", assessmentId],
      mutationFn: async (payload: CreateSession) => {
        return await apiClient.post<CreateSessionResponse>(`/assessments/${assessmentId}/sessions`, {
          session: payload,
        });
      },
    }),
  destroy: () =>
    mutationOptions({
      mutationKey: [...assessmentMutations.all(), "destroy"],
      mutationFn: async (id: number) => {
        return await apiClient.delete(`/assessments/${id}`);
      },
    }),
};
