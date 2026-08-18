import { mutationOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { LoginResponse, LoginValues } from "../schemas/auth";

export const authMutations = {
  all: () => ["auth"] as const,
  login: () =>
    mutationOptions({
      mutationKey: [...authMutations.all(), "login"],
      mutationFn: async (payload: LoginValues) => {
        return await apiClient.post<LoginResponse>("/auth/login", payload);
      },
    }),
};
