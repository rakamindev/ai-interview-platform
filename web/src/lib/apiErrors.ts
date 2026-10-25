import type { NormalizedApiError } from "@/types";

/**
 * F-26: single source of truth for turning any axios rejection into a
 * unified, user-presentable error. Handles every envelope the API has ever
 * produced so old payloads keep working while the backend migrates to the
 * canonical { error: { code, message } } shape.
 */
export function extractApiError(err: unknown): NormalizedApiError {
  const e = err as {
    response?: { status?: number; data?: unknown };
    message?: string;
  } | null;

  const status = e?.response?.status;
  const data = e?.response?.data as
    | { error?: { code?: string; message?: string } | string }
    | { errors?: Array<{ code?: string | number; status?: number | string; message?: string }> }
    | undefined;

  // Canonical envelope: { error: { code, message } }
  if (data && typeof data === "object" && "error" in data) {
    const errObj = (data as { error?: unknown }).error;
    if (errObj && typeof errObj === "object") {
      const { code, message } = errObj as { code?: string; message?: string };
      return {
        status,
        code: code || codeFromStatus(status),
        message: message || "Something went wrong. Please try again.",
      };
    }
    // Legacy 429 shape: { error: "Too many requests..." }
    if (typeof errObj === "string") {
      return {
        status,
        code: status === 429 ? "rate_limited" : codeFromStatus(status),
        message: errObj,
      };
    }
  }

  // Legacy envelope: { errors: [{ status?, code?, message }] }
  if (data && typeof data === "object" && "errors" in data) {
    const list = (data as { errors?: unknown[] }).errors;
    if (Array.isArray(list) && list.length > 0) {
      const first = list[0] as { code?: string | number; status?: number | string; message?: string };
      const errStatus = typeof first.status === "number" ? first.status : status;
      return {
        status: errStatus,
        code: first.code !== undefined ? String(first.code) : codeFromStatus(errStatus),
        message: first.message || "Something went wrong. Please try again.",
      };
    }
  }

  // Network-level failure (no HTTP response at all).
  if (!status) {
    return {
      code: "network_error",
      message: e?.message || "Unable to reach the server. Check your connection and try again.",
    };
  }

  return {
    status,
    code: codeFromStatus(status),
    message: "Something went wrong. Please try again.",
  };
}

/** Maps an HTTP status to the backend's error code vocabulary. */
export function codeFromStatus(status?: number): string {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation_failed";
    case 429:
      return "rate_limited";
    default:
      return "error";
  }
}