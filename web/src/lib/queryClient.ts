import { QueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 1) return false;

  const status = (error as AxiosError | undefined)?.response?.status;
  return status === undefined || status >= 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
