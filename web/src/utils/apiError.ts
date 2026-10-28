// Turns an axios error into the few cases the UI explains differently.
// Server messages are never shown, so nothing about other tenants leaks.
export type ApiErrorKind =
  | "not_found"
  | "server"
  | "network"
  | "vacancy_has_no_skills"
  | "portfolio_not_ready";

export interface ApiErrorInfo {
  kind: ApiErrorKind;
  generationStatus?: string;
}

interface ErrorShape {
  response?: {
    status?: number;
    data?: { code?: string; generation_status?: string; errors?: { message?: string; code?: string }[] };
  };
}

export function classifyApiError(error: unknown): ApiErrorInfo {
  const response = (error as ErrorShape | null)?.response;
  if (!response) return { kind: "network" };

  const code = response.data?.code;
  if (code === "vacancy_has_no_skills") return { kind: "vacancy_has_no_skills" };
  if (code === "portfolio_not_ready") {
    return { kind: "portfolio_not_ready", generationStatus: response.data?.generation_status };
  }
  if (response.status === 404) return { kind: "not_found" };
  return { kind: "server" };
}

// The safe message the API returns for a validation error (422), if any.
export function validationMessage(error: unknown): string | null {
  const response = (error as ErrorShape | null)?.response;
  if (response?.status !== 422) return null;
  return response.data?.errors?.[0]?.message ?? null;
}

export function isConflict(error: unknown): boolean {
  return (error as ErrorShape | null)?.response?.status === 409;
}
