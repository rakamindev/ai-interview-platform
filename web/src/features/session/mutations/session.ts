import { mutationOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { Session } from "../schemas/session";

export const sessionMutations = {
  all: () => ["session"] as const,
  endSession: (id: number) =>
    mutationOptions({
      mutationKey: [...sessionMutations.all(), "end-session", id] as const,
      mutationFn: async () => {
        return await apiClient.post<{ session: Session }>(`/sessions/${id}/end_session`, {
          session: { reason: "manual_assessor" },
        });
      },
    }),
};
