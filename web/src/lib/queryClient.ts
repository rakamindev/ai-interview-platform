import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes: cached data remains fresh, avoiding redundant API calls
      gcTime: 1000 * 60 * 15,   // 15 minutes: inactive cache persists in memory for instant tab/page switching
      refetchOnWindowFocus: false, // Prevents sudden UI flicker during recruiter interviews
      refetchOnReconnect: false,   // Uses cached data instead of triggering heavy network spikes on reconnect
      retry: (failureCount, error: any) => {
        // Do not retry client 4xx errors (e.g. 404 Not Found, 401 Unauthorized, 422 Unprocessable)
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
