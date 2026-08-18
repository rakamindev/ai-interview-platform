import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { MeResponse } from "../schemas/auth";

export const authQueries = {
  all: () => ["auth"] as const,
  meKey: () => [...authQueries.all(), "me"] as const,
  me: () =>
    queryOptions({
      queryKey: authQueries.meKey(),
      queryFn: async ({ signal }) =>
        await apiClient.get<MeResponse>("/auth/me", {
          signal,
        }),
    }),
};
