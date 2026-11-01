import axios from "axios";

interface ApiErrorResponse {
  errors?: Array<{ message?: string }>;
}

export const NETWORK_ERROR_MESSAGE =
  "Can't reach the server. Check your internet connection and try again.";

export const FORBIDDEN_MESSAGE =
  "You don't have permission to do this. Contact your administrator if you need access.";

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;
  // No response means the request never completed (offline, DNS, CORS, or timeout).
  if (!error.response) return NETWORK_ERROR_MESSAGE;
  if (error.response.status === 403) return FORBIDDEN_MESSAGE;

  return error.response.data?.errors?.[0]?.message ?? fallback;
}

export function getApiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}
